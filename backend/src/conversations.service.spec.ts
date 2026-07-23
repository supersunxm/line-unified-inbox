import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "./prisma.service";
import { ConversationsService } from "./conversations.service";

void test("conversation returns only the canonical manager URL and excludes chat and credential fields", async () => {
  const managerUrl = "https://manager.line.biz/account/canonical";
  const chatUrl = "https://chat.line.biz/U1234567890abcdef";
  const conversation = {
    id: "conversation-1", customerId: "customer-1", storeId: "store-1", lineOfficialAccountId: "oa-1", priority: "NORMAL", prioritySource: null, followUpStatus: "FOLLOW_UP", productRelationship: null, purchaseIntent: null, latestMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    customer: { id: "customer-1", lineUserId: "U123456789", displayName: "Customer", pictureUrl: null, statusMessage: null, preferredLanguage: null, profileFetchedAt: null, profileFetchStatus: "SUCCESS", profileFetchError: null, createdAt: new Date(), updatedAt: new Date() },
    store: { id: "store-1", code: "26197", name: "Store", region: null, area: null, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), storeMasterId: "master-old", provinceSource: null, regionSource: null, storeMaster: { lineManagerUrl: "https://manager.line.biz/account/stale" } },
    lineOfficialAccount: { id: "oa-1", name: "OA", basicId: "@oa", channelId: "channel", destinationId: "destination", encryptedChannelSecret: "secret-ciphertext", encryptedChannelAccessToken: "token-ciphertext", webhookKey: "private-webhook-key", lineChatWorkspaceUrl: chatUrl, connectionStatus: "CONNECTED", lastWebhookReceivedAt: new Date(), lastConnectionTestAt: null, lastConnectionError: null, storeId: "store-1", isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
    messages: [], products: [], topics: [], notes: [], activityHistory: [],
  };
  const prisma = { conversation: { findUnique: () => Promise.resolve(conversation) }, storeMaster: { findMany: () => Promise.resolve([{ externalStoreId: "26197", lineManagerUrl: managerUrl }]) } } as unknown as PrismaService;
  const result = await new ConversationsService(prisma).get("conversation-1");
  assert.equal(result.resolvedLineOaManagerUrl, managerUrl);
  assert.deepEqual(result.lineOfficialAccount, { id: "oa-1", name: "OA", basicId: "@oa", connectionStatus: "CONNECTED", isActive: true, lastWebhookReceivedAt: conversation.lineOfficialAccount.lastWebhookReceivedAt });
  const json = JSON.stringify(result);
  for (const forbidden of ["resolvedLineOaChatUrl", "resolvedLineOaOpenUrl", "lineChatWorkspaceUrl", "chat.line.biz", "encryptedChannelSecret", "encryptedChannelAccessToken", "channelSecret", "channelAccessToken", "secret-ciphertext", "token-ciphertext", "private-webhook-key", "webhookKey"]) assert.equal(json.includes(forbidden), false, `${forbidden} must not be serialized`);
});

void test("conversation exposes the connected legacy manager URL fallback", async () => {
  const managerUrl = "https://manager.line.biz/account/other-store";
  const conversation = {
    id: "conversation-2", customerId: "customer-2", storeId: "store-2", lineOfficialAccountId: "oa-2", priority: "NORMAL", prioritySource: null, followUpStatus: "FOLLOW_UP", productRelationship: null, purchaseIntent: null, latestMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    customer: { id: "customer-2", lineUserId: "U987654321", displayName: "Customer", pictureUrl: null, statusMessage: null, preferredLanguage: null, profileFetchedAt: null, profileFetchStatus: "SUCCESS", profileFetchError: null, createdAt: new Date(), updatedAt: new Date() },
    store: { id: "store-2", code: "99999", name: "Another Store", region: null, area: null, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), storeMasterId: "master-2", provinceSource: null, regionSource: null, storeMaster: { lineManagerUrl: managerUrl } },
    lineOfficialAccount: { id: "oa-2", name: "Other OA", basicId: "@other", channelId: null, destinationId: null, encryptedChannelSecret: "secret", encryptedChannelAccessToken: "token", webhookKey: "key", lineChatWorkspaceUrl: null, connectionStatus: "CONNECTED", lastWebhookReceivedAt: null, lastConnectionTestAt: null, lastConnectionError: null, storeId: "store-2", isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
    messages: [], products: [], topics: [], notes: [], activityHistory: [],
  };
  const prisma = { conversation: { findUnique: () => Promise.resolve(conversation) }, storeMaster: { findMany: () => Promise.resolve([]) } } as unknown as PrismaService;
  const result = await new ConversationsService(prisma).get("conversation-2");
  assert.equal(result.resolvedLineOaManagerUrl, managerUrl);
});

