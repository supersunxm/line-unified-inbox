import { Prisma, PrismaClient } from "@prisma/client";
import {
  buildDeterministicResponseCycles,
  normalizeReplyTimeline,
  resolveReplyState,
  type CanonicalReplyMessage,
  type HistoricalReplyMessage,
  type NormalizedReplyEvent,
  type ReplyEventDirection,
} from "./reply-state-resolver";

type ProjectionConversationRow = {
  conversationId: string;
  decidingEventAt: Date;
  storeId: string | null;
  storeName: string | null;
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

function numberArg(name: string, fallback: number): number {
  const prefix = "--" + name + "=";
  const raw = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) throw new Error("Invalid " + prefix + "<number>");
  return Math.floor(value);
}

function direction(value: string): ReplyEventDirection {
  if (value === "INBOUND" || value === "OUTBOUND" || value === "SYSTEM") return value;
  throw new Error("Unexpected message direction: " + value);
}

function canonicalDeliveryStatus(
  value: string,
): "DELIVERED" | "FAILED" | "PENDING" {
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
    items.map((item) =>
      Prisma.sql`(${item.storeId}, ${item.lineOfficialAccountId}, ${item.historicalLineChatUserId})`,
    ),
  );
}

function increment(target: Record<string, number>, key: string, amount = 1): void {
  target[key] = (target[key] ?? 0) + amount;
}

function bangkokDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function payloadLabel(rawPayload: unknown): string {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return "NO_PAYLOAD";
  }
  const raw = rawPayload as Record<string, unknown>;
  const source = typeof raw.source === "string" ? raw.source : null;
  const provider = typeof raw.provider === "string" ? raw.provider : null;
  if (source && provider) return "source=" + source + "|provider=" + provider;
  if (source) return "source=" + source;
  if (provider) return "provider=" + provider;
  return "PAYLOAD_WITHOUT_SOURCE";
}

