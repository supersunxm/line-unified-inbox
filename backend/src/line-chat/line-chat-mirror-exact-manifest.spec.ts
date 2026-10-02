import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { BmReplyStatus, FollowUpStatus } from "@prisma/client";
import type { PrismaService } from "../prisma.service";
import {
  LineChatMirrorReconcilerService,
  type ExactMirrorManifestExecutionResult,
} from "./line-chat-mirror-reconciler.service";
import {
  EXACT_MIRROR_MANIFEST_MAX_ROWS,
  exactMirrorIdentityKey,
  exactMirrorIdentityWhere,
  exactMirrorRawRowMatches,
  exactMirrorRawRowMatchesPriorState,
  parseExactMirrorManifestCsv,
} from "./line-chat-mirror-exact-manifest";

const HEADER = [
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
  "text_sha256",
  "text_bytes",
  "prior_reconcile_status",
  "prior_attempts",
  "canonical_near_identity_count",
  "historical_near_identity_count",
  "raw_source_id_oa_count",
].join(",");
const TEXT_HASH = createHash("sha256").update("a", "utf8").digest("hex");

function csvRows(count = EXACT_MIRROR_MANIFEST_MAX_ROWS): string[] {
  const timestamp = "2026-09-22T00:00:00.000Z";
  return Array.from({ length: count }, (_, index) => {
    const storeIndex = index % 24;
    return [
      `store-${storeIndex}`,
      `store-id-${storeIndex}`,
      `oa-id-${storeIndex}`,
      `chat-id-${storeIndex}`,
      `conversation-id-${storeIndex}`,
      `source-id-${index}`,
      timestamp,
      "2026-09-22T07:00:00+07:00",
      "OUTBOUND",
      "messageSent",
      "text",
      TEXT_HASH,
      "1",
      "PENDING",
      "0",
      "0",
      "0",
      "1",
    ].join(",");
  });
}

