import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "./prisma.service";
import { ConversationsService, detectImageMime } from "./conversations.service";
import { OperationsService } from "./operations/operations.service";
import { CredentialEncryptionService } from "./credentials/credential-encryption.service";
import { LineMessagingService } from "./line-messaging/line-messaging.service";
import { BadGatewayException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

const noopOperations = {
  getOperationalConversationFilter: async () => ({}),
  getLatestResetAt: async () => null,
} as unknown as OperationsService;

void test("detectImageMime accepts supported signatures independently of multipart MIME", () => {
  assert.equal(detectImageMime(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "image/png");
  assert.equal(detectImageMime(Buffer.from([0xff, 0xd8, 0xff])), "image/jpeg");
  assert.equal(detectImageMime(Buffer.from("GIF89a")), "image/gif");
  assert.equal(detectImageMime(Buffer.from("RIFFxxxxWEBP")), "image/webp");
  assert.equal(detectImageMime(Buffer.from("%PDF-1.7")), null);
});

void test("sendImage accepts a valid PNG with generic multipart MIME", async () => {
  let storedMime: string | undefined;
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const conversation = { id: "conversation-generic", storeId: "store", customer: { lineUserId: "Ucustomer" }, lineOfficialAccount: { isActive: true, archivedAt: null, encryptedChannelAccessToken: "cipher" } };
  const prisma = {
    message: { findUnique: async () => null },
    conversation: { findUnique: async () => conversation },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      message: { create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "message-generic", ...data }) },
      messageMedia: { create: async ({ data }: { data: Record<string, unknown> }) => { storedMime = data.mimeType as string; return data; } },
      conversation: { update: async ({ data }: { data: Record<string, unknown> }) => data },
    }),
  } as unknown as PrismaService;
  const service = new ConversationsService(prisma, noopOperations, { decrypt: () => "token" } as CredentialEncryptionService, { pushImage: async () => ({ requestId: "request", acceptedRequestId: null, externalMessageId: "line-image", duplicateAccepted: false }) } as unknown as LineMessagingService, { put: async (_key: string, _body: Buffer, mime: string) => ({ provider: "s3", fileId: "key", mimeType: mime, size: png.length }) } as never);
  await service.sendImage(conversation.id, { buffer: png, mimetype: "application/octet-stream", size: png.length }, "123e4567-e89b-42d3-a456-426614174001", { id: "bm-a", email: "bm@example.com", displayName: "BM A", role: UserRole.VIEWER, isActive: true });
  assert.equal(storedMime, "image/png");
  await assert.rejects(() => service.sendImage(conversation.id, { buffer: png, mimetype: "image/jpeg", size: png.length }, "123e4567-e89b-42d3-a456-426614174002", { id: "bm-a", email: "bm@example.com", displayName: "BM A", role: UserRole.VIEWER, isActive: true }), /does not match/);
  await assert.rejects(() => service.sendImage(conversation.id, { buffer: Buffer.from("not an image"), mimetype: "image/png", size: 12 }, "123e4567-e89b-42d3-a456-426614174003", { id: "bm-a", email: "bm@example.com", displayName: "BM A", role: UserRole.VIEWER, isActive: true }), /Unsupported image type/);
  const oversized = Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024)]);
  await assert.rejects(() => service.sendImage(conversation.id, { buffer: oversized, mimetype: "image/png", size: oversized.length }, "123e4567-e89b-42d3-a456-426614174004", { id: "bm-a", email: "bm@example.com", displayName: "BM A", role: UserRole.VIEWER, isActive: true }), /10 MB/);
});

