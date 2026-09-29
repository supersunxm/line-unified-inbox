import assert from "node:assert/strict";
import test from "node:test";
import { MonthlySummaryService, bangkokMonthBounds, calculateResponseCycles, calculateResponseCyclesWithDiagnostics, isHumanStaffReply, monthlyOverview, monthlyVolume, responseMetrics, tagAnalytics, tagQuality, teamAnalytics, type AnalyticsMessage } from "./monthly-summary.service";
import { OWNER_TRACKING_STARTED_AT, OWNER_TRACKING_STARTED_AT_ISO, isOwnerTrackingInbound } from "../owner-tracking";

const inbound = (id: string, conversationId: string, sentAt: string, messageType = "TEXT"): AnalyticsMessage => ({ id, conversationId, sentAt: new Date(sentAt), direction: "INBOUND", messageType, deliveryStatus: "DELIVERED", senderUserId: null });
const outbound = (id: string, conversationId: string, sentAt: string, senderUserId: string | null = "bm-1", overrides: Partial<AnalyticsMessage> = {}): AnalyticsMessage => ({ id, conversationId, sentAt: new Date(sentAt), direction: "OUTBOUND", messageType: "TEXT", deliveryStatus: "DELIVERED", senderUserId, ...overrides });
const system = (id: string, conversationId: string, sentAt: string): AnalyticsMessage => ({ id, conversationId, sentAt: new Date(sentAt), direction: "SYSTEM", messageType: "TEXT", deliveryStatus: "DELIVERED", senderUserId: null });

void test("monthly overview uses current operational status for selected inbound conversations", () => {
  const start = new Date("2026-08-01T00:00:00Z");
  const end = new Date("2026-09-01T00:00:00Z");
  const result = monthlyOverview([
    { ...inbound("1", "answered", "2026-08-02T00:00:00Z"), bmReplyStatus: "REPLIED" },
    { ...inbound("2", "waiting", "2026-08-03T00:00:00Z"), bmReplyStatus: "NOT_REPLIED" },
    { ...inbound("3", "outside", "2026-07-31T23:00:00Z"), bmReplyStatus: "REPLIED" },
  ], start, end);
  assert.deepEqual(result, { incomingMessages: 2, incomingConversations: 2, repliedConversations: 1, waitingConversations: 1 });
});

void test("team analytics counts distinct human conversations and keeps bot separate", () => {
  const start = new Date("2026-08-01T00:00:00Z");
  const end = new Date("2026-09-01T00:00:00Z");
  const result = teamAnalytics([
    { ...outbound("1", "c1", "2026-08-02T00:00:00Z", "bm-1"), senderDisplayName: "Kittiya" },
    { ...outbound("2", "c1", "2026-08-02T01:00:00Z", "bm-1"), senderDisplayName: "Kittiya" },
    { ...outbound("3", "c2", "2026-08-02T02:00:00Z", "bm-1"), senderDisplayName: "Kittiya" },
    { ...outbound("4", "c3", "2026-08-02T03:00:00Z", "bm-2"), senderDisplayName: "Somchai" },
    { ...outbound("5", "c4", "2026-08-02T04:00:00Z", null), senderDisplayName: "Legacy" },
    { ...outbound("6", "c5", "2026-08-02T05:00:00Z", null), senderDisplayName: "Auto Reply Bot" },
  ], start, end);
  assert.deepEqual(result.humanReplies.map(({ userId, displayName, conversationsReplied, outboundMessages }) => ({ userId, displayName, conversationsReplied, outboundMessages })), [
    { userId: "bm-1", displayName: "Kittiya", conversationsReplied: 2, outboundMessages: 3 },
    { userId: "bm-2", displayName: "Somchai", conversationsReplied: 1, outboundMessages: 1 },
  ]);
  assert.equal(result.humanReplies[0]?.workloadShare, 2 / 3);
  assert.deepEqual(result.bot, { conversationsReplied: 1, outboundMessages: 1 });
});

