import assert from "node:assert/strict";
import test from "node:test";
import { LineChatNicknameQueueService } from "./line-chat-nickname-queue.service";
import { LineChatNicknameSyncJobStatus, CustomerSalesStatus, PaymentMethodType } from "@prisma/client";

void test("enqueueSalesSync creates Online job when status is ONLINE", async () => {
  const createdJobs: Array<Record<string, unknown>> = [];
  const supersededJobs: Array<Record<string, unknown>> = [];

  const prisma = {
    conversation: {
      findUnique: async () => ({
        id: "conv-1",
        lineOfficialAccountId: "oa-1",
        lineChatUserId: "Ud8d5af30ddca3ed4237e157d5d73c2f1",
        lineOfficialAccount: {
          id: "oa-1",
          chatBotId: "U092441d025f688e389d25779dd8debf4",
          lineChatSessionId: "sess-1",
          lineChatNicknameSyncEnabled: true,
          lineChatSession: { id: "sess-1", sessionKey: "profile-a", status: "ACTIVE" },
        },
        customerSalesStatus: CustomerSalesStatus.ONLINE,
        paymentMethod: null,
        salesRecordedAt: new Date("2026-08-31T10:00:00.000Z"),
        salesProducts: [],
      }),
    },
    lineChatNicknameSyncJob: {
      updateMany: async (args: Record<string, unknown>) => {
        supersededJobs.push(args);
        return { count: 1 };
      },
      create: async (args: { data: Record<string, unknown> }) => {
        createdJobs.push(args.data);
        return { id: "job-1", ...args.data };
      },
    },
  };

  const service = new LineChatNicknameQueueService(prisma as never);
  const result = await service.enqueueSalesSync("conv-1");

  assert.equal(result.enqueued, true);
  assert.equal(result.nickname, "Online");
  assert.equal(result.jobId, "job-1");
  assert.equal(result.supersededCount, 1);
  assert.equal(createdJobs.length, 1);
  assert.equal(createdJobs[0].nickname, "Online");
  assert.equal(createdJobs[0].lineChatUserId, "Ud8d5af30ddca3ed4237e157d5d73c2f1");
  assert.equal(createdJobs[0].status, LineChatNicknameSyncJobStatus.PENDING);
});

void test("enqueueSalesSync creates Cash purchase nickname job with Bangkok MM/YY", async () => {
  const createdJobs: Array<Record<string, unknown>> = [];

  const prisma = {
    conversation: {
      findUnique: async () => ({
        id: "conv-2",
        lineOfficialAccountId: "oa-1",
        lineChatUserId: "Uchat_user_cash_2",
        lineOfficialAccount: {
          id: "oa-1",
          chatBotId: "U092441d025f688e389d25779dd8debf4",
          lineChatSessionId: "sess-1",
          lineChatNicknameSyncEnabled: true,
          lineChatSession: { id: "sess-1", sessionKey: "profile-a", status: "ACTIVE" },
        },
        customerSalesStatus: CustomerSalesStatus.PURCHASED,
        paymentMethod: PaymentMethodType.CASH,
        salesRecordedAt: new Date("2026-08-30T05:00:00.000Z"),
        salesProducts: [
          {
            customProductName: null,
            productModel: { name: "OPPO Find X9" },
          },
        ],
      }),
    },
    lineChatNicknameSyncJob: {
      updateMany: async () => ({ count: 0 }),
      create: async (args: { data: Record<string, unknown> }) => {
        createdJobs.push(args.data);
        return { id: "job-2", ...args.data };
      },
    },
  };

  const service = new LineChatNicknameQueueService(prisma as never);
  const result = await service.enqueueSalesSync("conv-2");

  assert.equal(result.enqueued, true);
  assert.equal(result.nickname, "Find X9 สด 08/26");
  assert.equal(createdJobs.length, 1);
  assert.equal(createdJobs[0].nickname, "Find X9 สด 08/26");
  assert.equal(createdJobs[0].lineChatUserId, "Uchat_user_cash_2");
});