void test("sendMessage resolves the conversation OA token, persists outbound text, marks REPLIED, and audits only after LINE accepts", async () => {
  const writes: string[] = [];
  let persistedData: Record<string, unknown> | undefined;
  const conversation = {
    id: "conversation-send", customerId: "customer-send", storeId: "store-send", lineOfficialAccountId: "oa-send",
    latestMessageAt: new Date(), priority: "NORMAL", prioritySource: "SYSTEM", followUpStatus: "FOLLOW_UP", bmReplyStatus: "NOT_REPLIED",
    productRelationship: null, purchaseIntent: null, createdAt: new Date(), updatedAt: new Date(),
    customer: { id: "customer-send", lineUserId: "Ucorrect-customer" },
    store: { id: "store-send", name: "Safe Store" },
    lineOfficialAccount: { id: "oa-send", isActive: true, archivedAt: null, encryptedChannelAccessToken: "encrypted-correct-token" },
  };
  const persisted = { id: "outbound-1", conversationId: conversation.id, externalMessageId: "outbound:123e4567-e89b-42d3-a456-426614174000", direction: "OUTBOUND", messageType: "TEXT", originalText: "สวัสดีครับ", sentAt: new Date() };
  const prisma = {
    conversation: { findUnique: ({ where }: { where: { id?: string } }) => Promise.resolve(where.id ? conversation : null) },
    message: { findUnique: () => Promise.resolve(null) },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      message: { create: ({ data }: { data: Record<string, unknown> }) => { persistedData = data; writes.push("message"); return Promise.resolve(persisted); } },
      conversation: { update: ({ data }: { data: { bmReplyStatus: string } }) => { writes.push(`status:${data.bmReplyStatus}`); return Promise.resolve(conversation); } },
      activityHistory: { create: ({ data }: { data: { description: string; createdByName: string } }) => { writes.push(`audit:${data.createdByName}:${data.description}`); return Promise.resolve({}); } },
    }),
  } as unknown as PrismaService;
  const encryption = { decrypt: (value: string) => { assert.equal(value, "encrypted-correct-token"); return "correct-oa-token"; } } as CredentialEncryptionService;
  const line = { pushText: (input: { accessToken: string; lineUserId: string; retryKey: string }) => {
    assert.equal(input.accessToken, "correct-oa-token");
    assert.equal(input.lineUserId, "Ucorrect-customer");
    assert.equal(input.retryKey, "123e4567-e89b-42d3-a456-426614174000");
    assert.deepEqual(writes, []);
    return Promise.resolve({ requestId: "request", acceptedRequestId: null, externalMessageId: "line-message", duplicateAccepted: false });
  } } as LineMessagingService;
  const service = new ConversationsService(prisma, noopOperations, encryption, line);
  const result = await service.sendMessage(conversation.id, { text: "  สวัสดีครับ  ", idempotencyKey: "123e4567-e89b-42d3-a456-426614174000" }, { id: "admin", email: "admin@example.com", displayName: "Operator", role: UserRole.ADMIN, isActive: true });
  assert.equal(result.message.direction, "OUTBOUND");
  assert.equal(result.message.originalText, "สวัสดีครับ");
  assert.equal(persistedData?.senderUserId, "admin");
  assert.equal(persistedData?.senderDisplayName, "Operator");
  assert.equal(result.bmReplyStatus, "REPLIED");
  assert.deepEqual(writes.map((value) => value.split(":")[0]), ["message", "status", "audit"]);
  assert.equal(writes.join(" ").includes("correct-oa-token"), false);
});

void test("sendMessage does not persist or mark REPLIED when LINE rejects the push", async () => {
  let transactionCalled = false;
  const prisma = {
    message: { findUnique: () => Promise.resolve(null) },
    conversation: { findUnique: () => Promise.resolve({
      id: "conversation-fail", customer: { lineUserId: "Ucustomer" }, store: { id: "store" }, storeId: "store",
      lineOfficialAccountId: "oa", lineOfficialAccount: { isActive: true, archivedAt: null, encryptedChannelAccessToken: "cipher" },
    }) },
    $transaction: () => { transactionCalled = true; throw new Error("must not persist"); },
  } as unknown as PrismaService;
  const service = new ConversationsService(
    prisma,
    noopOperations,
    { decrypt: () => "token" } as CredentialEncryptionService,
    { pushText: () => Promise.reject(new BadGatewayException("LINE ปฏิเสธการส่งข้อความ")) },
  );
  await assert.rejects(() => service.sendMessage("conversation-fail", { text: "hello", idempotencyKey: "123e4567-e89b-42d3-a456-426614174000" }, { id: "admin", email: "admin@example.com", displayName: "Operator", role: UserRole.ADMIN, isActive: true }), /LINE ปฏิเสธ/);
  assert.equal(transactionCalled, false);
});

void test("sendImage validates content, persists media, sender, and REPLIED status", async () => {
  let mediaData: Record<string, unknown> | undefined;
  const conversation = { id: "conversation-image", storeId: "store", customer: { lineUserId: "Ucustomer" }, lineOfficialAccount: { isActive: true, archivedAt: null, encryptedChannelAccessToken: "cipher" } };
  const prisma = {
    message: { findUnique: async () => null },
    conversation: { findUnique: async () => conversation },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      message: { create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "message-image", ...data }) },
      messageMedia: { create: async ({ data }: { data: Record<string, unknown> }) => { mediaData = data; return data; } },
      conversation: { update: async ({ data }: { data: Record<string, unknown> }) => data },
    }),
  } as unknown as PrismaService;
  const service = new ConversationsService(prisma, noopOperations, { decrypt: () => "token" } as CredentialEncryptionService, { pushImage: async () => ({ requestId: "request", acceptedRequestId: null, externalMessageId: "line-image", duplicateAccepted: false }) } as unknown as LineMessagingService, { put: async () => ({ provider: "s3", fileId: "key", mimeType: "image/png", size: 8 }) } as never);
  const result = await service.sendImage(conversation.id, { buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), mimetype: "image/png", size: 8 }, "123e4567-e89b-42d3-a456-426614174000", { id: "bm-a", email: "bm@example.com", displayName: "BM A", role: UserRole.VIEWER, isActive: true });
  assert.equal(result.message.messageType, "IMAGE");
  assert.equal(mediaData?.processingStatus, "READY");
  assert.equal(mediaData?.mediaType, "IMAGE");
  assert.equal(result.bmReplyStatus, "REPLIED");
});

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
  const result = await new ConversationsService(prisma, noopOperations).get("conversation-1");
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
  const result = await new ConversationsService(prisma, noopOperations).get("conversation-2");
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
    storeMaster: {
      findMany: ({ where }: { where: { externalStoreId: { in: string[] } } }) => {
        storeMasterQueries += 1;
        assert.deepEqual(where.externalStoreId.in, ["STORE-A", "STORE-B"]);
        return Promise.resolve([{ externalStoreId: "STORE-A", lineManagerUrl: "https://manager.line.biz/account/a" }]);
      }
    },
    $transaction: (queries: Array<Promise<unknown>>) => Promise.all(queries),
  } as unknown as PrismaService;
  const result = await new ConversationsService(prisma, noopOperations).list({ page: 1, pageSize: 1_000, sort: "latest-desc" });
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

  const service = new ConversationsService(prisma, noopOperations);

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

