import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { LineChatNicknameQueueService } from "./line-chat-nickname-queue.service";
import { LineChatSessionStatus } from "@prisma/client";

test("LineChatNicknameQueueService: skips enqueuing when lineChatNicknameSyncEnabled is false", async () => {
  let createdJob = false;
  const mockPrisma: any = {
    conversation: {
      findUnique: async () => ({
        id: "conv-1",
        lineOfficialAccountId: "oa-disabled",
        customerSalesStatus: "ONLINE",
        paymentMethod: null,
        salesRecordedAt: new Date(),
        lineOfficialAccount: {
          id: "oa-disabled",
          name: "Disabled Store OA",
          chatBotId: "U092441d025f688e389d25779dd8debf4",
          lineChatSessionId: "session-1",
          lineChatNicknameSyncEnabled: false, // Rollout disabled
          lineChatSession: { id: "session-1", sessionKey: "profile-a", status: LineChatSessionStatus.ACTIVE },
        },
        customer: { id: "c-1", lineUserId: "Uuser123" },
        salesProducts: [],
      }),
    },
    lineChatNicknameSyncJob: {
      create: async () => {
        createdJob = true;
        return {};
      },
    },
  };

  const queue = new LineChatNicknameQueueService(mockPrisma);
  const result = await queue.enqueueSalesSync("conv-1");

  assert.equal(result.enqueued, false);
  assert.equal(result.reason, "ROLLOUT_DISABLED");
  assert.equal(createdJob, false, "No job must be created when rollout flag is false");
});

test("LineChatNicknameQueueService: creates PENDING job when lineChatNicknameSyncEnabled is true", async () => {
  let createdJobData: any = null;
  const mockPrisma: any = {
    conversation: {
      findUnique: async () => ({
        id: "conv-2",
        lineOfficialAccountId: "oa-enabled",
        customerSalesStatus: "ONLINE",
        paymentMethod: null,
        salesRecordedAt: new Date(),
        lineOfficialAccount: {
          id: "oa-enabled",
          name: "Enabled Store OA",
          chatBotId: "U092441d025f688e389d25779dd8debf4",
          lineChatSessionId: "session-1",
          lineChatNicknameSyncEnabled: true, // Rollout enabled
          lineChatSession: { id: "session-1", sessionKey: "profile-a", status: LineChatSessionStatus.ACTIVE },
        },
        customer: { id: "c-1", lineUserId: "Uuser123" },
        salesProducts: [],
      }),
    },
    lineChatNicknameSyncJob: {
      updateMany: async () => ({ count: 0 }),
      create: async (args: any) => {
        createdJobData = args.data;
        return { id: "job-created-1", ...args.data };
      },
    },
  };

  const queue = new LineChatNicknameQueueService(mockPrisma);
  const result = await queue.enqueueSalesSync("conv-2");

  assert.equal(result.enqueued, true);
  assert.ok(createdJobData);
  assert.equal(createdJobData.nickname, "Online");
  assert.equal(createdJobData.lineOfficialAccountId, "oa-enabled");
});

test("LineChatNicknameQueueService: skips enqueuing safely when chatBotId is missing", async () => {
  const mockPrisma: any = {
    conversation: {
      findUnique: async () => ({
        id: "conv-3",
        lineOfficialAccountId: "oa-missing-bot",
        customerSalesStatus: "ONLINE",
        paymentMethod: null,
        salesRecordedAt: new Date(),
        lineOfficialAccount: {
          id: "oa-missing-bot",
          name: "No Bot ID Store",
          chatBotId: null, // Missing bot ID
          lineChatSessionId: "session-1",
          lineChatNicknameSyncEnabled: true,
          lineChatSession: { id: "session-1", sessionKey: "profile-a", status: LineChatSessionStatus.ACTIVE },
        },
        customer: { id: "c-1", lineUserId: "Uuser123" },
        salesProducts: [],
      }),
    },
  };

  const queue = new LineChatNicknameQueueService(mockPrisma);
  const result = await queue.enqueueSalesSync("conv-3");

  assert.equal(result.enqueued, false);
  assert.equal(result.reason, "MISSING_OA_MAPPING");
});

test("LineChatNicknameQueueService: skips enqueuing safely when session is DISABLED", async () => {
  const mockPrisma: any = {
    conversation: {
      findUnique: async () => ({
        id: "conv-4",
        lineOfficialAccountId: "oa-disabled-session",
        customerSalesStatus: "ONLINE",
        paymentMethod: null,
        salesRecordedAt: new Date(),
        lineOfficialAccount: {
          id: "oa-disabled-session",
          name: "Disabled Session Store",
          chatBotId: "U092441d025f688e389d25779dd8debf4",
          lineChatSessionId: "session-disabled",
          lineChatNicknameSyncEnabled: true,
          lineChatSession: { id: "session-disabled", sessionKey: "profile-a", status: LineChatSessionStatus.DISABLED },
        },
        customer: { id: "c-1", lineUserId: "Uuser123" },
        salesProducts: [],
      }),
    },
  };

  const queue = new LineChatNicknameQueueService(mockPrisma);
  const result = await queue.enqueueSalesSync("conv-4");

  assert.equal(result.enqueued, false);
  assert.equal(result.reason, "SESSION_DISABLED");
});
