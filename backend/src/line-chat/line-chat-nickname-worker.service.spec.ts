import assert from "node:assert/strict";
import test from "node:test";
import { LineChatNicknameWorkerService } from "./line-chat-nickname-worker.service";
import { LineChatNicknameSyncJobStatus, LineChatSessionStatus } from "@prisma/client";
import { LineChatSessionService } from "./line-chat-session.service";

const CHAT_ID_FOR_TEST = `U${"a".repeat(32)}`;

void test("worker lifecycle keeps maintenance alive without polling and preserves flag precedence", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMaintenance = process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
  const originalDisabled = process.env.DISABLE_NICKNAME_WORKER;

  const createWorker = () => {
    let queueCycles = 0;
    let browserCalls = 0;
    const worker = new LineChatNicknameWorkerService({} as never, {
      updateNickname: async () => {
        browserCalls += 1;
        return { success: true, status: 200 };
      },
    } as unknown as LineChatSessionService);
    worker.processQueueCycle = async () => {
      queueCycles += 1;
      return 0;
    };
    return {
      worker,
      queueCycles: () => queueCycles,
      browserCalls: () => browserCalls,
      internals: worker as unknown as {
        timer: NodeJS.Timeout | null;
        maintenanceTimer: NodeJS.Timeout | null;
      },
    };
  };

  try {
    process.env.NODE_ENV = "production";
    delete process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
    delete process.env.DISABLE_NICKNAME_WORKER;
    const normal = createWorker();
    normal.worker.onModuleInit();
    assert.equal(normal.queueCycles(), 1);
    assert.ok(normal.internals.timer);
    assert.equal(normal.internals.maintenanceTimer, null);
    normal.worker.onModuleDestroy();

    process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "true";
    process.env.DISABLE_NICKNAME_WORKER = "true";
    const maintenance = createWorker();
    maintenance.worker.onModuleInit();
    assert.equal(maintenance.queueCycles(), 0);
    assert.equal(maintenance.browserCalls(), 0);
    assert.equal(maintenance.internals.timer, null);
    assert.ok(maintenance.internals.maintenanceTimer);
    assert.equal(maintenance.internals.maintenanceTimer.hasRef(), true);
    maintenance.worker.onModuleDestroy();
    assert.equal(maintenance.internals.maintenanceTimer, null);

    delete process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
    process.env.DISABLE_NICKNAME_WORKER = "true";
    const disabled = createWorker();
    disabled.worker.onModuleInit();
    assert.equal(disabled.queueCycles(), 0);
    assert.equal(disabled.internals.timer, null);
    assert.equal(disabled.internals.maintenanceTimer, null);

    process.env.NODE_ENV = "test";
    process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "true";
    const testMode = createWorker();
    testMode.worker.onModuleInit();
    assert.equal(testMode.queueCycles(), 0);
    assert.equal(testMode.internals.timer, null);
    assert.equal(testMode.internals.maintenanceTimer, null);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalMaintenance === undefined) delete process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
    else process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = originalMaintenance;
    if (originalDisabled === undefined) delete process.env.DISABLE_NICKNAME_WORKER;
    else process.env.DISABLE_NICKNAME_WORKER = originalDisabled;
  }
});