void test("UpdateBmReplyStatusDto accepts valid enum values and rejects invalid values", async () => {
  const { validate } = await import("class-validator");
  const { UpdateBmReplyStatusDto } = await import("./dto");
  const { BmReplyStatus } = await import("@prisma/client");

  for (const status of [BmReplyStatus.NOT_REPLIED, BmReplyStatus.NOTIFIED_BM, BmReplyStatus.REPLIED]) {
    const dto = new UpdateBmReplyStatusDto();
    dto.status = status;
    const errors = await validate(dto);
    assert.equal(errors.length, 0, `Expected status ${status} to be valid`);
  }

  const invalidDto = new UpdateBmReplyStatusDto();
  (invalidDto as { status: unknown }).status = "INVALID_STATUS";
  const errors = await validate(invalidDto);
  assert.equal(errors.length, 1);
});

void test("ConversationsController registers PATCH /conversations/:id/bm-reply-status route with correct metadata", async () => {
  const { PATH_METADATA, METHOD_METADATA } = await import("@nestjs/common/constants");
  const { ConversationsController } = await import("./conversations.controller");

  const path = Reflect.getMetadata(PATH_METADATA, ConversationsController.prototype.bmReplyStatus);
  const method = Reflect.getMetadata(METHOD_METADATA, ConversationsController.prototype.bmReplyStatus);
  assert.equal(path, ":id/bm-reply-status");
  assert.equal(method, 4); // RequestMethod.PATCH is 4
});

void test("ConversationsService.updateBmReplyStatus NOT_REPLIED -> NOTIFIED_BM updates only BM status and logs activity", async () => {
  const { BmReplyStatus, FollowUpStatus, ActivityActionType } = await import("@prisma/client");

  const existingConv = {
    id: "conv-1",
    bmReplyStatus: BmReplyStatus.NOT_REPLIED,
    followUpStatus: FollowUpStatus.FOLLOW_UP,
    customerId: "c1",
    storeId: "s1",
    lineOfficialAccountId: "oa1",
    priority: "NORMAL",
    customer: {},
    store: {},
    lineOfficialAccount: {},
    messages: [],
    products: [],
    topics: [],
    notes: [],
    activityHistory: [],
  };

  let updatePayload: Record<string, unknown> | undefined;
  let activityPayload: Record<string, unknown> | undefined;

  const prisma = {
    conversation: {
      findUnique: () => Promise.resolve(existingConv),
      update: (args: { data: Record<string, unknown> }) => {
        updatePayload = args.data;
        return Promise.resolve({ ...existingConv, ...args.data });
      },
    },
    activityHistory: {
      create: (args: { data: Record<string, unknown> }) => {
        activityPayload = args.data;
        return Promise.resolve({ id: "act-1", ...args.data });
      },
    },
    storeMaster: { findMany: () => Promise.resolve([]) },
    $transaction: (queries: Array<Promise<unknown>>) => Promise.all(queries),
  } as unknown as PrismaService;

  const service = new ConversationsService(prisma, noopOperations);
  const result = await service.updateBmReplyStatus("conv-1", BmReplyStatus.NOTIFIED_BM);

  assert.equal(result.changed, true);
  assert.deepEqual(updatePayload, { bmReplyStatus: BmReplyStatus.NOTIFIED_BM });
  assert.deepEqual(activityPayload, {
    conversationId: "conv-1",
    actionType: ActivityActionType.BM_REPLY_STATUS_CHANGED,
    previousBmReplyStatus: BmReplyStatus.NOT_REPLIED,
    newBmReplyStatus: BmReplyStatus.NOTIFIED_BM,
    description: "BM reply status changed manually",
  });
});

