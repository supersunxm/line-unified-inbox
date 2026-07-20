import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "./prisma.service";
import { ConversationsService } from "./conversations.service";

void test("conversation response includes resolved manager URL and excludes all OA credentials", async () => {
  const managerUrl = "https://manager.line.biz/account/canonical";
  const conversation = {
    id: "conversation-1", customerId: "customer-1", storeId: "store-1", lineOfficialAccountId: "oa-1", priority: "NORMAL", prioritySource: null, followUpStatus: "FOLLOW_UP", productRelationship: null, purchaseIntent: null, latestMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    customer: { id: "customer-1", lineUserId: "U123456789", displayName: "Customer", pictureUrl: null, statusMessage: null, preferredLanguage: null, profileFetchedAt: null, profileFetchStatus: "SUCCESS", profileFetchError: null, createdAt: new Date(), updatedAt: new Date() },
    store: { id: "store-1", code: "22535", name: "Store", region: null, area: null, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), storeMasterId: "master-old", provinceSource: null, regionSource: null, storeMaster: { lineManagerUrl: "https://manager.line.biz/account/stale" } },
    lineOfficialAccount: { id: "oa-1", name: "OA", basicId: "@oa", channelId: "channel", destinationId: "destination", encryptedChannelSecret: "secret-ciphertext", encryptedChannelAccessToken: "token-ciphertext", webhookKey: "private-webhook-key", connectionStatus: "CONNECTED", lastWebhookReceivedAt: new Date(), lastConnectionTestAt: null, lastConnectionError: null, storeId: "store-1", isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
    messages: [], products: [], topics: [], notes: [], activityHistory: [],
  };
  const prisma = { conversation: { findUnique: () => Promise.resolve(conversation) }, storeMaster: { findFirst: () => Promise.resolve({ lineManagerUrl: managerUrl }) } } as unknown as PrismaService;
  const result = await new ConversationsService(prisma).get("conversation-1");
  assert.equal(result.resolvedLineOaManagerUrl, managerUrl);
  assert.deepEqual(result.lineOfficialAccount, { id: "oa-1", name: "OA", basicId: "@oa", connectionStatus: "CONNECTED", isActive: true, lastWebhookReceivedAt: conversation.lineOfficialAccount.lastWebhookReceivedAt });
  const json = JSON.stringify(result);
  for (const forbidden of ["encryptedChannelSecret", "encryptedChannelAccessToken", "channelSecret", "channelAccessToken", "secret-ciphertext", "token-ciphertext", "private-webhook-key", "webhookKey"]) assert.equal(json.includes(forbidden), false, `${forbidden} must not be serialized`);
});
