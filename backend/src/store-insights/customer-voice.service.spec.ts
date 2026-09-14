import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { CustomerVoiceAnalysisSource } from "@prisma/client";
import { CUSTOMER_VOICE_ANALYSIS_VERSION } from "./customer-voice-taxonomy";
import { CustomerVoiceService } from "./customer-voice.service";

const user = { id: "user-1", email: "user@example.test", displayName: "User", role: "VIEWER", isActive: true } as never;

function analysis(source: CustomerVoiceAnalysisSource, primaryTopic: string | null, secondaryTopics: string[] = [], intent: string | null = null, productMentions: string[] = [], confidence: number | null = 0.85, modelProvider: string | null = null) {
  return { source, primaryTopic, secondaryTopics, intent, productMentions, confidence, modelProvider };
}

function buildService(current: unknown[], previous: unknown[] = [], options: { storeExists?: boolean; assertAccess?: () => Promise<void> } = {}) {
  const calls: { conversationWheres: unknown[]; analysisWheres: unknown[] } = { conversationWheres: [], analysisWheres: [] };
  const prisma = {
    store: { findFirst: async () => options.storeExists !== false ? { id: "store-1" } : null },
    conversation: {
      count: async ({ where }: { where: { messages?: { some?: { sentAt?: { gte?: Date; lt?: Date } } } } }) => {
        calls.conversationWheres.push(where);
        const start = where.messages?.some?.sentAt?.gte?.toISOString();
        return start?.startsWith("2026-09-07T17:00:00") ? 2 : 1;
      },
    },
    conversationAnalytics: {
      findMany: async ({ where }: { where: { conversation?: { messages?: { some?: { sentAt?: { gte?: Date } } } } } }) => {
        calls.analysisWheres.push(where);
        const start = where.conversation?.messages?.some?.sentAt?.gte?.toISOString();
        return start?.startsWith("2026-09-07T17:00:00") ? previous : current;
      },
    },
  };
  const access = { assertStoreAccess: options.assertAccess ?? (async () => undefined) };
  return { service: new CustomerVoiceService(prisma as never, access as never), calls };
}

test("Customer Voice API scopes to active STORE conversations and aggregates one row per conversation", async () => {
  const { service, calls } = buildService([
    analysis(CustomerVoiceAnalysisSource.MIXED_ENRICHED, "Price Inquiry", ["Stock Availability"], "PRICE_CHECK", ["OPPO Reno16"]),
    analysis(CustomerVoiceAnalysisSource.UNCLASSIFIED, null),
  ]);
  const result = await service.getCustomerVoice(user, "store-1", { from: "2026-09-09", to: "2026-09-09" });

  assert.equal(result.coverage.totalConversations, 1);
  assert.equal(result.coverage.analysisRows, 2);
  assert.equal(result.coverage.classifiedConversations, 1);
  assert.equal(result.coverage.unclassifiedConversations, 1);
  assert.equal(result.coverage.notAnalyzedConversations, 0);
  assert.deepEqual(result.topTopics.map(({ label, count }) => ({ label, count })), [
    { label: "Price Inquiry", count: 1 },
    { label: "Stock Availability", count: 1 },
  ]);
  assert.deepEqual(result.topProducts.map(({ label, count }) => ({ label, count })), [{ label: "OPPO Reno16", count: 1 }]);
  assert.equal(calls.conversationWheres[0] && (calls.conversationWheres[0] as { isQa: boolean }).isQa, false);
  assert.deepEqual((calls.conversationWheres[0] as { lineOfficialAccount: unknown }).lineOfficialAccount, { accountType: "STORE", isActive: true, archivedAt: null });
  assert.equal((calls.conversationWheres[0] as { messages: { some: { direction: string } } }).messages.some.direction, "INBOUND");
});