void test("ConversationsService.updateBmReplyStatus NOTIFIED_BM -> REPLIED updates BM status AND sets followUpStatus to COMPLETED in one transaction", async () => {
  const { BmReplyStatus, FollowUpStatus, ActivityActionType } = await import("@prisma/client");

  const existingConv = {
    id: "conv-2",
    bmReplyStatus: BmReplyStatus.NOTIFIED_BM,
    followUpStatus: FollowUpStatus.FOLLOW_UP,
    customerId: "c1",
    storeId: "s1",
    lineOfficialAccountId: "oa1",
    priority: "NORMAL",
    customer: {},
    store: {},
    lineOfficialAccount: {},
    messages: [],
    products: [],
    topics: [],
    notes: [],
    activityHistory: [],
  };

  let updatePayload: Record<string, unknown> | undefined;
  let activityPayload: Record<string, unknown> | undefined;
  let transactionCalled = false;

  const prisma = {
    conversation: {
      findUnique: () => Promise.resolve(existingConv),
      update: (args: { data: Record<string, unknown> }) => {
        updatePayload = args.data;
        return Promise.resolve({ ...existingConv, ...args.data });
      },
    },
    activityHistory: {
      create: (args: { data: Record<string, unknown> }) => {
        activityPayload = args.data;
        return Promise.resolve({ id: "act-2", ...args.data });
      },
    },
    storeMaster: { findMany: () => Promise.resolve([]) },
    $transaction: (queries: Array<Promise<unknown>>) => {
      transactionCalled = true;
      assert.equal(queries.length, 2);
      return Promise.all(queries);
    },
  } as unknown as PrismaService;

  const service = new ConversationsService(prisma, noopOperations);
  const result = await service.updateBmReplyStatus("conv-2", BmReplyStatus.REPLIED);

  assert.equal(transactionCalled, true);
  assert.equal(result.changed, true);
  assert.deepEqual(updatePayload, {
    bmReplyStatus: BmReplyStatus.REPLIED,
    followUpStatus: FollowUpStatus.COMPLETED,
  });
  assert.deepEqual(activityPayload, {
    conversationId: "conv-2",
    actionType: ActivityActionType.BM_REPLY_STATUS_CHANGED,
    previousBmReplyStatus: BmReplyStatus.NOTIFIED_BM,
    newBmReplyStatus: BmReplyStatus.REPLIED,
    previousStatus: FollowUpStatus.FOLLOW_UP,
    newStatus: FollowUpStatus.COMPLETED,
    description: "BM reply status changed manually",
  });
});

void test("ConversationsService.updateBmReplyStatus repeating the same status is a no-op", async () => {
  const { BmReplyStatus, FollowUpStatus } = await import("@prisma/client");

  const existingConv = {
    id: "conv-3",
    bmReplyStatus: BmReplyStatus.NOTIFIED_BM,
    followUpStatus: FollowUpStatus.FOLLOW_UP,
    customerId: "c1",
    storeId: "s1",
    lineOfficialAccountId: "oa1",
    priority: "NORMAL",
    customer: {},
    store: {},
    lineOfficialAccount: {},
    messages: [],
    products: [],
    topics: [],
    notes: [],
    activityHistory: [],
  };

  let updateCalled = false;
  let activityCalled = false;

  const prisma = {
    conversation: {
      findUnique: () => Promise.resolve(existingConv),
      update: () => {
        updateCalled = true;
        return Promise.resolve(existingConv);
      },
    },
    activityHistory: {
      create: () => {
        activityCalled = true;
        return Promise.resolve({});
      },
    },
    storeMaster: { findMany: () => Promise.resolve([]) },
  } as unknown as PrismaService;

  const service = new ConversationsService(prisma, noopOperations);
  const result = await service.updateBmReplyStatus("conv-3", BmReplyStatus.NOTIFIED_BM);

  assert.equal(result.changed, false);
  assert.equal(updateCalled, false);
  assert.equal(activityCalled, false);
});

void test("AuthGuard rejects VIEWER role and allows ADMIN for PATCH /conversations/:id/bm-reply-status", async () => {
  const { ForbiddenException } = await import("@nestjs/common");
  const { Reflector } = await import("@nestjs/core");
  const { AuthGuard, AuthUser } = await import("./auth/auth.guard");
  const { ConversationsController } = await import("./conversations.controller");

  const viewer = { id: "v1", email: "viewer@example.test", displayName: "Viewer", role: "VIEWER", isActive: true } as AuthUser;
  const admin = { id: "a1", email: "admin@example.test", displayName: "Admin", role: "ADMIN", isActive: true } as AuthUser;

  const request = { method: "PATCH", path: "/conversations/conv-1/bm-reply-status", headers: {} };
  const viewerContext = {
    getHandler: () => ConversationsController.prototype.bmReplyStatus,
    getClass: () => ConversationsController,
    switchToHttp: () => ({ getRequest: () => request }),
  };

  const viewerGuard = new AuthGuard(new Reflector(), { authenticate: async () => viewer } as never);
  await assert.rejects(viewerGuard.canActivate(viewerContext as never), ForbiddenException);

  const adminGuard = new AuthGuard(new Reflector(), { authenticate: async () => admin } as never);
  assert.equal(await adminGuard.canActivate(viewerContext as never), true);
});

