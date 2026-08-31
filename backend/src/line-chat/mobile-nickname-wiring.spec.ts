import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { Test } from "@nestjs/testing";
import { MobileConversationsService } from "../mobile/mobile-conversations.service";
import { LineChatNicknameQueueService } from "./line-chat-nickname-queue.service";
import { LineChatModule } from "./line-chat.module";
import { PrismaService } from "../prisma.service";
import { StoreAccessService } from "../auth/store-access.service";
import { ConversationsService } from "../conversations.service";
import { PriorityService } from "../priority/priority.service";
import { AuthService } from "../auth/auth.service";
import { AuthGuard } from "../auth/auth.guard";

test("Nest DI container correctly injects LineChatNicknameQueueService into MobileConversationsService", async () => {
  const mockPrisma = {
    conversation: {
      findUnique: async () => null,
      update: async () => ({}),
    },
    lineChatNicknameSyncJob: {
      findFirst: async () => null,
      create: async () => ({ id: "job-test" }),
      updateMany: async () => ({ count: 0 }),
    },
  };
  const mockStoreAccess = {
    assertConversationAccess: async () => "store-1",
    accessibleStoreIds: async () => null,
  };
  const mockConversations = {};
  const mockPriority = {};
  const mockAuthService = {};

  const moduleRef = await Test.createTestingModule({
    imports: [LineChatModule],
    providers: [
      MobileConversationsService,
      { provide: StoreAccessService, useValue: mockStoreAccess },
      { provide: ConversationsService, useValue: mockConversations },
      { provide: PriorityService, useValue: mockPriority },
      { provide: AuthService, useValue: mockAuthService },
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(mockPrisma)
    .compile();

  const mobileService = moduleRef.get<MobileConversationsService>(MobileConversationsService);
  const queueService = moduleRef.get<LineChatNicknameQueueService>(LineChatNicknameQueueService);

  assert.ok(mobileService, "MobileConversationsService must be created by Nest DI");
  assert.ok(queueService, "LineChatNicknameQueueService must be created by Nest DI");

  const injectedQueue = (mobileService as unknown as { nicknameQueue?: LineChatNicknameQueueService }).nicknameQueue;
  assert.ok(injectedQueue, "LineChatNicknameQueueService MUST be injected and defined on MobileConversationsService");
  assert.equal(injectedQueue, queueService, "Injected queue instance must match the DI container instance");
});

test("MobileConversationsService.updateCustomerSalesInfo with status ONLINE creates persisted PENDING nickname sync job", async () => {
  const createdJobs: any[] = [];
  const supersededJobs: any[] = [];

  const conversationRecord = {
    id: "e36030a1-bb26-4c8c-bf6e-4b483925d0be",
    lineOfficialAccountId: "oa-test-1",
    lineOfficialAccount: {
      id: "oa-test-1",
      name: "Test OA",
      chatBotId: "U092441d025f688e389d25779dd8debf4",
      lineChatSessionId: "session-1",
      lineChatNicknameSyncEnabled: true,
      lineChatSession: { id: "session-1", sessionKey: "profile-a", status: "ACTIVE" },
    },
    customerSalesStatus: null,
    paymentMethod: null,
    salesRecordedAt: null,
    sourceChannels: ["STORE"],
    isInstallment: false,
    lineChatUserId: "Ud8d5af30ddca3ed4237e157d5d73c2f1",
    customer: {
      id: "cust-1",
      displayName: "Test Customer",
      lineUserId: "Umsg_api_distinct_123",
    },
    store: { id: "store-1", name: "OPPO Store", code: "S01" },
    salesProducts: [],
    products: [],
  };

  const mockTx = {
    conversation: {
      findUnique: async () => ({
        id: conversationRecord.id,
        sourceChannels: [],
        isInstallment: false,
        customerSalesStatus: null,
        interestLevel: null,
        paymentMethod: null,
        salesRecordedAt: null,
        salesRecordedById: null,
        products: [],
      }),
      update: async (args: any) => {
        Object.assign(conversationRecord, args.data);
        return conversationRecord;
      },
    },
    conversationCustomerSalesProduct: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 }),
    },
    activityHistory: {
      create: async () => ({}),
    },
  };

  const mockPrisma: any = {
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(mockTx),
    conversation: {
      findUnique: async () => conversationRecord,
    },
    lineChatNicknameSyncJob: {
      updateMany: async (args: any) => {
        supersededJobs.push(args);
        return { count: 0 };
      },
      create: async (args: any) => {
        createdJobs.push(args);
        return {
          id: "job-online-1",
          status: "PENDING",
          ...args.data,
        };
      },
    },
  };

  const queueService = new LineChatNicknameQueueService(mockPrisma);
  const storeAccessService = {
    assertConversationAccess: async () => "store-1",
  } as unknown as StoreAccessService;

  const mobileService = new MobileConversationsService(
    mockPrisma,
    storeAccessService,
    {} as ConversationsService,
    {} as PriorityService,
    undefined,
    queueService,
  );

  (mobileService as unknown as { get: () => Promise<unknown> }).get = async () => ({
    id: conversationRecord.id,
    store: { id: "store-1" },
  });

  const user: AuthUser = {
    id: "bm-user-1",
    email: "bm@oppo.com",
    displayName: "BM Staff",
    role: "BM",
    isActive: true,
  };

  const result = await mobileService.updateCustomerSalesInfo(user, conversationRecord.id, {
    status: "ONLINE",
  });

  assert.ok(result);

  // Allow next microtask / promise tick to complete async queue enqueue
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(createdJobs.length, 1, "Exactly one nickname sync job must be created");
  const job = createdJobs[0].data;
  assert.equal(job.conversationId, conversationRecord.id);
  assert.equal(job.lineOfficialAccountId, "oa-test-1");
  assert.equal(job.lineChatUserId, "Ud8d5af30ddca3ed4237e157d5d73c2f1");
  assert.equal(job.nickname, "Online", "Nickname for ONLINE status must be 'Online'");
});