test("a conversation with only historical analysis rows is not counted as current-version analyzed", async () => {
  const { service, calls } = buildService([]);
  const result = await service.getCustomerVoice(user, "store-1", { from: "2026-09-09", to: "2026-09-09" });
  assert.equal(result.coverage.analyzedConversations, 0);
  assert.equal(result.coverage.classifiedConversations, 0);
  assert.equal(result.coverage.unclassifiedConversations, 0);
  assert.equal(result.coverage.notAnalyzedConversations, 1);
  assert.equal((calls.analysisWheres[0] as { analysisVersion: string }).analysisVersion, CUSTOMER_VOICE_ANALYSIS_VERSION);
});

test("comparison is zero-safe and returns NEW without dividing by zero", async () => {
  const { service } = buildService([analysis(CustomerVoiceAnalysisSource.RULE_ENRICHED, "Complaint", [], "COMPLAINT")], []);
  const result = await service.getCustomerVoice(user, "store-1", { from: "2026-09-09", to: "2026-09-09", compareFrom: "2026-09-08", compareTo: "2026-09-08" });
  const item = result.topTopics.find(({ label }) => label === "Complaint");
  assert.equal(item?.previousCount, 0);
  assert.equal(item?.trend, "NEW");
  assert.equal(item?.changePercentage, null);
  assert.deepEqual(result.comparisonPeriod, { from: "2026-09-08", to: "2026-09-08", timezone: "Asia/Bangkok" });
});

test("no comparison is explicit and HEAD_OFFICE cannot enter the where clause", async () => {
  const { service, calls } = buildService([analysis(CustomerVoiceAnalysisSource.EXISTING_TOPIC, "Price Inquiry")]);
  const result = await service.getCustomerVoice(user, "store-1", { from: "2026-09-09", to: "2026-09-09" });
  assert.equal(result.comparisonPeriod, null);
  assert.equal(result.topTopics[0].trend, "NO_COMPARISON");
  assert.doesNotMatch(JSON.stringify(calls.conversationWheres[0]), /HEAD_OFFICE/);
  assert.equal(JSON.stringify(calls.conversationWheres[0]).includes('"accountType":"STORE"'), true);
});

test("authorization is checked before the store is read", async () => {
  let storeRead = false;
  const { service } = buildService([], [], { assertAccess: async () => { throw new ForbiddenException("Store access is forbidden"); } });
  const prisma = (service as unknown as { prisma: { store: { findFirst: () => Promise<unknown> } } }).prisma;
  prisma.store.findFirst = async () => { storeRead = true; return null; };
  await assert.rejects(() => service.getCustomerVoice(user, "other-store", { from: "2026-09-09", to: "2026-09-09" }), ForbiddenException);
  assert.equal(storeRead, false);
});

function drilldownConversation(id: string, name: string, inboundAt: string, currentAnalysis: Record<string, unknown> | null, extras: Record<string, unknown> = {}, historicalVersions: string[] = []) {
  return {
    id,
    latestMessageAt: new Date(inboundAt),
    customer: { displayName: name },
    messages: [
      { id: id + "-in", direction: "INBOUND", sentAt: new Date(inboundAt), senderUserId: null, senderDisplayName: null, sender: null },
      ...(extras.reply ? [{ id: id + "-out", direction: "OUTBOUND", sentAt: new Date(new Date(inboundAt).getTime() + 10 * 60 * 1000), senderUserId: "staff-1", senderDisplayName: "Staff One", sender: null }] : []),
    ],
    customerSalesStatus: extras.customerSalesStatus ?? null,
    sourceChannels: [],
    isInstallment: false,
    paymentMethod: null,
    purchaseRecordedAt: null,
    purchaseRecordedById: null,
    salesRecordedAt: null,
    salesRecordedById: null,
    salesProducts: [],
    products: [],
    customerVoiceAnalyses: [...historicalVersions.map((analysisVersion) => ({ analysisVersion })), ...(currentAnalysis ? [{ analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION, ...currentAnalysis }] : [])],
  };
}