function bytesFor(lines: readonly string[]): Buffer {
  return Buffer.from(`${HEADER}\n${lines.length > 0 ? `${lines.join("\n")}\n` : ""}`, "utf8");
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function noRawCandidatesPrisma(whereCalls: unknown[]) {
  return {
    lineChatMirrorMessage: {
      findMany: async (query: { where: unknown }) => {
        whereCalls.push(query.where);
        return [];
      },
    },
    lineOfficialAccount: { findMany: async () => [] },
    conversation: { findMany: async () => [] },
    historicalTimelineMessage: { groupBy: async () => [] },
  };
}

function exactManifestHarness(options: {
  missingRawIndex?: number;
  canonicalOverride?: { index: number; direction?: string; text?: string; conversationId?: string; externalId?: string };
  historicalOverride?: { index: number; text?: string; chatId?: string };
} = {}) {
  const bytes = bytesFor(csvRows());
  const manifest = parseExactMirrorManifestCsv(bytes, digest(bytes));
  const rawRows = manifest.rows
    .filter((_, index) => index !== options.missingRawIndex)
    .map((row, index) => ({
      id: `raw-${index}`,
      lineOfficialAccountId: row.lineOfficialAccountId,
      lineChatUserId: row.lineChatUserId,
      managerMessageId: row.sourceEventId,
      eventType: row.eventType,
      direction: row.direction,
      messageType: row.messageType,
      text: "a",
      fileName: null,
      bizId: null,
      ownerName: null,
      sentAt: row.sentAt,
      reconcileStatus: "PENDING",
      reconcileAttempts: 0,
    }));
  const stores = Array.from({ length: 24 }, (_, index) => ({
    id: `store-id-${index}`,
    code: `store-${index}`,
    isActive: true,
    archivedAt: null,
    storeMaster: { externalStoreId: `store-${index}` },
    storeMasterAccountName: null,
    lineOfficialAccounts: [{
      id: `oa-id-${index}`,
      storeId: `store-id-${index}`,
      name: `Synthetic OA ${index}`,
      basicId: `@synthetic-${index}`,
    }],
  }));
  const oas = stores.map((store) => ({
    id: store.lineOfficialAccounts[0].id,
    storeId: store.id,
    accountType: "STORE",
    isActive: true,
    archivedAt: null,
    store: {
      id: store.id,
      code: store.code,
      isActive: true,
      archivedAt: null,
      storeMaster: { externalStoreId: store.code },
    },
  }));
  const conversations = stores.map((store, index) => ({
    id: `conversation-id-${index}`,
    storeId: store.id,
    lineOfficialAccountId: `oa-id-${index}`,
    lineChatUserId: `chat-id-${index}`,
    latestMessageAt: new Date("2026-09-22T00:00:00.000Z"),
    bmReplyStatus: BmReplyStatus.NOT_REPLIED,
    followUpStatus: FollowUpStatus.FOLLOW_UP,
    ownerUserId: null as string | null,
  }));
  const canonicalRows: Array<{
    id: string;
    conversationId: string;
    externalMessageId: string | null;
    direction: string;
    deliveryStatus: string;
    messageType: string;
    originalText: string;
    sentAt: Date;
    senderUserId: string | null;
    senderDisplayName: string;
    rawPayload: Record<string, unknown>;
  }> = [];
  if (options.canonicalOverride) {
    const row = manifest.rows[options.canonicalOverride.index];
    canonicalRows.push({
      id: "preexisting-canonical",
      conversationId: options.canonicalOverride.conversationId ?? row.canonicalConversationId,
      externalMessageId: options.canonicalOverride.externalId ?? `line-chat-manager:${row.sourceEventId}`,
      direction: options.canonicalOverride.direction ?? "OUTBOUND",
      deliveryStatus: "DELIVERED",
      messageType: "TEXT",
      originalText: options.canonicalOverride.text ?? "a",
      sentAt: row.sentAt,
      senderUserId: null,
      senderDisplayName: "Staff",
      rawPayload: { provider: "LINE_MANAGER", source: "LINE_MANAGER_MIRROR" },
    });
  }
  const historicalRows = options.historicalOverride
    ? [{
        storeId: manifest.rows[options.historicalOverride.index].storeId,
        lineOfficialAccountId: manifest.rows[options.historicalOverride.index].lineOfficialAccountId,
        lineChatUserId: options.historicalOverride.chatId
          ?? manifest.rows[options.historicalOverride.index].lineChatUserId,
        sourceEventId: manifest.rows[options.historicalOverride.index].sourceEventId,
        direction: "OUTBOUND",
        text: options.historicalOverride.text ?? "a",
        sentAt: manifest.rows[options.historicalOverride.index].sentAt,
      }]
    : [];
  const mirrorUpdates: Array<{ id: string; data: { reconcileStatus: string; reconcileAttempts?: number } }> = [];
  const conversationUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const rawWhereCalls: unknown[] = [];
  const prisma = {
    lineChatMirrorMessage: {
      findMany: async (query: { where: { OR: Array<{ lineOfficialAccountId: string; managerMessageId: string }> } }) => {
        rawWhereCalls.push(query.where);
        const wanted = new Set(query.where.OR.map((identity) => exactMirrorIdentityKey({
          lineOfficialAccountId: identity.lineOfficialAccountId,
          sourceEventId: identity.managerMessageId,
        })));
        return rawRows.filter((row) => wanted.has(exactMirrorIdentityKey({
          lineOfficialAccountId: row.lineOfficialAccountId,
          sourceEventId: row.managerMessageId,
        })));
      },
      update: async (input: { where: { id: string }; data: { reconcileStatus: string; reconcileAttempts?: number } }) => {
        mirrorUpdates.push({ id: input.where.id, data: input.data });
        const raw = rawRows.find((row) => row.id === input.where.id);
        if (raw) {
          raw.reconcileStatus = input.data.reconcileStatus;
          raw.reconcileAttempts += 1;
        }
      },
    },
    lineOfficialAccount: {
      findMany: async (query: { where: { id: { in: string[] } } }) => oas.filter((oa) => query.where.id.in.includes(oa.id)),
    },
    conversation: {
      findMany: async (query: { where?: { id?: { in: string[] } } }) => query.where?.id?.in
        ? conversations.filter((conversation) => query.where!.id!.in.includes(conversation.id))
        : [],
      findUnique: async (query: { where: { id: string } }) => conversations.find((conversation) => conversation.id === query.where.id) ?? null,
      update: async (input: { where: { id: string }; data: Record<string, unknown> }) => {
        conversationUpdates.push({ id: input.where.id, data: input.data });
        const conversation = conversations.find((item) => item.id === input.where.id);
        if (conversation) Object.assign(conversation, input.data);
        return conversation;
      },
    },
    store: {
      findFirst: async (query: { where: { id?: string } }) => stores.find((store) => store.id === query.where.id) ?? null,
    },
    historicalTimelineMessage: {
      groupBy: async () => historicalRows.map((row) => ({
        lineOfficialAccountId: row.lineOfficialAccountId,
        sourceEventId: row.sourceEventId,
        _count: { _all: 1 },
      })),
      findMany: async () => historicalRows,
    },
    historicalConversationCrosswalk: { findMany: async () => [] },
    message: {
      findMany: async (query: { where: Record<string, unknown> }) => {
        if (query.where.externalMessageId) {
          const externalMessageIds = (query.where.externalMessageId as { in: string[] }).in;
          return canonicalRows.filter((message) => message.externalMessageId && externalMessageIds.includes(message.externalMessageId));
        }
        if (query.where.direction) return [];
        if (query.where.conversationId) {
          return canonicalRows
            .filter((message) => message.conversationId === query.where.conversationId)
            .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
        }
        return canonicalRows;
      },
      findFirst: async (query: { where: { externalMessageId: { in: string[] } } }) => canonicalRows.find(
        (message) => message.externalMessageId && query.where.externalMessageId.in.includes(message.externalMessageId),
      ) ?? null,
      create: async (input: { data: Omit<typeof canonicalRows[number], "id"> }) => {
        const created = { ...input.data, id: `created-${canonicalRows.length}` };
        canonicalRows.push(created);
        return { id: created.id };
      },
      findUnique: async () => null,
    },
    user: { findMany: async () => [] },
    activityHistory: { create: async () => undefined },
  };
  const service = new LineChatMirrorReconcilerService(prisma as unknown as PrismaService);
  Object.defineProperty(service, "logger", {
    value: { log() {}, warn() {}, error() {} },
  });
  return {
    bytes,
    sha256: digest(bytes),
    manifest,
    prisma,
    service,
    rawRows,
    canonicalRows,
    mirrorUpdates,
    conversationUpdates,
    rawWhereCalls,
  };
}

function runSyntheticManifest(
  service: LineChatMirrorReconcilerService,
  bytes: Uint8Array,
  expectedSha256: string,
  apply = false,
): Promise<ExactMirrorManifestExecutionResult> {
  const testOnlyRunner = service as unknown as {
    reconcileExactManifestCsvWithExpectedHash: (
      inputBytes: Uint8Array,
      digest: string,
      shouldApply: boolean,
    ) => Promise<ExactMirrorManifestExecutionResult>;
  };
  return testOnlyRunner.reconcileExactManifestCsvWithExpectedHash(bytes, expectedSha256, apply);
}

test("exact manifest accepts exactly bounded rows and an immutable digest", () => {
  const bytes = bytesFor(csvRows());
  const parsed = parseExactMirrorManifestCsv(bytes, digest(bytes));
  assert.equal(parsed.rows.length, 490);
  assert.equal(parsed.storeCount, 24);
  assert.equal(parsed.sha256, digest(bytes));
});

test("wrong manifest digest is rejected before any database query or write", async () => {
  const calls: unknown[] = [];
  const prisma = noRawCandidatesPrisma(calls);
  const service = new LineChatMirrorReconcilerService(prisma as unknown as PrismaService);
  const bytes = bytesFor(csvRows());
  await assert.rejects(
    runSyntheticManifest(service, bytes, "0".repeat(64), true),
    /EXACT_MIRROR_MANIFEST_DIGEST_MISMATCH/u,
  );
  await assert.rejects(
    service.reconcileExactManifestCsv({ bytes, apply: true }),
    /EXACT_MIRROR_MANIFEST_DIGEST_MISMATCH/u,
  );
  assert.equal(calls.length, 0);
});

test("exact reconciliation queries only OA-scoped source identities and considers no adjacent events", async () => {
  const calls: unknown[] = [];
  const service = new LineChatMirrorReconcilerService(
    noRawCandidatesPrisma(calls) as unknown as PrismaService,
  );
  const rows = csvRows();
  rows[1] = rows[1].replace("source-id-1", "source-id-0");
  const bytes = bytesFor(rows);
  const result = await runSyntheticManifest(service, bytes, digest(bytes), true);
  assert.equal(result.manifestRows, 490);
  assert.equal(result.rawRowsFound, 0);
  assert.equal(result.missingRawSource, 490);
  assert.equal(result.writes, 0);
  assert.equal(result.outsideManifestConsidered, 0);
  const rawWhere = calls[0] as { OR: Array<{ lineOfficialAccountId: string; managerMessageId: string }> };
  assert.equal(rawWhere.OR.length, 490);
  assert.deepEqual(rawWhere.OR.slice(0, 2), [
    { lineOfficialAccountId: "oa-id-0", managerMessageId: "source-id-0" },
    { lineOfficialAccountId: "oa-id-1", managerMessageId: "source-id-0" },
  ]);
  assert.equal("sentAt" in rawWhere, false);
});

test("empty manifest and a manifest outside the frozen window are rejected without a DB scan", async () => {
  const calls: unknown[] = [];
  const service = new LineChatMirrorReconcilerService(
    noRawCandidatesPrisma(calls) as unknown as PrismaService,
  );
  const empty = bytesFor([]);
  assert.equal(parseExactMirrorManifestCsv(empty, digest(empty)).rows.length, 0);
  await assert.rejects(
    runSyntheticManifest(service, empty, digest(empty), true),
    /EXPECTED_490_ROWS_ACROSS_24_STORES/u,
  );
  const outsideWindow = csvRows();
  outsideWindow[0] = outsideWindow[0].replace(
    "2026-09-22T00:00:00.000Z,2026-09-22T07:00:00+07:00",
    "2026-10-01T15:57:00.001Z,2026-10-01T22:57:00.001+07:00",
  );
  const outside = bytesFor(outsideWindow);
  await assert.rejects(
    runSyntheticManifest(service, outside, digest(outside), true),
    /EXACT_MIRROR_MANIFEST_OUTSIDE_FROZEN_WINDOW/u,
  );
  assert.equal(calls.length, 0);
});

test("OA plus source ID is the exact selector; same ID on another OA and adjacent events are excluded", () => {
  const where = exactMirrorIdentityWhere([
    { lineOfficialAccountId: "oa-a", sourceEventId: "reused-id" },
    { lineOfficialAccountId: "oa-b", sourceEventId: "other-id" },
  ]);
  assert.deepEqual(where.OR, [
    { lineOfficialAccountId: "oa-a", managerMessageId: "reused-id" },
    { lineOfficialAccountId: "oa-b", managerMessageId: "other-id" },
  ]);
  const selected = new Set(where.OR.map((identity) => exactMirrorIdentityKey({
    lineOfficialAccountId: identity.lineOfficialAccountId,
    sourceEventId: identity.managerMessageId,
  })));
  assert.equal(selected.has(exactMirrorIdentityKey({ lineOfficialAccountId: "oa-b", sourceEventId: "reused-id" })), false);
  assert.equal(selected.has(exactMirrorIdentityKey({ lineOfficialAccountId: "oa-a", sourceEventId: "adjacent-event" })), false);
  assert.equal("sentAt" in where, false);
});

test("duplicate OA-scoped manifest identities are rejected deterministically", () => {
  const rows = csvRows();
  rows[1] = rows[1].replace("oa-id-1,chat-id-1,conversation-id-1,source-id-1", "oa-id-0,chat-id-0,conversation-id-0,source-id-0");
  const bytes = bytesFor(rows);
  assert.throws(
    () => parseExactMirrorManifestCsv(bytes, digest(bytes)),
    /EXACT_MIRROR_MANIFEST_DUPLICATE_OA_SOURCE_IDENTITY/u,
  );
});

test("source proof checks OA, chat, stable source ID, payload hash, direction, type, and timestamp", () => {
  const parsed = parseExactMirrorManifestCsv(bytesFor(csvRows(1)), digest(bytesFor(csvRows(1))));
  const expected = parsed.rows[0];
  const raw = {
    lineOfficialAccountId: expected.lineOfficialAccountId,
    lineChatUserId: expected.lineChatUserId,
    managerMessageId: expected.sourceEventId,
    eventType: expected.eventType,
    direction: expected.direction,
    messageType: expected.messageType,
    text: "a",
    sentAt: expected.sentAt,
    reconcileStatus: "PENDING",
    reconcileAttempts: 0,
  };
  assert.equal(exactMirrorRawRowMatches(raw, expected), true);
  assert.equal(exactMirrorRawRowMatchesPriorState(raw, expected), true);
  assert.equal(exactMirrorRawRowMatches({ ...raw, lineOfficialAccountId: "other-oa" }, expected), false);
  assert.equal(exactMirrorRawRowMatches({ ...raw, text: "b" }, expected), false);
  assert.equal(exactMirrorRawRowMatchesPriorState({ ...raw, reconcileStatus: "IMPORTED" }, expected), false);
});

test("a fully safe manifest dry run remains bounded and performs no writes", async () => {
  const harness = exactManifestHarness();
  const result = await runSyntheticManifest(harness.service, harness.bytes, harness.sha256);
  assert.equal(result.manifestRows, 490);
  assert.equal(result.rawRowsFound, 490);
  assert.equal(result.stillSafeToApply, 490);
  assert.equal(result.unexplained, 0);
  assert.equal(result.outsideManifestConsidered, 0);
  assert.equal(result.writes, 0);
  assert.equal(harness.mirrorUpdates.length, 0);
  assert.equal(harness.canonicalRows.length, 0);
  assert.equal(harness.rawWhereCalls.length, 1);
  const where = harness.rawWhereCalls[0] as { OR: Array<{ lineOfficialAccountId: string; managerMessageId: string }> };
  assert.equal(where.OR.length, 490);
  assert.equal("sentAt" in where, false);
});

test("valid existing canonical source identity is skipped and a different OA cannot capture it", async () => {
  const harness = exactManifestHarness({ canonicalOverride: { index: 0 } });
  const result = await runSyntheticManifest(harness.service, harness.bytes, harness.sha256);
  assert.equal(result.alreadyCanonical, 1);
  assert.equal(result.stillSafeToApply, 489);
  assert.equal(result.newConflict, 0);
  assert.equal(result.unexplained, 0);
  const where = harness.rawWhereCalls[0] as { OR: Array<{ lineOfficialAccountId: string; managerMessageId: string }> };
  assert.equal(where.OR.some((identity) => identity.lineOfficialAccountId === "oa-id-1" && identity.managerMessageId === "source-id-0"), false);
});

test("canonical payload, direction, or destination conflicts are held", async (t) => {
  const cases = [
    { name: "payload", override: { text: "different" } },
    { name: "direction", override: { direction: "INBOUND" } },
    { name: "destination", override: { conversationId: "wrong-conversation" } },
  ] as const;
  for (const item of cases) {
    await t.test(item.name, async () => {
      const harness = exactManifestHarness({ canonicalOverride: { index: 0, ...item.override } });
      const result = await runSyntheticManifest(harness.service, harness.bytes, harness.sha256);
      assert.equal(result.newConflict, 1);
      assert.equal(result.stillSafeToApply, 489);
      assert.equal(result.unexplained, 0);
    });
  }
});

test("valid Historical-only overlap remains eligible for existing Reconciler canonicalization", async () => {
  const harness = exactManifestHarness({ historicalOverride: { index: 0 } });
  const result = await runSyntheticManifest(harness.service, harness.bytes, harness.sha256);
  assert.equal(result.historicalOverlap, 1);
  assert.equal(result.stillSafeToApply, 490);
  assert.equal(result.newConflict, 0);
  assert.equal(result.unexplained, 0);
});

test("an invalid or absent LINK_SAFE destination mapping is held without changing canonical identity", async () => {
  const harness = exactManifestHarness();
  const firstConversation = harness.manifest.rows[0].canonicalConversationId;
  const conversation = (harness.prisma.conversation as unknown as { findMany: (query: unknown) => Promise<unknown[]> });
  const original = conversation.findMany;
  conversation.findMany = async (query: unknown) => {
    const rows = await original(query);
    return rows.map((item) => item && typeof item === "object" && "id" in item && item.id === firstConversation
      ? { ...item, lineChatUserId: "different-chat-id" }
      : item);
  };
  const result = await runSyntheticManifest(harness.service, harness.bytes, harness.sha256);
  assert.equal(result.newHold, 21);
  assert.equal(result.stillSafeToApply, 469);
  assert.equal(result.reasons.CANONICAL_DESTINATION_IDENTITY_NOT_PROVEN, 21);
  assert.equal(result.unexplained, 0);
});

test("apply uses the existing reconciler and the second run is insert-free", async () => {
  const harness = exactManifestHarness();
  const first = await runSyntheticManifest(harness.service, harness.bytes, harness.sha256, true);
  assert.equal(first.writes, 490);
  assert.equal(first.newConflict, 0);
  assert.equal(first.newHold, 0);
  assert.equal(harness.canonicalRows.length, 490);
  assert.equal(harness.mirrorUpdates.length, 490);
  assert.equal(harness.conversationUpdates.some((update) => "ownerUserId" in update.data), false);

  const second = await runSyntheticManifest(harness.service, harness.bytes, harness.sha256);
  assert.equal(second.stillSafeToApply, 0);
  assert.equal(second.alreadyCanonical, 490);
  assert.equal(second.writes, 0);
  assert.equal(second.unexplained, 0);
});

test("a separately bounded four-row manifest never discovers adjacent original rows", async () => {
  const harness = exactManifestHarness();
  const all = csvRows();
  const bytes = bytesFor([all[0], all[1], all[24], all[25]]);
  const runner = harness.service as unknown as {
    reconcileExactManifestCsvWithExpectedHash: (bytes: Uint8Array, hash: string, apply: boolean, rows: number, stores: number) => Promise<ExactMirrorManifestExecutionResult>;
  };
  const first = await runner.reconcileExactManifestCsvWithExpectedHash(bytes, digest(bytes), true, 4, 2);
  assert.equal(first.manifestRows, 4);
  assert.equal(first.rawRowsFound, 4);
  assert.equal(first.writes, 4);
  assert.equal(first.outsideManifestConsidered, 0);
  assert.equal(harness.canonicalRows.length, 4);
  assert.equal(harness.mirrorUpdates.length, 4);
  const second = await runner.reconcileExactManifestCsvWithExpectedHash(bytes, digest(bytes), false, 4, 2);
  assert.equal(second.alreadyCanonical, 4);
  assert.equal(second.stillSafeToApply, 0);
  assert.equal(second.writes, 0);
  await assert.rejects(harness.service.reconcileExactManifestCsv({ bytes, apply: true }), /DIGEST_MISMATCH/u);
});

test("a separately bounded nineteen-row manifest cannot select adjacent events or caller-supplied digests", async () => {
  const harness = exactManifestHarness();
  const all = csvRows();
  const selected = [...Array.from({ length: 18 }, (_, index) => all[Math.floor(index / 6) * 24 + index % 6]), all[72]];
  const bytes = bytesFor(selected);
  const runner = harness.service as unknown as {
    reconcileExactManifestCsvWithExpectedHash: (bytes: Uint8Array, hash: string, apply: boolean, rows: number, stores: number) => Promise<ExactMirrorManifestExecutionResult>;
  };
  const first = await runner.reconcileExactManifestCsvWithExpectedHash(bytes, digest(bytes), true, 19, 6);
  assert.equal(first.manifestRows, 19);
  assert.equal(first.rawRowsFound, 19);
  assert.equal(first.writes, 19);
  assert.equal(first.outsideManifestConsidered, 0);
  assert.equal(harness.canonicalRows.length, 19);
  assert.equal(harness.mirrorUpdates.length, 19);
  const second = await runner.reconcileExactManifestCsvWithExpectedHash(bytes, digest(bytes), false, 19, 6);
  assert.equal(second.alreadyCanonical, 19);
  assert.equal(second.stillSafeToApply, 0);
  assert.equal(second.writes, 0);
  await assert.rejects(harness.service.reconcileExactManifestCsv({ bytes, apply: true }), /DIGEST_MISMATCH/u);
});