void test("enqueueSalesSync creates Installment purchase nickname job with custom model name", async () => {
  const createdJobs: Array<Record<string, unknown>> = [];

  const prisma = {
    conversation: {
      findUnique: async () => ({
        id: "conv-3",
        lineOfficialAccountId: "oa-1",
        lineChatUserId: "Uchat_user_inst_3",
        lineOfficialAccount: {
          id: "oa-1",
          chatBotId: "U092441d025f688e389d25779dd8debf4",
          lineChatSessionId: "sess-1",
          lineChatNicknameSyncEnabled: true,
          lineChatSession: { id: "sess-1", sessionKey: "profile-a", status: "ACTIVE" },
        },
        customerSalesStatus: CustomerSalesStatus.PURCHASED,
        paymentMethod: PaymentMethodType.INSTALLMENT,
        salesRecordedAt: new Date("2026-08-30T05:00:00.000Z"),
        salesProducts: [
          {
            customProductName: "Reno14 Pro",
            productModel: { name: "OPPO Reno14 Pro 5G" },
          },
        ],
      }),
    },
    lineChatNicknameSyncJob: {
      updateMany: async () => ({ count: 0 }),
      create: async (args: { data: Record<string, unknown> }) => {
        createdJobs.push(args.data);
        return { id: "job-3", ...args.data };
      },
    },
  };

  const service = new LineChatNicknameQueueService(prisma as never);
  const result = await service.enqueueSalesSync("conv-3");

  assert.equal(result.enqueued, true);
  assert.equal(result.nickname, "Reno14Pro ผ่อน 08/26");
  assert.equal(createdJobs.length, 1);
  assert.equal(createdJobs[0].nickname, "Reno14Pro ผ่อน 08/26");
  assert.equal(createdJobs[0].lineChatUserId, "Uchat_user_inst_3");
});

void test("enqueueSalesSync creates no job for INTERESTED and supersedes pending jobs", async () => {
  const createdJobs: Array<Record<string, unknown>> = [];
  const supersededCalls: Array<Record<string, unknown>> = [];

  const prisma = {
    conversation: {
      findUnique: async () => ({
        id: "conv-4",
        lineOfficialAccountId: "oa-1",
        lineChatUserId: "Uchat_user_4",
        lineOfficialAccount: {
          id: "oa-1",
          chatBotId: "U092441d025f688e389d25779dd8debf4",
          lineChatSessionId: "sess-1",
          lineChatNicknameSyncEnabled: true,
          lineChatSession: { id: "sess-1", sessionKey: "profile-a", status: "ACTIVE" },
        },
        customerSalesStatus: CustomerSalesStatus.INTERESTED,
        paymentMethod: null,
        salesRecordedAt: new Date("2026-08-30T05:00:00.000Z"),
        salesProducts: [{ customProductName: "Find X9", productModel: { name: "Find X9" } }],
      }),
    },
    lineChatNicknameSyncJob: {
      updateMany: async (args: Record<string, unknown>) => {
        supersededCalls.push(args);
        return { count: 1 };
      },
      create: async (args: { data: Record<string, unknown> }) => {
        createdJobs.push(args.data);
        return { id: "job-4", ...args.data };
      },
    },
  };

  const service = new LineChatNicknameQueueService(prisma as never);
  const result = await service.enqueueSalesSync("conv-4");

  assert.equal(result.enqueued, false);
  assert.equal(result.reason, "NO_NICKNAME_NEEDED");
  assert.equal(createdJobs.length, 0);
  assert.equal(supersededCalls.length, 1);
});

void test("enqueueSalesSync skips safely when Conversation.lineChatUserId is missing", async () => {
  const createdJobs: Array<Record<string, unknown>> = [];

  const prisma = {
    conversation: {
      findUnique: async () => ({
        id: "conv-missing-chat-id",
        lineOfficialAccountId: "oa-1",
        lineChatUserId: null, // missing LINE OA Manager chat user ID
        lineOfficialAccount: {
          id: "oa-1",
          chatBotId: "U092441d025f688e389d25779dd8debf4",
          lineChatSessionId: "sess-1",
          lineChatNicknameSyncEnabled: true,
          lineChatSession: { id: "sess-1", sessionKey: "profile-a", status: "ACTIVE" },
        },
        customerSalesStatus: CustomerSalesStatus.ONLINE,
        paymentMethod: null,
        salesRecordedAt: new Date("2026-08-30T05:00:00.000Z"),
        salesProducts: [],
      }),
    },
    lineChatNicknameSyncJob: {
      create: async (args: { data: Record<string, unknown> }) => {
        createdJobs.push(args.data);
        return { id: "job-5", ...args.data };
      },
    },
  };

  const service = new LineChatNicknameQueueService(prisma as never);
  const result = await service.enqueueSalesSync("conv-missing-chat-id");

  assert.equal(result.enqueued, false);
  assert.equal(result.reason, "MISSING_LINE_CHAT_USER_ID");
  assert.equal(createdJobs.length, 0);
});