void test("worker processes job successfully and marks SUCCESS using only lineChatUserId", async () => {
  let updatedJobData: Record<string, unknown> | undefined;
  let updatedSessionData: Record<string, unknown> | undefined;
  let dispatchedLineUserId: string | undefined;
  let resolverCalls = 0;

  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-101",
        conversationId: "conv-101",
        lineOfficialAccountId: "oa-101",
        lineChatUserId: "Ud8d5af30ddca3ed4237e157d5d73c2f1",
        lineUserId: "U124d80f7c70ed8f48cfc93c707853ab4", // Messaging API ID - must NOT be dispatched
        nickname: "Find X9 สด 08/26",
        status: LineChatNicknameSyncJobStatus.PROCESSING,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date("2026-08-31T10:00:00Z"),
      }),
      findFirst: async () => null, // No newer job
      update: async (args: { data: Record<string, unknown> }) => {
        updatedJobData = args.data;
        return {};
      },
    },
    lineOfficialAccount: {
      findUnique: async () => ({
        id: "oa-101",
        chatBotId: "U092441d025f688e389d25779dd8debf4",
        lineChatSessionId: "session-1",
        lineChatSession: {
          id: "session-1",
          sessionKey: "profile-a",
          profilePath: "./local-data/line-chat-profile-a",
        },
      }),
    },
    lineChatSession: {
      update: async (args: { data: Record<string, unknown> }) => {
        updatedSessionData = args.data;
        return {};
      },
    },
  };

  const sessionService = {
    resolveProfilePath: (session: any) => session?.profilePath || "./local-data/line-chat-profile-a",
    updateNickname: async (params: Record<string, unknown>) => {
      dispatchedLineUserId = String(params.lineUserId);
      assert.equal(params.botId, "U092441d025f688e389d25779dd8debf4");
      assert.equal(params.lineUserId, "Ud8d5af30ddca3ed4237e157d5d73c2f1");
      assert.notEqual(params.lineUserId, "U124d80f7c70ed8f48cfc93c707853ab4");
      assert.equal(params.nickname, "Find X9 สด 08/26");
      assert.equal(params.profilePath, "./local-data/line-chat-profile-a");
      return {
        success: true,
        status: 200,
        botId: String(params.botId),
        lineUserId: String(params.lineUserId),
        nickname: String(params.nickname),
        tokenSource: "network" as const,
      };
    },
  } as unknown as LineChatSessionService;

  const worker = new LineChatNicknameWorkerService(prisma as never, sessionService, {
    resolve: async () => {
      resolverCalls += 1;
      return { status: "RESOLVE_NO_MATCH" } as const;
    },
  } as never);
  await worker.processSingleJob("job-101");

  assert.equal(dispatchedLineUserId, "Ud8d5af30ddca3ed4237e157d5d73c2f1");
  assert.equal(updatedJobData?.status, LineChatNicknameSyncJobStatus.SUCCESS);
  assert.equal(updatedJobData?.lastError, null);
  assert.equal(updatedSessionData?.status, LineChatSessionStatus.ACTIVE);
  assert.equal(resolverCalls, 0);
});

void test("worker supersedes stale job when newer job exists for same conversation", async () => {
  let updatedJobData: Record<string, unknown> | undefined;
  let updateNicknameCalled = false;

  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-stale",
        conversationId: "conv-101",
        lineOfficialAccountId: "oa-101",
        lineChatUserId: "Ud8d5af30ddca3ed4237e157d5d73c2f1",
        lineUserId: "Umsg_api_stale",
        nickname: "Online",
        status: LineChatNicknameSyncJobStatus.PROCESSING,
        attemptCount: 0,
        createdAt: new Date("2026-08-31T09:00:00Z"),
      }),
      findFirst: async () => ({
        id: "job-newer",
        createdAt: new Date("2026-08-31T09:05:00Z"),
      }),
      update: async (args: { data: Record<string, unknown> }) => {
        updatedJobData = args.data;
        return {};
      },
    },
  };

  const sessionService = {
    resolveProfilePath: () => "./local-data/line-chat-profile-a",
    updateNickname: async () => {
      updateNicknameCalled = true;
      return { success: true, status: 200 };
    },
  } as unknown as LineChatSessionService;

  const worker = new LineChatNicknameWorkerService(prisma as never, sessionService);
  await worker.processSingleJob("job-stale");

  assert.equal(updatedJobData?.status, LineChatNicknameSyncJobStatus.SUPERSEDED);
  assert.equal(updateNicknameCalled, false);
});

