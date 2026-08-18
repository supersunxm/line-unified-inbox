import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ConversationsService } from "../conversations.service";
import { MobileConversationsService } from "./mobile-conversations.service";

const user = { id: "user-1", email: "staff@example.com", displayName: "Staff", role: "VIEWER" as const, isActive: true };

void test("mobile list is restricted to the authenticated user's accessible stores", async () => {
  let where: unknown;
  const prisma = {
    conversation: {
      findMany: async (input: { where: unknown }) => { where = input.where; return [{ id: "conversation-1", latestMessageAt: new Date(), bmReplyStatus: "NOT_REPLIED", followUpStatus: "FOLLOW_UP", customer: { id: "customer-1", displayName: "Customer" }, store: { id: "store-1", name: "Store", code: "S1" }, messages: [{ id: "message-1", direction: "INBOUND", messageType: "TEXT", originalText: "Hello", sentAt: new Date() }], _count: { pushNotifications: 2 } }]; },
      count: async () => 1,
    },
    $transaction: async <T>(operations: Promise<T>[]) => Promise.all(operations),
  };
  const stores = { accessibleStoreIds: async () => ["store-1"] };
  const service = new MobileConversationsService(prisma as never, stores as never, {} as never);
  const result = await service.list(user, { page: 1, pageSize: 30 });
  assert.deepEqual(where, { store: { isActive: true, archivedAt: null }, storeId: { in: ["store-1"] } });
  assert.equal(result.items[0]?.unreadCount, 2);
});

void test("mobile detail permits the assigned store and rejects a different store", async () => {
  const conversation = { id: "conversation-1", latestMessageAt: new Date(), bmReplyStatus: "NOT_REPLIED", followUpStatus: "FOLLOW_UP", customer: { id: "customer-1", displayName: "Customer" }, store: { id: "store-1", name: "Store", code: "S1" }, messages: [], _count: { pushNotifications: 0 } };
  const prisma = { conversation: { findUnique: async () => conversation } };
  const allowed = { assertConversationAccess: async () => "store-1" };
  const service = new MobileConversationsService(prisma as never, allowed as never, {} as never);
  assert.equal((await service.get(user, "conversation-1")).id, "conversation-1");

  const denied = { assertConversationAccess: async () => { throw new ForbiddenException("Store access is forbidden"); } };
  const deniedService = new MobileConversationsService(prisma as never, denied as never, {} as never);
  await assert.rejects(() => deniedService.get(user, "conversation-2"), ForbiddenException);
});

void test("mobile detail separates verified purchase data from AI insight", async () => {
  const conversation = {
    id: "conversation-1",
    latestMessageAt: new Date(),
    bmReplyStatus: "NOT_REPLIED",
    followUpStatus: "FOLLOW_UP",
    sourceChannels: ["STORE"],
    isInstallment: true,
    purchaseRecordedBy: { id: "user-1", displayName: "Staff" },
    purchaseRecordedAt: new Date("2026-08-16T10:00:00.000Z"),
    productRelationship: "Interested",
    purchaseIntent: "High Intent",
    customer: { id: "customer-1", displayName: "Customer" },
    store: { id: "store-1", name: "Store", code: "S1" },
    products: [
      { source: "MANUAL", productModel: { id: "model-1", name: "OPPO Find N6", productSeries: { name: "Find", productGroup: "SMARTPHONE" } }, productVariant: { id: "variant-1", ram: "16", rom: "512", color: "Titanium" } },
      { source: "RULE", confidence: 0.9, matchedPhrase: "Find N6", detectionMethod: "CLASSIFIER", sourceMessageId: "message-1", productModel: { id: "model-1", name: "OPPO Find N6", productSeries: { name: "Find", productGroup: "SMARTPHONE" } }, productVariant: null },
    ],
    topics: [{ source: "RULE", confidence: 0.8, topic: { id: "topic-1", name: "Price Inquiry", category: "SALES" } }],
    messages: [],
    _count: { pushNotifications: 3 },
  };
  const service = new MobileConversationsService({ conversation: { findUnique: async () => conversation } } as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);
  const result = await service.get(user, "conversation-1");
  assert.equal(result.purchaseInformation.products.length, 1);
  assert.equal(result.purchaseInformation.products[0]?.model.name, "OPPO Find N6");
  assert.equal(result.aiInsight.mentionedProducts.length, 1);
  assert.equal(result.aiInsight.topics[0]?.name, "Price Inquiry");
  assert.deepEqual(result.operationalState, { replyStatus: "NOT_REPLIED", priority: { level: "NONE" }, unread: 3 });
});

