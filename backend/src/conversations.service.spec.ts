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

  const service = new ConversationsService(prisma);
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

  const service = new ConversationsService(prisma);
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

  const service = new ConversationsService(prisma);
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

  const service = new ConversationsService(prisma);
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

  const service = new ConversationsService(prisma);
  const summary = await service.getBmReplyStatusSummary();

  // 1. Overall aggregation across all stores (10+20=30 NOT_REPLIED, 5 NOTIFIED_BM, 1+2=3 REPLIED)
  assert.equal(summary.overview.notReplied, 30);
  assert.equal(summary.overview.notifiedBm, 5);
  assert.equal(summary.overview.replied, 3);

  // 2. Per-store aggregation
  assert.deepEqual(summary.stores, [
    { storeId: "store-1", storeName: "Store Alpha", notReplied: 10, notifiedBm: 5, replied: 1 },
    { storeId: "store-2", storeName: "Store Beta", notReplied: 20, notifiedBm: 0, replied: 2 },
    // 3. Empty store handling
    { storeId: "store-3", storeName: "Store Gamma Empty", notReplied: 0, notifiedBm: 0, replied: 0 },
  ]);
});


