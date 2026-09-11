import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { StoreInsightsService } from "./store-insights.service";

const user = { id: "user-1", email: "user@example.test", displayName: "User", role: "VIEWER", isActive: true } as never;

function message(id: string, direction: "INBOUND" | "OUTBOUND" | "SYSTEM", sentAt: string, extras: Record<string, unknown> = {}) {
  return {
    id,
    direction,
    messageType: "TEXT",
    sentAt: new Date(sentAt),
    senderUserId: null,
    senderDisplayName: null,
    sender: null,
    rawPayload: null,
    ...extras,
  };
}

function conversation(id: string, customerId: string, name: string, messages: unknown[], extras: Record<string, unknown> = {}) {
  return {
    id,
    customerId,
    latestMessageAt: new Date("2026-09-10T08:00:00.000Z"),
    customer: { id: customerId, displayName: name },
    messages,
    customerSalesStatus: null,
    sourceChannels: [],
    isInstallment: false,
    paymentMethod: null,
    purchaseRecordedAt: null,
    purchaseRecordedById: null,
    salesRecordedAt: null,
    salesRecordedById: null,
    salesProducts: [],
    products: [],
    topics: [],
    ...extras,
  };
}

function buildService(conversations: unknown[], options: { assertAccess?: () => Promise<void>; snapshots?: unknown[] } = {}) {
  const calls: { storeWhere?: unknown; conversationWhere?: unknown; messageWhere?: unknown; activityWhere?: unknown } = {};
  const prisma = {
    store: {
      findFirst: async (args: { where: unknown }) => {
        calls.storeWhere = args.where;
        return {
          id: "store-1",
          name: "Store One",
          code: "S1",
          region: "Central",
          storeMaster: { externalStoreId: "1001", province: "Bangkok", region: "Central" },
          lineOfficialAccounts: [{ id: "oa-1", name: "Store OA", basicId: "@store", connectionStatus: "CONNECTED", lastWebhookReceivedAt: null }],
        };
      },
    },
    conversation: {
      findMany: async (args: { where: unknown; select: { messages: { where: unknown } } }) => {
        calls.conversationWhere = args.where;
        calls.messageWhere = args.select.messages.where;
        return conversations;
      },
    },
    activityHistory: { findMany: async (args: { where: unknown }) => { calls.activityWhere = args.where; return []; } },
    lineOaFollowerSnapshot: { findMany: async () => options.snapshots ?? [] },
  };
  const access = { assertStoreAccess: options.assertAccess ?? (async () => undefined) };
  return { service: new StoreInsightsService(prisma as never, access as never), calls };
}

test("Store 360 scopes conversations to the requested store, active STORE OA, and date range", async () => {
  const firstInbound = message("in-1", "INBOUND", "2026-09-05T03:00:00.000Z");
  const secondInbound = message("in-2", "INBOUND", "2026-09-06T03:00:00.000Z");
  const { service, calls } = buildService([
    conversation("c-1", "customer-1", "Customer One", [firstInbound]),
    conversation("c-2", "customer-1", "Customer One", [secondInbound]),
  ]);

  const result = await service.getSummary(user, "store-1", { from: "2026-09-05", to: "2026-09-05" });

  assert.equal(result.customers, 1, "two conversations for one customer must count once");
  assert.deepEqual(calls.storeWhere, { id: "store-1", isActive: true, archivedAt: null });
  assert.deepEqual(calls.conversationWhere, {
    storeId: "store-1",
    isQa: false,
    lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null },
    messages: { some: { direction: "INBOUND", sentAt: { gte: new Date("2026-09-04T17:00:00.000Z"), lt: new Date("2026-09-05T17:00:00.000Z") } } },
  });
  assert.deepEqual(calls.messageWhere, { sentAt: { gte: new Date("2026-09-04T17:00:00.000Z"), lt: new Date("2026-09-06T17:00:00.000Z") } });
  assert.deepEqual(calls.activityWhere, {
    actionType: "RETURNED_TO_FOLLOW_UP",
    createdAt: { gte: new Date("2026-09-04T17:00:00.000Z"), lt: new Date("2026-09-05T17:00:00.000Z") },
    conversation: { storeId: "store-1", isQa: false, lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null } },
  });
});