async function fetchProjectionBatch(
  prisma: PrismaClient,
  cursor: string | undefined,
  take: number,
): Promise<ProjectionConversationRow[]> {
  const cursorClause = cursor
    ? Prisma.sql`AND p."conversationId" > ${cursor}`
    : Prisma.empty;
  return prisma.$queryRaw<ProjectionConversationRow[]>(Prisma.sql`
    SELECT
      p."conversationId",
      p."decidingEventAt",
      c."storeId",
      s."name" AS "storeName",
      c."lineOfficialAccountId",
      c."lineChatUserId"
    FROM public."ConversationReplyStateProjection" p
    JOIN public."Conversation" c ON c."id" = p."conversationId"
    LEFT JOIN public."Store" s ON s."id" = c."storeId"
    WHERE p."state" = 'NOT_REPLIED'
      ${cursorClause}
    ORDER BY p."conversationId" ASC
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

function topEntries(input: Record<string, number>, limit: number) {
  return Object.entries(input)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function sourceAtOpen(
  canonical: readonly CanonicalReplyMessage[],
  historical: readonly HistoricalReplyMessage[],
  openAt: Date,
): "CANONICAL_ONLY" | "HISTORICAL_ONLY" | "BOTH" | "UNKNOWN" {
  const timestamp = openAt.getTime();
  const hasCanonical = canonical.some(
    (message) =>
      message.direction === "INBOUND" &&
      message.sentAt.getTime() === timestamp,
  );
  const hasHistorical = historical.some(
    (message) =>
      message.direction === "INBOUND" &&
      message.sentAt.getTime() === timestamp,
  );
  if (hasCanonical && hasHistorical) return "BOTH";
  if (hasCanonical) return "CANONICAL_ONLY";
  if (hasHistorical) return "HISTORICAL_ONLY";
  return "UNKNOWN";
}

function outboundSignals(
  timeline: readonly NormalizedReplyEvent[],
  canonical: readonly CanonicalReplyMessage[],
  openAt: Date,
) {
  const start = openAt.getTime();
  const outbound = timeline.filter(
    (event) =>
      event.eventKind === "MESSAGE" &&
      event.direction === "OUTBOUND" &&
      event.sentAt.getTime() >= start,
  );
  const failedOrPending = canonical.filter(
    (message) =>
      message.direction === "OUTBOUND" &&
      message.sentAt.getTime() >= start &&
      (message.deliveryStatus === "FAILED" || message.deliveryStatus === "PENDING"),
  ).length;
  return {
    outboundCount: outbound.length,
    automated: outbound.filter((event) => event.actor === "AUTOMATED").length,
    unknown: outbound.filter((event) => event.actor === "UNKNOWN").length,
    human: outbound.filter((event) => event.actor === "HUMAN_STAFF").length,
    failedOrPending,
  };
}

async function main() {
  const prisma = new PrismaClient();
  const batchSize = numberArg("batch-size", 200);
  const limit = numberArg("limit", Number.MAX_SAFE_INTEGER);
  const now = new Date();

  const summary = {
    AUDIT_STATUS: "READ_ONLY_COMPLETE",
    DATABASE_WRITES: 0,
    projectedNotRepliedScanned: 0,
    dynamicNotReplied: 0,
    dynamicRepliedMismatch: 0,
    dynamicAmbiguousMismatch: 0,
    missingOpenCycle: 0,
    reopenedAfterEarlierValidReply: 0,
    neverValidlyReplied: 0,
    noOutboundAfterOpen: 0,
    automatedOutboundAfterOpen: 0,
    failedOrPendingOutboundAfterOpen: 0,
    unknownOutboundAfterOpen: 0,
    humanReplyAfterOpenUnexpected: 0,
    directLinkAmbiguousIdentities: 0,
    linkageConflictIdentities: 0,
  };

  const openSourceCounts: Record<string, number> = {};
  const openDateCounts: Record<string, number> = {};
  const openAgeBucketCounts: Record<string, number> = {};
  const storeCounts: Record<string, number> = {};
  const canonicalOpenPayloadSources: Record<string, number> = {};
  const historicalOpenEventTypes: Record<string, number> = {};
  const latestCustomerBurstSizes: Record<string, number> = {};

  const directAmbiguous = new Set<string>();
  const linkageConflicts = new Set<string>();
  let cursor: string | undefined;

  while (summary.projectedNotRepliedScanned < limit) {
    const take = Math.min(batchSize, limit - summary.projectedNotRepliedScanned);
    const conversations = await fetchProjectionBatch(prisma, cursor, take);
    if (conversations.length === 0) break;

    const conversationIds = conversations.map((conversation) => conversation.conversationId);
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
      directIdsByIdentity.set(key, [...(directIdsByIdentity.get(key) ?? []), row.id]);
    }

    const directToConversation = new Map<string, string>();
    for (const identity of directIdentityInputs) {
      const key = identityKey(identity);
      const ids = [...new Set(directIdsByIdentity.get(key) ?? [])];
      if (ids.length === 1) directToConversation.set(key, ids[0]);
      else if (ids.length > 1) directAmbiguous.add(key);
    }

    const historicalIdentities = uniqueIdentities([
      ...crosswalks.map((link) => ({
        storeId: link.storeId,
        lineOfficialAccountId: link.lineOfficialAccountId,
        historicalLineChatUserId: link.historicalLineChatUserId,
      })),
      ...directIdentityInputs.filter((identity) =>
        directToConversation.has(identityKey(identity)),
      ),
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
        linkageConflicts.add(key);
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

    for (const conversation of conversations) {
      summary.projectedNotRepliedScanned += 1;
      increment(storeCounts, conversation.storeName ?? "__NO_STORE__");

      const canonical: CanonicalReplyMessage[] =
        (messagesByConversation.get(conversation.conversationId) ?? []).map((message) => ({
          id: message.id,
          externalMessageId: message.externalMessageId,
          direction: direction(message.direction),
          deliveryStatus: canonicalDeliveryStatus(message.deliveryStatus),
          originalText: message.originalText,
          sentAt: message.sentAt,
          senderUserId: message.senderUserId,
          senderDisplayName: message.senderDisplayName,
          rawPayload: message.rawPayload,
        }));
      const historical = historicalByConversation.get(conversation.conversationId) ?? [];

      const timeline = normalizeReplyTimeline({ canonical, historical });
      const resolution = resolveReplyState(timeline);
      if (resolution.state === "REPLIED") {
        summary.dynamicRepliedMismatch += 1;
        continue;
      }
      if (resolution.state === "AMBIGUOUS") {
        summary.dynamicAmbiguousMismatch += 1;
        continue;
      }
      summary.dynamicNotReplied += 1;

      const cycleResult = buildDeterministicResponseCycles(timeline);
      if (cycleResult.status !== "DETERMINISTIC") {
        summary.dynamicAmbiguousMismatch += 1;
        continue;
      }
      const cycles = cycleResult.cycles;
      const latestCycle = cycles.at(-1);
      if (!latestCycle || latestCycle.answeredAt !== null) {
        summary.missingOpenCycle += 1;
        continue;
      }

      const openAt = latestCycle.startedAt;
      const answeredCycles = cycles.filter((cycle) => cycle.answeredAt !== null).length;
      if (answeredCycles > 0) summary.reopenedAfterEarlierValidReply += 1;
      else summary.neverValidlyReplied += 1;

      increment(openSourceCounts, sourceAtOpen(canonical, historical, openAt));
      increment(openDateCounts, bangkokDate(openAt));

      const ageDays = Math.max(
        0,
        Math.floor((now.getTime() - openAt.getTime()) / 86_400_000),
      );
      const ageBucket =
        ageDays <= 1 ? "0-1d"
        : ageDays <= 3 ? "2-3d"
        : ageDays <= 7 ? "4-7d"
        : ageDays <= 14 ? "8-14d"
        : ageDays <= 21 ? "15-21d"
        : "22+d";
      increment(openAgeBucketCounts, ageBucket);

      const signals = outboundSignals(timeline, canonical, openAt);
      if (signals.outboundCount === 0 && signals.failedOrPending === 0) {
        summary.noOutboundAfterOpen += 1;
      }
      if (signals.automated > 0) summary.automatedOutboundAfterOpen += 1;
      if (signals.failedOrPending > 0) summary.failedOrPendingOutboundAfterOpen += 1;
      if (signals.unknown > 0) summary.unknownOutboundAfterOpen += 1;
      if (signals.human > 0) summary.humanReplyAfterOpenUnexpected += 1;

      const openTimestamp = openAt.getTime();
      for (const message of canonical) {
        if (
          message.direction === "INBOUND" &&
          message.sentAt.getTime() === openTimestamp
        ) {
          increment(canonicalOpenPayloadSources, payloadLabel(message.rawPayload));
        }
      }
      for (const message of historical) {
        if (
          message.direction === "INBOUND" &&
          message.sentAt.getTime() === openTimestamp
        ) {
          increment(historicalOpenEventTypes, message.sourceEventType || "__EMPTY__");
        }
      }

      const burstSize = timeline.filter(
        (event) =>
          event.eventKind === "MESSAGE" &&
          event.direction === "INBOUND" &&
          event.actor === "CUSTOMER" &&
          event.sentAt.getTime() >= openAt.getTime(),
      ).length;
      increment(
        latestCustomerBurstSizes,
        burstSize >= 5 ? "5+" : String(Math.max(1, burstSize)),
      );
    }

    cursor = conversations.at(-1)?.conversationId;
    if (!cursor) break;
  }

  summary.directLinkAmbiguousIdentities = directAmbiguous.size;
  summary.linkageConflictIdentities = linkageConflicts.size;

  process.stdout.write(JSON.stringify({
    ...summary,
    openCycleSource: openSourceCounts,
    openCycleAgeBuckets: openAgeBucketCounts,
    openCycleByBangkokDate: topEntries(openDateCounts, 40),
    topStores: topEntries(storeCounts, 25),
    canonicalOpenInboundPayloadSources: topEntries(canonicalOpenPayloadSources, 20),
    historicalOpenInboundEventTypes: topEntries(historicalOpenEventTypes, 20),
    customerMessagesInCurrentOpenCycle: latestCustomerBurstSizes,
  }, null, 2) + "\n");

  await prisma.$disconnect();
}

void main().catch((error) => {
  process.stderr.write(JSON.stringify({
    AUDIT_STATUS: "ERROR",
    DATABASE_WRITES: 0,
    error: error instanceof Error ? error.message : String(error),
  }) + "\n");
  process.exitCode = 1;
});
