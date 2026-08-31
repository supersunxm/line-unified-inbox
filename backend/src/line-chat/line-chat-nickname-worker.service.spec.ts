import assert from "node:assert/strict";
import test from "node:test";
import { LineChatNicknameWorkerService } from "./line-chat-nickname-worker.service";
import { LineChatNicknameSyncJobStatus, LineChatSessionStatus } from "@prisma/client";
import { LineChatSessionService } from "./line-chat-session.service";

void test("worker processes job successfully and marks SUCCESS using only lineChatUserId", async () => {
  let updatedJobData: Record<string, unknown> | undefined;
  let updatedSessionData: Record<string, unknown> | undefined;
  let dispatchedLineUserId: string | undefined;

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

  const worker = new LineChatNicknameWorkerService(prisma as never, sessionService);
  await worker.processSingleJob("job-101");

  assert.equal(dispatchedLineUserId, "Ud8d5af30ddca3ed4237e157d5d73c2f1");
  assert.equal(updatedJobData?.status, LineChatNicknameSyncJobStatus.SUCCESS);
  assert.equal(updatedJobData?.lastError, null);
  assert.equal(updatedSessionData?.status, LineChatSessionStatus.ACTIVE);
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
  const { LineChatNicknameWorkerModule } = await import("./line-chat.module");
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