void test("worker skips and marks FAILED when lineChatUserId is missing/null without calling updateNickname", async () => {
  let updatedJobData: Record<string, unknown> | undefined;
  let updateNicknameCalled = false;

  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-missing-chat-id",
        conversationId: "conv-101",
        lineOfficialAccountId: "oa-101",
        lineChatUserId: null, // missing LINE OA Manager chat user ID
        lineUserId: "U124d80f7c70ed8f48cfc93c707853ab4", // Messaging API ID present - must NOT fallback
        nickname: "Find X9 สด 08/26",
        status: LineChatNicknameSyncJobStatus.PROCESSING,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date("2026-08-31T10:00:00Z"),
      }),
      findFirst: async () => null,
      update: async (args: { data: Record<string, unknown> }) => {
        updatedJobData = args.data;
        return {};
      },
    },
    lineOfficialAccount: {
      findUnique: async () => ({
        id: "oa-101",
        chatBotId: "U092441d025f688e389d25779dd8debf4",
        lineChatSessionId: "session-1",
        lineChatSession: {
          id: "session-1",
          sessionKey: "profile-a",
          profilePath: "./local-data/line-chat-profile-a",
        },
      }),
    },
  };

  const sessionService = {
    resolveProfilePath: () => "./local-data/line-chat-profile-a",
    updateNickname: async () => {
      updateNicknameCalled = true;
      return { success: true, status: 200 };
    },
  } as unknown as LineChatSessionService;

  const worker = new LineChatNicknameWorkerService(prisma as never, sessionService);
  await worker.processSingleJob("job-missing-chat-id");

  assert.equal(updateNicknameCalled, false, "updateNickname must NOT be called when lineChatUserId is missing");
  assert.equal(updatedJobData?.status, LineChatNicknameSyncJobStatus.FAILED);
  assert.match(String(updatedJobData?.lastError), /Missing LINE OA Manager chat user ID \(lineChatUserId\)/);
});

void test("worker resolves an unmapped job once and continues the same nickname execution", async () => {
  const resolvedId = `U${"a".repeat(32)}`;
  const jobUpdates: Array<Record<string, unknown>> = [];
  let resolverCalls = 0;
  let dispatchedId: string | undefined;
  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-resolve",
        conversationId: "conversation-resolve",
        lineOfficialAccountId: "oa-pilot",
        lineChatUserId: null,
        lineUserId: null,
        nickname: "Online",
        status: LineChatNicknameSyncJobStatus.PROCESSING,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date("2026-09-01T05:00:00Z"),
      }),
      findFirst: async () => null,
      update: async (args: { data: Record<string, unknown> }) => {
        jobUpdates.push(args.data);
        return {};
      },
    },
    lineOfficialAccount: { findUnique: async () => ({
      id: "oa-pilot",
      chatBotId: "U729972869a565723cb7fcf7ea28bbc43",
      lineChatSession: { id: "session-pilot", sessionKey: "profile-b", status: LineChatSessionStatus.ACTIVE },
    }) },
    lineChatSession: { update: async () => ({}) },
  };
  const session = {
    resolveProfilePath: () => "/safe/profile",
    updateNickname: async (args: { lineUserId: string }) => {
      dispatchedId = args.lineUserId;
      return { success: true, status: 200, tokenSource: "network" };
    },
  };
  const resolver = {
    resolve: async () => {
      resolverCalls += 1;
      return { status: "RESOLVED", lineChatUserId: resolvedId } as const;
    },
  };

  await new LineChatNicknameWorkerService(prisma as never, session as never, resolver as never)
    .processSingleJob("job-resolve");

  assert.equal(resolverCalls, 1);
  assert.equal(dispatchedId, resolvedId);
  assert.deepEqual(
    jobUpdates.find((update) => update.lineChatUserId === resolvedId),
    { lineChatUserId: resolvedId, lineUserId: resolvedId },
  );
  assert.equal(jobUpdates.at(-1)?.status, LineChatNicknameSyncJobStatus.SUCCESS);
});

