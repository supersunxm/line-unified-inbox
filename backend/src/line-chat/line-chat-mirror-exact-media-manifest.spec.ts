import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { MessageType } from "@prisma/client";
import type { PrismaService } from "../prisma.service";
import {
  LineChatMirrorReconcilerService,
  type ExactMirrorManifestExecutionResult,
  mirrorCanonicalExternalId,
} from "./line-chat-mirror-reconciler.service";
import {
  exactMirrorIdentityKey,
  exactMirrorRawRowMatches,
  parseExactMirrorManifestCsv,
} from "./line-chat-mirror-exact-manifest";

const MEDIA_HEADER = [
  "store_code",
  "store_id",
  "line_official_account_id",
  "line_chat_user_id",
  "canonical_conversation_id",
  "source_event_id",
  "sent_at_utc",
  "sent_at_bangkok",
  "direction",
  "event_type",
  "message_type",
  "source_payload_sha256",
  "text_sha256",
  "text_bytes",
  "file_name_sha256",
  "file_name_bytes",
  "biz_id_sha256",
  "actor_class",
  "prior_reconcile_status",
  "prior_attempts",
  "raw_source_id_oa_count",
  "link_type",
].join(",");

const MEDIA_TYPES = ["sticker", "image", "file"] as const;
const EMPTY_SHA256 = createHash("sha256").update("", "utf8").digest("hex");
const STAFF_BIZ_ID = "staff-account-1";
const SENT_AT = "2026-09-22T00:00:00.000Z";

