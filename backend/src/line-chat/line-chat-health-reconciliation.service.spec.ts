import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { LineChatNicknameSyncJobStatus, LineChatSessionStatus } from "@prisma/client";
import { LineChatHealthReconciliationService } from "./line-chat-health-reconciliation.service";
import type { LineChatHealthReport } from "./line-chat-operations.service";

function report(): LineChatHealthReport {
  return {
    timestamp: "2026-09-09T08:00:00.000Z",
    sessions: [{
      id: "session-b",
      sessionKey: "profile-b",
      displayName: "Profile B",
      status: LineChatSessionStatus.ACTIVE,
      lastAuthenticatedAt: null,
      lastSuccessfulRequestAt: null,
      lastAuthFailureAt: null,
      consecutiveAuthFailures: 0,
      mappedOaCount: 1,
      enabledOaCount: 1,
      healthStatus: "CONNECTED",
      healthFailureStage: null,
      healthLastCheckedAt: null,
      healthLastHealthyAt: null,
      activeProfileLeases: 0,
      activeLeaseOperation: null,
      jobs: { pending: 2, processing: 0, success: 10, failed: 0, failedAuth: 0, superseded: 3, total: 15 },
      recentFailures: [],
    }],
    queue: { pending: 2, processing: 0, success: 10, failed: 0, failedAuth: 0, superseded: 3, total: 15 },
    mapping: { mappedReadyPending: 0, waitingForMapping: 2, oldestPendingAt: "2026-09-01T00:00:00.000Z" },
    rollout: { totalOas: 1, enabledOas: 1, disabledOas: 0, missingChatBotId: 0, missingSession: 0 },
  };
}

test("health reconciliation hides stale pending predecessors when a newer job exists", async () => {
  let findManyCalls = 0;
  const mockPrisma: any = {
    lineChatNicknameSyncJob: {
      findMany: async (args: any) => {
        findManyCalls += 1;
        if (args.where.status) {
          return [
            {
              id: "old-pending",
              conversationId: "conv-1",
              lineOfficialAccountId: "oa-b",
              status: LineChatNicknameSyncJobStatus.PENDING,
              lineChatUserId: null,
              createdAt: new Date("2026-09-01T00:00:00.000Z"),
              conversation: { lineChatUserId: null },
            },
            {
              id: "real-pending",
              conversationId: "conv-2",
              lineOfficialAccountId: "oa-b",
              status: LineChatNicknameSyncJobStatus.PENDING,
              lineChatUserId: null,
              createdAt: new Date("2026-09-05T00:00:00.000Z"),
              conversation: { lineChatUserId: null },
            },
          ];
        }
        return [
          { id: "new-success", conversationId: "conv-1", createdAt: new Date("2026-09-08T00:00:00.000Z") },
          { id: "old-pending", conversationId: "conv-1", createdAt: new Date("2026-09-01T00:00:00.000Z") },
          { id: "real-pending", conversationId: "conv-2", createdAt: new Date("2026-09-05T00:00:00.000Z") },
        ];
      },
    },
    lineOfficialAccount: {
      findMany: async () => [{ id: "oa-b", lineChatSessionId: "session-b" }],
    },
  };

  const service = new LineChatHealthReconciliationService(mockPrisma);
  const result = await service.reconcile(report());

  assert.equal(findManyCalls, 2);
  assert.equal(result.queue.pending, 1);
  assert.equal(result.queue.superseded, 4);
  assert.equal(result.queue.total, 15);
  assert.equal(result.sessions[0].jobs.pending, 1);
  assert.equal(result.sessions[0].jobs.superseded, 4);
  assert.equal(result.mapping.waitingForMapping, 1);
  assert.equal(result.mapping.mappedReadyPending, 0);
  assert.equal(result.mapping.oldestPendingAt, "2026-09-05T00:00:00.000Z");
});

test("health reconciliation preserves a latest mapped pending job as actionable", async () => {
  const mockPrisma: any = {
    lineChatNicknameSyncJob: {
      findMany: async (args: any) => args.where.status ? [
        {
          id: "pending",
          conversationId: "conv-1",
          lineOfficialAccountId: "oa-b",
          status: LineChatNicknameSyncJobStatus.PENDING,
          lineChatUserId: "manager-user-id",
          createdAt: new Date("2026-09-05T00:00:00.000Z"),
          conversation: { lineChatUserId: null },
        },
      ] : [
        { id: "pending", conversationId: "conv-1", createdAt: new Date("2026-09-05T00:00:00.000Z") },
      ],
    },
    lineOfficialAccount: { findMany: async () => [] },
  };

  const base = report();
  base.queue.pending = 1;
  base.sessions[0].jobs.pending = 1;
  const service = new LineChatHealthReconciliationService(mockPrisma);
  const result = await service.reconcile(base);

  assert.equal(result.queue.pending, 1);
  assert.equal(result.mapping.mappedReadyPending, 1);
  assert.equal(result.mapping.waitingForMapping, 0);
  assert.equal(result.mapping.oldestPendingAt, "2026-09-05T00:00:00.000Z");
});