void test("latest save wins when a newer job appears during resolution", async () => {
  let newerChecks = 0;
  let nicknameCalls = 0;
  let finalStatus: unknown;
  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-old", conversationId: "conversation-1", lineOfficialAccountId: "oa-pilot",
        lineChatUserId: null, lineUserId: null, nickname: "Online",
        status: LineChatNicknameSyncJobStatus.PROCESSING, attemptCount: 0, maxAttempts: 3,
        createdAt: new Date("2026-09-01T05:00:00Z"),
      }),
      findFirst: async () => (++newerChecks === 1 ? null : { id: "job-new", createdAt: new Date("2026-09-01T05:00:01Z") }),
      update: async (args: { data: Record<string, unknown> }) => { finalStatus = args.data.status ?? finalStatus; return {}; },
    },
    lineOfficialAccount: { findUnique: async () => ({
      chatBotId: "U729972869a565723cb7fcf7ea28bbc43",
      lineChatSession: { id: "session-pilot", sessionKey: "profile-b", status: LineChatSessionStatus.ACTIVE },
    }) },
  };
  const session = {
    resolveProfilePath: () => "/safe/profile",
    updateNickname: async () => { nicknameCalls += 1; return { success: true }; },
  };
  const resolver = { resolve: async () => ({ status: "RESOLVED", lineChatUserId: CHAT_ID_FOR_TEST } as const) };
  await new LineChatNicknameWorkerService(prisma as never, session as never, resolver as never).processSingleJob("job-old");
  assert.equal(nicknameCalls, 0);
  assert.equal(finalStatus, LineChatNicknameSyncJobStatus.SUPERSEDED);
});

void test("worker keeps resolver failure inside the job and never calls nickname update", async () => {
  let nicknameCalls = 0;
  let finalUpdate: Record<string, unknown> | undefined;
  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-no-match", conversationId: "conversation-no-match", lineOfficialAccountId: "oa-pilot",
        lineChatUserId: null, lineUserId: null, nickname: "Online",
        status: LineChatNicknameSyncJobStatus.PROCESSING, attemptCount: 0, maxAttempts: 3,
        createdAt: new Date("2026-09-01T05:00:00Z"),
      }),
      findFirst: async () => null,
      update: async (args: { data: Record<string, unknown> }) => { finalUpdate = args.data; return {}; },
    },
    lineOfficialAccount: { findUnique: async () => ({
      chatBotId: "U729972869a565723cb7fcf7ea28bbc43",
      lineChatSession: { id: "session-pilot", sessionKey: "profile-b", status: LineChatSessionStatus.ACTIVE },
    }) },
  };
  const session = {
    resolveProfilePath: () => "/safe/profile",
    updateNickname: async () => { nicknameCalls += 1; return { success: true }; },
  };
  const resolver = { resolve: async () => ({ status: "RESOLVE_NO_MATCH" as const }) };
  await new LineChatNicknameWorkerService(prisma as never, session as never, resolver as never)
    .processSingleJob("job-no-match");
  assert.equal(nicknameCalls, 0);
  assert.equal(finalUpdate?.status, LineChatNicknameSyncJobStatus.FAILED);
  assert.equal(finalUpdate?.lastError, "RESOLVE_NO_MATCH");
});

void test("worker transitions to FAILED_AUTH on session authentication failure", async () => {
  let updatedJobData: Record<string, unknown> | undefined;
  let updatedSessionData: Record<string, unknown> | undefined;

  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-auth-fail",
        conversationId: "conv-101",
        lineOfficialAccountId: "oa-101",
        lineChatUserId: "Uchat_user_1",
        lineUserId: "Uuser1",
        nickname: "Find X9 สด 08/26",
        status: LineChatNicknameSyncJobStatus.PROCESSING,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date("2026-08-31T10:00:00Z"),
      }),
      findFirst: async () => null,
      update: async (args: { data: Record<string, unknown> }) => {
        updatedJobData = args.data;
        return {};
      },
    },
    lineOfficialAccount: {
      findUnique: async () => ({
        id: "oa-101",
        chatBotId: "U092441d025f688e389d25779dd8debf4",
        lineChatSessionId: "session-1",
        lineChatSession: {
          id: "session-1",
          sessionKey: "profile-a",
          profilePath: "./local-data/line-chat-profile-a",
          status: LineChatSessionStatus.ACTIVE,
        },
      }),
    },
    lineChatSession: {
      update: async (args: { data: Record<string, unknown> }) => {
        updatedSessionData = args.data;
        return {};
      },
    },
  };

  const sessionService = {
    resolveProfilePath: (session: any) => session?.profilePath || "./local-data/line-chat-profile-a",
    updateNickname: async () => ({
      success: false,
      status: 401,
      error: "LINE chat session is not authenticated or has expired (HTTP 401)",
    }),
  } as unknown as LineChatSessionService;

  const worker = new LineChatNicknameWorkerService(prisma as never, sessionService);
  await worker.processSingleJob("job-auth-fail");

  assert.equal(updatedJobData?.status, LineChatNicknameSyncJobStatus.FAILED_AUTH);
  assert.equal(updatedSessionData?.status, LineChatSessionStatus.AUTH_REQUIRED);
});

