import { ActivityActionType, BmReplyStatus, FollowUpStatus, MessageDeliveryStatus, MessageDirection, PrismaClient } from "@prisma/client";

type Candidate = {
  id: string;
  bmReplyStatus: BmReplyStatus;
  followUpStatus: FollowUpStatus;
  ownerUserId: string | null;
  latestMessageAt: Date;
  messages: Array<{
    id: string;
    direction: MessageDirection;
    deliveryStatus: MessageDeliveryStatus;
    senderUserId: string | null;
    senderDisplayName: string | null;
    sentAt: Date;
  }>;
};

type Decision = {
  replied: boolean;
  ownerUserId: string | null;
  ownerDisplayName: string | null;
  latestMessageAt: Date;
  reason: string;
};

export function decideReplyState(conversation: Candidate): Decision {
  const messages = [...conversation.messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const latest = messages.at(-1);
  const latestInbound = [...messages].reverse().find((message) => message.direction === MessageDirection.INBOUND);
  const latestStaffOutbound = [...messages].reverse().find(
    (message) =>
      message.direction === MessageDirection.OUTBOUND &&
      message.deliveryStatus === MessageDeliveryStatus.DELIVERED &&
      Boolean(message.senderUserId),
  );

  const latestMessageAt = latest?.sentAt ?? conversation.latestMessageAt;

  if (!latestInbound) {
    return {
      replied: conversation.bmReplyStatus === BmReplyStatus.REPLIED,
      ownerUserId: conversation.ownerUserId,
      ownerDisplayName: null,
      latestMessageAt,
      reason: "NO_INBOUND_MESSAGE",
    };
  }

  if (!latestStaffOutbound || latestStaffOutbound.sentAt < latestInbound.sentAt) {
    return {
      replied: false,
      ownerUserId: conversation.ownerUserId,
      ownerDisplayName: null,
      latestMessageAt,
      reason: latestStaffOutbound ? "CUSTOMER_REPLIED_AFTER_STAFF" : "NO_QUALIFYING_STAFF_OUTBOUND",
    };
  }

  return {
    replied: true,
    ownerUserId: conversation.ownerUserId ?? latestStaffOutbound.senderUserId,
    ownerDisplayName: conversation.ownerUserId ? null : latestStaffOutbound.senderDisplayName,
    latestMessageAt,
    reason: "STAFF_REPLIED_AFTER_LATEST_INBOUND",
  };
}

function numberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`Invalid ${prefix}<number>`);
  return Math.floor(parsed);
}

function stringArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length).trim() || undefined;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const batchSize = numberArg("batch-size", 200);
  const limit = numberArg("limit", Number.MAX_SAFE_INTEGER);
  const storeId = stringArg("store-id");
  const fromRaw = stringArg("from");
  const toRaw = stringArg("to");
  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;
  if (from && Number.isNaN(from.getTime())) throw new Error("Invalid --from date");
  if (to && Number.isNaN(to.getTime())) throw new Error("Invalid --to date");

  const prisma = new PrismaClient();
  let cursor: string | undefined;
  const summary = {
    mode: apply ? "APPLY" : "DRY_RUN",
    scanned: 0,
    markReplied: 0,
    markNotReplied: 0,
    assignOwner: 0,
    preserveOwner: 0,
    latestMessageAtFix: 0,
    alreadyCorrect: 0,
    skippedNoInbound: 0,
    skippedAmbiguous: 0,
    changed: 0,
  };

  try {
    while (summary.scanned < limit) {
      const take = Math.min(batchSize, limit - summary.scanned);
      const rows = await prisma.conversation.findMany({
        take,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        where: {
          ...(storeId ? { storeId } : {}),
          ...(from || to
            ? {
                latestMessageAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
        select: {
          id: true,
          bmReplyStatus: true,
          followUpStatus: true,
          ownerUserId: true,
          latestMessageAt: true,
          messages: {
            orderBy: [{ sentAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              direction: true,
              deliveryStatus: true,
              senderUserId: true,
              senderDisplayName: true,
              sentAt: true,
            },
          },
        },
      });

      if (!rows.length) break;

      for (const conversation of rows) {
        summary.scanned += 1;
        const decision = decideReplyState(conversation);

        if (decision.reason === "NO_INBOUND_MESSAGE") {
          summary.skippedNoInbound += 1;
          continue;
        }

        const targetBmReplyStatus = decision.replied ? BmReplyStatus.REPLIED : BmReplyStatus.NOT_REPLIED;
        const targetFollowUpStatus = decision.replied ? FollowUpStatus.COMPLETED : conversation.followUpStatus;
        const ownerShouldAssign = !conversation.ownerUserId && decision.replied && Boolean(decision.ownerUserId);
        const latestMessageAtNeedsFix = conversation.latestMessageAt.getTime() !== decision.latestMessageAt.getTime();

        if (decision.replied && conversation.bmReplyStatus !== BmReplyStatus.REPLIED) summary.markReplied += 1;
        if (!decision.replied && conversation.bmReplyStatus === BmReplyStatus.REPLIED) summary.markNotReplied += 1;
        if (ownerShouldAssign) summary.assignOwner += 1;
        if (conversation.ownerUserId) summary.preserveOwner += 1;
        if (latestMessageAtNeedsFix) summary.latestMessageAtFix += 1;

        const needsChange =
          conversation.bmReplyStatus !== targetBmReplyStatus ||
          (decision.replied && conversation.followUpStatus !== FollowUpStatus.COMPLETED) ||
          ownerShouldAssign ||
          latestMessageAtNeedsFix;

        if (!needsChange) {
          summary.alreadyCorrect += 1;
          continue;
        }

        summary.changed += 1;
        if (!apply) continue;

        await prisma.$transaction(async (tx) => {
          const current = await tx.conversation.findUnique({
            where: { id: conversation.id },
            select: {
              bmReplyStatus: true,
              followUpStatus: true,
              ownerUserId: true,
              latestMessageAt: true,
            },
          });
          if (!current) return;

          await tx.conversation.update({
            where: { id: conversation.id },
            data: {
              bmReplyStatus: targetBmReplyStatus,
              ...(decision.replied ? { followUpStatus: FollowUpStatus.COMPLETED } : {}),
              latestMessageAt: decision.latestMessageAt,
              ...(ownerShouldAssign && current.ownerUserId === null ? { ownerUserId: decision.ownerUserId } : {}),
            },
          });

          await tx.activityHistory.create({
            data: {
              conversationId: conversation.id,
              actionType: ActivityActionType.STATUS_CHANGED,
              previousStatus: current.followUpStatus,
              newStatus: decision.replied ? FollowUpStatus.COMPLETED : current.followUpStatus,
              previousBmReplyStatus: current.bmReplyStatus,
              newBmReplyStatus: targetBmReplyStatus,
              createdByUserId: ownerShouldAssign ? decision.ownerUserId : null,
              createdByName: ownerShouldAssign ? decision.ownerDisplayName : "System Backfill",
              description: "Backfilled conversation reply state from message history",
              metadata: {
                source: "conversation-reply-state-backfill",
                reason: decision.reason,
                ownerAssigned: ownerShouldAssign && current.ownerUserId === null,
              },
            },
          });
        });
      }

      cursor = rows.at(-1)?.id;
      if (rows.length < take) break;
    }

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : "Conversation reply-state backfill failed");
    process.exitCode = 1;
  });
}