void test("unmapped pilot ONLINE and PURCHASED conversations enqueue nullable-ID jobs", async (t) => {
  for (const sales of [
    { status: CustomerSalesStatus.ONLINE, paymentMethod: null, products: [], expected: "Online" },
    {
      status: CustomerSalesStatus.PURCHASED,
      paymentMethod: PaymentMethodType.INSTALLMENT,
      products: [{ customProductName: null, productModel: { name: "OPPO Find X9" } }],
      expected: "Find X9 ผ่อน 09/26",
    },
  ]) {
    await t.test(sales.status, async () => {
      let created: Record<string, unknown> | undefined;
      const prisma = {
        conversation: { findUnique: async () => ({
          id: `pilot-${sales.status}`,
          storeId: "pilot-store",
          lineOfficialAccountId: "pilot-oa",
          lineChatUserId: null,
          store: { code: "28375", storeMaster: null },
          lineOfficialAccount: {
            id: "pilot-oa",
            name: "OPPO BS RBS Chonburi",
            storeId: "pilot-store",
            accountType: "STORE",
            isActive: true,
            archivedAt: null,
            chatBotId: "U729972869a565723cb7fcf7ea28bbc43",
            lineChatSessionId: "pilot-session",
            lineChatNicknameSyncEnabled: true,
            lineChatSession: { id: "pilot-session", sessionKey: "profile-b", status: "ACTIVE" },
          },
          customerSalesStatus: sales.status,
          paymentMethod: sales.paymentMethod,
          salesRecordedAt: new Date("2026-08-31T17:30:00.000Z"),
          salesProducts: sales.products,
        }) },
        lineChatNicknameSyncJob: {
          updateMany: async () => ({ count: 0 }),
          create: async (args: { data: Record<string, unknown> }) => {
            created = args.data;
            return { id: "pilot-job", ...args.data };
          },
        },
      };
      const result = await new LineChatNicknameQueueService(prisma as never).enqueueSalesSync(`pilot-${sales.status}`);
      assert.equal(result.enqueued, true);
      assert.equal(result.nickname, sales.expected);
      assert.equal(created?.lineChatUserId, null);
      assert.equal(created?.lineUserId, null);
    });
  }
});

void test("enqueueSalesSync creates no job for incomplete purchase or unsupported payment", async () => {
  const createdJobs: Array<Record<string, unknown>> = [];

  const prisma = {
    conversation: {
      findUnique: async () => ({
        id: "conv-5",
        lineOfficialAccountId: "oa-1",
        lineChatUserId: "Uchat_user_5",
        lineOfficialAccount: {
          id: "oa-1",
          chatBotId: "U092441d025f688e389d25779dd8debf4",
          lineChatSessionId: "sess-1",
          lineChatNicknameSyncEnabled: true,
          lineChatSession: { id: "sess-1", sessionKey: "profile-a", status: "ACTIVE" },
        },
        customerSalesStatus: CustomerSalesStatus.PURCHASED,
        paymentMethod: PaymentMethodType.CREDIT_CARD, // unsupported for nickname
        salesRecordedAt: new Date("2026-08-30T05:00:00.000Z"),
        salesProducts: [{ customProductName: "Find X9", productModel: { name: "Find X9" } }],
      }),
    },
    lineChatNicknameSyncJob: {
      updateMany: async () => ({ count: 0 }),
      create: async (args: { data: Record<string, unknown> }) => {
        createdJobs.push(args.data);
        return { id: "job-5", ...args.data };
      },
    },
  };

  const service = new LineChatNicknameQueueService(prisma as never);
  const result = await service.enqueueSalesSync("conv-5");

  assert.equal(result.enqueued, false);
  assert.equal(createdJobs.length, 0);
});

