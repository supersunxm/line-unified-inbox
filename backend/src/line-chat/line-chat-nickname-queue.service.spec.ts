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
  assert.equal(result.nickname, "Reno14 Pro ผ่อน 08/26");
  assert.equal(createdJobs.length, 1);
  assert.equal(createdJobs[0].nickname, "Reno14 Pro ผ่อน 08/26");
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