void test("AuthGuard requires authentication and allows both VIEWER and ADMIN for GET /conversations/bm-reply-status-summary", async () => {
  const { ForbiddenException, UnauthorizedException } = await import("@nestjs/common");
  const { Reflector } = await import("@nestjs/core");
  const { AuthGuard, AuthUser } = await import("./auth/auth.guard");
  const { ConversationsController } = await import("./conversations.controller");

  const viewer = { id: "v1", email: "viewer@example.test", displayName: "Viewer", role: "VIEWER", isActive: true } as AuthUser;
  const admin = { id: "a1", email: "admin@example.test", displayName: "Admin", role: "ADMIN", isActive: true } as AuthUser;

  const getRequest = { method: "GET", path: "/conversations/bm-reply-status-summary", headers: {} };
  const getContext = {
    getHandler: () => ConversationsController.prototype.bmReplyStatusSummary,
    getClass: () => ConversationsController,
    switchToHttp: () => ({ getRequest: () => getRequest }),
  };

  // 1. Unauthenticated request throws UnauthorizedException (401)
  const unauthGuard = new AuthGuard(new Reflector(), { authenticate: async () => null } as never);
  await assert.rejects(unauthGuard.canActivate(getContext as never), UnauthorizedException);

  // 2. Authenticated VIEWER role can access GET summary for read-only monitoring (200)
  const viewerGuard = new AuthGuard(new Reflector(), { authenticate: async () => viewer } as never);
  assert.equal(await viewerGuard.canActivate(getContext as never), true);

  // 3. Authenticated ADMIN role can access GET summary (200)
  const adminGuard = new AuthGuard(new Reflector(), { authenticate: async () => admin } as never);
  assert.equal(await adminGuard.canActivate(getContext as never), true);
});

void test("ConversationsService getBmReplyStatusSummary and ConversationsController storePrioritySummary compute oldestWaitingMinutes for NOT_REPLIED chats", async () => {
  const { ConversationsController } = await import("./conversations.controller");
  const service = new ConversationsService(
    {
      store: {
        findMany: async () => [{ id: "store-1", name: "Store 1" }],
      },
      conversation: {
        groupBy: async (params: { _min?: { latestMessageAt?: boolean } }) => {
          if (params._min) {
            return [{ storeId: "store-1", _min: { latestMessageAt: new Date(Date.now() - 150 * 60 * 1000) } }];
          }
          return [{ storeId: "store-1", bmReplyStatus: "NOT_REPLIED", _count: { _all: 3 } }];
        },
      },
    } as never,
    noopOperations,
  );

  const summary = await service.getBmReplyStatusSummary(null);
  assert.equal(summary.stores.length, 1);
  assert.equal(summary.stores[0].storeId, "store-1");
  assert.equal(summary.stores[0].notReplied, 3);
  assert.equal((summary.stores[0].oldestWaitingMinutes ?? 0) >= 149, true);

  const controller = new ConversationsController(service, {} as never, {} as never, {} as never, { accessibleStoreIds: async () => null } as never);
  const prioritySummary = await controller.storePrioritySummary({ user: { id: "admin" } } as never);
  assert.equal(prioritySummary.stores.length, 1);
  assert.equal(prioritySummary.stores[0].id, "store-1");
  assert.equal((prioritySummary.stores[0].oldestWaitingMinutes ?? 0) >= 149, true);
});

void test("ConversationsService.list supports bmReplyStatus filter", async () => {
  const { BmReplyStatus } = await import("@prisma/client");

  let capturedWhere: Record<string, unknown> | undefined;

  const prisma = {
    conversation: {
      findMany: (args: { where: Record<string, unknown> }) => {
        capturedWhere = args.where;
        return Promise.resolve([]);
      },
      count: () => Promise.resolve(0),
    },
    storeMaster: { findMany: () => Promise.resolve([]) },
    $transaction: (queries: Array<Promise<unknown>>) => Promise.all(queries),
  } as unknown as PrismaService;

  const service = new ConversationsService(prisma, noopOperations);
  await service.list({ bmReplyStatus: BmReplyStatus.NOTIFIED_BM, page: 1, pageSize: 25, sort: "latest-desc" });

  assert.equal(capturedWhere?.bmReplyStatus, BmReplyStatus.NOTIFIED_BM);
});

