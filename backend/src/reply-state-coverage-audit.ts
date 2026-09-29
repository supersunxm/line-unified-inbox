import { PrismaClient } from "@prisma/client";
import {
  normalizeCanonicalReplyMessage,
  normalizeHistoricalReplyMessage,
  resolveReplyState,
  type HistoricalReplyMessage,
  type ReplyState,
  type ReplyStateAmbiguityReason,
} from "./reply-state-resolver";

type SchemaPreflightRow = {
  timeline_table: string | null;
  crosswalk_table: string | null;
};

type StoredStatus = "REPLIED" | "NOT_REPLIED" | "NOTIFIED_BM";

type MatrixKey =
  | "STORED_REPLIED__RESOLVED_REPLIED"
  | "STORED_REPLIED__RESOLVED_NOT_REPLIED"
  | "STORED_REPLIED__RESOLVED_AMBIGUOUS"
  | "STORED_NOT_REPLIED__RESOLVED_REPLIED"
  | "STORED_NOT_REPLIED__RESOLVED_NOT_REPLIED"
  | "STORED_NOT_REPLIED__RESOLVED_AMBIGUOUS"
  | "STORED_NOTIFIED_BM__RESOLVED_REPLIED"
  | "STORED_NOTIFIED_BM__RESOLVED_NOT_REPLIED"
  | "STORED_NOTIFIED_BM__RESOLVED_AMBIGUOUS";

function numberArg(name: string, fallback: number): number {
  const prefix = "--" + name + "=";
  const raw = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) throw new Error("Invalid " + prefix + "<number>");
  return Math.floor(value);
}

function matrixKey(stored: StoredStatus, resolved: ReplyState): MatrixKey {
  return ("STORED_" + stored + "__RESOLVED_" + resolved) as MatrixKey;
}

function crosswalkKey(input: {
  storeId: string;
  lineOfficialAccountId: string;
  historicalLineChatUserId: string;
}): string {
  return input.storeId + "\u0000" + input.lineOfficialAccountId + "\u0000" + input.historicalLineChatUserId;
}

async function schemaPreflight(prisma: PrismaClient) {
  const rows = await prisma.$queryRawUnsafe<SchemaPreflightRow[]>(
    "SELECT to_regclass('\"HistoricalTimelineMessage\"')::text AS timeline_table, " +
    "to_regclass('\"HistoricalConversationCrosswalk\"')::text AS crosswalk_table",
  );
  return {
    timeline: Boolean(rows[0]?.timeline_table),
    crosswalk: Boolean(rows[0]?.crosswalk_table),
  };
}