void test("QA conversations can be excluded before cycle calculation", () => {
  const messages = [inbound("qa", "qa-conversation", "2026-08-05T00:00:00.000Z"), inbound("real", "real-conversation", "2026-08-05T01:00:00.000Z")];
  assert.equal(monthlyVolume(messages.filter((message) => message.conversationId !== "qa-conversation"), new Date("2026-08-01T00:00:00Z"), new Date("2026-09-01T00:00:00Z")).incomingMessages, 1);
});

void test("non-QA inbound messages are counted once per message and conversation", () => {
  const messages = [inbound("1", "c1", "2026-08-01T01:00:00Z"), inbound("2", "c1", "2026-08-01T02:00:00Z"), inbound("3", "c2", "2026-08-01T03:00:00Z")];
  const result = monthlyVolume(messages, new Date("2026-08-01T00:00:00Z"), new Date("2026-09-01T00:00:00Z"));
  assert.deepEqual(result, { incomingMessages: 3, incomingConversations: 2, bmReplies: 0 });
});

void test("confirmed human outbound is counted while null sender is excluded", () => {
  const messages = [outbound("1", "c1", "2026-08-02T00:00:00Z"), outbound("2", "c1", "2026-08-02T01:00:00Z", null), system("3", "c1", "2026-08-02T02:00:00Z")];
  assert.equal(monthlyVolume(messages, new Date("2026-08-01T00:00:00Z"), new Date("2026-09-01T00:00:00Z")).bmReplies, 1);
});

void test("multi-inbound burst creates one cycle", () => {
  const cycles = calculateResponseCycles([inbound("1", "c1", "2026-08-01T00:00:00Z"), inbound("2", "c1", "2026-08-01T00:30:00Z"), outbound("3", "c1", "2026-08-01T01:00:00Z")]);
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0]?.durationSeconds, 3600);
});

void test("inbound/reply/inbound/reply creates two cycles", () => {
  const cycles = calculateResponseCycles([inbound("1", "c1", "2026-08-01T00:00:00Z"), outbound("2", "c1", "2026-08-01T01:00:00Z"), inbound("3", "c1", "2026-08-01T02:00:00Z"), outbound("4", "c1", "2026-08-01T03:00:00Z")]);
  assert.deepEqual(cycles.map((cycle) => cycle.durationSeconds), [3600, 3600]);
});

void test("unanswered cycle remains open", () => {
  const cycles = calculateResponseCycles([inbound("1", "c1", "2026-08-01T00:00:00Z")]);
  assert.equal(cycles[0]?.answeredAt, null);
  assert.equal(cycles[0]?.durationSeconds, null);
});

void test("unknown outbound actor makes the monthly cycle ambiguous instead of guessing", () => {
  const result = calculateResponseCyclesWithDiagnostics([
    inbound("1", "c1", "2026-08-01T00:00:00Z"),
    outbound("2", "c1", "2026-08-01T01:00:00Z", null),
  ]);
  assert.equal(result.cycles.length, 0);
  assert.equal(result.ambiguousConversations, 1);
  assert.equal(result.ambiguityReasons.UNKNOWN_OUTBOUND_ACTOR, 1);
});

void test("LINE Manager mirror outbound counts as a human reply without senderUserId", () => {
  const messages = [
    inbound("1", "c1", "2026-09-05T01:00:00Z"),
    outbound("2", "c1", "2026-09-05T01:30:00Z", null, {
      rawPayload: { provider: "LINE_MANAGER", source: "LINE_MANAGER_MIRROR" },
    }),
  ];
  const cycles = calculateResponseCycles(messages);
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0]?.durationSeconds, 1800);
  assert.equal(isHumanStaffReply(messages[1]), true);
});

void test("failed, pending, and automated outbound do not close a response cycle", () => {
  for (const reply of [
    outbound("failed", "c1", "2026-09-05T01:30:00Z", "bm-1", { deliveryStatus: "FAILED" }),
    outbound("pending", "c1", "2026-09-05T01:30:00Z", "bm-1", { deliveryStatus: "PENDING" }),
    outbound("auto", "c1", "2026-09-05T01:30:00Z", "bot", { senderDisplayName: "Auto Reply Bot", rawPayload: { source: "AUTO_RESPONSE" } }),
  ]) {
    const cycles = calculateResponseCycles([
      inbound("1", "c1", "2026-09-05T01:00:00Z"),
      reply,
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0]?.answeredAt, null);
  }
});

