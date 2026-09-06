import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { classifyLineChatJobFailure, getRecommendedAction, LineChatOperationsService } from "./line-chat-operations.service";
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
      healthStatus: "CONNECTED",
      healthFailureStage: null,
      healthLastCheckedAt: new Date("2026-08-31T11:05:00Z"),
      healthLastHealthyAt: new Date("2026-08-31T11:05:00Z"),
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
      healthStatus: "AUTH_REQUIRED",
      healthFailureStage: "MANAGER_AUTH",
      healthLastCheckedAt: new Date("2026-08-31T11:30:00Z"),
      healthLastHealthyAt: null,
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
      groupBy: async (args: { by: string[] }) => args.by.includes("lineOfficialAccountId") ? [
        { lineOfficialAccountId: "oa-1", status: LineChatNicknameSyncJobStatus.SUCCESS, _count: { id: 10 } },
        { lineOfficialAccountId: "oa-2", status: LineChatNicknameSyncJobStatus.FAILED_AUTH, _count: { id: 3 } },
      ] : mockQueueCounts,
      findMany: async () => ["RESOLVE_NO_MATCH", "RESOLVE_TRANSPORT cookie=secret /profiles/private customer message"].map((lastError) => ({
        id: "job-1", status: "FAILED", lastError, attemptCount: 1,
        createdAt: new Date(), updatedAt: new Date(),
        lineOfficialAccount: { id: "oa-1", name: "OA", lineChatSessionId: "sess-1" },
      })),
    },
    lineChatProfileOperationLease: { findMany: async () => [] },
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
  assert.equal(health.sessions[0].healthStatus, "CONNECTED");
  assert.equal(health.sessions[0].jobs.success, 10);
  assert.deepEqual(Object.keys(health.sessions[0].recentFailures[0]).sort(), ["attemptCount", "conversationId", "createdAt", "failureCategory", "failureStage", "isAutoFixable", "jobId", "oaId", "oaName", "recommendedAction", "updatedAt"]);
  assert.equal(health.sessions[0].recentFailures[0].failureStage, "RESOLVE_NO_MATCH");
  assert.equal(health.sessions[0].recentFailures[0].recommendedAction, "MANUAL_REVIEW");
  assert.equal(health.sessions[0].recentFailures[0].isAutoFixable, false);
  assert.equal(health.sessions[0].recentFailures[1].failureStage, null);
  assert.doesNotMatch(JSON.stringify(health), /cookie=secret|profiles\/private|customer message/);

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

test("LineChatOperationsService: failures are classified without treating job failures as session health", () => {
  assert.equal(classifyLineChatJobFailure("FAILED_AUTH", "anything"), "AUTHENTICATION");
  assert.equal(classifyLineChatJobFailure("FAILED", "RESOLVE_NO_MATCH"), "VALIDATION");
  assert.equal(classifyLineChatJobFailure("FAILED", "Network failure"), "TRANSPORT");
  assert.equal(classifyLineChatJobFailure("FAILED", "Failed to fetch"), "TRANSPORT");
  assert.equal(classifyLineChatJobFailure("FAILED", "ETIMEDOUT"), "TIMEOUT");
  assert.equal(classifyLineChatJobFailure("FAILED", "PROFILE_LOCK"), "PROFILE_LOCK");
  assert.equal(classifyLineChatJobFailure("FAILED", "Profile directory does not exist"), "COORDINATOR");
  assert.equal(classifyLineChatJobFailure("FAILED", "HTTP 400"), "VALIDATION");
  assert.equal(classifyLineChatJobFailure("FAILED", "HTTP 400 (Bad Request)"), "VALIDATION");
  assert.equal(classifyLineChatJobFailure("FAILED", "NICKNAME_VALIDATION_FAILED"), "VALIDATION");
  assert.equal(classifyLineChatJobFailure("FAILED", "NICKNAME_LENGTH_EXCEEDED"), "VALIDATION");
  assert.equal(classifyLineChatJobFailure("FAILED", "HTTP 500"), "EXECUTION");
  assert.equal(classifyLineChatJobFailure("FAILED", ""), "UNKNOWN");
});