void test("purchase information records the BM provenance and audit diff", async () => {
  const activities: any[] = [];
  const writes: any[] = [];
  let readCount = 0;
  const detail = {
    id: "conversation-1",
    latestMessageAt: new Date(),
    bmReplyStatus: "NOT_REPLIED",
    followUpStatus: "FOLLOW_UP",
    sourceChannels: ["ONLINE"],
    isInstallment: true,
    customer: { id: "customer-1", displayName: "Customer" },
    store: { id: "store-1", name: "Store", code: "S1" },
    products: [{ source: "MANUAL", productModel: { id: "model-1", name: "OPPO Find N6", productSeries: { name: "Find", productGroup: "SMARTPHONE" } }, productVariant: { id: "variant-1", ram: "16", rom: "512", color: "Titanium" } }],
    messages: [],
    _count: { pushNotifications: 0 },
    purchaseRecordedBy: { id: "user-1", displayName: "Staff" },
    purchaseRecordedAt: new Date("2026-08-16T10:00:00.000Z"),
  };
  const tx = {
    conversation: {
      findUnique: async () => {
        readCount += 1;
        return readCount === 1
          ? { id: "conversation-1", sourceChannels: [], isInstallment: false, products: [] }
          : { id: "conversation-1", sourceChannels: ["ONLINE"], isInstallment: true, products: [{ productModelId: "model-1", productVariantId: "variant-1" }] };
      },
      update: async (args: any) => { writes.push(args); return {}; },
    },
    productModel: { findFirst: async () => ({ id: "model-1" }) },
    productVariant: { findFirst: async () => ({ id: "variant-1", productModelId: "model-1" }) },
    conversationProduct: {
      deleteMany: async () => ({}),
      create: async () => ({}),
      findFirst: async () => null,
      update: async () => ({}),
    },
    activityHistory: { create: async (args: any) => { activities.push(args); return {}; } },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    conversation: { findUnique: async () => detail },
  };
  const service = new MobileConversationsService(prisma as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);
  const result = await service.updatePurchaseInformation(user, "conversation-1", { purchaseChannel: ["ONLINE"], paymentMethod: "INSTALLMENT", productModelId: "model-1", productVariantId: "variant-1" });
  assert.equal(result.purchaseInformation.recordedBy, "Staff");
  assert.equal(result.purchaseInformation.recordedAt, "2026-08-16T10:00:00.000Z");
  assert.equal(writes[0]?.data.purchaseRecordedBy.connect.id, "user-1");
  assert.ok(writes[0]?.data.purchaseRecordedAt instanceof Date);
  assert.equal(activities[0]?.data.createdByUserId, "user-1");
  assert.deepEqual(activities[0]?.data.metadata.oldValue, { purchaseChannel: [], paymentMethod: null, products: [] });
  assert.deepEqual(activities[0]?.data.metadata.newValue, { purchaseChannel: ["ONLINE"], paymentMethod: "INSTALLMENT", products: [{ productModelId: "model-1", productVariantId: "variant-1" }] });
});

void test("purchase information preserves store authorization", async () => {
  const denied = new MobileConversationsService({} as never, { assertConversationAccess: async () => { throw new ForbiddenException("Store access is forbidden"); } } as never, {} as never);
  await assert.rejects(() => denied.updatePurchaseInformation(user, "other-store-conversation", { purchaseChannel: ["STORE"] }), ForbiddenException);
});

void test("mobile reply delegates only after store ownership is verified", async () => {
  let sent = false;
  const stores = { assertConversationAccess: async () => "store-1" };
  const conversations = { sendMessage: async (id: string, dto: unknown, actor: unknown) => { sent = true; assert.equal(id, "conversation-1"); assert.equal(actor, user); assert.deepEqual(dto, { text: "Reply", idempotencyKey: "key-1" }); return { message: { id: "outbound-1" } }; } };
  const service = new MobileConversationsService({} as never, stores as never, conversations as never);
  await service.send(user, "conversation-1", { text: "Reply", idempotencyKey: "key-1" });
  assert.equal(sent, true);

  const denied = new MobileConversationsService({} as never, { assertConversationAccess: async () => { throw new ForbiddenException(); } } as never, conversations as never);
  await assert.rejects(() => denied.send(user, "conversation-2", { text: "Reply", idempotencyKey: "key-2" }), ForbiddenException);
});

