import { Prisma, PrismaClient } from "@prisma/client";
import {
  analyzeReplyEvidenceWindow,
  classifyReplyProjectionEligibility,
} from "./reply-state-evidence-window";
import {
  normalizeReplyTimeline,
  resolveReplyState,
  type CanonicalReplyMessage,
  type HistoricalReplyMessage,
  type ReplyEventDirection,
} from "./reply-state-resolver";

const DEFAULT_EVIDENCE_START = "2026-09-01T00:00:00+07:00";
const RESOLVER_VERSION = "reply-state-v1"; // projection verify trigger 2026-09-29

type DeliveryStatus = "DELIVERED" | "FAILED" | "PENDING";

type ConversationRow = {
  id: string;
  storeId: string | null;
  lineOfficialAccountId: string;
  lineChatUserId: string | null;
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

type ProjectionRow = {
  conversationId: string;
  state: "REPLIED" | "NOT_REPLIED";
  decidingEventKind: "CUSTOMER_INBOUND" | "HUMAN_STAFF_REPLY";
  decidingEventAt: Date;
  evidenceBoundary: Date;
  resolverVersion: string;
  canonicalMessageCount: number;
  historicalMessageCount: number;
};

type ExistingProjectionRow = ProjectionRow;

function numberArg(name: string, fallback: number): number {
  const prefix = "--" + name + "=";
  const raw = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) throw new Error("Invalid " + prefix + "<number>");
  return Math.floor(value);
}

function dateArg(name: string, fallback: string): Date {
  const prefix = "--" + name + "=";
  const raw = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) throw new Error("Invalid " + prefix + "<ISO date>");
  return value;
}

function direction(value: string): ReplyEventDirection {
  if (value === "INBOUND" || value === "OUTBOUND" || value === "SYSTEM") return value;
  throw new Error("Unexpected message direction: " + value);
}

function deliveryStatus(value: string): DeliveryStatus {
  if (value === "DELIVERED" || value === "FAILED" || value === "PENDING") return value;
  throw new Error("Unexpected delivery status: " + value);
}

function identityKey(input: HistoricalIdentity): string {
  return [
    input.storeId,
    input.lineOfficialAccountId,
    input.historicalLineChatUserId,
  ].join("\u0000");
}

function uniqueIdentities(items: readonly HistoricalIdentity[]): HistoricalIdentity[] {
  return [...new Map(items.map((item) => [identityKey(item), item])).values()];
}

function targetValues(items: readonly HistoricalIdentity[]): Prisma.Sql {
  return Prisma.join(
    items.map((item) => Prisma.sql`(${item.storeId}, ${item.lineOfficialAccountId}, ${item.historicalLineChatUserId})`),
  );
}