test("a reply after the reporting boundary is included only in the bounded response window", async () => {
  const { service, calls } = buildService([
    conversation("c-boundary", "customer-1", "Customer", [
      message("in-1", "INBOUND", "2026-08-31T16:50:00.000Z"),
      message("out-1", "OUTBOUND", "2026-08-31T17:10:00.000Z", { senderUserId: "staff-1", senderDisplayName: "Staff One" }),
    ]),
  ]);

  const result = await service.getResponsePerformance(user, "store-1", { from: "2026-08-31", to: "2026-08-31" });

  assert.equal(result.repliedWithin24Hours.count, 1);
  assert.equal(result.unanswered.count, 0);
  assert.equal(result.medianFirstResponseSeconds, 20 * 60);
  assert.deepEqual(calls.messageWhere, { sentAt: { gte: new Date("2026-08-30T17:00:00.000Z"), lt: new Date("2026-09-01T17:00:00.000Z") } });
});

test("uses the Bangkok end boundary and extends the SLA lookup by 24 hours", async () => {
  const { service, calls } = buildService([
    conversation("c-bangkok-boundary", "customer-1", "Customer", [
      message("in-1", "INBOUND", "2026-09-04T16:59:00.000Z"),
      message("out-1", "OUTBOUND", "2026-09-05T16:58:00.000Z", { senderUserId: "staff-1", senderDisplayName: "Staff One" }),
    ]),
  ]);

  const result = await service.getResponsePerformance(user, "store-1", { from: "2026-09-04", to: "2026-09-04" });

  assert.equal(result.repliedWithin24Hours.count, 1);
  assert.equal(result.medianFirstResponseSeconds, 23 * 60 * 60 + 59 * 60);
  assert.deepEqual(calls.messageWhere, { sentAt: { gte: new Date("2026-09-03T17:00:00.000Z"), lt: new Date("2026-09-05T17:00:00.000Z") } });
});

test("a human reply after 24 hours is replied but not within the 24-hour SLA", async () => {
  const { service } = buildService([
    conversation("c-late", "customer-1", "Customer", [
      message("in-1", "INBOUND", "2026-09-05T03:00:00.000Z"),
      message("out-1", "OUTBOUND", "2026-09-06T04:00:00.000Z", { senderUserId: "staff-1", senderDisplayName: "Staff One" }),
    ]),
  ]);

  const result = await service.getResponsePerformance(user, "store-1", { from: "2026-09-05", to: "2026-09-05" });

  assert.equal(result.repliedWithin24Hours.count, 0);
  assert.equal(result.unanswered.count, 0);
  assert.equal(result.medianFirstResponseSeconds, 25 * 60 * 60);
});

test("repeated inbound messages produce one conversation-level response case", async () => {
  const { service } = buildService([
    conversation("c-repeat", "customer-1", "Customer", [
      message("in-1", "INBOUND", "2026-09-05T03:00:00.000Z"),
      message("in-2", "INBOUND", "2026-09-05T03:02:00.000Z"),
      message("in-3", "INBOUND", "2026-09-05T03:04:00.000Z"),
      message("out-1", "OUTBOUND", "2026-09-05T03:10:00.000Z", { senderUserId: "staff-1", senderDisplayName: "Staff One" }),
    ]),
  ]);

  const result = await service.getResponsePerformance(user, "store-1", { from: "2026-09-05", to: "2026-09-05" });

  assert.equal(result.totalConversations, 1);
  assert.equal(result.totalInboundMessages, 3);
  assert.equal(result.repliedWithin15Minutes.count, 1);
  assert.equal(result.unanswered.count, 0);
  assert.equal(result.medianFirstResponseSeconds, 10 * 60);
});

test("automated replies do not satisfy the human 24-hour SLA, while a staff reply does", async () => {
  const { service } = buildService([
    conversation("c-bot", "customer-bot", "Bot Customer", [
      message("in-bot", "INBOUND", "2026-09-05T03:00:00.000Z"),
      message("out-bot", "OUTBOUND", "2026-09-05T03:01:00.000Z", { senderDisplayName: "Auto Reply Bot" }),
    ]),
    conversation("c-human", "customer-human", "Human Customer", [
      message("in-human", "INBOUND", "2026-09-05T04:00:00.000Z"),
      message("out-human", "OUTBOUND", "2026-09-05T04:31:00.000Z", { senderUserId: "staff-1", senderDisplayName: "Staff One", sender: { id: "staff-1", displayName: "Staff One" } }),
    ]),
    conversation("c-unanswered", "customer-unanswered", "Unanswered Customer", [message("in-unanswered", "INBOUND", "2026-09-05T05:00:00.000Z")]),
    conversation("c-system", "customer-system", "System Customer", [
      message("in-system", "INBOUND", "2026-09-05T06:00:00.000Z"),
      message("out-system", "SYSTEM", "2026-09-05T06:01:00.000Z"),
    ]),
  ]);

  const result = await service.getResponsePerformance(user, "store-1", { from: "2026-09-05", to: "2026-09-05" });

  assert.equal(result.available, true);
  assert.equal(result.dataQuality.automatedOutboundCount, 1);
  assert.equal(result.repliedWithin24Hours.count, 1);
  assert.equal(result.unanswered.count, 3);
  assert.equal(result.repliedWithin24Hours.percentage, 1 / 4);
});