void test("mark read clears every unread notification for the user and conversation", async () => {
  const updates: any[] = [];
  const prisma = { pushNotification: { updateMany: async (args: any) => { updates.push(args); return { count: 28 }; } } };
  const stores = { assertConversationAccess: async () => "store-1" };
  const service = new MobileConversationsService(prisma as never, stores as never, {} as never);

  assert.deepEqual(await service.markRead(user, "conversation-1"), { conversationId: "conversation-1", unreadCount: 0 });
  assert.deepEqual(updates[0]?.where, { userId: "user-1", conversationId: "conversation-1", readAt: null });
  assert.ok(updates[0]?.data.readAt instanceof Date);

  assert.deepEqual(await service.markRead(user, "conversation-1"), { conversationId: "conversation-1", unreadCount: 0 });
});

void test("mark read preserves reply status and rejects cross-store access", async () => {
  let conversationUpdated = false;
  const prisma = {
    conversation: { update: async () => { conversationUpdated = true; } },
    pushNotification: { updateMany: async () => ({ count: 0 }) },
  };
  const denied = { assertConversationAccess: async () => { throw new ForbiddenException("Store access is forbidden"); } };
  const service = new MobileConversationsService(prisma as never, denied as never, {} as never);

  await assert.rejects(() => service.markRead(user, "other-store-conversation"), ForbiddenException);
  assert.equal(conversationUpdated, false);
});

void test("mobile detail returns a stable cursor and prepends older pages without overlap", async () => {
  let captured: any;
  const messages = [0, 1, 2].map((index) => ({ id: `message-${index}`, direction: "INBOUND", messageType: "TEXT", originalText: `m${index}`, sentAt: new Date(`2026-08-13T00:0${index}:00.000Z`), senderUserId: null, senderDisplayName: null, media: null }));
  const prisma = { conversation: { findUnique: async (args: any) => { captured = args; const before = args.select.messages.where; return { id: "conversation-1", latestMessageAt: new Date(), bmReplyStatus: "NOT_REPLIED", followUpStatus: "FOLLOW_UP", customer: { id: "customer-1", displayName: "Customer" }, store: { id: "store-1", name: "Store", code: "S1" }, messages: before ? messages.slice(0, 2) : messages, _count: { pushNotifications: 0 } }; } } };
  const service = new MobileConversationsService(prisma as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);
  const first = await service.get(user, "conversation-1", { limit: 2 });
  assert.equal(first.messages.length, 2);
  assert.ok(first.nextCursor);
  const second = await service.get(user, "conversation-1", { limit: 2, before: first.nextCursor });
  assert.equal(second.messages.length, 2);
  assert.ok(captured.select.messages.where);
});

void test("mobile detail cursor orders equal timestamps by id without overlap or gaps", async () => {
  const sentAt = new Date("2026-08-13T00:00:00.000Z");
  const messages = ["a", "b", "c"].map((id) => ({ id, direction: "INBOUND", messageType: "TEXT", originalText: id, sentAt, senderUserId: null, senderDisplayName: null, media: null }));
  const queries: any[] = [];
  const prisma = { conversation: { findUnique: async (args: any) => {
    queries.push(args);
    const cursorId = args.select.messages.where?.OR?.[1]?.id?.lt as string | undefined;
    const filtered = cursorId ? messages.filter((message) => message.id < cursorId) : messages;
    return { id: "conversation-1", latestMessageAt: sentAt, bmReplyStatus: "NOT_REPLIED", followUpStatus: "FOLLOW_UP", customer: { id: "customer-1", displayName: "Customer" }, store: { id: "store-1", name: "Store", code: "S1" }, messages: filtered.slice().sort((a, b) => b.id.localeCompare(a.id)).slice(0, args.select.messages.take), _count: { pushNotifications: 0 } };
  } } };
  const service = new MobileConversationsService(prisma as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);
  const first = await service.get(user, "conversation-1", { limit: 2 });
  const second = await service.get(user, "conversation-1", { limit: 2, before: first.nextCursor });
  assert.deepEqual(first.messages.map((message) => message.id), ["b", "c"]);
  assert.deepEqual(second.messages.map((message) => message.id), ["a"]);
  assert.equal(first.messages.some((message) => second.messages.some((older) => older.id === message.id)), false);
  assert.equal(second.nextCursor, null);
  assert.deepEqual(queries[1].select.messages.where.OR[1], { sentAt, id: { lt: "b" } });
});