void test("100 list rows use one Store Master batch query, cap page size, and load only latest summaries", async () => {
  let conversationQueries = 0; let storeMasterQueries = 0; let listArguments: Record<string, unknown> = {};
  const conversations = Array.from({ length: 100 }, (_, index) => {
    const code = index % 2 === 0 ? "STORE-A" : "STORE-B";
    return {
      id: `conversation-${index}`, customerId: `customer-${index}`, storeId: `store-${code}`, lineOfficialAccountId: `oa-${code}`, priority: "NORMAL", prioritySource: null, followUpStatus: "FOLLOW_UP", productRelationship: null, purchaseIntent: null, latestMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
      customer: { id: `customer-${index}`, lineUserId: `U${index}12345678`, displayName: `Customer ${index}`, pictureUrl: null, statusMessage: null, preferredLanguage: null, profileFetchedAt: null, profileFetchStatus: "SUCCESS", profileFetchError: null, createdAt: new Date(), updatedAt: new Date() },
      store: { id: `store-${code}`, code, name: code, region: null, area: null, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), storeMasterId: null, provinceSource: null, regionSource: null, storeMaster: null },
      lineOfficialAccount: { id: `oa-${code}`, name: code, basicId: null, channelId: null, destinationId: null, encryptedChannelSecret: "ciphertext", encryptedChannelAccessToken: "ciphertext", webhookKey: "private", lineChatWorkspaceUrl: null, connectionStatus: "CONNECTED", lastWebhookReceivedAt: null, lastConnectionTestAt: null, lastConnectionError: null, storeId: `store-${code}`, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      messages: [{ id: `message-${index}`, originalText: "latest", sentAt: new Date(), media: null }], products: [], topics: [], notes: [], activityHistory: [],
    };
  });
  const prisma = {
    conversation: {
      findMany: (args: Record<string, unknown>) => { conversationQueries += 1; listArguments = args; return Promise.resolve(conversations); },
      count: () => Promise.resolve(100),
    },
    storeMaster: { findMany: ({ where }: { where: { externalStoreId: { in: string[] } } }) => {
      storeMasterQueries += 1;
      assert.deepEqual(where.externalStoreId.in, ["STORE-A", "STORE-B"]);
      return Promise.resolve([{ externalStoreId: "STORE-A", lineManagerUrl: "https://manager.line.biz/account/a" }]);
    } },
    $transaction: (queries: Array<Promise<unknown>>) => Promise.all(queries),
  } as unknown as PrismaService;
  const result = await new ConversationsService(prisma).list({ page: 1, pageSize: 1_000, sort: "latest-desc" });
  assert.equal(conversationQueries, 1); assert.equal(storeMasterQueries, 1);
  assert.equal(listArguments.take, 100); assert.equal(result.pageSize, 100);
  const include = listArguments.include as { messages: { take: number }; notes: { take: number }; activityHistory: { take: number } };
  assert.equal(include.messages.take, 1); assert.equal(include.notes.take, 1); assert.equal(include.activityHistory.take, 1);
  assert.equal(result.items[0].resolvedLineOaManagerUrl, "https://manager.line.biz/account/a");
  assert.equal(result.items[1].resolvedLineOaManagerUrl, null);
  assert.equal(JSON.stringify(result).includes("encryptedChannelAccessToken"), false);
});

void test("ConversationsService.list supports lineOaId filter, unknown lineOaId, and page skip/take pagination", async () => {
  const capturedArgs: Array<Record<string, unknown>> = [];
  const fakeConversations = [
    {
      id: "conv-1", customerId: "cust-1", storeId: "store-1", lineOfficialAccountId: "oa-1", priority: "NORMAL", prioritySource: null, followUpStatus: "FOLLOW_UP", productRelationship: null, purchaseIntent: null, latestMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
      customer: { id: "cust-1", lineUserId: "U1", displayName: "Cust 1", pictureUrl: null, statusMessage: null, preferredLanguage: null, profileFetchedAt: null, profileFetchStatus: "SUCCESS", profileFetchError: null, createdAt: new Date(), updatedAt: new Date() },
      store: { id: "store-1", code: "S1", name: "Store 1", region: null, area: null, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), storeMasterId: null, provinceSource: null, regionSource: null, storeMaster: null },
      lineOfficialAccount: { id: "oa-1", name: "OA 1", basicId: null, channelId: null, destinationId: null, encryptedChannelSecret: "c", encryptedChannelAccessToken: "c", webhookKey: "w", lineChatWorkspaceUrl: null, connectionStatus: "CONNECTED", lastWebhookReceivedAt: null, lastConnectionTestAt: null, lastConnectionError: null, storeId: "store-1", isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      messages: [], products: [], topics: [], notes: [], activityHistory: [],
    },
  ];

  const prisma = {
    conversation: {
      findMany: (args: Record<string, unknown>) => {
        capturedArgs.push(args);
        return Promise.resolve(fakeConversations);
      },
      count: () => Promise.resolve(1),
    },
    storeMaster: { findMany: () => Promise.resolve([]) },
    $transaction: (queries: Array<Promise<unknown>>) => Promise.all(queries),
  } as unknown as PrismaService;

  const service = new ConversationsService(prisma);

  // 1. No lineOaId (page 1, size 20)
  await service.list({ page: 1, pageSize: 20, sort: "latest-desc" });
  const req1 = capturedArgs[0] as { where: { lineOfficialAccountId?: string }; skip: number; take: number };
  assert.equal(req1.where.lineOfficialAccountId, undefined);
  assert.equal(req1.skip, 0);
  assert.equal(req1.take, 20);

  // 2. Valid lineOaId
  await service.list({ page: 1, pageSize: 20, lineOaId: "oa-1", sort: "latest-desc" });
  const req2 = capturedArgs[1] as { where: { lineOfficialAccountId?: string }; skip: number; take: number };
  assert.equal(req2.where.lineOfficialAccountId, "oa-1");
  assert.equal(req2.skip, 0);
  assert.equal(req2.take, 20);

  // 3. Unknown lineOaId
  await service.list({ page: 1, pageSize: 20, lineOaId: "unknown-oa", sort: "latest-desc" });
  const req3 = capturedArgs[2] as { where: { lineOfficialAccountId?: string }; skip: number; take: number };
  assert.equal(req3.where.lineOfficialAccountId, "unknown-oa");

  // 4. Page 2 with same filter
  await service.list({ page: 2, pageSize: 20, lineOaId: "oa-1", sort: "latest-desc" });
  const req4 = capturedArgs[3] as { where: { lineOfficialAccountId?: string }; skip: number; take: number };
  assert.equal(req4.where.lineOfficialAccountId, "oa-1");
  assert.equal(req4.skip, 20);
  assert.equal(req4.take, 20);
});

