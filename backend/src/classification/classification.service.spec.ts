import assert from "node:assert/strict";
import test from "node:test";
import { ProductAliasSource } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { ClassificationService } from "./classification.service";

void test("classification persists the canonical OPPO A6 5G rule match", async () => {
  const productModel = {
    id: "oppo-a6-5g",
    name: "OPPO A6 5G",
    classificationLevel: "MODEL",
    priority: 110,
    aliases: [{ alias: "a6 5g", priority: 0, source: ProductAliasSource.CATALOG }],
    productSeries: { name: "A Series", productGroup: "SMARTPHONE" },
  };
  type PersistedProduct = {
    conversationId: string;
    productModelId: string;
    confidence: number;
    source: string;
    matchedPhrase: string;
    detectionMethod: string;
    sourceMessageId: string;
  };
  let persistedProduct: PersistedProduct | undefined;
  let lookupCount = 0;
  const conversation = {
    id: "conversation-a6",
    prioritySource: "RULE",
    messages: [{ id: "message-a6", originalText: "A65G", sentAt: new Date("2026-07-30T00:00:00Z") }],
    products: [],
    topics: [],
  };
  const transactionClient = {
    conversationProduct: {
      deleteMany: () => Promise.resolve({ count: 0 }),
      create: ({ data }: { data: PersistedProduct }) => {
        persistedProduct = data;
        return Promise.resolve(data);
      },
    },
    conversationTopic: {
      deleteMany: () => Promise.resolve({ count: 0 }),
      createMany: () => Promise.resolve({ count: 0 }),
    },
    topic: { upsert: () => Promise.reject(new Error("No topic expected")) },
    conversation: { update: () => Promise.resolve(conversation) },
    activityHistory: { create: () => Promise.resolve({}) },
  };
  const prisma = {
    conversation: {
      findUnique: () => {
        lookupCount += 1;
        return Promise.resolve(lookupCount === 1 ? conversation : { id: conversation.id, products: [{ ...persistedProduct, productModel }], topics: [] });
      },
    },
    productModel: { findMany: () => Promise.resolve([productModel]) },
    $transaction: (callback: (tx: typeof transactionClient) => Promise<void>) => callback(transactionClient),
  } as unknown as PrismaService;

  const result = await new ClassificationService(prisma).analyze(conversation.id);

  assert.deepEqual(persistedProduct, {
    conversationId: conversation.id,
    productModelId: productModel.id,
    confidence: 0.92,
    source: "RULE",
    matchedPhrase: "a6 5g",
    detectionMethod: "COMPACT_ALIAS",
    sourceMessageId: "message-a6",
  });
  assert.equal(result?.products[0]?.productModel.id, productModel.id);
  assert.equal(result?.products[0]?.productModel.name, "OPPO A6 5G");
});

void test("re-analysis preserves manual product, topic, confidence, and priority", async () => {
  const productCreates: Array<{ productModelId: string }> = [];
  const topicCreates: Array<{ topicId: string }> = [];
  const productDeletes: Array<{ source?: string }> = [];
  const topicDeletes: Array<{ source?: string }> = [];
  let conversationUpdate: { priority?: unknown } = {};
  let lookupCount = 0;
  const conversation = {
    id: "conversation-1", prioritySource: "MANUAL",
    messages: [{ originalText: "พร้อมซื้อ Reno16 ราคาเท่าไหร่" }],
    products: [{ productModelId: "manual-model", source: "MANUAL", confidence: 1 }],
    topics: [{ topicId: "manual-topic", source: "MANUAL", confidence: 1 }],
  };
  const transactionClient = {
    conversationProduct: {
      deleteMany: ({ where }: { where: { source?: string } }) => { productDeletes.push(where); return Promise.resolve({ count: 0 }); },
      createMany: ({ data }: { data: Array<{ productModelId: string }> }) => { productCreates.push(...data); return Promise.resolve({ count: data.length }); },
    },
    conversationTopic: {
      deleteMany: ({ where }: { where: { source?: string } }) => { topicDeletes.push(where); return Promise.resolve({ count: 0 }); },
      createMany: ({ data }: { data: Array<{ topicId: string }> }) => { topicCreates.push(...data); return Promise.resolve({ count: data.length }); },
    },
    topic: { upsert: ({ where }: { where: { name: string } }) => Promise.resolve({ id: where.name === "Price Inquiry" ? "manual-topic" : `topic:${where.name}` }) },
    conversation: { update: ({ data }: { data: { priority?: unknown } }) => { conversationUpdate = data; return Promise.resolve(conversation); } },
    activityHistory: { create: () => Promise.resolve({}) },
  };
  const prisma = {
    conversation: { findUnique: () => { lookupCount += 1; return Promise.resolve(lookupCount === 1 ? conversation : { id: conversation.id }); } },
    productModel: { findMany: () => Promise.resolve([{ id: "manual-model", name: "Reno16", aliases: [] }]) },
    $transaction: (callback: (tx: typeof transactionClient) => Promise<void>) => callback(transactionClient),
  } as unknown as PrismaService;

  await new ClassificationService(prisma).analyze(conversation.id);

  assert.deepEqual(productDeletes, [{ conversationId: conversation.id, source: "RULE" }]);
  assert.deepEqual(topicDeletes, [{ conversationId: conversation.id, source: "RULE" }]);
  assert.equal(productCreates.some(({ productModelId }) => productModelId === "manual-model"), false);
  assert.equal(topicCreates.some(({ topicId }) => topicId === "manual-topic"), false);
  assert.equal(conversationUpdate.priority, undefined);
});