void test("monthly reply volume counts LINE Manager staff replies and excludes failed or automated outbound", () => {
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-10-01T00:00:00Z");
  const result = monthlyVolume([
    outbound("manager", "c1", "2026-09-05T01:30:00Z", null, { rawPayload: { provider: "LINE_MANAGER", source: "LINE_MANAGER_MIRROR" } }),
    outbound("failed", "c2", "2026-09-05T02:00:00Z", "bm-1", { deliveryStatus: "FAILED" }),
    outbound("auto", "c3", "2026-09-05T03:00:00Z", "bot", { senderDisplayName: "Auto Reply Bot", rawPayload: { source: "AUTO_RESPONSE" } }),
  ], start, end);
  assert.equal(result.bmReplies, 1);
});

void test("image and sticker inbound messages start cycles", () => {
  const cycles = calculateResponseCycles([inbound("1", "c1", "2026-08-01T00:00:00Z", "IMAGE"), outbound("2", "c1", "2026-08-01T01:00:00Z"), inbound("3", "c1", "2026-08-01T02:00:00Z", "STICKER")]);
  assert.equal(cycles.length, 2);
  assert.equal(cycles[1]?.answeredAt, null);
});

void test("SYSTEM messages are ignored", () => {
  const cycles = calculateResponseCycles([system("1", "c1", "2026-08-01T00:00:00Z"), inbound("2", "c1", "2026-08-01T01:00:00Z"), system("3", "c1", "2026-08-01T02:00:00Z")]);
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0]?.answeredAt, null);
});

void test("response bucket boundaries are half-open", () => {
  const cycles = [
    { conversationId: "1", startedAt: new Date("2026-08-01T00:00:00Z"), answeredAt: new Date("2026-08-01T03:59:59Z"), durationSeconds: 4 * 3600 - 1 },
    { conversationId: "2", startedAt: new Date("2026-08-01T00:00:00Z"), answeredAt: new Date("2026-08-01T04:00:00Z"), durationSeconds: 4 * 3600 },
    { conversationId: "3", startedAt: new Date("2026-08-01T00:00:00Z"), answeredAt: new Date("2026-08-01T12:00:00Z"), durationSeconds: 12 * 3600 },
    { conversationId: "4", startedAt: new Date("2026-08-01T00:00:00Z"), answeredAt: new Date("2026-08-02T00:00:00Z"), durationSeconds: 24 * 3600 },
  ];
  assert.deepEqual(responseMetrics(cycles, new Date("2026-08-01T00:00:00Z"), new Date("2026-09-01T00:00:00Z")).buckets, { under4h: 1, from4To12h: 1, from12To24h: 1, over24h: 1 });
});

void test("Bangkok month boundaries convert local midnight to UTC", () => {
  const bounds = bangkokMonthBounds("2026-08");
  assert.equal(bounds.start.toISOString(), "2026-07-31T17:00:00.000Z");
  assert.equal(bounds.end.toISOString(), "2026-08-31T17:00:00.000Z");
});

void test("cross-month reply is attributed to inbound month", () => {
  const cycles = calculateResponseCycles([inbound("1", "c1", "2026-08-31T16:30:00Z"), outbound("2", "c1", "2026-08-31T18:00:00Z")]);
  assert.equal(cycles[0]?.startedAt.toISOString(), "2026-08-31T16:30:00.000Z");
  assert.equal(cycles[0]?.durationSeconds, 5400);
});

void test("30 Sep 23:55 Bangkok inbound and 1 Oct 00:10 reply stays a September 15-minute cycle", () => {
  const cycles = calculateResponseCycles([
    inbound("1", "c1", "2026-09-30T16:55:00Z"),
    outbound("2", "c1", "2026-09-30T17:10:00Z"),
  ]);
  const september = bangkokMonthBounds("2026-09");
  const metrics = responseMetrics(cycles, september.start, september.end);
  assert.equal(cycles[0]?.startedAt.toISOString(), "2026-09-30T16:55:00.000Z");
  assert.equal(cycles[0]?.durationSeconds, 900);
  assert.equal(metrics.cyclesStarted, 1);
  assert.equal(metrics.cyclesAnswered, 1);
});