test("LineChatOperationsService: getRecommendedAction maps categories to safe action policies", () => {
  // AUTHENTICATION -> RE_LOGIN_REQUIRED (never auto-fix)
  assert.deepEqual(getRecommendedAction("AUTHENTICATION"), { action: "RE_LOGIN_REQUIRED", isAutoFixable: false });

  // TRANSPORT & TIMEOUT -> RETRY_RECOMMENDED (auto-fixable)
  assert.deepEqual(getRecommendedAction("TRANSPORT"), { action: "RETRY_RECOMMENDED", isAutoFixable: true });
  assert.deepEqual(getRecommendedAction("TIMEOUT"), { action: "RETRY_RECOMMENDED", isAutoFixable: true });

  // EXECUTION -> controlled 1-retry: attemptCount < 2 is auto-fixable; attemptCount >= 2 is MANUAL_REVIEW
  assert.deepEqual(getRecommendedAction("EXECUTION", 0), { action: "RETRY_OR_INSPECT", isAutoFixable: true });
  assert.deepEqual(getRecommendedAction("EXECUTION", 1), { action: "RETRY_OR_INSPECT", isAutoFixable: true });
  assert.deepEqual(getRecommendedAction("EXECUTION", 2), { action: "MANUAL_REVIEW", isAutoFixable: false });
  assert.deepEqual(getRecommendedAction("EXECUTION", 3), { action: "MANUAL_REVIEW", isAutoFixable: false });

  // VALIDATION -> MANUAL_REVIEW (never auto-fix)
  assert.deepEqual(getRecommendedAction("VALIDATION"), { action: "MANUAL_REVIEW", isAutoFixable: false });

  // PROFILE_LOCK & COORDINATOR -> SYSTEM_ATTENTION (not auto-fixable)
  assert.deepEqual(getRecommendedAction("PROFILE_LOCK"), { action: "SYSTEM_ATTENTION", isAutoFixable: false });
  assert.deepEqual(getRecommendedAction("COORDINATOR"), { action: "SYSTEM_ATTENTION", isAutoFixable: false });

  // UNKNOWN -> INVESTIGATE (not auto-fixable)
  assert.deepEqual(getRecommendedAction("UNKNOWN"), { action: "INVESTIGATE", isAutoFixable: false });
});

test("LineChatOperationsService: retrySelectedJobs re-validates retryability on server and respects session isolation", async () => {
  let updatedIds: string[] = [];

  const mockPrisma: any = {
    lineChatSession: {
      findUnique: async (args: any) => {
        if (args.where.sessionKey === "profile-b") {
          return {
            id: "sess-b",
            sessionKey: "profile-b",
            lineOfficialAccounts: [{ id: "oa-b1" }],
          };
        }
        return null;
      },
    },
    lineChatNicknameSyncJob: {
      findMany: async (args: any) => {
        // Return only jobs matching the where clause (filtered by oa-b1 and status in FAILED/FAILED_AUTH)
        assert.deepEqual(args.where.lineOfficialAccountId, { in: ["oa-b1"] });
        assert.deepEqual(args.where.status, { in: [LineChatNicknameSyncJobStatus.FAILED, LineChatNicknameSyncJobStatus.FAILED_AUTH] });

        return [
          { id: "job-trans", status: "FAILED", lastError: "RESOLVE_TRANSPORT", attemptCount: 1 },
          { id: "job-exec-1", status: "FAILED", lastError: "HTTP 500", attemptCount: 1 },
          { id: "job-valid", status: "FAILED", lastError: "RESOLVE_NO_MATCH", attemptCount: 1 },
        ];
      },
      updateMany: async (args: any) => {
        updatedIds.push(...args.where.id.in);
        return { count: args.where.id.in.length };
      },
    },
  };

  const ops = new LineChatOperationsService(mockPrisma);

  // Without overrideNonRetryable: only TRANSPORT and EXECUTION (attemptCount < 2) are retried; VALIDATION is excluded!
  const result = await ops.retrySelectedJobs({
    sessionKey: "profile-b",
    jobIds: ["job-trans", "job-exec-1", "job-valid", "job-nonexistent-or-other-oa"],
    overrideNonRetryable: false,
  });

  assert.equal(result.retriedCount, 2);
  assert.equal(result.skippedCount, 2);
  assert.deepEqual(result.retriedJobIds.sort(), ["job-exec-1", "job-trans"]);
  assert.deepEqual(updatedIds.sort(), ["job-exec-1", "job-trans"]);

  // With overrideNonRetryable: true, all matched failed jobs are retried
  updatedIds = [];
  const overrideResult = await ops.retrySelectedJobs({
    sessionKey: "profile-b",
    jobIds: ["job-trans", "job-exec-1", "job-valid"],
    overrideNonRetryable: true,
  });
  assert.equal(overrideResult.retriedCount, 3);
  assert.deepEqual(overrideResult.retriedJobIds.sort(), ["job-exec-1", "job-trans", "job-valid"]);
});