async function projectionTableExists(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ projection_table: string | null }>>(Prisma.sql`
    SELECT to_regclass('public."ConversationReplyStateProjection"')::text AS projection_table
  `);
  return Boolean(rows[0]?.projection_table);
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
      c."lineChatUserId"
    FROM public."Conversation" c
    ${cursorClause}
    ORDER BY c."id" ASC
    LIMIT ${take}
  `);
}

async function fetchMessages(
  prisma: PrismaClient,
  conversationIds: readonly string[],
): Promise<MessageRow[]> {
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

async function fetchCrosswalks(
  prisma: PrismaClient,
  conversationIds: readonly string[],
): Promise<CrosswalkRow[]> {
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

async function fetchExistingProjections(
  prisma: PrismaClient,
  conversationIds: readonly string[],
): Promise<ExistingProjectionRow[]> {
  if (conversationIds.length === 0) return [];
  return prisma.$queryRaw<ExistingProjectionRow[]>(Prisma.sql`
    SELECT
      p."conversationId",
      p."state"::text AS "state",
      p."decidingEventKind"::text AS "decidingEventKind",
      p."decidingEventAt",
      p."evidenceBoundary",
      p."resolverVersion",
      p."canonicalMessageCount",
      p."historicalMessageCount"
    FROM public."ConversationReplyStateProjection" p
    WHERE p."conversationId" IN (${Prisma.join(conversationIds)})
  `);
}

function sameProjection(left: ProjectionRow, right: ProjectionRow): boolean {
  return (
    left.state === right.state &&
    left.decidingEventKind === right.decidingEventKind &&
    left.decidingEventAt.getTime() === right.decidingEventAt.getTime() &&
    left.evidenceBoundary.getTime() === right.evidenceBoundary.getTime() &&
    left.resolverVersion === right.resolverVersion &&
    left.canonicalMessageCount === right.canonicalMessageCount &&
    left.historicalMessageCount === right.historicalMessageCount
  );
}

async function applyBatch(
  prisma: PrismaClient,
  desired: readonly ProjectionRow[],
  staleConversationIds: readonly string[],
): Promise<void> {
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  if (staleConversationIds.length > 0) {
    operations.push(
      prisma.conversationReplyStateProjection.deleteMany({
        where: { conversationId: { in: [...staleConversationIds] } },
      }),
    );
  }

  for (const row of desired) {
    operations.push(
      prisma.conversationReplyStateProjection.upsert({
        where: { conversationId: row.conversationId },
        create: {
          conversationId: row.conversationId,
          state: row.state,
          decidingEventKind: row.decidingEventKind,
          decidingEventAt: row.decidingEventAt,
          evidenceBoundary: row.evidenceBoundary,
          resolverVersion: row.resolverVersion,
          canonicalMessageCount: row.canonicalMessageCount,
          historicalMessageCount: row.historicalMessageCount,
        },
        update: {
          state: row.state,
          decidingEventKind: row.decidingEventKind,
          decidingEventAt: row.decidingEventAt,
          evidenceBoundary: row.evidenceBoundary,
          resolverVersion: row.resolverVersion,
          canonicalMessageCount: row.canonicalMessageCount,
          historicalMessageCount: row.historicalMessageCount,
          computedAt: new Date(),
        },
      }),
    );
  }

  if (operations.length > 0) await prisma.$transaction(operations);
}

async function main() {
  const batchSize = numberArg("batch-size", 200);
  const limit = numberArg("limit", Number.MAX_SAFE_INTEGER);
  const evidenceBoundary = dateArg("evidence-start", DEFAULT_EVIDENCE_START);
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();

  const summary = {
    PROJECTION_RUN_STATUS: "COMPLETE",
    MODE: apply ? "APPLY" : "DRY_RUN",
    RESOLVER_VERSION,
    EVIDENCE_BOUNDARY: evidenceBoundary.toISOString(),
    TOTAL_SCANNED: 0,
    ELIGIBLE_TOTAL: 0,
    ELIGIBLE_REPLIED: 0,
    ELIGIBLE_NOT_REPLIED: 0,
    INELIGIBLE_AMBIGUOUS: 0,
    INELIGIBLE_PRE_BOUNDARY: 0,
    INELIGIBLE_NO_DECIDING_EVENT: 0,
    WOULD_CREATE: 0,
    WOULD_UPDATE: 0,
    UNCHANGED: 0,
    WOULD_DELETE_STALE: 0,
    LINKAGE_CONFLICT_IDENTITIES: 0,
    DIRECT_LINK_AMBIGUOUS_IDENTITIES: 0,
    DATABASE_WRITES: 0,
  };

  try {
    if (!(await projectionTableExists(prisma))) {
      process.stdout.write(JSON.stringify({
        ...summary,
        PROJECTION_RUN_STATUS: "BLOCKED_PROJECTION_SCHEMA_NOT_APPLIED",
      }, null, 2) + "\n");
      return;
    }

    const ambiguousDirectIdentityKeys = new Set<string>();
    const linkageConflictIdentityKeys = new Set<string>();
    let cursor: string | undefined;

    while (summary.TOTAL_SCANNED < limit) {
      const take = Math.min(batchSize, limit - summary.TOTAL_SCANNED);
      const conversations = await fetchConversationBatch(prisma, cursor, take);
      if (conversations.length === 0) break;

      const conversationIds = conversations.map((conversation) => conversation.id);
      const [messages, crosswalks, existingRows] = await Promise.all([
        fetchMessages(prisma, conversationIds),
        fetchCrosswalks(prisma, conversationIds),
        fetchExistingProjections(prisma, conversationIds),
      ]);

      const existingByConversation = new Map(
        existingRows.map((row) => [row.conversationId, row]),
      );

      const messagesByConversation = new Map<string, MessageRow[]>();
      for (const message of messages) {
        messagesByConversation.set(message.conversationId, [
          ...(messagesByConversation.get(message.conversationId) ?? []),
          message,
        ]);
      }

      const crosswalkToConversation = new Map<string, string>();
      for (const link of crosswalks) {
        crosswalkToConversation.set(identityKey(link), link.canonicalConversationId);
      }

      const directIdentityInputs = uniqueIdentities(
        conversations.flatMap((conversation) =>
          conversation.storeId && conversation.lineChatUserId
            ? [{
                storeId: conversation.storeId,
                lineOfficialAccountId: conversation.lineOfficialAccountId,
                historicalLineChatUserId: conversation.lineChatUserId,
              }]
            : [],
        ),
      );

      const directRows = await fetchDirectCandidates(prisma, directIdentityInputs);
      const directIdsByIdentity = new Map<string, string[]>();
      for (const row of directRows) {
        const key = identityKey({
          storeId: row.storeId,
          lineOfficialAccountId: row.lineOfficialAccountId,
          historicalLineChatUserId: row.lineChatUserId,
        });
        directIdsByIdentity.set(key, [
          ...(directIdsByIdentity.get(key) ?? []),
          row.id,
        ]);
      }

      const directToConversation = new Map<string, string>();
      for (const identity of directIdentityInputs) {
        const key = identityKey(identity);
        const ids = [...new Set(directIdsByIdentity.get(key) ?? [])];
        if (ids.length === 1) directToConversation.set(key, ids[0]);
        else if (ids.length > 1) ambiguousDirectIdentityKeys.add(key);
      }

      const historicalIdentities = uniqueIdentities([
        ...crosswalks.map((link) => ({
          storeId: link.storeId,
          lineOfficialAccountId: link.lineOfficialAccountId,
          historicalLineChatUserId: link.historicalLineChatUserId,
        })),
        ...directIdentityInputs.filter((identity) => directToConversation.has(identityKey(identity))),
      ]);

      const historicalRows = await fetchHistoricalRows(prisma, historicalIdentities);
      const historicalByConversation = new Map<string, HistoricalReplyMessage[]>();

      for (const row of historicalRows) {
        const key = identityKey({
          storeId: row.storeId,
          lineOfficialAccountId: row.lineOfficialAccountId,
          historicalLineChatUserId: row.lineChatUserId,
        });
        const crosswalkConversationId = crosswalkToConversation.get(key);
        const directConversationId = directToConversation.get(key);

        if (
          crosswalkConversationId &&
          directConversationId &&
          crosswalkConversationId !== directConversationId
        ) {
          linkageConflictIdentityKeys.add(key);
          continue;
        }

        const conversationId = crosswalkConversationId ?? directConversationId;
        if (!conversationId) continue;

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

      const desiredWrites: ProjectionRow[] = [];
      const staleConversationIds: string[] = [];

      for (const conversation of conversations) {
        summary.TOTAL_SCANNED += 1;

        const canonical: CanonicalReplyMessage[] =
          (messagesByConversation.get(conversation.id) ?? []).map((message) => ({
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

        const historical = historicalByConversation.get(conversation.id) ?? [];
        const timeline = normalizeReplyTimeline({ canonical, historical });
        const resolution = resolveReplyState(timeline);
        const evidenceWindow = analyzeReplyEvidenceWindow(timeline, evidenceBoundary);
        const eligibility = classifyReplyProjectionEligibility(
          resolution.state,
          evidenceWindow,
        );

        if (!eligibility.eligible) {
          if (eligibility.reason === "AMBIGUOUS") summary.INELIGIBLE_AMBIGUOUS += 1;
          else if (eligibility.reason === "PRE_BOUNDARY_DECIDING_EVENT") {
            summary.INELIGIBLE_PRE_BOUNDARY += 1;
          } else {
            summary.INELIGIBLE_NO_DECIDING_EVENT += 1;
          }

          if (existingByConversation.has(conversation.id)) {
            staleConversationIds.push(conversation.id);
            summary.WOULD_DELETE_STALE += 1;
          }
          continue;
        }

        summary.ELIGIBLE_TOTAL += 1;
        if (eligibility.state === "REPLIED") summary.ELIGIBLE_REPLIED += 1;
        else summary.ELIGIBLE_NOT_REPLIED += 1;

        const row: ProjectionRow = {
          conversationId: conversation.id,
          state: eligibility.state,
          decidingEventKind: eligibility.decidingEventKind,
          decidingEventAt: eligibility.decidingEventAt,
          evidenceBoundary,
          resolverVersion: RESOLVER_VERSION,
          canonicalMessageCount: canonical.length,
          historicalMessageCount: historical.length,
        };
        const existing = existingByConversation.get(conversation.id);
        if (!existing) {
          summary.WOULD_CREATE += 1;
          desiredWrites.push(row);
        } else if (sameProjection(existing, row)) {
          summary.UNCHANGED += 1;
        } else {
          summary.WOULD_UPDATE += 1;
          desiredWrites.push(row);
        }
      }

      if (apply) {
        await applyBatch(prisma, desiredWrites, staleConversationIds);
        summary.DATABASE_WRITES += desiredWrites.length + staleConversationIds.length;
      }

      cursor = conversations.at(-1)?.id;
      if (conversations.length < take) break;
    }

    summary.DIRECT_LINK_AMBIGUOUS_IDENTITIES = ambiguousDirectIdentityKeys.size;
    summary.LINKAGE_CONFLICT_IDENTITIES = linkageConflictIdentityKeys.size;
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.stack ?? error.message
        : "Reply-state projection sync failed",
    );
    process.exitCode = 1;
  });
}