void test("ConversationsService.getBmReplyStatusSummary aggregates overall and per-store counts including empty stores", async () => {
  const { BmReplyStatus } = await import("@prisma/client");

  const prisma = {
    store: {
      findMany: () => Promise.resolve([
        { id: "store-1", name: "Store Alpha" },
        { id: "store-2", name: "Store Beta" },
        { id: "store-3", name: "Store Gamma Empty" },
      ]),
    },
    conversation: {
      groupBy: () => Promise.resolve([
        { storeId: "store-1", bmReplyStatus: BmReplyStatus.NOT_REPLIED, _count: { _all: 10 } },
        { storeId: "store-1", bmReplyStatus: BmReplyStatus.NOTIFIED_BM, _count: { _all: 5 } },
        { storeId: "store-1", bmReplyStatus: BmReplyStatus.REPLIED, _count: { _all: 1 } },
        { storeId: "store-2", bmReplyStatus: BmReplyStatus.NOT_REPLIED, _count: { _all: 20 } },
        { storeId: "store-2", bmReplyStatus: BmReplyStatus.REPLIED, _count: { _all: 2 } },
      ]),
    },
  } as unknown as PrismaService;

  const service = new ConversationsService(prisma, noopOperations);
  const summary = await service.getBmReplyStatusSummary(null);

  // 1. Overall aggregation across all stores (10+20=30 NOT_REPLIED, 5 NOTIFIED_BM, 1+2=3 REPLIED)
  assert.equal(summary.overview.notReplied, 30);
  assert.equal(summary.overview.notifiedBm, 5);
  assert.equal(summary.overview.replied, 3);

  // 2. Per-store aggregation
  assert.deepEqual(summary.stores, [
    { id: "store-1", storeId: "store-1", masterStoreId: null, externalStoreId: null, storeName: "Store Alpha", notReplied: 10, notifiedBm: 5, replied: 1, oldestWaitingMinutes: 0 },
    { id: "store-2", storeId: "store-2", masterStoreId: null, externalStoreId: null, storeName: "Store Beta", notReplied: 20, notifiedBm: 0, replied: 2, oldestWaitingMinutes: 0 },
    // 3. Empty store handling
    { id: "store-3", storeId: "store-3", masterStoreId: null, externalStoreId: null, storeName: "Store Gamma Empty", notReplied: 0, notifiedBm: 0, replied: 0, oldestWaitingMinutes: 0 },
  ]);
});