void test("below threshold keeps response values unavailable", () => {
  const cycles = Array.from({ length: 9 }, (_, index) => ({ conversationId: String(index), startedAt: new Date(`2026-08-${String(index + 1).padStart(2, "0")}T00:00:00Z`), answeredAt: new Date(`2026-08-${String(index + 1).padStart(2, "0")}T01:00:00Z`), durationSeconds: 3600 }));
  const result = responseMetrics(cycles, new Date("2026-08-01T00:00:00Z"), new Date("2026-09-01T00:00:00Z"));
  assert.equal(result.available, false);
  assert.equal(result.averageSeconds, null);
  assert.equal(result.responseRate, null);
});

void test("threshold makes response metrics available", () => {
  const cycles = Array.from({ length: 10 }, (_, index) => ({ conversationId: String(index), startedAt: new Date(`2026-08-${String(index + 1).padStart(2, "0")}T00:00:00Z`), answeredAt: new Date(`2026-08-${String(index + 1).padStart(2, "0")}T01:00:00Z`), durationSeconds: 3600 }));
  const result = responseMetrics(cycles, new Date("2026-08-01T00:00:00Z"), new Date("2026-09-01T00:00:00Z"));
  assert.equal(result.available, true);
  assert.equal(result.responseRate, 1);
  assert.equal(result.medianSeconds, 3600);
});

void test("outbound before inbound does not create a cycle", () => {
  assert.equal(calculateResponseCycles([outbound("1", "c1", "2026-08-01T00:00:00Z"), inbound("2", "c1", "2026-08-01T01:00:00Z")]).length, 1);
});

void test("messages are ordered chronologically before cycle calculation", () => {
  const cycles = calculateResponseCycles([outbound("2", "c1", "2026-08-01T01:00:00Z"), inbound("1", "c1", "2026-08-01T00:00:00Z")]);
  assert.equal(cycles[0]?.durationSeconds, 3600);
});

void test("equal inbound and human reply timestamps are excluded as ordering ambiguity", () => {
  const result = calculateResponseCyclesWithDiagnostics([
    inbound("a", "c1", "2026-08-01T00:00:00Z"),
    outbound("b", "c1", "2026-08-01T00:00:00Z"),
  ]);
  assert.equal(result.cycles.length, 0);
  assert.equal(result.ambiguityReasons.ORDERING_CONFLICT, 1);
});

void test("a second outbound after a reply does not create another cycle", () => {
  const cycles = calculateResponseCycles([inbound("1", "c1", "2026-08-01T00:00:00Z"), outbound("2", "c1", "2026-08-01T01:00:00Z"), outbound("3", "c1", "2026-08-01T02:00:00Z")]);
  assert.equal(cycles.length, 1);
});

void test("summary queries explicitly constrain analytics to non-QA conversations", async () => {
  let captured: unknown;
  const prisma = {
    message: { findMany: async (args: { where: unknown }) => { captured = args.where; return []; } },
    conversation: { findMany: async () => [] },
  };
  const service = new MonthlySummaryService(prisma as never, { accessibleStoreIds: async () => ["store-1"] } as never);
  await service.get({ id: "u", role: "VIEWER", isActive: true, email: "a", displayName: "A" }, "2026-08");
  assert.deepEqual(captured, { conversation: { isQa: false, store: { isActive: true, archivedAt: null }, storeId: { in: ["store-1"] } }, sentAt: { lte: captured && (captured as { sentAt: { lte: Date } }).sentAt.lte } });
});