async function main() {
  const batchSize = numberArg("batch-size", 200);
  const limit = numberArg("limit", Number.MAX_SAFE_INTEGER);
  const prisma = new PrismaClient();

  try {
    const schema = await schemaPreflight(prisma);
    if (!schema.timeline || !schema.crosswalk) {
      process.stdout.write(JSON.stringify({
        COVERAGE_RUN_STATUS: "BLOCKED_SCHEMA_NOT_APPLIED",
        HISTORICAL_TIMELINE_TABLE_PRESENT: schema.timeline,
        HISTORICAL_CROSSWALK_TABLE_PRESENT: schema.crosswalk,
        DATABASE_WRITES: 0,
      }, null, 2) + "\n");
      return;
    }

    const matrix: Record<MatrixKey, number> = {
      STORED_REPLIED__RESOLVED_REPLIED: 0,
      STORED_REPLIED__RESOLVED_NOT_REPLIED: 0,
      STORED_REPLIED__RESOLVED_AMBIGUOUS: 0,
      STORED_NOT_REPLIED__RESOLVED_REPLIED: 0,
      STORED_NOT_REPLIED__RESOLVED_NOT_REPLIED: 0,
      STORED_NOT_REPLIED__RESOLVED_AMBIGUOUS: 0,
      STORED_NOTIFIED_BM__RESOLVED_REPLIED: 0,
      STORED_NOTIFIED_BM__RESOLVED_NOT_REPLIED: 0,
      STORED_NOTIFIED_BM__RESOLVED_AMBIGUOUS: 0,
    };

    const ambiguityReasons: Record<ReplyStateAmbiguityReason, number> = {
      UNKNOWN_OUTBOUND_ACTOR: 0,
      ORDERING_CONFLICT: 0,
      UNKNOWN_EVENT_CLASSIFICATION: 0,
      NO_MESSAGE_EVIDENCE: 0,
    };

    const totals = {
      COVERAGE_RUN_STATUS: "COMPLETE",
      TOTAL_CANONICAL_CONVERSATIONS: 0,
      RESOLVED_REPLIED: 0,
      RESOLVED_NOT_REPLIED: 0,
      AMBIGUOUS: 0,
      NO_MESSAGE_EVIDENCE: 0,
      HISTORICAL_LINKED_CONVERSATIONS: 0,
      HISTORICAL_CROSSWALK_LINKED_CONVERSATIONS: 0,
      HISTORICAL_DIRECT_LINKED_CONVERSATIONS: 0,
      CANONICAL_ONLY_CONVERSATIONS: 0,
      UNKNOWN_OUTBOUND_ACTOR_EVENT_COUNT: 0,
      DATABASE_WRITES: 0,
    };

    const byStore = new Map<string, {
      total: number;
      replied: number;
      notReplied: number;
      ambiguous: number;
      historicalLinked: number;
    }>();

    const ambiguousDirectIdentities = new Set<string>();
    const linkageConflictIdentities = new Set<string>();
    let cursor: string | undefined;

    while (totals.TOTAL_CANONICAL_CONVERSATIONS < limit) {
      const take = Math.min(batchSize, limit - totals.TOTAL_CANONICAL_CONVERSATIONS);
      const conversations = await prisma.conversation.findMany({
        take,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        select: {
          id: true,
          storeId: true,
          lineOfficialAccountId: true,
          lineChatUserId: true,
          bmReplyStatus: true,
          messages: {
            orderBy: [{ sentAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              externalMessageId: true,
              direction: true,
              deliveryStatus: true,
              originalText: true,
              sentAt: true,
              senderUserId: true,
              senderDisplayName: true,
              rawPayload: true,
            },
          },
          historicalConversationCrosswalks: {
            where: {
              classification: "LINK_SAFE",
              evidenceType: "SOURCE_EVENT_ID",
              anchorCount: { gt: 0 },
              canonicalConversationId: { not: null },
            },
            select: {
              storeId: true,
              lineOfficialAccountId: true,
              historicalLineChatUserId: true,
            },
          },
        },
      });

      if (conversations.length === 0) break;

      const crosswalkToConversation = new Map<string, string>();
      for (const conversation of conversations) {
        for (const link of conversation.historicalConversationCrosswalks) {
          crosswalkToConversation.set(crosswalkKey(link), conversation.id);
        }
      }

      const directIdentityInputs = conversations.flatMap((conversation) =>
        conversation.storeId && conversation.lineChatUserId
          ? [{
              storeId: conversation.storeId,
              lineOfficialAccountId: conversation.lineOfficialAccountId,
              historicalLineChatUserId: conversation.lineChatUserId,
            }]
          : [],
      );
      const uniqueDirectIdentityInputs = [...new Map(
        directIdentityInputs.map((identity) => [crosswalkKey(identity), identity]),
      ).values()];
      const directConversationRows = uniqueDirectIdentityInputs.length === 0
        ? []
        : await prisma.conversation.findMany({
            where: {
              OR: uniqueDirectIdentityInputs.map((identity) => ({
                storeId: identity.storeId,
                lineOfficialAccountId: identity.lineOfficialAccountId,
                lineChatUserId: identity.historicalLineChatUserId,
              })),
            },
            select: {
              id: true,
              storeId: true,
              lineOfficialAccountId: true,
              lineChatUserId: true,
            },
          });
      const directConversationIdsByIdentity = new Map<string, string[]>();
      for (const row of directConversationRows) {
        if (!row.storeId || !row.lineChatUserId) continue;
        const identityKey = crosswalkKey({
          storeId: row.storeId,
          lineOfficialAccountId: row.lineOfficialAccountId,
          historicalLineChatUserId: row.lineChatUserId,
        });
        directConversationIdsByIdentity.set(identityKey, [
          ...(directConversationIdsByIdentity.get(identityKey) ?? []),
          row.id,
        ]);
      }
      const directToConversation = new Map<string, string>();
      for (const identity of uniqueDirectIdentityInputs) {
        const identityKey = crosswalkKey(identity);
        const ids = [...new Set(directConversationIdsByIdentity.get(identityKey) ?? [])];
        if (ids.length === 1) directToConversation.set(identityKey, ids[0]);
        else if (ids.length > 1) ambiguousDirectIdentities.add(identityKey);
      }

      const historicalByConversation = new Map<string, HistoricalReplyMessage[]>();
      const crosswalkEvidenceConversationIds = new Set<string>();
      const directEvidenceConversationIds = new Set<string>();
      const links = conversations.flatMap((conversation) => conversation.historicalConversationCrosswalks);
      const historicalIdentityInputs = [...new Map(
        [
          ...links.map((link) => ({
            storeId: link.storeId,
            lineOfficialAccountId: link.lineOfficialAccountId,
            historicalLineChatUserId: link.historicalLineChatUserId,
          })),
          ...uniqueDirectIdentityInputs.filter((identity) => directToConversation.has(crosswalkKey(identity))),
        ].map((identity) => [crosswalkKey(identity), identity]),
      ).values()];
      if (historicalIdentityInputs.length > 0) {
        const historicalRows = await prisma.historicalTimelineMessage.findMany({
          where: {
            OR: historicalIdentityInputs.map((link) => ({
              storeId: link.storeId,
              lineOfficialAccountId: link.lineOfficialAccountId,
              lineChatUserId: link.historicalLineChatUserId,
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

        for (const row of historicalRows) {
          const identityKey = crosswalkKey({
            storeId: row.storeId,
            lineOfficialAccountId: row.lineOfficialAccountId,
            historicalLineChatUserId: row.lineChatUserId,
          });
          const crosswalkConversationId = crosswalkToConversation.get(identityKey);
          const directConversationId = directToConversation.get(identityKey);
          if (crosswalkConversationId && directConversationId && crosswalkConversationId !== directConversationId) {
            linkageConflictIdentities.add(identityKey);
            continue;
          }
          const conversationId = crosswalkConversationId ?? directConversationId;
          if (!conversationId) continue;
          if (crosswalkConversationId) crosswalkEvidenceConversationIds.add(conversationId);
          if (directConversationId) directEvidenceConversationIds.add(conversationId);
          const item: HistoricalReplyMessage = {
            id: row.id,
            sourceEventId: row.sourceEventId,
            sourceEventType: row.sourceEventType,
            direction: row.direction,
            text: row.text,
            sentAt: row.sentAt,
            senderBizId: row.senderBizId,
          };
          historicalByConversation.set(conversationId, [
            ...(historicalByConversation.get(conversationId) ?? []),
            item,
          ]);
        }
      }

      for (const conversation of conversations) {
        totals.TOTAL_CANONICAL_CONVERSATIONS += 1;
        const historical = historicalByConversation.get(conversation.id) ?? [];
        const crosswalkLinked = crosswalkEvidenceConversationIds.has(conversation.id);
        const directLinked = directEvidenceConversationIds.has(conversation.id);
        const linked = historical.length > 0;
        if (linked) totals.HISTORICAL_LINKED_CONVERSATIONS += 1;
        else totals.CANONICAL_ONLY_CONVERSATIONS += 1;
        if (crosswalkLinked) totals.HISTORICAL_CROSSWALK_LINKED_CONVERSATIONS += 1;
        if (directLinked) totals.HISTORICAL_DIRECT_LINKED_CONVERSATIONS += 1;

        const events = [
          ...conversation.messages.map((message) => normalizeCanonicalReplyMessage({
            id: message.id,
            externalMessageId: message.externalMessageId,
            direction: message.direction,
            deliveryStatus: message.deliveryStatus,
            originalText: message.originalText,
            sentAt: message.sentAt,
            senderUserId: message.senderUserId,
            senderDisplayName: message.senderDisplayName,
            rawPayload: message.rawPayload,
          })),
          ...historical.map(normalizeHistoricalReplyMessage),
        ];

        totals.UNKNOWN_OUTBOUND_ACTOR_EVENT_COUNT += events.filter(
          (event) => event.direction === "OUTBOUND" && event.actor === "UNKNOWN",
        ).length;

        const resolution = resolveReplyState(events);
        const stored: StoredStatus = conversation.bmReplyStatus;
        matrix[matrixKey(stored, resolution.state)] += 1;

        const storeId = conversation.storeId ?? "__NO_STORE__";
        const store = byStore.get(storeId) ?? {
          total: 0,
          replied: 0,
          notReplied: 0,
          ambiguous: 0,
          historicalLinked: 0,
        };
        store.total += 1;
        if (linked) store.historicalLinked += 1;

        if (resolution.state === "REPLIED") {
          totals.RESOLVED_REPLIED += 1;
          store.replied += 1;
        } else if (resolution.state === "NOT_REPLIED") {
          totals.RESOLVED_NOT_REPLIED += 1;
          store.notReplied += 1;
        } else {
          totals.AMBIGUOUS += 1;
          store.ambiguous += 1;
          if (!("reason" in resolution)) throw new Error("Unexpected deterministic reply-state resolution");
          const reason = resolution.reason;
          if (reason === "UNKNOWN_OUTBOUND_ACTOR") ambiguityReasons.UNKNOWN_OUTBOUND_ACTOR += 1;
          else if (reason === "ORDERING_CONFLICT") ambiguityReasons.ORDERING_CONFLICT += 1;
          else if (reason === "UNKNOWN_EVENT_CLASSIFICATION") ambiguityReasons.UNKNOWN_EVENT_CLASSIFICATION += 1;
          else {
            ambiguityReasons.NO_MESSAGE_EVIDENCE += 1;
            totals.NO_MESSAGE_EVIDENCE += 1;
          }
        }
        byStore.set(storeId, store);
      }

      cursor = conversations.at(-1)?.id;
      if (conversations.length < take) break;
    }

    process.stdout.write(JSON.stringify({
      ...totals,
      ...matrix,
      DIRECT_LINK_AMBIGUOUS_IDENTITIES: ambiguousDirectIdentities.size,
      LINKAGE_CONFLICT_IDENTITIES: linkageConflictIdentities.size,
      AMBIGUITY_REASONS: ambiguityReasons,
      BY_STORE: [...byStore.entries()]
        .map(([storeId, counts]) => ({ storeId, ...counts }))
        .sort((left, right) => right.total - left.total || left.storeId.localeCompare(right.storeId)),
    }, null, 2) + "\n");
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : "Reply-state coverage audit failed");
    process.exitCode = 1;
  });
}
