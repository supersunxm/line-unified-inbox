import { ActivityActionType, BmReplyStatus, FollowUpStatus, Prisma } from "@prisma/client";
import type { AuthUser } from "./auth/auth.guard";
import type { PrismaService } from "./prisma.service";

type ReplyStateTransaction = {
  conversation: {
    update: (args: Prisma.ConversationUpdateArgs) => Promise<unknown>;
    updateMany?: (args: Prisma.ConversationUpdateManyArgs) => Promise<{ count: number }>;
  };
  activityHistory: {
    create: (args: Prisma.ActivityHistoryCreateArgs) => Promise<unknown>;
  };
};

/**
 * Persist the state transition that belongs to a successful staff outbound
 * message. Keeping this beside the domain model prevents each delivery path
 * from drifting on status, ownership, or actor attribution.
 */
export async function persistStaffOutboundReplyState(
  tx: ReplyStateTransaction,
  input: {
    conversationId: string;
    previousBmReplyStatus: BmReplyStatus;
    previousFollowUpStatus: FollowUpStatus;
    actor: Pick<AuthUser, "id" | "displayName">;
    sentAt: Date;
    description: string;
  },
) {
  await tx.conversation.update({
    where: { id: input.conversationId },
    data: {
      latestMessageAt: input.sentAt,
      bmReplyStatus: BmReplyStatus.REPLIED,
      followUpStatus: FollowUpStatus.COMPLETED,
    },
  });

  const ownerUpdate = typeof tx.conversation.updateMany === "function"
    ? await tx.conversation.updateMany({
        where: { id: input.conversationId, ownerUserId: null },
        data: { ownerUserId: input.actor.id },
      })
    : { count: 0 };

  await tx.activityHistory.create({
    data: {
      conversationId: input.conversationId,
      actionType: ActivityActionType.STATUS_CHANGED,
      previousStatus: input.previousFollowUpStatus,
      newStatus: FollowUpStatus.COMPLETED,
      previousBmReplyStatus: input.previousBmReplyStatus,
      newBmReplyStatus: BmReplyStatus.REPLIED,
      createdByUserId: input.actor.id,
      createdByName: input.actor.displayName,
      description: input.description,
    },
  });

  return { ownerAssigned: ownerUpdate.count === 1 };
}

/** Repair the conversation state when an idempotent retry finds a message that
 * was already persisted by an earlier request. */
export async function reconcileStaffOutboundReplyState(
  prisma: PrismaService,
  input: {
    conversationId: string;
    sentAt: Date;
    actor: Pick<AuthUser, "id" | "displayName">;
  },
) {
  if (typeof prisma.conversation?.findUnique !== "function") return false;

  const current = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { id: true, latestMessageAt: true, bmReplyStatus: true, followUpStatus: true, ownerUserId: true },
  });
  if (!current) return false;

  const stateNeedsRepair = current.bmReplyStatus !== BmReplyStatus.REPLIED
    || current.followUpStatus !== FollowUpStatus.COMPLETED
    || current.ownerUserId === null;
  if (!stateNeedsRepair) return false;

  const latestMessageAt = current.latestMessageAt && current.latestMessageAt > input.sentAt
    ? current.latestMessageAt
    : input.sentAt;

  await prisma.$transaction(async (tx) => {
    await persistStaffOutboundReplyState(tx, {
      conversationId: input.conversationId,
      previousBmReplyStatus: current.bmReplyStatus,
      previousFollowUpStatus: current.followUpStatus,
      actor: input.actor,
      sentAt: latestMessageAt,
      description: "Reconciled state for an already-persisted staff outbound message",
    });
  });
  return true;
}