void test("monthly reply cards use selected response cycles rather than current conversation status", async () => {
  const messages = [
    inbound("jul-answered-in", "jul-answered", "2026-07-05T02:00:00Z"),
    outbound("jul-answered-out", "jul-answered", "2026-07-05T03:00:00Z"),
    inbound("jul-open-in", "jul-open", "2026-07-10T02:00:00Z"),
    inbound("aug-open-in", "aug-open", "2026-08-05T02:00:00Z"),
  ];
  const conversationQueries: Array<{ select?: Record<string, unknown> }> = [];
  const prisma = {
    message: { findMany: async () => messages },
    conversation: { findMany: async (args: { select?: Record<string, unknown> }) => { conversationQueries.push(args); return []; } },
  };
  const service = new MonthlySummaryService(prisma as never, { accessibleStoreIds: async () => null } as never);
  const july = await service.get({ id: "u", role: "ADMIN", isActive: true, email: "a", displayName: "A" }, "2026-07");
  const august = await service.get({ id: "u", role: "ADMIN", isActive: true, email: "a", displayName: "A" }, "2026-08");

  assert.deepEqual(july.operational, { needReply: 1, completed: 1, asOf: july.period.asOf });
  assert.deepEqual(august.operational, { needReply: 1, completed: 0, asOf: august.period.asOf });
  assert.equal(july.operational.needReply + july.operational.completed, july.response.cyclesStarted);
  assert.equal(august.operational.needReply + august.operational.completed, august.response.cyclesStarted);
  assert.equal(july.response.cyclesStarted, 2);
  assert.equal(august.response.cyclesStarted, 1);
  assert.ok(conversationQueries.every(({ select }) => !select || !("bmReplyStatus" in select)));
});

void test("historical monthly reply counts are unaffected by current bmReplyStatus changes", async () => {
  const messages = [inbound("in", "c1", "2026-07-05T02:00:00Z"), outbound("out", "c1", "2026-07-05T03:00:00Z")];
  let currentStatus = "NOT_REPLIED";
  const prisma = {
    message: { findMany: async () => messages },
    conversation: { findMany: async (args: { select?: Record<string, unknown> }) => {
      if (args.select && "bmReplyStatus" in args.select) return [{ bmReplyStatus: currentStatus }];
      return [];
    } },
  };
  const service = new MonthlySummaryService(prisma as never, { accessibleStoreIds: async () => null } as never);
  const before = await service.get({ id: "u", role: "ADMIN", isActive: true, email: "a", displayName: "A" }, "2026-07");
  currentStatus = "REPLIED";
  const after = await service.get({ id: "u", role: "ADMIN", isActive: true, email: "a", displayName: "A" }, "2026-07");
  assert.deepEqual(before.operational, { needReply: 0, completed: 1, asOf: before.period.asOf });
  assert.deepEqual(after.operational, { needReply: 0, completed: 1, asOf: after.period.asOf });
});

void test("current month comparison uses same elapsed range", () => {
  const current = bangkokMonthBounds("2026-08");
  const previous = bangkokMonthBounds("2026-07");
  const asOf = new Date(current.start.getTime() + 14 * 24 * 3600 * 1000);
  const previousEnd = new Date(Math.min(previous.end.getTime(), previous.start.getTime() + (asOf.getTime() - current.start.getTime())));
  assert.equal(previousEnd.toISOString(), "2026-07-14T17:00:00.000Z");
});

void test("previous comparison is unavailable when coverage begins later", async () => {
  const prisma = {
    message: { findMany: async () => [inbound("1", "c1", "2026-08-05T00:00:00Z")] },
    conversation: { findMany: async () => [] },
  };
  const service = new MonthlySummaryService(prisma as never, { accessibleStoreIds: async () => null } as never);
  const result = await service.get({ id: "u", role: "ADMIN", isActive: true, email: "a", displayName: "A" }, "2026-08");
  assert.equal(result.comparison.available, false);
});

void test("future month is rejected", async () => {
  const service = new MonthlySummaryService({} as never, { accessibleStoreIds: async () => null } as never);
  await assert.rejects(() => service.get({ id: "u", role: "ADMIN", isActive: true, email: "a", displayName: "A" }, "2999-01"));
});

void test("invalid month is rejected", async () => {
  const service = new MonthlySummaryService({} as never, { accessibleStoreIds: async () => null } as never);
  await assert.rejects(() => service.get({ id: "u", role: "ADMIN", isActive: true, email: "a", displayName: "A" }, "2026-13"));
});