void test("enqueueSalesSync fails safe and returns error reason without throwing on DB exception", async () => {
  const prisma = {
    conversation: {
      findUnique: async () => {
        throw new Error("DB connection pool exhausted");
      },
    },
  };

  const service = new LineChatNicknameQueueService(prisma as never);
  const result = await service.enqueueSalesSync("conv-fail");

  assert.equal(result.enqueued, false);
  assert.equal(result.reason, "DB connection pool exhausted");
});

void test("isLineChatRealtimeResolverEligible: Phase 1 and Phase 2 controlled rollout boundaries", async () => {
  const { isLineChatRealtimeResolverEligible } = await import("./line-chat-nickname-queue.service");

  const baseParams = {
    storeCode: "25610",
    conversationStoreId: "store-25610",
    oaStoreId: "store-25610",
    oaAccountType: "STORE",
    oaIsActive: true,
    oaArchivedAt: null,
    oaChatBotId: "U001732513bc5f534c1a40d36c89bb43f",
    oaSessionKey: "account-1",
    oaSessionStatus: "ACTIVE",
    oaSyncEnabled: true,
  };

  // 1. Phase 1 store 28375 is eligible
  assert.equal(
    isLineChatRealtimeResolverEligible({
      ...baseParams,
      storeCode: "28375",
      oaChatBotId: "U729972869a565723cb7fcf7ea28bbc43",
      oaSessionKey: "profile-b",
    }),
    true
  );

  // 2. Central World 25610 is eligible when sync=true
  assert.equal(isLineChatRealtimeResolverEligible(baseParams), true);

  // 3. Central World with sync=false is NOT eligible
  assert.equal(isLineChatRealtimeResolverEligible({ ...baseParams, oaSyncEnabled: false }), false);

  // 4. Other Phase 2 store (Bangkapi 27627) with sync=false is NOT eligible
  assert.equal(
    isLineChatRealtimeResolverEligible({ ...baseParams, storeCode: "27627", oaSyncEnabled: false }),
    false
  );

  // 5. Unknown/non-allowlisted store (99999) is NOT eligible even if sync=true and DB configured
  assert.equal(isLineChatRealtimeResolverEligible({ ...baseParams, storeCode: "99999" }), false);

  // 7. Mismatched conversationStoreId and oaStoreId fails closed
  assert.equal(
    isLineChatRealtimeResolverEligible({ ...baseParams, conversationStoreId: "store-other" }),
    false
  );

  // 8. HEAD_OFFICE accountType fails closed
  assert.equal(isLineChatRealtimeResolverEligible({ ...baseParams, oaAccountType: "HEAD_OFFICE" }), false);

  // 9. Inactive or archived OA fails closed
  assert.equal(isLineChatRealtimeResolverEligible({ ...baseParams, oaIsActive: false }), false);
  assert.equal(isLineChatRealtimeResolverEligible({ ...baseParams, oaArchivedAt: new Date() }), false);

  // Session disabled fails closed
  assert.equal(isLineChatRealtimeResolverEligible({ ...baseParams, oaSessionStatus: "DISABLED" }), false);
  assert.equal(isLineChatRealtimeResolverEligible({ ...baseParams, oaChatBotId: null }), false);
  assert.equal(isLineChatRealtimeResolverEligible({ ...baseParams, oaSessionKey: null }), false);
});