void test("sendMessage uses Reply API when a fresh unused replyToken is available", async () => {
  let replyCalled = false;
  let pushCalled = false;
  let claimedTokenId: string | null = null;
  let persistedRawPayload: Record<string, unknown> | undefined;

  const conversation = {
    id: "conv-reply-1",
    storeId: "store-1",
    customer: { lineUserId: "Ucust1" },
    lineOfficialAccount: { isActive: true, archivedAt: null, encryptedChannelAccessToken: "enc-tok" },
    store: { id: "store-1", name: "Store 1" },
  };

  const prisma = {
    conversation: { findUnique: async () => conversation },
    message: {
      findUnique: async () => null,
      findFirst: async (args: any) => {
        if (args?.where?.lineReplyTokenUsedAt === null) {
          return { id: "msg-inbound-1", encryptedLineReplyToken: "enc-reply-tok", lineReplyTokenReceivedAt: new Date(Date.now() - 5000) };
        }
        return null;
      },
      updateMany: async ({ where, data }: { where: any; data: any }) => {
        if (where.id === "msg-inbound-1" && where.lineReplyTokenUsedAt === null) {
          claimedTokenId = where.id;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    $transaction: async (cb: any) => cb({
      message: {
        create: async ({ data }: { data: any }) => {
          persistedRawPayload = data.rawPayload;
          return { id: "out-msg-1", ...data };
        },
      },
      conversation: { update: async ({ data }: { data: any }) => data },
      activityHistory: { create: async () => ({}) },
    }),
  } as unknown as PrismaService;

  const encryption = {
    decrypt: (val: string) => (val === "enc-reply-tok" ? "raw-reply-tok-123" : "channel-access-tok"),
  } as CredentialEncryptionService;

  const lineMessaging = {
    replyText: async (input: any) => {
      assert.equal(input.replyToken, "raw-reply-tok-123");
      assert.equal(input.text, "ตอบกลับเร็ว");
      assert.equal(input.context?.replyTokenAgeBucket, "< 30 seconds");
      replyCalled = true;
      return { success: true, requestId: "req-reply-1", externalMessageId: "line-msg-reply" };
    },
    pushText: async () => {
      pushCalled = true;
      return { requestId: "req-push-1", acceptedRequestId: null, externalMessageId: "line-msg-push", duplicateAccepted: false };
    },
  } as unknown as LineMessagingService;

  const service = new ConversationsService(prisma, noopOperations, encryption, lineMessaging);
  const result = await service.sendMessage(
    conversation.id,
    { text: "ตอบกลับเร็ว", idempotencyKey: "123e4567-e89b-42d3-a456-426614174099" },
    { id: "op-1", email: "op@test.com", displayName: "Operator", role: UserRole.VIEWER, isActive: true },
  );

  assert.equal(replyCalled, true);
  assert.equal(pushCalled, false);
  assert.equal(claimedTokenId, "msg-inbound-1");
  assert.equal(persistedRawPayload?.deliveryMethod, "REPLY");
  assert.equal(result.bmReplyStatus, "REPLIED");
});

void test("sendMessage attempts Reply API on token older than 45s and >1 minute without age cutoff", async () => {
  let replyCalled = false;
  let pushCalled = false;
  let passedTokenAgeMs: number | undefined;
  let passedAgeBucket: string | undefined;

  const conversation = {
    id: "conv-reply-old",
    storeId: "store-1",
    customer: { lineUserId: "Ucust1" },
    lineOfficialAccount: { isActive: true, archivedAt: null, encryptedChannelAccessToken: "enc-tok" },
    store: { id: "store-1", name: "Store 1" },
  };

  // 90 seconds old token
  const receivedAt90sAgo = new Date(Date.now() - 90_000);

  const prisma = {
    conversation: { findUnique: async () => conversation },
    message: {
      findUnique: async () => null,
      findFirst: async () => ({ id: "msg-inbound-old", encryptedLineReplyToken: "enc-old-tok", lineReplyTokenReceivedAt: receivedAt90sAgo }),
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (cb: any) => cb({
      message: { create: async ({ data }: { data: any }) => ({ id: "out-msg-1", ...data }) },
      conversation: { update: async ({ data }: { data: any }) => data },
      activityHistory: { create: async () => ({}) },
    }),
  } as unknown as PrismaService;

  const encryption = { decrypt: (val: string) => (val === "enc-old-tok" ? "raw-old-token-90s" : "channel-access-tok") } as CredentialEncryptionService;
  const lineMessaging = {
    replyText: async (input: any) => {
      replyCalled = true;
      passedTokenAgeMs = input.context?.replyTokenAgeMs;
      passedAgeBucket = input.context?.replyTokenAgeBucket;
      return { success: true, requestId: "req-reply-old", externalMessageId: "line-msg-old" };
    },
    pushText: async () => { pushCalled = true; return { requestId: "r", acceptedRequestId: null, externalMessageId: "m", duplicateAccepted: false }; },
  } as unknown as LineMessagingService;

  const service = new ConversationsService(prisma, noopOperations, encryption, lineMessaging);
  const result = await service.sendMessage(
    conversation.id,
    { text: "ข้อความตอบกลับหลัง 90 วินาที", idempotencyKey: "123e4567-e89b-42d3-a456-426614174098" },
    { id: "op-1", email: "op@test.com", displayName: "Operator", role: UserRole.VIEWER, isActive: true },
  );

  assert.equal(replyCalled, true, "Reply API must be attempted even after 90 seconds (no age cutoff)");
  assert.equal(pushCalled, false);
  assert.ok((passedTokenAgeMs ?? 0) >= 89_000, "Token age should reflect actual elapsed time");
  assert.equal(passedAgeBucket, "1-2 minutes");
  assert.equal(result.bmReplyStatus, "REPLIED");
});

void test("sendMessage falls back to Push API when LINE explicitly reports invalid or expired reply token", async () => {
  let replyCalled = false;
  let pushCalled = false;
  let persistedRawPayload: Record<string, unknown> | undefined;

  const conversation = {
    id: "conv-invalid-token",
    storeId: "store-1",
    customer: { lineUserId: "Ucust1" },
    lineOfficialAccount: { isActive: true, archivedAt: null, encryptedChannelAccessToken: "enc-tok" },
    store: { id: "store-1", name: "Store 1" },
  };

  const prisma = {
    conversation: { findUnique: async () => conversation },
    message: {
      findUnique: async () => null,
      findFirst: async () => ({ id: "msg-inbound-stale", encryptedLineReplyToken: "enc-stale", lineReplyTokenReceivedAt: new Date(Date.now() - 400_000) }),
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (cb: any) => cb({
      message: {
        create: async ({ data }: { data: any }) => {
          persistedRawPayload = data.rawPayload;
          return { id: "out-msg-invalid-fallback", ...data };
        },
      },
      conversation: { update: async ({ data }: { data: any }) => data },
      activityHistory: { create: async () => ({}) },
    }),
  } as unknown as PrismaService;

  const encryption = { decrypt: () => "token" } as CredentialEncryptionService;
  const lineMessaging = {
    replyText: async () => {
      replyCalled = true;
      return { success: false, invalidReplyToken: true, requestId: "req-invalid", externalMessageId: null };
    },
    pushText: async (input: any) => {
      pushCalled = true;
      assert.equal(input.context?.fallbackReason, "INVALID_REPLY_TOKEN");
      assert.equal(input.context?.replyTokenAgeBucket, "5-10 minutes");
      return { requestId: "req-push-fallback", acceptedRequestId: null, externalMessageId: "line-msg-pushed", duplicateAccepted: false };
    },
  } as unknown as LineMessagingService;

  const service = new ConversationsService(prisma, noopOperations, encryption, lineMessaging);
  const result = await service.sendMessage(
    conversation.id,
    { text: "ข้อความทดสอบ", idempotencyKey: "123e4567-e89b-42d3-a456-426614174097" },
    { id: "op-1", email: "op@test.com", displayName: "Operator", role: UserRole.VIEWER, isActive: true },
  );

  assert.equal(replyCalled, true);
  assert.equal(pushCalled, true);
  assert.equal(persistedRawPayload?.deliveryMethod, "PUSH");
  assert.equal(result.bmReplyStatus, "REPLIED");
});

void test("sendMessage routes directly to Push API when conversation has no unused tokens", async () => {
  let replyCalled = false;
  let pushCalled = false;

  const conversation = {
    id: "conv-no-token",
    storeId: "store-1",
    customer: { lineUserId: "Ucust1" },
    lineOfficialAccount: { isActive: true, archivedAt: null, encryptedChannelAccessToken: "enc-tok" },
    store: { id: "store-1", name: "Store 1" },
  };

  const prisma = {
    conversation: { findUnique: async () => conversation },
    message: {
      findUnique: async () => null,
      findFirst: async () => null, // No unused reply token
    },
    $transaction: async (cb: any) => cb({
      message: { create: async ({ data }: { data: any }) => ({ id: "out-msg-push", ...data }) },
      conversation: { update: async ({ data }: { data: any }) => data },
      activityHistory: { create: async () => ({}) },
    }),
  } as unknown as PrismaService;

  const encryption = { decrypt: () => "channel-access-tok" } as CredentialEncryptionService;
  const lineMessaging = {
    replyText: async () => { replyCalled = true; return { success: true, requestId: "r", externalMessageId: "m" }; },
    pushText: async () => {
      pushCalled = true;
      return { requestId: "req-push-direct", acceptedRequestId: null, externalMessageId: "line-msg-push", duplicateAccepted: false };
    },
  } as unknown as LineMessagingService;

  const service = new ConversationsService(prisma, noopOperations, encryption, lineMessaging);
  const result = await service.sendMessage(
    conversation.id,
    { text: "ข้อความโดยตรง", idempotencyKey: "123e4567-e89b-42d3-a456-426614174095" },
    { id: "op-1", email: "op@test.com", displayName: "Operator", role: UserRole.VIEWER, isActive: true },
  );

  assert.equal(replyCalled, false);
  assert.equal(pushCalled, true);
  assert.equal(result.bmReplyStatus, "REPLIED");
});

void test("sendImage uses Reply API when unused reply token is available", async () => {
  let replyCalled = false;
  let pushCalled = false;

  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const conversation = {
    id: "conv-img-reply",
    storeId: "store-1",
    customer: { lineUserId: "Ucust1" },
    lineOfficialAccount: { channelId: "oa-ch", isActive: true, archivedAt: null, encryptedChannelAccessToken: "enc-tok" },
    store: { id: "store-1", name: "Store 1" },
  };

  const prisma = {
    conversation: { findUnique: async () => conversation },
    message: {
      findUnique: async () => null,
      findFirst: async () => ({ id: "msg-inbound-img", encryptedLineReplyToken: "enc-reply-img", lineReplyTokenReceivedAt: new Date(Date.now() - 300_000) }),
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (cb: any) => cb({
      message: { create: async ({ data }: { data: any }) => ({ id: "out-msg-img-reply", ...data }) },
      messageMedia: { create: async () => ({}) },
      conversation: { update: async ({ data }: { data: any }) => data },
    }),
  } as unknown as PrismaService;

  const encryption = { decrypt: () => "token" } as CredentialEncryptionService;
  const lineMessaging = {
    replyImage: async (input: any) => {
      assert.ok(input.originalContentUrl.includes("/messages/media/public"));
      assert.equal(input.context?.replyTokenAgeBucket, "5-10 minutes");
      replyCalled = true;
      return { success: true, requestId: "req-img-reply", externalMessageId: "line-img-replied" };
    },
    pushImage: async () => {
      pushCalled = true;
      return { requestId: "r", acceptedRequestId: null, externalMessageId: "m", duplicateAccepted: false };
    },
  } as unknown as LineMessagingService;

  const service = new ConversationsService(
    prisma,
    noopOperations,
    encryption,
    lineMessaging,
    { put: async (_k: string, _b: Buffer, mime: string) => ({ provider: "local", fileId: "f-1", mimeType: mime, size: png.length }) } as any,
  );

  const result = await service.sendImage(
    conversation.id,
    { buffer: png, mimetype: "image/png", size: png.length },
    "123e4567-e89b-42d3-a456-426614174096",
    { id: "op-1", email: "op@test.com", displayName: "Operator", role: UserRole.VIEWER, isActive: true },
  );

  assert.equal(replyCalled, true);
  assert.equal(pushCalled, false);
  assert.equal(result.bmReplyStatus, "REPLIED");
});

void test("replyToken fields are never exposed in safeMessage", () => {
  const service = new ConversationsService({} as any, noopOperations);
  const msgWithTokens = {
    id: "msg-1",
    direction: "INBOUND" as const,
    originalText: "test",
    encryptedLineReplyToken: "secret-token-ciphertext",
    lineReplyTokenReceivedAt: new Date(),
    lineReplyTokenUsedAt: new Date(),
    media: null,
  };

  const safe: any = (service as any).safeMessage(msgWithTokens);
  assert.equal(safe.encryptedLineReplyToken, undefined);
  assert.equal(safe.lineReplyTokenReceivedAt, undefined);
  assert.equal(safe.lineReplyTokenUsedAt, undefined);
  assert.equal(safe.id, "msg-1");
});
