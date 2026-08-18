import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { StoreAccessService } from "../auth/store-access.service";
import type { AuthUser } from "../auth/auth.guard";
import { calculatePriority } from "./priority-calculator";
import type { OperationalPriority, PriorityContext } from "./priority.types";

type StoreScope = string[] | null;

export const EMPTY_OPERATIONAL_PRIORITY: OperationalPriority = {
  level: "NONE",
  waitingSeconds: 0,
  waitingSince: null,
  reasons: [],
};

function toResponse(context: PriorityContext, now: Date): OperationalPriority {
  const calculated = calculatePriority(context, now);
  return {
    level: calculated.level,
    waitingSeconds: calculated.waitingSeconds,
    waitingSince: calculated.waitingSince?.toISOString() ?? null,
    reasons: calculated.reasons,
  };
}

@Injectable()
export class PriorityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  async forConversationIds(user: AuthUser, conversationIds: string[], scope?: StoreScope): Promise<Map<string, OperationalPriority>> {
    const ids = [...new Set(conversationIds)].filter((id) => id.length > 0);
    if (ids.length === 0) return new Map();

    // The caller may pass the scope already resolved by the list query to avoid
    // repeating the membership lookup. Direct callers are still authorized here.
    const accessibleStoreIds = scope === undefined
      ? await this.storeAccess.accessibleStoreIds(user)
      : scope;
    const rows = await this.prisma.conversation.findMany({
      where: {
        id: { in: ids },
        store: { isActive: true, archivedAt: null },
        ...(accessibleStoreIds === null ? {} : { storeId: { in: accessibleStoreIds } }),
      },
      select: {
        id: true,
        bmReplyStatus: true,
        isInstallment: true,
        products: {
          where: { source: "MANUAL" },
          select: { productModelId: true },
          take: 1,
        },
        messages: {
          select: { id: true, direction: true, sentAt: true, senderUserId: true },
          orderBy: [{ sentAt: "asc" }, { id: "asc" }],
        },
      },
    });
    const now = new Date();
    return new Map(rows.map((row) => [row.id, toResponse({
      bmReplyStatus: row.bmReplyStatus,
      isInstallment: row.isInstallment,
      hasManualProductTag: row.products.length > 0,
      messages: row.messages,
    }, now)]));
  }

  async forConversation(user: AuthUser, conversationId: string): Promise<OperationalPriority> {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    const result = await this.forConversationIds(user, [conversationId]);
    const priority = result.get(conversationId);
    if (!priority) throw new NotFoundException("Conversation not found");
    return priority;
  }
}