test("Customer Voice drill-down uses only the current version and returns safe paginated evidence", async () => {
  const conversations = [
    drilldownConversation("c-topic", "Customer Topic", "2026-09-09T03:00:00.000Z", analysis(CustomerVoiceAnalysisSource.RULE_ENRICHED, "Price Inquiry", ["Promotion"], "PRICE_CHECK", ["OPPO Reno16"]), { reply: true }),
    drilldownConversation("c-unclassified", "Customer Unclassified", "2026-09-09T04:00:00.000Z", analysis(CustomerVoiceAnalysisSource.UNCLASSIFIED, null)),
    drilldownConversation("c-other", "Customer Other", "2026-09-09T05:00:00.000Z", analysis(CustomerVoiceAnalysisSource.MIXED_ENRICHED, "After-sales / Repair", [], "AFTER_SALES", ["OPPO Find X8"]), { customerSalesStatus: "PURCHASED" }),
    drilldownConversation("c-not-analyzed", "Customer Not Analyzed", "2026-09-09T06:00:00.000Z", null, {}, ["customer-voice-rules-v1", "customer-voice-rules-v2"]),
  ];
  const calls: { conversationWhere?: unknown; select?: unknown; writes: number } = { writes: 0 };
  const prisma = {
    store: {
      findFirst: async () => ({ id: "store-1", name: "Store One", code: "S1", region: "Central", storeMaster: { externalStoreId: "1001", province: "Bangkok", region: "Central" }, lineOfficialAccounts: [{ id: "oa-1", name: "Store OA", basicId: "@store", connectionStatus: "CONNECTED", lastWebhookReceivedAt: null }] }),
    },
    conversation: {
      count: async () => conversations.length,
      findMany: async (args: { where: unknown; select: unknown }) => { calls.conversationWhere = args.where; calls.select = args.select; return conversations; },
    },
    conversationAnalytics: { findMany: async () => { calls.writes++; return []; } },
  };
  const access = { assertStoreAccess: async () => undefined };
  const service = new CustomerVoiceService(prisma as never, access as never);

  const result = await service.getCustomerVoiceDrilldown(user, "store-1", { from: "2026-09-09", to: "2026-09-09", dimension: "topic", value: "Price Inquiry", pageSize: 1 });

  assert.equal(result.analysisVersion, CUSTOMER_VOICE_ANALYSIS_VERSION);
  assert.equal(result.coverage.totalConversations, 4);
  assert.equal(result.coverage.analysisRows, 3);
  assert.equal(result.coverage.classifiedConversations, 2);
  assert.equal(result.coverage.unclassifiedConversations, 1);
  assert.equal(result.coverage.notAnalyzedConversations, 1);
  assert.deepEqual(result.distribution.map(({ label, count }) => ({ label, count })), [
    { label: "After-sales / Repair", count: 1 },
    { label: "Price Inquiry", count: 1 },
    { label: "Promotion", count: 1 },
  ]);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, "c-topic");
  assert.equal(result.items[0].responseStatus, "REPLIED");
  assert.equal(result.items[0].customer.displayName, "Customer Topic");
  assert.equal("rawPayload" in result.items[0], false);
  assert.equal("originalText" in result.items[0], false);
  assert.equal(calls.writes, 0);
  const selectedAnalysis = (calls.select as { customerVoiceAnalyses: { where: unknown } }).customerVoiceAnalyses.where;
  assert.deepEqual(selectedAnalysis, { analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION });
  assert.equal(JSON.stringify(calls.conversationWhere).includes("HEAD_OFFICE"), false);
  assert.equal(JSON.stringify(calls.conversationWhere).includes('"accountType":"STORE"'), true);

  const unclassified = await service.getCustomerVoiceDrilldown(user, "store-1", { from: "2026-09-09", to: "2026-09-09", unclassified: true, pageSize: 10 });
  assert.deepEqual(unclassified.items.map(({ id }) => id), ["c-unclassified"]);
  assert.equal(unclassified.items[0].source, CustomerVoiceAnalysisSource.UNCLASSIFIED);
  const notAnalyzed = await service.getCustomerVoiceDrilldown(user, "store-1", { from: "2026-09-09", to: "2026-09-09", notAnalyzed: true, pageSize: 10 });
  assert.deepEqual(notAnalyzed.items.map(({ id }) => id), ["c-not-analyzed"]);
  assert.equal(notAnalyzed.items[0].source, null);
  assert.equal(notAnalyzed.items[0].analysisVersion, null);
  const intent = await service.getCustomerVoiceDrilldown(user, "store-1", { from: "2026-09-09", to: "2026-09-09", dimension: "intent", value: "AFTER_SALES", pageSize: 10 });
  assert.deepEqual(intent.items.map(({ id }) => id), ["c-other"]);
  const product = await service.getCustomerVoiceDrilldown(user, "store-1", { from: "2026-09-09", to: "2026-09-09", dimension: "product", value: "OPPO Reno16", responseStatus: "REPLIED", pageSize: 10 });
  assert.deepEqual(product.items.map(({ id }) => id), ["c-topic"]);
});