void test("tag analytics uses mutually exclusive source buckets", () => {
  const result = tagAnalytics([
    { sourceChannels: ["STORE"], isInstallment: false, products: [] },
    { sourceChannels: ["ONLINE"], isInstallment: false, products: [] },
    { sourceChannels: ["STORE", "ONLINE"], isInstallment: false, products: [] },
    { sourceChannels: [], isInstallment: false, products: [] },
  ]);
  assert.deepEqual(result.sources, { storeOnly: 1, onlineOnly: 1, storeAndOnline: 1, untagged: 1 });
  assert.equal(Object.values(result.sources).reduce((sum, count) => sum + count, 0), 4);
});

void test("tag coverage counts customer installment status separately from sources", () => {
  const result = tagAnalytics([
    { sourceChannels: [], isInstallment: true, products: [] },
    { sourceChannels: [], isInstallment: false, products: [{ productModel: { id: "p1", name: "Reno" }, productVariant: null }] },
    { sourceChannels: [], isInstallment: false, products: [{ productModel: { id: "p1", name: "Reno" }, productVariant: { ram: "12", rom: "256", color: "Purple" } }] },
    { sourceChannels: ["STORE"], isInstallment: false, products: [] },
    { sourceChannels: [], isInstallment: false, products: [] },
  ]);
  assert.equal(result.coverage.eligibleConversations, 5);
  assert.equal(result.coverage.taggedConversations, 4);
  assert.equal(result.coverage.coverageRate, 0.8);
  assert.equal(result.coverage.quality, "STRONG");
  assert.equal(result.installment.count, 1);
  assert.equal(result.installment.eligibleRate, 0.2);
  assert.equal(result.installment.taggedRate, 0.25);
  assert.equal(result.topProducts[0]?.count, 2);
  assert.equal(result.topVariants[0]?.color, "Purple");
});

void test("tag quality thresholds are centralized", () => {
  assert.equal(tagQuality(0.19), "LOW");
  assert.equal(tagQuality(0.2), "PARTIAL");
  assert.equal(tagQuality(0.5), "MODERATE");
  assert.equal(tagQuality(0.8), "STRONG");
});

void test("owner tracking cutoff uses Bangkok midnight in UTC", () => {
  assert.equal(OWNER_TRACKING_STARTED_AT_ISO, "2026-08-29T17:00:00.000Z");
  assert.equal(isOwnerTrackingInbound({ direction: "INBOUND", createdAt: new Date("2026-08-29T16:59:59.999Z") }), false);
  assert.equal(isOwnerTrackingInbound({ direction: "INBOUND", createdAt: OWNER_TRACKING_STARTED_AT }), true);
  assert.equal(isOwnerTrackingInbound({ direction: "OUTBOUND", createdAt: new Date("2026-08-30T00:00:00.000Z") }), false);
});

void test("ownership summary excludes legacy conversations from the current snapshot denominator", async () => {
  const captured: unknown[] = [];
  const prisma = {
    message: { findMany: async () => [] },
    conversation: {
      findMany: async () => [],
      count: async ({ where }: { where: { messages?: unknown } }) => {
        captured.push(where);
        return where.messages ? 3 : 10;
      },
      groupBy: async ({ where }: { where: unknown }) => {
        captured.push(where);
        return [{ ownerUserId: "owner-1", _count: { _all: 2 } }];
      },
    },
    user: { findMany: async () => [{ id: "owner-1", displayName: "Owner One" }] },
  };
  const service = new MonthlySummaryService(prisma as never, { accessibleStoreIds: async () => ["store-1"] } as never);
  const result = await service.get({ id: "user-1", role: "VIEWER", isActive: true, email: "staff@example.com", displayName: "Staff" }, "2026-08");

  assert.deepEqual(result.ownership, {
    mode: "CURRENT_SNAPSHOT",
    trackingStartedAt: OWNER_TRACKING_STARTED_AT_ISO,
    trackedConversations: 3,
    legacyExcluded: 7,
    withOwner: 2,
    withoutOwner: 1,
    coverageRate: 2 / 3,
    byOwner: [{ userId: "owner-1", displayName: "Owner One", conversations: 2 }],
  });
  assert.ok(JSON.stringify(captured).includes('"createdAt":{"gte":"2026-08-29T17:00:00.000Z"}'));
});