void test("mobile detail rejects an invalid cursor before querying messages", async () => {
  let queried = false;
  const prisma = { conversation: { findUnique: async () => { queried = true; return null; } } };
  const service = new MobileConversationsService(prisma as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);
  await assert.rejects(() => service.get(user, "conversation-1", { limit: 20, before: "not-a-cursor" }), NotFoundException);
  assert.equal(queried, false);
});

void test("mobile product selector returns bounded active model-level products", async () => {
  let captured: any;
  const prisma = {
    productModel: {
      findMany: async (args: any) => {
        captured = args;
        return [{ id: "model-1", name: "OPPO Reno16 Pro 5G", productSeries: { name: "Reno16", productGroup: "SMARTPHONE" } }];
      },
    },
  };
  const service = new MobileConversationsService(prisma as never, {} as never, {} as never);
  const result = await service.products({ search: "reno16", limit: 100 });
  assert.deepEqual(result.items, [{ id: "model-1", productName: "OPPO Reno16 Pro 5G", category: "SMARTPHONE", seriesName: "Reno16" }]);
  assert.equal(captured.take, 50);
  assert.deepEqual(captured.where, {
    isActive: true,
    classificationLevel: "MODEL",
    productSeries: { isActive: true },
    name: { contains: "reno16", mode: "insensitive" },
  });
});

void test("legacy mobile tags cannot mutate purchase fields", async () => {
  let transactionCalled = false;
  const service = new MobileConversationsService(
    { $transaction: async () => { transactionCalled = true; } } as never,
    { assertConversationAccess: async () => "store-1" } as never,
    {} as never,
  );

  await assert.rejects(
    () => service.updateTags(user, "conversation-1", { sourceChannels: ["ONLINE"], isInstallment: true, productId: "model-1", variantId: "variant-1" }),
    (error: unknown) => error instanceof BadRequestException && error.message.includes("purchase-information"),
  );
  assert.equal(transactionCalled, false);
});

void test("purchase information preserves RULE products while replacing MANUAL data", async () => {
  const writes: any[] = [];
  const detail = {
    id: "conversation-1", latestMessageAt: new Date(), bmReplyStatus: "NOT_REPLIED", followUpStatus: "FOLLOW_UP",
    sourceChannels: ["STORE"], isInstallment: false,
    customer: { id: "customer-1", displayName: "Customer" }, store: { id: "store-1", name: "Store", code: "S1" },
    products: [
      { source: "MANUAL", productModel: { id: "model-1", name: "OPPO Find N6", productSeries: { name: "Find", productGroup: "SMARTPHONE" } }, productVariant: null },
      { source: "RULE", confidence: 0.9, productModel: { id: "model-rule", name: "OPPO Reno", productSeries: { name: "Reno", productGroup: "SMARTPHONE" } }, productVariant: null },
    ], messages: [], _count: { pushNotifications: 0 }, purchaseRecordedBy: null, purchaseRecordedAt: null,
  };
  const tx = {
    conversation: {
      findUnique: async () => ({ id: "conversation-1", sourceChannels: ["STORE"], isInstallment: false, purchaseRecordedById: null, purchaseRecordedAt: null, products: [{ productModelId: "model-1", productVariantId: null }] }),
      update: async (args: any) => { writes.push({ type: "conversation", args }); return {}; },
    },
    productModel: { findFirst: async () => ({ id: "model-2" }) },
    conversationProduct: {
      deleteMany: async (args: any) => { writes.push({ type: "delete", args }); return {}; },
      create: async (args: any) => { writes.push({ type: "create", args }); return {}; },
      findFirst: async () => null,
      update: async () => ({}),
    },
    activityHistory: { create: async (args: any) => { writes.push({ type: "activity", args }); return {}; } },
  };
  const prisma = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx), conversation: { findUnique: async () => detail } };
  const service = new MobileConversationsService(prisma as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);
  await service.updatePurchaseInformation(user, "conversation-1", { productModelId: "model-2" });
  assert.deepEqual(writes.find((write) => write.type === "delete")?.args.where, { conversationId: "conversation-1", source: "MANUAL" });
  assert.equal(writes.some((write) => write.type === "delete" && write.args.where.source === "RULE"), false);
});

