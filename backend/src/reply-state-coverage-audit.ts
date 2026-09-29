import { Prisma, PrismaClient } from "@prisma/client";
import {
  normalizeCanonicalReplyMessage,
  normalizeHistoricalReplyMessage,
  resolveReplyState,
  type CanonicalReplyMessage,
  type HistoricalReplyMessage,
  type ReplyEventDirection,
  type ReplyState,
  type ReplyStateAmbiguityReason,
} from "./reply-state-resolver";

type SchemaPreflightRow = {
  timeline_table: string | null;
  crosswalk_table: string | null;
};

type StoredStatus = "REPLIED" | "NOT_REPLIED" | "NOTIFIED_BM";
type DeliveryStatus = "DELIVERED" | "FAILED" | "PENDING";

type ConversationRow = {
  id: string;
  storeId: string | null;
  lineOfficialAccountId: string;
  lineChatUserId: string | null;
  bmReplyStatus: string;
};

type MessageRow = {
  id: string;
  conversationId: string;
  externalMessageId: string | null;
  direction: string;
  deliveryStatus: string;
  originalText: string;
  sentAt: Date;
  senderUserId: string | null;
  senderDisplayName: string | null;
  rawPayload: unknown;
};

type CrosswalkRow = {
  storeId: string;
  lineOfficialAccountId: string;
  historicalLineChatUserId: string;
  canonicalConversationId: string;
};

type DirectConversationRow = {
  id: string;
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
};

type HistoricalRow = {
  id: string;
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  sourceEventId: string;
  sourceEventType: string;
  direction: string;
  text: string;
  sentAt: Date;
  senderBizId: string | null;
};

type HistoricalIdentity = {
  storeId: string;
  lineOfficialAccountId: string;
  historicalLineChatUserId: string;
};

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

function storedStatus(value: string): StoredStatus {
  if (value === "REPLIED" || value === "NOT_REPLIED" || value === "NOTIFIED_BM") return value;
  throw new Error("Unexpected bmReplyStatus: " + value);
}

function direction(value: string): ReplyEventDirection {
  if (value === "INBOUND" || value === "OUTBOUND" || value === "SYSTEM") return value;
  throw new Error("Unexpected message direction: " + value);
}

function deliveryStatus(value: string): DeliveryStatus {
  if (value === "DELIVERED" || value === "FAILED" || value === "PENDING") return value;
  throw new Error("Unexpected delivery status: " + value);
}

function crosswalkKey(input: HistoricalIdentity): string {
  return input.storeId + "\u0000" + input.lineOfficialAccountId + "\u0000" + input.historicalLineChatUserId;
}

function uniqueIdentities(items: readonly HistoricalIdentity[]): HistoricalIdentity[] {
  return [...new Map(items.map((item) => [crosswalkKey(item), item])).values()];
}

function targetValues(items: readonly HistoricalIdentity[]): Prisma.Sql {
  return Prisma.join(
    items.map((item) => Prisma.sql`(${item.storeId}, ${item.lineOfficialAccountId}, ${item.historicalLineChatUserId})`),
  );
}

async function schemaPreflight(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<SchemaPreflightRow[]>(Prisma.sql`
    SELECT
      to_regclass('public."HistoricalTimelineMessage"')::text AS timeline_table,
      to_regclass('public."HistoricalConversationCrosswalk"')::text AS crosswalk_table
  `);
  return {
    timeline: Boolean(rows[0]?.timeline_table),
    crosswalk: Boolean(rows[0]?.crosswalk_table),
  };
}

async function fetchConversationBatch(
  prisma: PrismaClient,
  cursor: string | undefined,
  take: number,
): Promise<ConversationRow[]> {
  const cursorClause = cursor ? Prisma.sql`WHERE c."id" > ${cursor}` : Prisma.empty;
  return prisma.$queryRaw<ConversationRow[]>(Prisma.sql`
    SELECT
      c."id",
      c."storeId",
      c."lineOfficialAccountId",
      c."lineChatUserId",
      c."bmReplyStatus"::text AS "bmReplyStatus"
    FROM public."Conversation" c
    ${cursorClause}
    ORDER BY c."id" ASC
    LIMIT ${take}
  `);
}