type MediaType = typeof MEDIA_TYPES[number];
type FakeCanonical = {
  id: string;
  conversationId: string;
  externalMessageId: string | null;
  direction: string;
  deliveryStatus: string;
  messageType: string;
  originalText: string;
  fileName: string | null;
  sentAt: Date;
  senderUserId: string | null;
  senderDisplayName: string;
  rawPayload: Record<string, unknown>;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function mediaCsvRow(index: number, messageType: MediaType): string {
  const sourceEventId = `media-source-${index}`;
  const lineChatUserId = `media-chat-${index}`;
  const fileName = messageType === "file" ? "statement.pdf" : "";
  const textSha256 = EMPTY_SHA256;
  const fileNameSha256 = sha256(fileName);
  const bizIdSha256 = sha256(STAFF_BIZ_ID);
  const actorClass = "HUMAN_STAFF";
  const sourcePayloadSha256 = sha256(JSON.stringify({
    oaId: "media-oa",
    storeId: "media-store",
    chatUserId: lineChatUserId,
    sourceEventId,
    sentAt: SENT_AT,
    direction: "OUTBOUND",
    eventType: "messageSent",
    messageType,
    textSha256,
    fileNameSha256,
    bizIdSha256,
    actorClass,
  }));
  return [
    "28220",
    "media-store",
    "media-oa",
    lineChatUserId,
    `media-conversation-${index}`,
    sourceEventId,
    SENT_AT,
    "2026-09-22T07:00:00+07:00",
    "OUTBOUND",
    "messageSent",
    messageType,
    sourcePayloadSha256,
    textSha256,
    "0",
    fileNameSha256,
    String(Buffer.byteLength(fileName, "utf8")),
    bizIdSha256,
    actorClass,
    "PENDING",
    "0",
    "1",
    "DIRECT",
  ].join(",");
}

function manifestBytes(): Buffer {
  const rows = MEDIA_TYPES.map((messageType, index) => mediaCsvRow(index, messageType));
  return Buffer.from(`${MEDIA_HEADER}\n${rows.join("\n")}\n`, "utf8");
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function matchesIdentityFilter(message: FakeCanonical, filter: Record<string, unknown>, conversations: FakeConversation[]): boolean {
  const external = filter.externalMessageId as { in?: string[] } | undefined;
  if (external) return external.in?.includes(message.externalMessageId ?? "") ?? false;

  const and = filter.AND as Array<Record<string, unknown>> | undefined;
  if (!and) return false;
  let oaMatches = false;
  let payloadMatches = false;
  for (const condition of and) {
    if (condition.conversation) {
      const relation = condition.conversation as { lineOfficialAccountId?: string };
      const conversation = conversations.find((item) => item.id === message.conversationId);
      oaMatches = conversation?.lineOfficialAccountId === relation.lineOfficialAccountId;
    }
    if (condition.rawPayload) {
      const json = condition.rawPayload as { path?: string[]; equals?: string };
      const value = json.path?.reduce<unknown>((current, key) => {
        return current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined;
      }, message.rawPayload);
      payloadMatches = value === json.equals;
    }
  }
  return oaMatches && payloadMatches;
}

type FakeConversation = {
  id: string;
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  latestMessageAt: Date;
  bmReplyStatus: string;
  followUpStatus: string;
  ownerUserId: string | null;
};

function mediaHarness(options: {
  nearTimeIndex?: number;
  aliasIndex?: number;
  aliasWrongOa?: boolean;
  fileNameMismatchIndex?: number;
} = {}) {
  const bytes = manifestBytes();
  const manifest = parseExactMirrorManifestCsv(bytes, digest(bytes));
  const rawRows = manifest.rows.map((row, index) => ({
    id: `media-raw-${index}`,
    lineOfficialAccountId: row.lineOfficialAccountId,
    lineChatUserId: row.lineChatUserId,
    managerMessageId: row.sourceEventId,
    eventType: row.eventType,
    direction: row.direction,
    messageType: row.messageType,
    text: null as string | null,
    fileName: row.messageType === "file" ? "statement.pdf" : null,
    bizId: STAFF_BIZ_ID,
    ownerName: null as string | null,
    sentAt: row.sentAt,
    reconcileStatus: "PENDING",
    reconcileAttempts: 0,
  }));
  const conversations: FakeConversation[] = manifest.rows.map((row, index) => ({
    id: row.canonicalConversationId,
    storeId: row.storeId,
    lineOfficialAccountId: row.lineOfficialAccountId,
    lineChatUserId: row.lineChatUserId,
    latestMessageAt: new Date(row.sentAt.getTime() + 86_400_000),
    bmReplyStatus: "NOT_REPLIED",
    followUpStatus: "FOLLOW_UP",
    ownerUserId: null,
  }));
  const store = {
    id: "media-store",
    code: "28220",
    isActive: true,
    archivedAt: null,
    storeMaster: { externalStoreId: "28220", accountName: null, normalizedAccountName: null, lineId: null },
    lineOfficialAccounts: [{ id: "media-oa", storeId: "media-store", name: "Synthetic Media OA", basicId: "@media" }],
  };
  const oa = {
    id: "media-oa",
    storeId: "media-store",
    accountType: "STORE",
    isActive: true,
    archivedAt: null,
    store: {
      id: "media-store",
      code: "28220",
      isActive: true,
      archivedAt: null,
      storeMaster: { externalStoreId: "28220" },
    },
  };
  const canonicalRows: FakeCanonical[] = [];
  const aliasIndex = options.aliasIndex;
  if (aliasIndex !== undefined) {
    const row = manifest.rows[aliasIndex];
    canonicalRows.push({
      id: "canonical-alias",
      conversationId: options.aliasWrongOa ? "other-oa-conversation" : row.canonicalConversationId,
      externalMessageId: null,
      direction: "OUTBOUND",
      deliveryStatus: "DELIVERED",
      messageType: row.messageType.toUpperCase(),
      originalText: row.messageType === "file" ? "statement.pdf" : `[${row.messageType[0].toUpperCase()}${row.messageType.slice(1)}]`,
      fileName: row.messageType === "file"
        ? options.fileNameMismatchIndex === aliasIndex ? "other.pdf" : "statement.pdf"
        : null,
      sentAt: row.sentAt,
      senderUserId: null,
      senderDisplayName: "Staff",
      rawPayload: { managerMessageId: mirrorCanonicalExternalId(row.sourceEventId) },
    });
  }
  if (options.nearTimeIndex !== undefined) {
    const row = manifest.rows[options.nearTimeIndex];
    canonicalRows.push({
      id: "canonical-near-time",
      conversationId: row.canonicalConversationId,
      externalMessageId: "unrelated-source-id",
      direction: "OUTBOUND",
      deliveryStatus: "DELIVERED",
      messageType: row.messageType.toUpperCase(),
      originalText: "different representation",
      fileName: "different.pdf",
      sentAt: new Date(row.sentAt.getTime() + 1_000),
      senderUserId: null,
      senderDisplayName: "Staff",
      rawPayload: {},
    });
  }
  const mirrorUpdates: Array<{ id: string; status: string }> = [];
  const conversationUpdates: Array<{ id: string; keys: string[] }> = [];
  const rawIdentityCalls: unknown[] = [];
  const prisma = {
    lineChatMirrorMessage: {
      findMany: async (query: { where: Record<string, unknown> }) => {
        const alternatives = query.where.OR as Array<{ lineOfficialAccountId: string; managerMessageId: string }> | undefined;
        if (alternatives) {
          rawIdentityCalls.push(query.where);
          const wanted = new Set(alternatives.map((identity) => exactMirrorIdentityKey({
            lineOfficialAccountId: identity.lineOfficialAccountId,
            sourceEventId: identity.managerMessageId,
          })));
          return rawRows.filter((row) => wanted.has(exactMirrorIdentityKey({
            lineOfficialAccountId: row.lineOfficialAccountId,
            sourceEventId: row.managerMessageId,
          })));
        }
        const ids = (query.where.managerMessageId as { in?: string[] } | undefined)?.in ?? [];
        return rawRows.filter((row) => ids.includes(row.managerMessageId));
      },
      update: async (input: { where: { id: string }; data: { reconcileStatus: string } }) => {
        const raw = rawRows.find((candidate) => candidate.id === input.where.id);
        if (raw) {
          raw.reconcileStatus = input.data.reconcileStatus;
          raw.reconcileAttempts += 1;
        }
        mirrorUpdates.push({ id: input.where.id, status: input.data.reconcileStatus });
      },
    },
    lineOfficialAccount: { findMany: async () => [oa] },
    store: { findFirst: async () => store },
    conversation: {
      findMany: async (query: { where?: { id?: { in?: string[] } } }) => {
        const ids = query.where?.id?.in;
        return ids ? conversations.filter((conversation) => ids.includes(conversation.id)) : [];
      },
      findUnique: async (query: { where: { id: string } }) => conversations.find((row) => row.id === query.where.id) ?? null,
      update: async (input: { where: { id: string }; data: Record<string, unknown> }) => {
        conversationUpdates.push({ id: input.where.id, keys: Object.keys(input.data) });
        const conversation = conversations.find((row) => row.id === input.where.id);
        if (conversation) Object.assign(conversation, input.data);
        return conversation;
      },
    },
    historicalTimelineMessage: { findMany: async () => [] },
    historicalConversationCrosswalk: { findMany: async () => [] },
    message: {
      findMany: async (query: { where: Record<string, unknown> }) => {
        if (Array.isArray(query.where.OR)) {
          const filters = query.where.OR as Array<Record<string, unknown>>;
          return canonicalRows.filter((message) => filters.some((filter) => matchesIdentityFilter(message, filter, conversations)))
            .map((message) => ({ ...message, conversation: conversations.find((item) => item.id === message.conversationId) }));
        }
        if (typeof query.where.direction === "string") {
          const sentAt = query.where.sentAt as { gte: Date; lte: Date };
          return canonicalRows.filter((message) => message.conversationId === query.where.conversationId
            && message.direction === query.where.direction
            && message.deliveryStatus === query.where.deliveryStatus
            && message.messageType === query.where.messageType
            && message.sentAt >= sentAt.gte
            && message.sentAt <= sentAt.lte);
        }
        if (typeof query.where.conversationId === "string") {
          return canonicalRows.filter((message) => message.conversationId === query.where.conversationId)
            .sort((left, right) => right.sentAt.getTime() - left.sentAt.getTime());
        }
        return [];
      },
      findFirst: async (query: { where: Record<string, unknown> }) => {
        const filters = query.where.OR as Array<Record<string, unknown>> | undefined;
        return canonicalRows.find((message) => filters?.some((filter) => matchesIdentityFilter(message, filter, conversations))) ?? null;
      },
      create: async (input: { data: Record<string, unknown> }) => {
        const created = { ...input.data, id: `canonical-${canonicalRows.length}` } as FakeCanonical;
        canonicalRows.push(created);
        return { id: created.id };
      },
      findUnique: async () => null,
    },
    user: { findMany: async () => [] },
    activityHistory: { create: async () => undefined },
  };
  const service = new LineChatMirrorReconcilerService(prisma as unknown as PrismaService);
  Object.defineProperty(service, "logger", { value: { log() {}, warn() {}, error() {} } });
  return { bytes, manifest, service, rawRows, canonicalRows, mirrorUpdates, conversationUpdates, rawIdentityCalls };
}

async function runMediaManifest(
  harness: ReturnType<typeof mediaHarness>,
  apply = false,
): Promise<ExactMirrorManifestExecutionResult> {
  const runner = harness.service as unknown as {
    reconcileExactManifestCsvWithExpectedHash: (
      bytes: Uint8Array,
      sha256: string,
      apply: boolean,
      rows: number,
      stores: number,
    ) => Promise<ExactMirrorManifestExecutionResult>;
  };
  return runner.reconcileExactManifestCsvWithExpectedHash(
    harness.bytes,
    digest(harness.bytes),
    apply,
    harness.manifest.rows.length,
    harness.manifest.storeCount,
  );
}

test("media manifest binds source fingerprint to OA/chat/source/type/file metadata", () => {
  const harness = mediaHarness();
  const row = harness.manifest.rows[0];
  const raw = harness.rawRows[0];
  assert.equal(row.kind, "MEDIA");
  assert.equal(exactMirrorRawRowMatches(raw, row), true);
  assert.equal(exactMirrorRawRowMatches({ ...raw, lineOfficialAccountId: "other-oa" }, row), false);
  assert.equal(exactMirrorRawRowMatches({ ...raw, bizId: "__AUTO_RESPONSE" }, row), false);
  assert.equal(exactMirrorRawRowMatches({ ...raw, messageType: "image" }, row), false);
});

test("exact media apply is bounded, uses canonical media types, and is idempotent", async () => {
  const harness = mediaHarness();
  const first = await runMediaManifest(harness, true);
  assert.equal(first.manifestRows, 3);
  assert.equal(first.storeCount, 1);
  assert.equal(first.rawRowsFound, 3);
  assert.equal(first.stillSafeToApply, 3);
  assert.equal(first.writes, 3);
  assert.equal(first.outsideManifestConsidered, 0);
  assert.equal(first.unexplained, 0);
  assert.deepEqual(harness.canonicalRows.map((row) => row.messageType).sort(), [MessageType.FILE, MessageType.IMAGE, MessageType.STICKER].sort());
  assert.equal(harness.mirrorUpdates.length, 3);
  assert.equal(harness.rawIdentityCalls.length, 1);

  const second = await runMediaManifest(harness);
  assert.equal(second.alreadyCanonical, 3);
  assert.equal(second.stillSafeToApply, 0);
  assert.equal(second.writes, 0);
  assert.equal(second.outsideManifestConsidered, 0);
  assert.equal(second.unexplained, 0);
});

test("media exact preflight fails closed on a same-type outbound near-time canonical", async () => {
  const harness = mediaHarness({ nearTimeIndex: 0 });
  const result = await runMediaManifest(harness);
  assert.equal(result.newHold, 1);
  assert.equal(result.reasons.CANONICAL_CONTENT_TIME_NEAR_MATCH_REQUIRES_REVIEW, 1);
  assert.equal(result.stillSafeToApply, 2);
  assert.equal(result.writes, 0);
  assert.equal(result.unexplained, 0);
});

test("source-payload alias recognition is OA-scoped and checks FILE name", async (t) => {
  await t.test("same-OA exact alias is represented once", async () => {
    const harness = mediaHarness({ aliasIndex: 0 });
    const result = await runMediaManifest(harness);
    assert.equal(result.alreadyCanonical, 1);
    assert.equal(result.stillSafeToApply, 2);
    assert.equal(result.unexplained, 0);
  });

  await t.test("same alias on another OA is not captured", async () => {
    const harness = mediaHarness({ aliasIndex: 0, aliasWrongOa: true });
    const result = await runMediaManifest(harness);
    assert.equal(result.alreadyCanonical, 0);
    assert.equal(result.stillSafeToApply, 3);
    assert.equal(result.unexplained, 0);
  });

  await t.test("a FILE alias with a different filename is a conflict", async () => {
    const harness = mediaHarness({ aliasIndex: 2, fileNameMismatchIndex: 2 });
    const result = await runMediaManifest(harness);
    assert.equal(result.newConflict, 1);
    assert.equal(result.reasons.EXISTING_CANONICAL_IDENTITY_PAYLOAD_OR_DESTINATION_CONFLICT, 1);
    assert.equal(result.stillSafeToApply, 2);
    assert.equal(result.unexplained, 0);
  });
});
