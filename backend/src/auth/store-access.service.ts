import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import type { AuthUser } from "./auth.guard";

type StoreAccessScope = string[] | null;

@Injectable()
export class StoreAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private contextHasAllStores(user: AuthUser) {
    return user.role === UserRole.ADMIN || user.authorization?.scope.allStores === true || user.permissions?.canAccessAllStores === true;
  }

  async accessibleStoreIds(user: AuthUser): Promise<StoreAccessScope> {
    if (this.contextHasAllStores(user)) return null;

    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        isActive: true,
        status: true,
        canAccessAllStores: true,
        memberships: {
          select: {
            storeId: true,
            status: true,
            store: { select: { isActive: true, archivedAt: true } },
          },
        },
      },
    });

    if (!account || !account.isActive || account.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("User account is not active");
    }

    if (account.canAccessAllStores) return null;
    if (account.memberships.length === 0) throw new ForbiddenException("No active store membership");

    const storeIds = account.memberships
      .filter((membership) => membership.status === "ACTIVE" && membership.store.isActive && !membership.store.archivedAt)
      .map((membership) => membership.storeId);
    if (storeIds.length === 0) throw new ForbiddenException("No active store membership");
    return storeIds;
  }

  async canWriteAsStoreUser(user: AuthUser) {
    if (user.role === UserRole.ADMIN) return true;
    const canReply = user.authorization?.capabilities.reply ?? user.permissions?.canReply;
    if (canReply === false) return false;
    const scope = await this.accessibleStoreIds(user);
    if (canReply === true) return true;
    return scope !== null;
  }

  async assertStoreAccess(user: AuthUser, storeId: string) {
    const storeIds = await this.accessibleStoreIds(user);
    if (storeIds !== null && !storeIds.includes(storeId)) throw new ForbiddenException("Store access is forbidden");
  }

  async assertConversationAccess(user: AuthUser, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { storeId: true, lineOfficialAccount: { select: { accountType: true } } } });
    if (!conversation) throw new NotFoundException("Conversation not found");
    if (conversation.lineOfficialAccount?.accountType === "HEAD_OFFICE" || !conversation.storeId) throw new NotFoundException("Conversation not found");
    await this.assertStoreAccess(user, conversation.storeId);
    return conversation.storeId;
  }
}