async function fetchMessages(prisma: PrismaClient, conversationIds: readonly string[]): Promise<MessageRow[]> {
  if (conversationIds.length === 0) return [];
  return prisma.$queryRaw<MessageRow[]>(Prisma.sql`
    SELECT
      m."id",
      m."conversationId",
      m."externalMessageId",
      m."direction"::text AS "direction",
      m."deliveryStatus"::text AS "deliveryStatus",
      m."originalText",
      m."sentAt",
      m."senderUserId",
      m."senderDisplayName",
      m."rawPayload"
    FROM public."Message" m
    WHERE m."conversationId" IN (${Prisma.join(conversationIds)})
    ORDER BY m."sentAt" ASC, m."id" ASC
  `);
}

async function fetchCrosswalks(prisma: PrismaClient, conversationIds: readonly string[]): Promise<CrosswalkRow[]> {
  if (conversationIds.length === 0) return [];
  return prisma.$queryRaw<CrosswalkRow[]>(Prisma.sql`
    SELECT
      x."storeId",
      x."lineOfficialAccountId",
      x."historicalLineChatUserId",
      x."canonicalConversationId"
    FROM public."HistoricalConversationCrosswalk" x
    WHERE x."canonicalConversationId" IN (${Prisma.join(conversationIds)})
      AND x."classification" = 'LINK_SAFE'
      AND x."evidenceType" = 'SOURCE_EVENT_ID'
      AND x."anchorCount" > 0
      AND x."canonicalConversationId" IS NOT NULL
  `);
}

async function fetchDirectCandidates(
  prisma: PrismaClient,
  identities: readonly HistoricalIdentity[],
): Promise<DirectConversationRow[]> {
  if (identities.length === 0) return [];
  return prisma.$queryRaw<DirectConversationRow[]>(Prisma.sql`
    WITH targets("storeId", "lineOfficialAccountId", "lineChatUserId") AS (
      VALUES ${targetValues(identities)}
    )
    SELECT c."id", c."storeId", c."lineOfficialAccountId", c."lineChatUserId"
    FROM public."Conversation" c
    JOIN targets t
      ON t."storeId" = c."storeId"
     AND t."lineOfficialAccountId" = c."lineOfficialAccountId"
     AND t."lineChatUserId" = c."lineChatUserId"
  `);
}

