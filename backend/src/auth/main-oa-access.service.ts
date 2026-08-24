import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import type { AuthUser } from "./auth.guard";

@Injectable()
export class MainOaAccessService {
  constructor(private readonly prisma: PrismaService) {}
  assertAccess(user: AuthUser) { if (!user.permissions?.canAccessMainOa) throw new ForbiddenException("Main OA access is forbidden"); }
  assertManage(user: AuthUser) { if (!user.permissions?.canManageMainOa) throw new ForbiddenException("Main OA management is forbidden"); }
  async assertConversationAccess(user: AuthUser, conversationId: string) {
    this.assertAccess(user);
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, lineOfficialAccount: { accountType: "HEAD_OFFICE" } }, select: { id: true } });
    if (!conversation) throw new NotFoundException("Conversation not found");
  }
}
