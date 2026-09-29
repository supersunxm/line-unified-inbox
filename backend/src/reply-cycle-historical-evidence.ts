import type { PrismaService } from "./prisma.service";
import type {
  HistoricalReplyMessage,
  ReplyEventDirection,
} from "./reply-state-resolver";

export type LinkedHistoricalReplyMessage = HistoricalReplyMessage & {
  conversationId: string;
};

export type SafeHistoricalReplyEvidence = {
  messages: LinkedHistoricalReplyMessage[];
  safeCrosswalkCount: number;
  linkedConversationCount: number;
  linkageConflictIdentityCount: number;
};

type HistoricalIdentity = {
  storeId: string;
  lineOfficialAccountId: string;
  historicalLineChatUserId: string;
};

const HISTORICAL_QUERY_BATCH_SIZE = 400;

function identityKey(identity: HistoricalIdentity): string {
  return [
    identity.storeId,
    identity.lineOfficialAccountId,
    identity.historicalLineChatUserId,
  ].join("\u0000");
}

function direction(value: string): ReplyEventDirection {
  if (value === "INBOUND" || value === "OUTBOUND" || value === "SYSTEM") return value;
  throw new Error("Unexpected historical message direction: " + value);
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export async function loadSafeHistoricalReplyEvidence(
  prisma: PrismaService,
  conversationIds: readonly string[],
  asOf: Date,
): Promise<SafeHistoricalReplyEvidence> {
  if (conversationIds.length === 0) {
    return {
      messages: [],
      safeCrosswalkCount: 0,
      linkedConversationCount: 0,
      linkageConflictIdentityCount: 0,
    };
  }

  const safeCrosswalks = await prisma.historicalConversationCrosswalk.findMany({
    where: {
      canonicalConversationId: { in: [...conversationIds] },
      classification: "LINK_SAFE",
      evidenceType: "SOURCE_EVENT_ID",
      anchorCount: { gt: 0 },
    },
    select: {
      storeId: true,
      lineOfficialAccountId: true,
      historicalLineChatUserId: true,
      canonicalConversationId: true,
    },
  });

  const targetsByIdentity = new Map<string, Set<string>>();
  const identityByKey = new Map<string, HistoricalIdentity>();
  for (const link of safeCrosswalks) {
    if (!link.canonicalConversationId) continue;
    const identity: HistoricalIdentity = {
      storeId: link.storeId,
      lineOfficialAccountId: link.lineOfficialAccountId,
      historicalLineChatUserId: link.historicalLineChatUserId,
    };
    const key = identityKey(identity);
    identityByKey.set(key, identity);
    const targets = targetsByIdentity.get(key) ?? new Set<string>();
    targets.add(link.canonicalConversationId);
    targetsByIdentity.set(key, targets);
  }

  const conflicted = new Set(
    [...targetsByIdentity.entries()]
      .filter(([, targets]) => targets.size !== 1)
      .map(([key]) => key),
  );

  const targetConversationByIdentity = new Map<string, string>();
  for (const [key, targets] of targetsByIdentity) {
    if (conflicted.has(key)) continue;
    const target = [...targets][0];
    if (target) targetConversationByIdentity.set(key, target);
  }

  const identities = [...identityByKey.entries()]
    .filter(([key]) => !conflicted.has(key))
    .map(([, identity]) => identity);

  const messages: LinkedHistoricalReplyMessage[] = [];
  for (const batch of chunks(identities, HISTORICAL_QUERY_BATCH_SIZE)) {
    const rows = await prisma.historicalTimelineMessage.findMany({
      where: {
        sentAt: { lte: asOf },
        OR: batch.map((identity) => ({
          storeId: identity.storeId,
          lineOfficialAccountId: identity.lineOfficialAccountId,
          lineChatUserId: identity.historicalLineChatUserId,
        })),
      },
      orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        storeId: true,
        lineOfficialAccountId: true,
        lineChatUserId: true,
        sourceEventId: true,
        sourceEventType: true,
        direction: true,
        text: true,
        sentAt: true,
        senderBizId: true,
      },
    });

    for (const row of rows) {
      const key = identityKey({
        storeId: row.storeId,
        lineOfficialAccountId: row.lineOfficialAccountId,
        historicalLineChatUserId: row.lineChatUserId,
      });
      const conversationId = targetConversationByIdentity.get(key);
      if (!conversationId) continue;
      messages.push({
        conversationId,
        id: row.id,
        sourceEventId: row.sourceEventId,
        sourceEventType: row.sourceEventType,
        direction: direction(row.direction),
        text: row.text,
        sentAt: row.sentAt,
        senderBizId: row.senderBizId,
      });
    }
  }

  const linkedConversationCount = new Set(messages.map((message) => message.conversationId)).size;
  return {
    messages,
    safeCrosswalkCount: safeCrosswalks.length,
    linkedConversationCount,
    linkageConflictIdentityCount: conflicted.size,
  };
}