async function fetchHistoricalRows(
  prisma: PrismaClient,
  identities: readonly HistoricalIdentity[],
): Promise<HistoricalRow[]> {
  if (identities.length === 0) return [];
  return prisma.$queryRaw<HistoricalRow[]>(Prisma.sql`
    WITH targets("storeId", "lineOfficialAccountId", "lineChatUserId") AS (
      VALUES ${targetValues(identities)}
    )
    SELECT
      h."id",
      h."storeId",
      h."lineOfficialAccountId",
      h."lineChatUserId",
      h."sourceEventId",
      h."sourceEventType",
      h."direction"::text AS "direction",
      h."text",
      h."sentAt",
      h."senderBizId"
    FROM public."HistoricalTimelineMessage" h
    JOIN targets t
      ON t."storeId" = h."storeId"
     AND t."lineOfficialAccountId" = h."lineOfficialAccountId"
     AND t."lineChatUserId" = h."lineChatUserId"
    ORDER BY h."sentAt" ASC, h."id" ASC
  `);
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
      const conversations = await fetchConversationBatch(prisma, cursor, take);
      if (conversations.length === 0) break;

      const conversationIds = conversations.map((conversation) => conversation.id);
      const [messages, crosswalks] = await Promise.all([
        fetchMessages(prisma, conversationIds),
        fetchCrosswalks(prisma, conversationIds),
      ]);

      const messagesByConversation = new Map<string, MessageRow[]>();
      for (const message of messages) {
        messagesByConversation.set(message.conversationId, [
          ...(messagesByConversation.get(message.conversationId) ?? []),
          message,
        ]);
      }

      const crosswalkToConversation = new Map<string, string>();
      for (const link of crosswalks) crosswalkToConversation.set(crosswalkKey(link), link.canonicalConversationId);

      const directIdentityInputs = uniqueIdentities(conversations.flatMap((conversation) =>
        conversation.storeId && conversation.lineChatUserId
          ? [{
              storeId: conversation.storeId,
              lineOfficialAccountId: conversation.lineOfficialAccountId,
              historicalLineChatUserId: conversation.lineChatUserId,
            }]
          : [],
      ));
      const directRows = await fetchDirectCandidates(prisma, directIdentityInputs);
      const directIdsByIdentity = new Map<string, string[]>();
      for (const row of directRows) {
        const identityKey = crosswalkKey({
          storeId: row.storeId,
          lineOfficialAccountId: row.lineOfficialAccountId,
          historicalLineChatUserId: row.lineChatUserId,
        });
        directIdsByIdentity.set(identityKey, [...(directIdsByIdentity.get(identityKey) ?? []), row.id]);
      }

      const directToConversation = new Map<string, string>();
      for (const identity of directIdentityInputs) {
        const identityKey = crosswalkKey(identity);
        const ids = [...new Set(directIdsByIdentity.get(identityKey) ?? [])];
        if (ids.length === 1) directToConversation.set(identityKey, ids[0]);
        else if (ids.length > 1) ambiguousDirectIdentities.add(identityKey);
      }

      const historicalIdentities = uniqueIdentities([
        ...crosswalks.map((link) => ({
          storeId: link.storeId,
          lineOfficialAccountId: link.lineOfficialAccountId,
          historicalLineChatUserId: link.historicalLineChatUserId,
        })),
        ...directIdentityInputs.filter((identity) => directToConversation.has(crosswalkKey(identity))),
      ]);
      const historicalRows = await fetchHistoricalRows(prisma, historicalIdentities);
      const historicalByConversation = new Map<string, HistoricalReplyMessage[]>();
      const crosswalkEvidenceConversationIds = new Set<string>();
      const directEvidenceConversationIds = new Set<string>();

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
          direction: direction(row.direction),
          text: row.text,
          sentAt: row.sentAt,
          senderBizId: row.senderBizId,
        };
        historicalByConversation.set(conversationId, [
          ...(historicalByConversation.get(conversationId) ?? []),
          item,
        ]);
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

        const canonical: CanonicalReplyMessage[] = (messagesByConversation.get(conversation.id) ?? []).map((message) => ({
          id: message.id,
          externalMessageId: message.externalMessageId,
          direction: direction(message.direction),
          deliveryStatus: deliveryStatus(message.deliveryStatus),
          originalText: message.originalText,
          sentAt: message.sentAt,
          senderUserId: message.senderUserId,
          senderDisplayName: message.senderDisplayName,
          rawPayload: message.rawPayload,
        }));
        const events = [
          ...canonical.map(normalizeCanonicalReplyMessage),
          ...historical.map(normalizeHistoricalReplyMessage),
        ];

        totals.UNKNOWN_OUTBOUND_ACTOR_EVENT_COUNT += events.filter(
          (event) => event.direction === "OUTBOUND" && event.actor === "UNKNOWN",
        ).length;

        const resolution = resolveReplyState(events);
        matrix[matrixKey(storedStatus(conversation.bmReplyStatus), resolution.state)] += 1;

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
          ambiguityReasons[resolution.reason] += 1;
          if (resolution.reason === "NO_MESSAGE_EVIDENCE") totals.NO_MESSAGE_EVIDENCE += 1;
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