void test("enqueueSalesSync: Central World 25610 unmapped customer successfully creates PENDING job with null lineChatUserId", async () => {
  let createdJob: Record<string, unknown> | null = null;

  const prisma = {
    conversation: {
      findUnique: async () => ({
        id: "conv-cw-1",
        storeId: "store-cw",
        lineOfficialAccountId: "oa-cw",
        lineChatUserId: null, // Unmapped customer
        customerSalesStatus: CustomerSalesStatus.PURCHASED,
        paymentMethod: PaymentMethodType.CASH,
        salesRecordedAt: new Date("2026-09-02T10:00:00.000Z"),
        salesProducts: [{ customProductName: "Reno 12", productModel: { name: "Reno 12" } }],
        customer: { lineUserId: "U_cust_line_user_id_never_used_as_chat_id" },
        store: {
          code: "25610",
          storeMaster: { externalStoreId: "25610" },
        },
        lineOfficialAccount: {
          id: "oa-cw",
          name: "OPPO Central World",
          storeId: "store-cw",
          accountType: "STORE",
          isActive: true,
          archivedAt: null,
          chatBotId: "U001732513bc5f534c1a40d36c89bb43f",
          lineChatSessionId: "session-cw",
          lineChatNicknameSyncEnabled: true,
          lineChatSession: { id: "session-cw", sessionKey: "account-1", status: "ACTIVE" },
        },
      }),
    },
    lineChatNicknameSyncJob: {
      updateMany: async () => ({ count: 0 }),
      create: async (args: { data: Record<string, unknown> }) => {
        createdJob = args.data;
        return { id: "job-cw-1", ...args.data };
      },
    },
  };

  const service = new LineChatNicknameQueueService(prisma as never);
  const result = await service.enqueueSalesSync("conv-cw-1");

  assert.equal(result.enqueued, true);
  assert.equal(result.jobId, "job-cw-1");
  assert.ok(createdJob);
  // 10. Customer.lineUserId is NOT used as lineChatUserId (lineChatUserId must be null for worker resolution)
  assert.equal(createdJob.lineChatUserId, null);
  assert.equal(createdJob.status, LineChatNicknameSyncJobStatus.PENDING);
});

void test("enqueueSalesSync: Central World with sync=false skips enqueuing", async () => {
  const prisma = {
    conversation: {
      findUnique: async () => ({
        id: "conv-cw-disabled",
        storeId: "store-cw",
        lineOfficialAccountId: "oa-cw",
        lineChatUserId: null,
        customerSalesStatus: CustomerSalesStatus.ONLINE,
        paymentMethod: null,
        salesRecordedAt: new Date(),
        salesProducts: [],
        store: { code: "25610" },
        lineOfficialAccount: {
          id: "oa-cw",
          storeId: "store-cw",
          accountType: "STORE",
          isActive: true,
          archivedAt: null,
          chatBotId: "U001732513bc5f534c1a40d36c89bb43f",
          lineChatSessionId: "session-cw",
          lineChatNicknameSyncEnabled: false, // DISABLED
          lineChatSession: { id: "session-cw", sessionKey: "account-1", status: "ACTIVE" },
        },
      }),
    },
  };

  const service = new LineChatNicknameQueueService(prisma as never);
  const result = await service.enqueueSalesSync("conv-cw-disabled");

  assert.equal(result.enqueued, false);
  assert.equal(result.reason, "ROLLOUT_DISABLED");
});

void test("enqueueSalesSync: Existing mapped customer bypasses resolver check and queues directly", async () => {
  let createdJob: Record<string, unknown> | null = null;

  const prisma = {
    conversation: {
      findUnique: async () => ({
        id: "conv-mapped-1",
        storeId: "store-any",
        lineOfficialAccountId: "oa-any",
        lineChatUserId: "U_already_mapped_chat_user",
        customerSalesStatus: CustomerSalesStatus.ONLINE,
        paymentMethod: null,
        salesRecordedAt: new Date(),
        salesProducts: [],
        store: { code: "99999" }, // Non-allowlisted store, but already mapped!
        lineOfficialAccount: {
          id: "oa-any",
          storeId: "store-any",
          accountType: "STORE",
          isActive: true,
          archivedAt: null,
          chatBotId: "U_any_bot_id",
          lineChatSessionId: "sess-any",
          lineChatNicknameSyncEnabled: true,
          lineChatSession: { id: "sess-any", sessionKey: "account-x", status: "ACTIVE" },
        },
      }),
    },
    lineChatNicknameSyncJob: {
      updateMany: async () => ({ count: 0 }),
      create: async (args: { data: Record<string, unknown> }) => {
        createdJob = args.data;
        return { id: "job-mapped-1", ...args.data };
      },
    },
  };

  const service = new LineChatNicknameQueueService(prisma as never);
  const result = await service.enqueueSalesSync("conv-mapped-1");

  assert.equal(result.enqueued, true);
  assert.equal(createdJob?.lineChatUserId, "U_already_mapped_chat_user");
});

