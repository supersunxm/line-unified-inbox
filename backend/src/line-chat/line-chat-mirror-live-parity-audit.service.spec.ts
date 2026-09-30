import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { LineChatMirrorLiveParityAuditService } from "./line-chat-mirror-live-parity-audit.service";

const aggregate = (input: Partial<{
  section: "LEGACY" | "LIVE" | "COVERAGE";
  direction: string | null;
  reconcileStatus: string;
  count: bigint | number;
  canonicalPresent: boolean;
  canonicalImported: boolean;
  canonicalDuplicate: boolean;
  storeChatsVisible: boolean;
  matchingWebhook: boolean;
  exactIdentity: boolean;
  replyStatus: string | null;
  followUpStatus: string | null;
  configuredStores: bigint | number | null;
  attachedStores: bigint | number | null;
  completedAfterWatermark: bigint | number | null;
}> = {}) => ({
  section: "LIVE" as const,
  direction: "OUTBOUND",
  reconcileStatus: "PENDING",
  count: 1,
  canonicalPresent: false,
  canonicalImported: false,
  canonicalDuplicate: false,
  storeChatsVisible: false,
  matchingWebhook: false,
  exactIdentity: false,
  replyStatus: null,
  followUpStatus: null,
  configuredStores: null,
  attachedStores: null,
  completedAfterWatermark: null,
  ...input,
});

test("live-parity audit separates legacy debt from post-watermark live events", async () => {
  const capturedQueries: Prisma.Sql[] = [];
  const prisma = {
    $queryRaw: async (query: Prisma.Sql) => {
      capturedQueries.push(query);
      return [
        aggregate({ section: "COVERAGE", direction: null, reconcileStatus: "COVERAGE", count: 0, configuredStores: 2, attachedStores: 2, completedAfterWatermark: 1 }),
        aggregate({ section: "LEGACY", direction: null, reconcileStatus: "UNMAPPED", count: 3 }),
        aggregate({ section: "LEGACY", direction: null, reconcileStatus: "WAITING_CANONICAL", count: 2 }),
        aggregate({ direction: "OUTBOUND", reconcileStatus: "IMPORTED", count: 2, canonicalPresent: true, canonicalImported: true, storeChatsVisible: true, exactIdentity: true, replyStatus: "REPLIED", followUpStatus: "FOLLOW_UP" }),
        aggregate({ direction: "OUTBOUND", reconcileStatus: "DUPLICATE", canonicalPresent: true, canonicalDuplicate: true, storeChatsVisible: true, exactIdentity: true, replyStatus: "NOT_REPLIED", followUpStatus: "FOLLOW_UP" }),
        aggregate({ direction: "OUTBOUND", reconcileStatus: "PENDING", exactIdentity: false }),
        aggregate({ direction: "INBOUND", reconcileStatus: "PENDING", matchingWebhook: true, exactIdentity: true }),
        aggregate({ direction: "INBOUND", reconcileStatus: "WAITING_CANONICAL", matchingWebhook: true, exactIdentity: true }),
        aggregate({ direction: "INBOUND", reconcileStatus: "WAITING_CANONICAL", count: 2, exactIdentity: true }),
        aggregate({ direction: "INBOUND", reconcileStatus: "UNMAPPED", exactIdentity: false }),
        aggregate({ direction: "UNKNOWN", reconcileStatus: "PENDING" }),
      ];
    },
  } as unknown as PrismaService;

  const watermark = new Date("2026-09-30T00:00:00.000Z");
  const previousScope = process.env.LINE_CHAT_MIRROR_STORE_CODES;
  process.env.LINE_CHAT_MIRROR_STORE_CODES = "store-1,store-2";
  let report: Awaited<ReturnType<LineChatMirrorLiveParityAuditService["getReport"]>>;
  try {
    report = await new LineChatMirrorLiveParityAuditService(prisma).getReport(watermark);
  } finally {
    if (previousScope === undefined) delete process.env.LINE_CHAT_MIRROR_STORE_CODES;
    else process.env.LINE_CHAT_MIRROR_STORE_CODES = previousScope;
  }

  assert.equal(report.watermark, watermark.toISOString());
  assert.deepEqual(report.legacyEvidenceDebt, { unmapped: 3, waitingCanonical: 2 });
  assert.deepEqual(report.postWatermarkLive.storeCoverage, {
    configuredStores: 2,
    attachedStores: 2,
    completedAfterWatermark: 1,
    pendingAfterWatermark: 1,
  });
  assert.equal(report.postWatermarkLive.outbound.total, 4);
  assert.equal(report.postWatermarkLive.outbound.resolved, 3);
  assert.equal(report.postWatermarkLive.outbound.unresolved, 1);
  assert.equal(report.postWatermarkLive.outbound.canonicalImported, 2);
  assert.equal(report.postWatermarkLive.outbound.canonicalDuplicate, 1);
  assert.equal(report.postWatermarkLive.outbound.storeChatsVisible, 3);
  assert.equal(report.postWatermarkLive.outbound.mappingGap, 1);
  assert.equal(report.postWatermarkLive.outbound.exactIdentityEvidence, 3);
  assert.equal(report.postWatermarkLive.inbound.total, 5);
  assert.equal(report.postWatermarkLive.inbound.resolved, 2);
  assert.equal(report.postWatermarkLive.inbound.unresolved, 3);
  assert.equal(report.postWatermarkLive.inbound.matchingCanonicalWebhook, 2);
  assert.equal(report.postWatermarkLive.inbound.exactIdentityEvidence, 4);
  assert.equal(report.postWatermarkLive.inbound.webhookGap, 3);
  assert.equal(report.postWatermarkLive.inbound.waitingCanonical, 2);
  assert.equal(report.postWatermarkLive.inbound.unresolvedIdentity, 1);
  assert.equal(report.postWatermarkLive.unknownDirection, 1);
  assert.deepEqual(report.postWatermarkLive.replyStates, [
    { bmReplyStatus: "NOT_REPLIED", followUpStatus: "FOLLOW_UP", outboundEvents: 1 },
    { bmReplyStatus: "REPLIED", followUpStatus: "FOLLOW_UP", outboundEvents: 2 },
  ]);

  assert.equal(capturedQueries.length, 1);
  for (const query of capturedQueries) {
    assert.match(query.sql, /SELECT/u);
    assert.doesNotMatch(query.sql, /\b(?:INSERT|UPDATE|DELETE)\b/iu);
    assert.equal(query.values.includes(watermark), true);
  }
  assert.doesNotMatch(JSON.stringify(report), /lineChatUserId|lineOfficialAccountId|managerMessageId|synthetic/u);
});