test("staff text, image, and mobile video messages are attributable, while bots and legacy messages fail closed", async () => {
  const { service } = buildService([
    conversation("c-text", "customer-text", "Text Customer", [
      message("in-text", "INBOUND", "2026-09-05T03:00:00.000Z"),
      message("out-text", "OUTBOUND", "2026-09-05T03:01:00.000Z", { messageType: "TEXT", senderUserId: "staff-text", senderDisplayName: "Text Staff" }),
    ]),
    conversation("c-image", "customer-image", "Image Customer", [
      message("in-image", "INBOUND", "2026-09-05T04:00:00.000Z"),
      message("out-image", "OUTBOUND", "2026-09-05T04:01:00.000Z", { messageType: "IMAGE", senderUserId: "staff-image", senderDisplayName: "Image Staff" }),
    ]),
    conversation("c-video", "customer-video", "Video Customer", [
      message("in-video", "INBOUND", "2026-09-05T05:00:00.000Z"),
      message("out-video", "OUTBOUND", "2026-09-05T05:01:00.000Z", { messageType: "VIDEO", senderUserId: "staff-video", senderDisplayName: "Video Staff" }),
    ]),
    conversation("c-bot-source", "customer-bot-source", "Bot Source Customer", [
      message("in-bot-source", "INBOUND", "2026-09-05T06:00:00.000Z"),
      message("out-bot-source", "OUTBOUND", "2026-09-05T06:01:00.000Z", { rawPayload: { source: "AUTO_RESPONSE" } }),
    ]),
    conversation("c-legacy", "customer-legacy", "Legacy Customer", [
      message("in-legacy", "INBOUND", "2026-09-05T07:00:00.000Z"),
      message("out-legacy", "OUTBOUND", "2026-09-05T07:01:00.000Z", { senderDisplayName: "Legacy Operator" }),
    ]),
  ]);

  const result = await service.getResponsePerformance(user, "store-1", { from: "2026-09-05", to: "2026-09-05" });

  assert.equal(result.repliedWithin24Hours.count, 3);
  assert.equal(result.unanswered.count, 2);
  assert.equal(result.dataQuality.automatedOutboundCount, 1);
  assert.equal(result.dataQuality.ambiguousOutboundCount, 1);
  assert.equal(result.available, false);
  assert.equal(result.repliedWithin24Hours.percentage, null);
});

test("ambiguous historical outbound attribution fails closed for response KPIs", async () => {
  const { service } = buildService([
    conversation("c-ambiguous", "customer-1", "Customer", [
      message("in-1", "INBOUND", "2026-09-05T03:00:00.000Z"),
      message("out-1", "OUTBOUND", "2026-09-05T03:30:00.000Z", { senderDisplayName: "Legacy Operator" }),
    ]),
  ]);

  const result = await service.getResponsePerformance(user, "store-1", { from: "2026-09-05", to: "2026-09-05" });

  assert.equal(result.available, false);
  assert.equal(result.dataQuality.ambiguousOutboundCount, 1);
  assert.equal(result.repliedWithin24Hours.percentage, null);
  assert.equal(result.medianFirstResponseSeconds, null);
  assert.equal(result.unanswered.percentage, null);
});