void test("worker retries retryable network or 5xx failures with backoff", async () => {
  let updatedJobData: Record<string, unknown> | undefined;

  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-retry",
        conversationId: "conv-101",
        lineOfficialAccountId: "oa-101",
        lineChatUserId: "Uchat_user_1",
        lineUserId: "Uuser1",
        nickname: "Find X9 สด 08/26",
        status: LineChatNicknameSyncJobStatus.PROCESSING,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date("2026-08-31T10:00:00Z"),
      }),
      findFirst: async () => null,
      update: async (args: { data: Record<string, unknown> }) => {
        updatedJobData = args.data;
        return {};
      },
    },
    lineOfficialAccount: {
      findUnique: async () => ({
        id: "oa-101",
        chatBotId: "U092441d025f688e389d25779dd8debf4",
        lineChatSessionId: "session-1",
        lineChatSession: {
          id: "session-1",
          sessionKey: "profile-a",
          profilePath: "./local-data/line-chat-profile-a",
          status: LineChatSessionStatus.ACTIVE,
        },
      }),
    },
  };

  const sessionService = {
    resolveProfilePath: (session: any) => session?.profilePath || "./local-data/line-chat-profile-a",
    updateNickname: async () => ({
      success: false,
      status: 503,
      error: "LINE service temporarily unavailable",
    }),
  } as unknown as LineChatSessionService;

  const worker = new LineChatNicknameWorkerService(prisma as never, sessionService);
  await worker.processSingleJob("job-retry");

  assert.equal(updatedJobData?.status, LineChatNicknameSyncJobStatus.PENDING);
  assert.equal(updatedJobData?.attemptCount?.increment, 1);
  assert.ok(updatedJobData?.scheduledAt instanceof Date);
});

void test("worker marks FAILED when max attempts are exhausted", async () => {
  let updatedJobData: Record<string, unknown> | undefined;

  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-exhausted",
        conversationId: "conv-101",
        lineOfficialAccountId: "oa-101",
        lineChatUserId: "Uchat_user_1",
        lineUserId: "Uuser1",
        nickname: "Find X9 สด 08/26",
        status: LineChatNicknameSyncJobStatus.PROCESSING,
        attemptCount: 2, // 3rd attempt
        maxAttempts: 3,
        createdAt: new Date("2026-08-31T10:00:00Z"),
      }),
      findFirst: async () => null,
      update: async (args: { data: Record<string, unknown> }) => {
        updatedJobData = args.data;
        return {};
      },
    },
    lineOfficialAccount: {
      findUnique: async () => ({
        id: "oa-101",
        chatBotId: "U092441d025f688e389d25779dd8debf4",
        lineChatSessionId: "session-1",
        lineChatSession: {
          id: "session-1",
          sessionKey: "profile-a",
          profilePath: "./local-data/line-chat-profile-a",
          status: LineChatSessionStatus.ACTIVE,
        },
      }),
    },
  };

  const sessionService = {
    resolveProfilePath: (session: any) => session?.profilePath || "./local-data/line-chat-profile-a",
    updateNickname: async () => ({
      success: false,
      status: 500,
      error: "LINE server error",
    }),
  } as unknown as LineChatSessionService;

  const worker = new LineChatNicknameWorkerService(prisma as never, sessionService);
  await worker.processSingleJob("job-exhausted");

  assert.equal(updatedJobData?.status, LineChatNicknameSyncJobStatus.FAILED);
  assert.deepEqual(updatedJobData?.attemptCount, { increment: 1 });
});