test("Customer Voice drill-down authorization runs before store or conversation reads", async () => {
  let storeRead = false;
  let conversationRead = false;
  const prisma = {
    store: { findFirst: async () => { storeRead = true; return null; } },
    conversation: { count: async () => { conversationRead = true; return 0; }, findMany: async () => [] },
  };
  const access = { assertStoreAccess: async () => { throw new ForbiddenException("Store access is forbidden"); } };
  const service = new CustomerVoiceService(prisma as never, access as never);
  await assert.rejects(() => service.getCustomerVoiceDrilldown(user, "other-store", { from: "2026-09-09", to: "2026-09-09" }), ForbiddenException);
  assert.equal(storeRead, false);
  assert.equal(conversationRead, false);
});

test("analysis upsert is idempotent and never writes ConversationTopic rows", async () => {
  const upserts: unknown[] = [];
  const prisma = {
    conversation: {
      findUnique: async () => ({
        id: "conversation-1",
        storeId: "store-1",
        isQa: false,
        lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null },
        messages: [{ id: "message-1", originalText: "ราคา OPPO Reno16", sentAt: new Date("2026-09-09T01:00:00.000Z") }],
        topics: [{ confidence: 0.8, topic: { name: "Price Inquiry" } }],
      }),
    },
    conversationAnalytics: {
      upsert: async (args: unknown) => { upserts.push(args); return { source: CustomerVoiceAnalysisSource.MIXED_ENRICHED, primaryTopic: "Price Inquiry", secondaryTopics: [], intent: "PRICE_CHECK", productMentions: ["OPPO Reno16"], confidence: 0.86 }; },
    },
    productModel: { findMany: async () => [] },
  };
  const service = new CustomerVoiceService(prisma as never);
  await service.analyzeConversation("conversation-1", [{ id: "model-1", name: "OPPO Reno16", classificationLevel: "MODEL", priority: 1, aliases: [{ alias: "Reno16", safety: "SAFE_EXACT", priority: 0 }], productSeries: { name: "Reno", productGroup: "SMARTPHONE" } }]);
  await service.analyzeConversation("conversation-1", [{ id: "model-1", name: "OPPO Reno16", classificationLevel: "MODEL", priority: 1, aliases: [{ alias: "Reno16", safety: "SAFE_EXACT", priority: 0 }], productSeries: { name: "Reno", productGroup: "SMARTPHONE" } }]);
  assert.equal(upserts.length, 2);
  assert.deepEqual((upserts[0] as { where: unknown }).where, { conversationId_analysisVersion: { conversationId: "conversation-1", analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION } });
  const firstUpsert = upserts[0] as { create: { analysisVersion: string; modelProvider: string | null; modelName: string }; update: { modelProvider: string | null; modelName: string } };
  assert.equal(CUSTOMER_VOICE_ANALYSIS_VERSION, "customer-voice-rules-v3");
  assert.equal(firstUpsert.create.analysisVersion, "customer-voice-rules-v3");
  assert.equal(firstUpsert.create.modelProvider, null);
  assert.equal(firstUpsert.create.modelName, "rules-v3");
  assert.equal(firstUpsert.update.modelProvider, null);
  assert.equal(firstUpsert.update.modelName, "rules-v3");
  assert.equal(JSON.stringify(upserts).includes("conversationTopic"), false);
});