test("responder and sales aggregations use attributable staff and existing sales records", async () => {
  const { service } = buildService([
    conversation("c-1", "customer-1", "Customer", [
      message("in-1", "INBOUND", "2026-09-05T03:00:00.000Z"),
      message("out-1", "OUTBOUND", "2026-09-05T03:30:00.000Z", { senderUserId: "staff-1", senderDisplayName: "Staff One", sender: { id: "staff-1", displayName: "Staff One" } }),
    ], { customerSalesStatus: "PURCHASED", paymentMethod: "CREDIT_CARD", salesRecordedById: "staff-1", salesProducts: [{ productModel: { id: "model-1", name: "OPPO Find X" } }] }),
  ]);

  const [responders, sales] = await Promise.all([
    service.getResponders(user, "store-1", { from: "2026-09-05", to: "2026-09-05" }),
    service.getSales(user, "store-1", { from: "2026-09-05", to: "2026-09-05" }),
  ]);

  assert.equal(responders.responders[0].displayName, "Staff One");
  assert.equal(responders.responders[0].conversationsHandled, 1);
  assert.equal(responders.responders[0].repliedWithin24HoursPercentage, 1);
  assert.equal(sales.salesTaggedCustomers, 1);
  assert.equal(sales.salesTaggedConversations, 1);
  assert.deepEqual(sales.productModels, [{ name: "OPPO Find X", count: 1 }]);
  assert.deepEqual(sales.paymentMethods, [{ name: "CREDIT_CARD", count: 1 }]);
});

test("sales tagged customer percentage deduplicates customers rather than sales records", async () => {
  const { service } = buildService([
    conversation("c-a-1", "customer-a", "Customer A", [message("in-a-1", "INBOUND", "2026-09-05T03:00:00.000Z")], {
      customerSalesStatus: "PURCHASED",
      salesRecordedById: "staff-1",
      salesProducts: [{ customProductName: "Product 1", productModel: { id: "model-1", name: "Product 1" } }, { customProductName: "Product 2", productModel: { id: "model-2", name: "Product 2" } }],
    }),
    conversation("c-a-2", "customer-a", "Customer A", [message("in-a-2", "INBOUND", "2026-09-05T04:00:00.000Z")], {
      customerSalesStatus: "PURCHASED",
      salesRecordedById: "staff-1",
      salesProducts: [{ customProductName: "Product 3", productModel: { id: "model-3", name: "Product 3" } }],
    }),
    conversation("c-b", "customer-b", "Customer B", [message("in-b", "INBOUND", "2026-09-05T05:00:00.000Z")], {
      customerSalesStatus: "PURCHASED",
      salesRecordedById: "staff-1",
    }),
  ]);

  const result = await service.getSales(user, "store-1", { from: "2026-09-05", to: "2026-09-05" });

  assert.equal(result.totalCustomers, 2);
  assert.equal(result.salesTaggedCustomers, 2);
  assert.equal(result.salesTaggedCustomerPercentage, 1);
  assert.equal(result.salesTaggedConversations, 3);
});

test("no-data Store 360 responses use null percentages and stable empty collections", async () => {
  const { service } = buildService([]);

  const result = await service.getSummary(user, "store-1", { from: "2026-09-05", to: "2026-09-05", compareFrom: "2026-09-04", compareTo: "2026-09-04" });

  assert.equal(result.customers, 0);
  assert.equal(result.response.repliedWithin24Hours.percentage, null);
  assert.equal(result.response.unanswered.percentage, null);
  assert.equal(result.response.medianFirstResponseSeconds, null);
  assert.equal(result.sales.salesTaggedCustomerPercentage, null);
  assert.equal(result.followers.current, null);
  assert.equal(result.followers.growth, null);
  assert.deepEqual(result.responders, []);
  assert.equal(result.comparison?.response.repliedWithin24Hours.percentage, null);
  assert.equal(result.response.volumeByHour.length, 24);
  assert.equal(result.response.available, true);
});

test("persisted conversation topics are returned without generating or mutating topic data", async () => {
  const { service } = buildService([
    conversation("c-topic", "customer-1", "Customer", [message("in-1", "INBOUND", "2026-09-05T03:00:00.000Z")], {
      topics: [{ topic: { name: "Installment" } }, { topic: { name: "Price Inquiry" } }],
    }),
  ]);

  const result = await service.getConversations(user, "store-1", { from: "2026-09-05", to: "2026-09-05" });

  assert.equal(result.items[0].topic, "Installment, Price Inquiry");
});

test("store authorization is checked before Store 360 data is read", async () => {
  let storeRead = false;
  const { service } = buildService([], {
    assertAccess: async () => { throw new ForbiddenException("Store access is forbidden"); },
  });
  const original = (service as unknown as { prisma: { store: { findFirst: () => Promise<unknown> } } }).prisma;
  original.store.findFirst = async () => { storeRead = true; return null; };

  await assert.rejects(() => service.getSummary(user, "other-store", { from: "2026-09-05", to: "2026-09-05" }), ForbiddenException);
  assert.equal(storeRead, false);
});