void test("worker records a failed attempt without auto-retrying a missing profile directory", async () => {
  let updatedJobData: Record<string, unknown> | undefined;
  let updateNicknameCalls = 0;

  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-missing-profile",
        conversationId: "conv-101",
        lineOfficialAccountId: "oa-101",
        lineChatUserId: "Uchat_user_1",
        lineUserId: "Umessaging_api_user_1",
        nickname: "Online",
        status: LineChatNicknameSyncJobStatus.PROCESSING,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date("2026-08-31T10:00:00Z"),
      }),
      findFirst: async () => null,
      update: async (args: { data: Record<string, unknown> }) => {
        updatedJobData = args.data;
        return {};
      },
    },
    lineOfficialAccount: {
      findUnique: async () => ({
        id: "oa-101",
        chatBotId: "Ubot_profile_b",
        lineChatSession: {
          id: "session-1",
          sessionKey: "profile-b-linux",
          status: LineChatSessionStatus.ACTIVE,
        },
      }),
    },
  };

  const sessionService = {
    resolveProfilePath: () => "/data/line-chat-profiles/profile-b-linux",
    updateNickname: async () => {
      updateNicknameCalls++;
      return {
        success: false,
        error: 'Profile directory does not exist at "/data/line-chat-profiles/profile-b-linux"',
      };
    },
  } as unknown as LineChatSessionService;

  const worker = new LineChatNicknameWorkerService(prisma as never, sessionService);
  await worker.processSingleJob("job-missing-profile");

  assert.equal(updateNicknameCalls, 1);
  assert.equal(updatedJobData?.status, LineChatNicknameSyncJobStatus.FAILED);
  assert.deepEqual(updatedJobData?.attemptCount, { increment: 1 });
  assert.equal(updatedJobData?.scheduledAt, undefined, "profile configuration failures must not auto-retry");
});

void test("worker routes multiple sessions dynamically (Profile B) without hardcoding", async () => {
  let dispatchedProfilePath: string | undefined;
  let dispatchedBotId: string | undefined;
  let dispatchedLineUserId: string | undefined;

  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-profile-b",
        conversationId: "conv-202",
        lineOfficialAccountId: "oa-202",
        lineChatUserId: "Uchat_cust_202",
        lineUserId: "Ucust202_msg_api",
        nickname: "Find X9 สด 08/26",
        status: LineChatNicknameSyncJobStatus.PROCESSING,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date("2026-08-31T10:00:00Z"),
      }),
      findFirst: async () => null,
      update: async () => ({}),
    },
    lineOfficialAccount: {
      findUnique: async () => ({
        id: "oa-202",
        chatBotId: "Ubot_profile_b",
        lineChatSessionId: "session-2",
        lineChatSession: {
          id: "session-2",
          sessionKey: "profile-b",
          profilePath: "./local-data/line-chat-profile-b",
          status: LineChatSessionStatus.ACTIVE,
        },
      }),
    },
    lineChatSession: {
      update: async () => ({}),
    },
  };

  const sessionService = {
    resolveProfilePath: (session: any) => session?.profilePath || "./local-data/line-chat-profile-b",
    updateNickname: async (params: Record<string, unknown>) => {
      dispatchedProfilePath = String(params.profilePath);
      dispatchedBotId = String(params.botId);
      dispatchedLineUserId = String(params.lineUserId);
      return { success: true, status: 200 };
    },
  } as unknown as LineChatSessionService;

  const worker = new LineChatNicknameWorkerService(prisma as never, sessionService);
  await worker.processSingleJob("job-profile-b");

  assert.equal(dispatchedProfilePath, "./local-data/line-chat-profile-b");
  assert.equal(dispatchedBotId, "Ubot_profile_b");
  assert.equal(dispatchedLineUserId, "Uchat_cust_202");
});

void test("LineChatNicknameWorkerModule initializes cleanly without MobileAuthService or full app dependencies", async () => {
  const { Test } = await import("@nestjs/testing");
  const { LineChatNicknameWorkerModule } = await import("./line-chat-nickname-worker.module");
  const { PrismaService } = await import("../prisma.service");

  const moduleRef = await Test.createTestingModule({
    imports: [LineChatNicknameWorkerModule],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();

  const workerService = moduleRef.get(LineChatNicknameWorkerService);
  const sessionService = moduleRef.get(LineChatSessionService);
  assert.ok(workerService);
  assert.ok(sessionService);
});