test("live-parity audit rejects invalid and future watermarks before database access", async () => {
  let queryCount = 0;
  const prisma = {
    $queryRaw: async () => { queryCount += 1; return []; },
  } as unknown as PrismaService;
  const service = new LineChatMirrorLiveParityAuditService(prisma);

  await assert.rejects(service.getReport(new Date(Number.NaN)), /INVALID_LIVE_PARITY_WATERMARK/u);
  await assert.rejects(service.getReport(new Date(Date.now() + 60_000)), /INVALID_LIVE_PARITY_WATERMARK/u);
  assert.equal(queryCount, 0);
});

test("live-parity audit requires a configured fleet scope", async () => {
  let queryCount = 0;
  const prisma = {
    $queryRaw: async () => { queryCount += 1; return []; },
  } as unknown as PrismaService;
  const previousScope = process.env.LINE_CHAT_MIRROR_STORE_CODES;
  delete process.env.LINE_CHAT_MIRROR_STORE_CODES;
  try {
    await assert.rejects(
      new LineChatMirrorLiveParityAuditService(prisma).getReport(new Date("2026-09-30T00:00:00.000Z")),
      /LIVE_PARITY_AUDIT_FLEET_SCOPE_EMPTY/u,
    );
    assert.equal(queryCount, 0);
  } finally {
    if (previousScope === undefined) delete process.env.LINE_CHAT_MIRROR_STORE_CODES;
    else process.env.LINE_CHAT_MIRROR_STORE_CODES = previousScope;
  }
});
