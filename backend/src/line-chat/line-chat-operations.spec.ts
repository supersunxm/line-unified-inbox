import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { LineChatOperationsService } from "./line-chat-operations.service";
import { LineChatNicknameSyncJobStatus, LineChatSessionStatus } from "@prisma/client";

test("LineChatOperationsService: getHealthSummary aggregates non-secret metrics", async () => {
  const mockSessions = [
    {
      id: "sess-1",
      sessionKey: "profile-a",
      displayName: "Profile A",
      status: LineChatSessionStatus.ACTIVE,
      lastAuthenticatedAt: new Date("2026-08-31T10:00:00Z"),
      lastSuccessfulRequestAt: new Date("2026-08-31T11:00:00Z"),
      lastAuthFailureAt: null,
      consecutiveAuthFailures: 0,
      lineOfficialAccounts: [{ id: "oa-1", lineChatNicknameSyncEnabled: true }],
    },
    {
      id: "sess-2",
      sessionKey: "profile-b",
      displayName: "Profile B",
      status: LineChatSessionStatus.AUTH_REQUIRED,
      lastAuthenticatedAt: null,
      lastSuccessfulRequestAt: null,
      lastAuthFailureAt: new Date("2026-08-31T11:30:00Z"),
      consecutiveAuthFailures: 2,
      lineOfficialAccounts: [{ id: "oa-2", lineChatNicknameSyncEnabled: false }],
    },
  ];

  const mockOas = [
    { id: "oa-1", chatBotId: "Ubot1", lineChatSessionId: "sess-1", lineChatNicknameSyncEnabled: true },
    { id: "oa-2", chatBotId: null, lineChatSessionId: "sess-2", lineChatNicknameSyncEnabled: false },
    { id: "oa-3", chatBotId: null, lineChatSessionId: null, lineChatNicknameSyncEnabled: true }, // Enabled but missing bot & session
  ];

  const mockQueueCounts = [
    { status: LineChatNicknameSyncJobStatus.PENDING, _count: { id: 5 } },
    { status: LineChatNicknameSyncJobStatus.PROCESSING, _count: { id: 1 } },
    { status: LineChatNicknameSyncJobStatus.SUCCESS, _count: { id: 100 } },
    { status: LineChatNicknameSyncJobStatus.FAILED_AUTH, _count: { id: 3 } },
  ];

  const mockPrisma: any = {
    lineChatSession: {
      findMany: async () => mockSessions,
    },
    lineOfficialAccount: {
      findMany: async () => mockOas,
    },
    lineChatNicknameSyncJob: {
      groupBy: async () => mockQueueCounts,
    },
  };

  const ops = new LineChatOperationsService(mockPrisma);
  const health = await ops.getHealthSummary();

  assert.ok(health.timestamp);
  assert.equal(health.sessions.length, 2);
  assert.equal(health.sessions[0].sessionKey, "profile-a");
  assert.equal(health.sessions[0].status, LineChatSessionStatus.ACTIVE);
  assert.equal(health.sessions[1].sessionKey, "profile-b");
  assert.equal(health.sessions[1].status, LineChatSessionStatus.AUTH_REQUIRED);
  assert.equal(health.sessions[1].consecutiveAuthFailures, 2);

  assert.equal(health.queue.pending, 5);
  assert.equal(health.queue.processing, 1);
  assert.equal(health.queue.success, 100);
  assert.equal(health.queue.failedAuth, 3);
  assert.equal(health.queue.total, 109);

  assert.equal(health.rollout.totalOas, 3);
  assert.equal(health.rollout.enabledOas, 2);
  assert.equal(health.rollout.disabledOas, 1);
  assert.equal(health.rollout.missingChatBotId, 1);
  assert.equal(health.rollout.missingSession, 1);
});

test("LineChatOperationsService: retryFailedJobs resets failed jobs and reactivates session", async () => {
  let updatedSessionStatus: any = null;
  let updateManyArgs: any = null;

  const mockPrisma: any = {
    lineChatSession: {
      findUnique: async () => ({
        id: "sess-b",
        sessionKey: "profile-b",
        lineOfficialAccounts: [{ id: "oa-b1" }, { id: "oa-b2" }],
      }),
      update: async (args: any) => {
        updatedSessionStatus = args.data.status;
        return {};
      },
    },
    lineChatNicknameSyncJob: {
      updateMany: async (args: any) => {
        updateManyArgs = args;
        return { count: 4 };
      },
    },
  };

  const ops = new LineChatOperationsService(mockPrisma);
  const result = await ops.retryFailedJobs("profile-b");

  assert.equal(result.retriedCount, 4);
  assert.equal(updatedSessionStatus, LineChatSessionStatus.ACTIVE);
  assert.ok(updateManyArgs);
  assert.equal(updateManyArgs.data.status, LineChatNicknameSyncJobStatus.PENDING);
  assert.deepEqual(updateManyArgs.where.lineOfficialAccountId, { in: ["oa-b1", "oa-b2"] });
});

test("LineChatOperationsService: toggleOaNicknameSync toggles enabled flag", async () => {
  let toggledData: any = null;

  const mockPrisma: any = {
    lineOfficialAccount: {
      findUnique: async () => ({ id: "oa-100", lineChatNicknameSyncEnabled: false }),
      update: async (args: any) => {
        toggledData = args.data;
        return args.data;
      },
    },
  };

  const ops = new LineChatOperationsService(mockPrisma);
  const result = await ops.toggleOaNicknameSync("oa-100", true);

  assert.equal(result.enabled, true);
  assert.equal(toggledData.lineChatNicknameSyncEnabled, true);
});