test("LineChatOperationsService: fixRetryableFailures selects only safe auto-fixable jobs", async () => {
  let updatedIds: string[] = [];

  const mockPrisma: any = {
    lineChatSession: {
      findUnique: async (args: any) => {
        assert.equal(args.where.sessionKey, "profile-b");
        return {
          id: "sess-b",
          sessionKey: "profile-b",
          lineOfficialAccounts: [{ id: "oa-b1" }],
        };
      },
    },
    lineChatNicknameSyncJob: {
      findMany: async () => [
        { id: "job-1-trans", status: "FAILED", lastError: "RESOLVE_TRANSPORT", attemptCount: 1 },
        { id: "job-2-timeout", status: "FAILED", lastError: "ETIMEDOUT", attemptCount: 1 },
        { id: "job-3-exec-fresh", status: "FAILED", lastError: "HTTP 500", attemptCount: 1 },
        { id: "job-4-exec-maxed", status: "FAILED", lastError: "HTTP 500", attemptCount: 2 }, // already had 1 retry -> not auto-fixable!
        { id: "job-5-val", status: "FAILED", lastError: "RESOLVE_NO_MATCH", attemptCount: 1 },
        { id: "job-6-auth", status: "FAILED_AUTH", lastError: "UNAUTHENTICATED", attemptCount: 1 },
      ],
      updateMany: async (args: any) => {
        updatedIds.push(...args.where.id.in);
        return { count: args.where.id.in.length };
      },
    },
  };

  const ops = new LineChatOperationsService(mockPrisma);
  const result = await ops.fixRetryableFailures("profile-b");

  // 6 total failed; 3 safe to auto-fix: job-1-trans, job-2-timeout, job-3-exec-fresh.
  // job-4 (exec attemptCount 2), job-5 (validation), job-6 (auth) are NOT auto-fixed!
  assert.equal(result.totalFailed, 6);
  assert.equal(result.retriedCount, 3);
  assert.equal(result.remainingFailed, 3);
  assert.deepEqual(result.retriedJobIds.sort(), ["job-1-trans", "job-2-timeout", "job-3-exec-fresh"]);
  assert.deepEqual(updatedIds.sort(), ["job-1-trans", "job-2-timeout", "job-3-exec-fresh"]);
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

test("LineChatOperationsService: tryRememberedLogin works even when auto recovery kill switch is OFF", async () => {
  const previous = process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED;
  try {
    delete process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED;

    let recoveredSessionId: string | null = null;
    let recoveredTrigger: string | null = null;
    let recoveredOptions: any = null;

    const mockPrisma: any = {
      lineChatSession: {
        findUnique: async (args: any) => {
          if (args.where.sessionKey === "profile-b") {
            return { id: "sess-b", sessionKey: "profile-b" };
          }
          return null;
        },
      },
    };

    const mockAuthRecovery: any = {
      recoverSession: async (id: string, trigger: string, opts: any) => {
        recoveredSessionId = id;
        recoveredTrigger = trigger;
        recoveredOptions = opts;
        return {
          outcome: "RECOVERED_REMEMBERED_ACCOUNT",
          sessionId: id,
          sessionKey: "profile-b",
          status: "CONNECTED",
          failureStage: null,
          error: null,
          durationMs: 120,
        };
      },
    };

    const ops = new LineChatOperationsService(mockPrisma, mockAuthRecovery);
    const result = await ops.tryRememberedLogin("profile-b");

    assert.equal(result.outcome, "RECOVERED_REMEMBERED_ACCOUNT");
    assert.equal(recoveredSessionId, "sess-b");
    assert.equal(recoveredTrigger, "MANUAL");
    assert.deepEqual(recoveredOptions, { bypassCooldown: true });
  } finally {
    if (previous === undefined) delete process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED;
    else process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED = previous;
  }
});

