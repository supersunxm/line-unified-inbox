import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { LineChatNicknameSyncJobStatus } from "@prisma/client";
import { LineChatHealthReconciliationService } from "./line-chat-health-reconciliation.service";

test("LineChat health baseline is created once and historical counts reset to zero", async () => {
  const resetAt = new Date("2026-09-09T09:30:00.000Z");
  let createdType: string | null = null;
  const prisma: any = {
    operationalSession: {
      findFirst: async (args: any) => {
        assert.deepEqual(args.where, { type: "LINE_CHAT_NICKNAME_HEALTH" });
        return null;
      },
      create: async (args: any) => {
        createdType = args.data.type;
        return { resetAt };
      },
    },
    lineChatNicknameSyncJob: {
      findMany: async (args: any) => {
        assert.deepEqual(args.where, { createdAt: { gte: resetAt } });
        return [];
      },
    },
    lineOfficialAccount: { findMany: async () => [] },
  };

  const service = new LineChatHealthReconciliationService(prisma);
  const report: any = {
    timestamp: resetAt.toISOString(),
    queue: { pending: 140, processing: 0, success: 238, failed: 0, failedAuth: 0, superseded: 54, total: 432 },
    mapping: { mappedReadyPending: 0, waitingForMapping: 142, oldestPendingAt: "2026-09-02T14:00:32.000Z" },
    rollout: { totalOas: 1, enabledOas: 1, disabledOas: 0, missingChatBotId: 0, missingSession: 0 },
    sessions: [{
      id: "sess-b",
      jobs: { pending: 140, processing: 0, success: 238, failed: 0, failedAuth: 0, superseded: 54, total: 432 },
      recentFailures: [{ createdAt: "2026-09-08T00:00:00.000Z" }],
    }],
  };

  const reconciled = await service.reconcile(report);
  assert.equal(createdType, "LINE_CHAT_NICKNAME_HEALTH");
  assert.deepEqual(reconciled.queue, { pending: 0, processing: 0, success: 0, failed: 0, failedAuth: 0, superseded: 0, total: 0 });
  assert.deepEqual(reconciled.mapping, { mappedReadyPending: 0, waitingForMapping: 0, oldestPendingAt: null });
  assert.deepEqual(reconciled.sessions[0].jobs, { pending: 0, processing: 0, success: 0, failed: 0, failedAuth: 0, superseded: 0, total: 0 });
  assert.equal(reconciled.sessions[0].recentFailures.length, 0);
});

test("LineChat health baseline counts only post-reset terminal failures as Failed", async () => {
  const resetAt = new Date("2026-09-09T09:30:00.000Z");
  const freshJobs = [
    {
      id: "job-failed",
      conversationId: "conv-1",
      lineOfficialAccountId: "oa-b",
      status: LineChatNicknameSyncJobStatus.FAILED,
      lineChatUserId: null,
      createdAt: new Date("2026-09-09T09:31:00.000Z"),
      conversation: { lineChatUserId: null },
    },
    {
      id: "job-waiting",
      conversationId: "conv-2",
      lineOfficialAccountId: "oa-b",
      status: LineChatNicknameSyncJobStatus.PENDING,
      lineChatUserId: null,
      createdAt: new Date("2026-09-09T09:32:00.000Z"),
      conversation: { lineChatUserId: null },
    },
  ];
  const prisma: any = {
    operationalSession: {
      findFirst: async () => ({ resetAt }),
      create: async () => { throw new Error("should not create a second baseline"); },
    },
    lineChatNicknameSyncJob: { findMany: async () => freshJobs },
    lineOfficialAccount: { findMany: async () => [{ id: "oa-b", lineChatSessionId: "sess-b" }] },
  };

  const service = new LineChatHealthReconciliationService(prisma);
  const report: any = {
    timestamp: resetAt.toISOString(),
    queue: {},
    mapping: {},
    rollout: {},
    sessions: [{
      id: "sess-b",
      jobs: {},
      recentFailures: [
        { createdAt: "2026-09-08T00:00:00.000Z" },
        { createdAt: "2026-09-09T09:31:00.000Z" },
      ],
    }],
  };

  const reconciled = await service.reconcile(report);
  assert.equal(reconciled.queue.failed, 1);
  assert.equal(reconciled.queue.pending, 1);
  assert.equal(reconciled.queue.failedAuth, 0);
  assert.equal(reconciled.mapping.waitingForMapping, 1);
  assert.equal(reconciled.sessions[0].jobs.failed, 1);
  assert.equal(reconciled.sessions[0].jobs.pending, 1);
  assert.equal(reconciled.sessions[0].recentFailures.length, 1);
});
