import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import type { AuthUser } from "./auth.guard";

type StoreAccessScope = string[] | null;

@Injectable()
export class StoreAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async accessibleStoreIds(user: AuthUser): Promise<StoreAccessScope> {
    if (user.role === UserRole.ADMIN) return null;

    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        isActive: true,
        status: true,
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

    if (account.memberships.length === 0) throw new ForbiddenException("No active store membership");

    const storeIds = account.memberships
      .filter((membership) => membership.status === "ACTIVE" && membership.store.isActive && !membership.store.archivedAt)
      .map((membership) => membership.storeId);
    if (storeIds.length === 0) throw new ForbiddenException("No active store membership");
    return storeIds;
  }

  async canWriteAsStoreUser(user: AuthUser) {
    if (user.role === UserRole.ADMIN) return true;
    return (await this.accessibleStoreIds(user)) !== null;
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