void test("legacy conversation tags continue to update topics without touching purchases", async () => {
  const writes: any[] = [];
  const tx = {
    conversationTopic: {
      deleteMany: async (args: any) => { writes.push({ type: "delete", args }); return {}; },
      upsert: async (args: any) => { writes.push({ type: "upsert", args }); return {}; },
    },
    conversationProduct: {
      deleteMany: async () => { throw new Error("purchase products must not be touched"); },
      upsert: async () => { throw new Error("purchase products must not be touched"); },
    },
  };
  const prisma = {
    conversation: { findUnique: async () => ({ id: "conversation-1" }) },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new ConversationsService(prisma as never, {} as never);
  (service as unknown as { get: () => Promise<unknown> }).get = async () => ({ id: "conversation-1" });
  const result = await service.updateManualTags("conversation-1", [], ["topic-1"]);
  assert.equal(result.id, "conversation-1");
  assert.deepEqual(writes[0], { type: "delete", args: { where: { conversationId: "conversation-1", source: "MANUAL" } } });
  assert.deepEqual(writes[1]?.args.where, { conversationId_topicId: { conversationId: "conversation-1", topicId: "topic-1" } });
});

void test("legacy conversation tags reject manual product writes", async () => {
  const service = new ConversationsService({} as never, {} as never);
  await assert.rejects(() => service.updateManualTags("conversation-1", ["model-1"], []), BadRequestException);
});

void test("updateCustomerSalesInfo records INTERESTED lead with multiple products and HOT interest level", async () => {
  const writes: any[] = [];
  const activities: any[] = [];
  const detail = {
    id: "conversation-lead", latestMessageAt: new Date(), bmReplyStatus: "NOT_REPLIED", followUpStatus: "FOLLOW_UP",
    customerSalesStatus: "INTERESTED", interestLevel: "HOT", sourceChannels: [], isInstallment: false, paymentMethod: null,
    customer: { id: "customer-1", displayName: "Customer" }, store: { id: "store-1", name: "Store", code: "S1" },
    salesProducts: [
      { id: "sp-1", productModelId: "model-1", productVariantId: "var-1", quantity: 1, status: "INTERESTED", productModel: { id: "model-1", name: "OPPO Find X9", productSeries: { name: "Find", productGroup: "SMARTPHONE" } }, productVariant: { id: "var-1", ram: "16", rom: "512", color: "Black" } },
      { id: "sp-2", productModelId: "model-2", productVariantId: null, quantity: 2, status: "INTERESTED", productModel: { id: "model-2", name: "OPPO Watch X", productSeries: { name: "Wearable", productGroup: "WEARABLE" } }, productVariant: null },
    ],
    products: [], topics: [], messages: [], _count: { pushNotifications: 0 },
    salesRecordedBy: { id: "user-1", displayName: "Staff" }, salesRecordedAt: new Date(),
  };
  const tx = {
    conversation: {
      findUnique: async () => ({ id: "conversation-lead", customerSalesStatus: null, interestLevel: null, paymentMethod: null, sourceChannels: [], isInstallment: false, products: [], salesProducts: [] }),
      update: async (args: any) => { writes.push({ type: "conversation", args }); return {}; },
    },
    productModel: {
      findFirst: async ({ where }: any) => ({ id: where.id, name: where.id === "model-1" ? "OPPO Find X9" : "OPPO Watch X" }),
    },
    productVariant: {
      findFirst: async ({ where }: any) => ({ id: where.id, ram: "16", rom: "512", color: "Black" }),
    },
    conversationSalesProduct: {
      deleteMany: async (args: any) => { writes.push({ type: "deleteSalesProducts", args }); return {}; },
      createMany: async (args: any) => { writes.push({ type: "createSalesProducts", args }); return {}; },
    },
    conversationProduct: {
      deleteMany: async () => ({}),
      create: async () => ({}),
    },
    activityHistory: {
      create: async (args: any) => { activities.push(args); return {}; },
    },
  };
  const prisma = {
    $transaction: async (cb: any) => cb(tx),
    conversation: { findUnique: async () => detail },
  };
  const service = new MobileConversationsService(prisma as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);
  const result = await service.updateCustomerSalesInfo(user, "conversation-lead", {
    status: "INTERESTED",
    interestLevel: "HOT",
    products: [
      { productModelId: "model-1", productVariantId: "var-1", quantity: 1, status: "INTERESTED" },
      { productModelId: "model-2", productVariantId: null, quantity: 2, status: "INTERESTED" },
    ],
  });

  assert.equal(result.customerSalesInformation.status, "INTERESTED");
  assert.equal(result.customerSalesInformation.interestLevel, "HOT");
  assert.equal(result.customerSalesInformation.products.length, 2);
  assert.equal(result.customerSalesInformation.products[0]?.model.name, "OPPO Find X9");
  assert.equal(result.customerSalesInformation.products[1]?.model.name, "OPPO Watch X");
  assert.equal(activities[0]?.data.actionType, "CUSTOMER_SALES_INFO_UPDATED");
  assert.equal(activities[0]?.data.metadata.status, "INTERESTED");
  assert.equal(activities[0]?.data.metadata.interestLevel, "HOT");
});

void test("updateCustomerSalesInfo records PURCHASED customer with multi-product and payment method", async () => {
  const writes: any[] = [];
  const activities: any[] = [];
  const detail = {
    id: "conversation-purchased", latestMessageAt: new Date(), bmReplyStatus: "REPLIED", followUpStatus: "COMPLETED",
    customerSalesStatus: "PURCHASED", interestLevel: null, sourceChannels: ["STORE"], isInstallment: true, paymentMethod: "INSTALLMENT",
    customer: { id: "customer-1", displayName: "Customer" }, store: { id: "store-1", name: "Store", code: "S1" },
    salesProducts: [
      { id: "sp-1", productModelId: "model-1", productVariantId: "var-1", quantity: 1, status: "PURCHASED", productModel: { id: "model-1", name: "OPPO Find X9", productSeries: { name: "Find", productGroup: "SMARTPHONE" } }, productVariant: { id: "var-1", ram: "16", rom: "512", color: "Titanium" } },
      { id: "sp-3", productModelId: "model-3", productVariantId: null, quantity: 1, status: "PURCHASED", productModel: { id: "model-3", name: "SUPERVOOC 80W", productSeries: { name: "Accessories", productGroup: "ACCESSORIES" } }, productVariant: null },
    ],
    products: [], topics: [], messages: [], _count: { pushNotifications: 0 },
    salesRecordedBy: { id: "user-1", displayName: "Staff" }, salesRecordedAt: new Date(),
  };
  const tx = {
    conversation: {
      findUnique: async () => ({ id: "conversation-purchased", customerSalesStatus: "INTERESTED", interestLevel: "HOT", paymentMethod: null, sourceChannels: [], isInstallment: false, products: [], salesProducts: [] }),
      update: async (args: any) => { writes.push({ type: "conversation", args }); return {}; },
    },
    productModel: {
      findFirst: async ({ where }: any) => ({ id: where.id, name: where.id === "model-1" ? "OPPO Find X9" : "SUPERVOOC 80W" }),
    },
    productVariant: {
      findFirst: async ({ where }: any) => ({ id: where.id, ram: "16", rom: "512", color: "Titanium" }),
    },
    conversationSalesProduct: {
      deleteMany: async () => ({}),
      createMany: async () => ({}),
    },
    conversationProduct: {
      deleteMany: async () => ({}),
      create: async () => ({}),
    },
    activityHistory: {
      create: async (args: any) => { activities.push(args); return {}; },
    },
  };
  const prisma = {
    $transaction: async (cb: any) => cb(tx),
    conversation: { findUnique: async () => detail },
  };
  const service = new MobileConversationsService(prisma as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);
  const result = await service.updateCustomerSalesInfo(user, "conversation-purchased", {
    status: "PURCHASED",
    purchaseChannel: ["STORE"],
    paymentMethod: "INSTALLMENT",
    products: [
      { productModelId: "model-1", productVariantId: "var-1", quantity: 1, status: "PURCHASED" },
      { productModelId: "model-3", productVariantId: null, quantity: 1, status: "PURCHASED" },
    ],
  });

  assert.equal(result.customerSalesInformation.status, "PURCHASED");
  assert.deepEqual(result.customerSalesInformation.purchaseChannel, ["STORE"]);
  assert.equal(result.customerSalesInformation.paymentMethod, "INSTALLMENT");
  assert.equal(result.customerSalesInformation.products.length, 2);
  assert.equal(activities[0]?.data.actionType, "PURCHASE_INFORMATION_UPDATED");
});
