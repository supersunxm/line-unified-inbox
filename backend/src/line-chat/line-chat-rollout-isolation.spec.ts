import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { LineChatNicknameQueueService } from "./line-chat-nickname-queue.service";
import { LineChatOperationsService } from "./line-chat-operations.service";

test("Kill-Switch & Rollout Isolation: Enabling pilot OA does not enable others, and disabling halts jobs immediately", async () => {
  const oas: Record<string, { id: string; name: string; chatBotId: string; lineChatSessionId: string; lineChatNicknameSyncEnabled: boolean }> = {
    "oa-pilot": {
      id: "oa-pilot",
      name: "OPPO BigC MAHACHAI 1",
      chatBotId: "U092441d025f688e389d25779dd8debf4",
      lineChatSessionId: "session-profile-a",
      lineChatNicknameSyncEnabled: false, // Default false
    },
    "oa-store-2": {
      id: "oa-store-2",
      name: "OPPO Central World",
      chatBotId: "U11111111111111111111111111111111",
      lineChatSessionId: "session-profile-a",
      lineChatNicknameSyncEnabled: false,
    },
    "oa-store-3": {
      id: "oa-store-3",
      name: "OPPO Mega Bangna",
      chatBotId: "U22222222222222222222222222222222",
      lineChatSessionId: "session-profile-b",
      lineChatNicknameSyncEnabled: false,
    },
  };

  const createdJobs: any[] = [];

  const mockPrisma: any = {
    lineOfficialAccount: {
      findUnique: async (args: any) => oas[args.where.id],
      update: async (args: any) => {
        const item = oas[args.where.id];
        if (item) Object.assign(item, args.data);
        return item;
      },
    },
    conversation: {
      findUnique: async (args: any) => {
        const convId = args.where.id;
        const targetOaId = convId === "conv-pilot" ? "oa-pilot" : "oa-store-2";
        const oa = oas[targetOaId];
        return {
          id: convId,
          lineOfficialAccountId: oa.id,
          lineChatUserId: "Uchat_user_pilot",
          customerSalesStatus: "ONLINE",
          paymentMethod: null,
          salesRecordedAt: new Date(),
          lineOfficialAccount: {
            ...oa,
            lineChatSession: { id: oa.lineChatSessionId, sessionKey: "profile-a", status: "ACTIVE" },
          },
          customer: { id: "c-1", lineUserId: "Uuser123" },
          salesProducts: [],
        };
      },
    },
    lineChatNicknameSyncJob: {
      updateMany: async () => ({ count: 0 }),
      create: async (args: any) => {
        createdJobs.push(args.data);
        return { id: `job-${createdJobs.length}`, ...args.data };
      },
    },
  };

  const queue = new LineChatNicknameQueueService(mockPrisma);
  const ops = new LineChatOperationsService(mockPrisma);

  // Step 1: Initial state (All disabled)
  const initialPilotResult = await queue.enqueueSalesSync("conv-pilot");
  assert.equal(initialPilotResult.enqueued, false);
  assert.equal(initialPilotResult.reason, "ROLLOUT_DISABLED");
  assert.equal(createdJobs.length, 0);

  // Step 2: Enable ONLY the pilot OA via Operations API
  const toggleRes = await ops.toggleOaNicknameSync("oa-pilot", true);
  assert.equal(toggleRes.enabled, true);

  // Verify other OAs remain disabled
  assert.equal(oas["oa-pilot"].lineChatNicknameSyncEnabled, true);
  assert.equal(oas["oa-store-2"].lineChatNicknameSyncEnabled, false, "Store 2 must remain disabled");
  assert.equal(oas["oa-store-3"].lineChatNicknameSyncEnabled, false, "Store 3 must remain disabled");

  // Step 3: Sales save on pilot OA now creates a job
  const pilotSaveResult = await queue.enqueueSalesSync("conv-pilot");
  assert.equal(pilotSaveResult.enqueued, true);
  assert.equal(createdJobs.length, 1);
  assert.equal(createdJobs[0].lineOfficialAccountId, "oa-pilot");

  // Step 4: Sales save on Store 2 does NOT create a job
  const store2SaveResult = await queue.enqueueSalesSync("conv-store-2");
  assert.equal(store2SaveResult.enqueued, false);
  assert.equal(store2SaveResult.reason, "ROLLOUT_DISABLED");
  assert.equal(createdJobs.length, 1, "No new job created for Store 2");

  // Step 5: Emergency Kill Switch - Disable pilot OA
  await ops.toggleOaNicknameSync("oa-pilot", false);
  assert.equal(oas["oa-pilot"].lineChatNicknameSyncEnabled, false);

  // Step 6: Subsequent sales save on pilot OA is immediately skipped
  const killSwitchResult = await queue.enqueueSalesSync("conv-pilot");
  assert.equal(killSwitchResult.enqueued, false);
  assert.equal(killSwitchResult.reason, "ROLLOUT_DISABLED");
  assert.equal(createdJobs.length, 1, "Kill switch immediately halts job creation");
});
