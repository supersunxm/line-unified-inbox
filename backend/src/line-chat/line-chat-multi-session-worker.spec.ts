import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { LineChatNicknameWorkerService } from "./line-chat-nickname-worker.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { LineChatNicknameSyncJobStatus, LineChatSessionStatus } from "@prisma/client";

test("Worker: routes dynamically across Profile A, Profile B, and arbitrary Profile C", async () => {
  const executedUpdates: { botId: string; lineUserId: string; profilePath: string }[] = [];

  const fakeSessionService = {
    resolveProfilePath: (session: any) => `./local-data/${session.sessionKey}`,
    updateNickname: async (input: any) => {
      executedUpdates.push({
        botId: input.botId,
        lineUserId: input.lineUserId,
        profilePath: input.profilePath,
      });
      return {
        success: true,
        status: 200,
        tokenSource: "network",
      };
    },
  } as unknown as LineChatSessionService;

  const jobs = [
    {
      id: "job-a",
      conversationId: "conv-a",
      lineOfficialAccountId: "oa-a",
      lineUserId: "UuserA",
      nickname: "Find X9 สด 08/26",
      status: LineChatNicknameSyncJobStatus.PENDING,
      attemptCount: 0,
      createdAt: new Date(),
    },
    {
      id: "job-b",
      conversationId: "conv-b",
      lineOfficialAccountId: "oa-b",
      lineUserId: "UuserB",
      nickname: "Reno14 ผ่อน 08/26",
      status: LineChatNicknameSyncJobStatus.PENDING,
      attemptCount: 0,
      createdAt: new Date(),
    },
    {
      id: "job-c",
      conversationId: "conv-c",
      lineOfficialAccountId: "oa-c",
      lineUserId: "UuserC",
      nickname: "Online",
      status: LineChatNicknameSyncJobStatus.PENDING,
      attemptCount: 0,
      createdAt: new Date(),
    },
  ];

  const oas: Record<string, any> = {
    "oa-a": {
      id: "oa-a",
      chatBotId: "Ubot_profile_a",
      lineChatSession: { id: "sess-a", sessionKey: "profile-a", status: LineChatSessionStatus.ACTIVE },
    },
    "oa-b": {
      id: "oa-b",
      chatBotId: "Ubot_profile_b",
      lineChatSession: { id: "sess-b", sessionKey: "profile-b", status: LineChatSessionStatus.ACTIVE },
    },
    "oa-c": {
      id: "oa-c",
      chatBotId: "Ubot_profile_c",
      lineChatSession: { id: "sess-c", sessionKey: "profile-c", status: LineChatSessionStatus.ACTIVE },
    },
  };

  const jobMap = new Map(jobs.map((j) => [j.id, { ...j }]));

  const mockPrisma: any = {
    lineChatNicknameSyncJob: {
      findMany: async () => Array.from(jobMap.values()),
      findUnique: async (args: any) => jobMap.get(args.where.id),
      findFirst: async () => null,
      updateMany: async () => ({ count: 1 }),
      update: async (args: any) => {
        const item = jobMap.get(args.where.id);
        if (item) Object.assign(item, args.data);
        return item;
      },
    },
    lineOfficialAccount: {
      findUnique: async (args: any) => oas[args.where.id],
    },
    lineChatSession: {
      update: async () => ({}),
    },
  };

  const worker = new LineChatNicknameWorkerService(mockPrisma, fakeSessionService);
  const processed = await worker.processQueueCycle(10);

  assert.equal(processed, 3);
  assert.equal(executedUpdates.length, 3);
  assert.equal(executedUpdates[0].profilePath, "./local-data/profile-a");
  assert.equal(executedUpdates[0].botId, "Ubot_profile_a");
  assert.equal(executedUpdates[1].profilePath, "./local-data/profile-b");
  assert.equal(executedUpdates[1].botId, "Ubot_profile_b");
  assert.equal(executedUpdates[2].profilePath, "./local-data/profile-c");
  assert.equal(executedUpdates[2].botId, "Ubot_profile_c");
});

test("Worker: session failure isolation (Profile B AUTH_REQUIRED does not affect Profile A)", async () => {
  const sessionStatus: Record<string, LineChatSessionStatus> = {
    "profile-a": LineChatSessionStatus.ACTIVE,
    "profile-b": LineChatSessionStatus.AUTH_REQUIRED, // Broken login
  };

  const executedForProfiles: string[] = [];

  const fakeSessionService = {
    resolveProfilePath: (session: any) => `./local-data/${session.sessionKey}`,
    updateNickname: async (input: any) => {
      if (input.profilePath.includes("profile-a")) {
        executedForProfiles.push("profile-a");
        return { success: true, status: 200 };
      }
      executedForProfiles.push("profile-b");
      return { success: false, status: 401, error: "Unauthorized" };
    },
  } as unknown as LineChatSessionService;

  const jobA = {
    id: "job-oa-1",
    conversationId: "conv-1",
    lineOfficialAccountId: "oa-1",
    lineUserId: "Uuser1",
    nickname: "Online",
    status: LineChatNicknameSyncJobStatus.PENDING,
    attemptCount: 0,
    createdAt: new Date(),
  };

  const jobB = {
    id: "job-oa-2",
    conversationId: "conv-2",
    lineOfficialAccountId: "oa-2",
    lineUserId: "Uuser2",
    nickname: "Online",
    status: LineChatNicknameSyncJobStatus.PENDING,
    attemptCount: 0,
    createdAt: new Date(),
  };

  const oas: Record<string, any> = {
    "oa-1": {
      id: "oa-1",
      chatBotId: "Ubot_1",
      lineChatSession: { id: "sess-1", sessionKey: "profile-a", status: sessionStatus["profile-a"] },
    },
    "oa-2": {
      id: "oa-2",
      chatBotId: "Ubot_2",
      lineChatSession: { id: "sess-2", sessionKey: "profile-b", status: sessionStatus["profile-b"] },
    },
  };

  const updatedJobStatus: Record<string, LineChatNicknameSyncJobStatus> = {};

  const mockPrisma: any = {
    lineChatNicknameSyncJob: {
      findMany: async () => [jobA, jobB],
      findUnique: async (args: any) => (args.where.id === "job-oa-1" ? jobA : jobB),
      findFirst: async () => null,
      updateMany: async () => ({ count: 1 }),
      update: async (args: any) => {
        updatedJobStatus[args.where.id] = args.data.status;
        return args.data;
      },
    },
    lineOfficialAccount: {
      findUnique: async (args: any) => oas[args.where.id],
    },
    lineChatSession: {
      update: async () => ({}),
    },
  };

  const worker = new LineChatNicknameWorkerService(mockPrisma, fakeSessionService);
  await worker.processQueueCycle(10);

  // Profile A should succeed
  assert.equal(updatedJobStatus["job-oa-1"], LineChatNicknameSyncJobStatus.SUCCESS);
  // Profile B should be marked FAILED_AUTH without calling LINE
  assert.equal(updatedJobStatus["job-oa-2"], LineChatNicknameSyncJobStatus.FAILED_AUTH);
  // Only Profile A executed against the session runner
  assert.deepEqual(executedForProfiles, ["profile-a"]);
});

test("Worker: stuck job recovery restores crashed PROCESSING jobs to PENDING", async () => {
  const staleTime = new Date(Date.now() - 10 * 60_000); // 10 mins ago

  const stuckJob = {
    id: "stuck-job-1",
    status: LineChatNicknameSyncJobStatus.PROCESSING,
    attemptCount: 0,
    maxAttempts: 3,
    claimedAt: staleTime,
    lockedUntil: new Date(Date.now() - 60_000), // Expired lease
  };

  let restoredJobData: any = null;

  const mockPrisma: any = {
    lineChatNicknameSyncJob: {
      findMany: async () => [stuckJob],
      update: async (args: any) => {
        restoredJobData = args.data;
        return args.data;
      },
    },
  };

  const worker = new LineChatNicknameWorkerService(mockPrisma, {} as LineChatSessionService);
  const recovered = await worker.recoverStuckJobs();

  assert.equal(recovered, 1);
  assert.ok(restoredJobData);
  assert.equal(restoredJobData.status, LineChatNicknameSyncJobStatus.PENDING);
  assert.equal(restoredJobData.lockedUntil, null);
  assert.equal(restoredJobData.workerId, null);
});

test("Worker: Store 28375 (OBS Robinson Chonburi) routes to profile-b and Mahachai routes to profile-a", async () => {
  const dispatchedRequests: Array<{ botId: string; lineUserId: string; profilePath: string; nickname: string }> = [];

  const fakeSessionService = {
    resolveProfilePath: (session: any) => {
      if (session.sessionKey === "profile-b") return "./local-data/line-chat-profile-b";
      return "./local-data/line-chat-profile-a";
    },
    updateNickname: async (input: any) => {
      dispatchedRequests.push({
        botId: input.botId,
        lineUserId: input.lineUserId,
        profilePath: input.profilePath,
        nickname: input.nickname,
      });
      return { success: true, status: 200, tokenSource: "network" };
    },
  } as unknown as LineChatSessionService;

  const jobChonburi = {
    id: "job-chonburi",
    conversationId: "conv-chonburi",
    lineOfficialAccountId: "oa-chonburi",
    lineUserId: "Ud8d5af30ddca3ed4237e157d5d73c2f1",
    nickname: "Online",
    status: LineChatNicknameSyncJobStatus.PENDING,
    attemptCount: 0,
    createdAt: new Date(),
  };

  const jobMahachai = {
    id: "job-mahachai",
    conversationId: "conv-mahachai",
    lineOfficialAccountId: "oa-mahachai",
    lineUserId: "Ud8d5af30ddca3ed4237e157d5d73c2f1",
    nickname: "Find X9 สด 08/26",
    status: LineChatNicknameSyncJobStatus.PENDING,
    attemptCount: 0,
    createdAt: new Date(),
  };

  const oas: Record<string, any> = {
    "oa-chonburi": {
      id: "oa-chonburi",
      name: "OPPO BS RBS Chonburi",
      chatBotId: "U729972869a565723cb7fcf7ea28bbc43",
      lineChatSessionId: "sess-profile-b",
      lineChatSession: { id: "sess-profile-b", sessionKey: "profile-b", status: LineChatSessionStatus.ACTIVE },
    },
    "oa-mahachai": {
      id: "oa-mahachai",
      name: "OPPO BigC MAHACHAI 1",
      chatBotId: "U092441d025f688e389d25779dd8debf4",
      lineChatSessionId: "sess-profile-a",
      lineChatSession: { id: "sess-profile-a", sessionKey: "profile-a", status: LineChatSessionStatus.ACTIVE },
    },
  };

  const jobMap = new Map([
    ["job-chonburi", { ...jobChonburi }],
    ["job-mahachai", { ...jobMahachai }],
  ]);

  const mockPrisma: any = {
    lineChatNicknameSyncJob: {
      findMany: async () => Array.from(jobMap.values()),
      findUnique: async (args: any) => jobMap.get(args.where.id),
      findFirst: async () => null,
      updateMany: async () => ({ count: 1 }),
      update: async (args: any) => {
        const item = jobMap.get(args.where.id);
        if (item) Object.assign(item, args.data);
        return item;
      },
    },
    lineOfficialAccount: {
      findUnique: async (args: any) => oas[args.where.id],
    },
    lineChatSession: {
      update: async () => ({}),
    },
  };

  const worker = new LineChatNicknameWorkerService(mockPrisma, fakeSessionService);
  const count = await worker.processQueueCycle(10);

  assert.equal(count, 2);
  assert.equal(dispatchedRequests.length, 2);

  // Store 28375 Chonburi must route to profile-b and U729972869a565723cb7fcf7ea28bbc43
  const chonburiReq = dispatchedRequests.find((r) => r.botId === "U729972869a565723cb7fcf7ea28bbc43");
  assert.ok(chonburiReq);
  assert.equal(chonburiReq.profilePath, "./local-data/line-chat-profile-b");
  assert.equal(chonburiReq.nickname, "Online");

  // Mahachai must route to profile-a and U092441d025f688e389d25779dd8debf4
  const mahachaiReq = dispatchedRequests.find((r) => r.botId === "U092441d025f688e389d25779dd8debf4");
  assert.ok(mahachaiReq);
  assert.equal(mahachaiReq.profilePath, "./local-data/line-chat-profile-a");
  assert.equal(mahachaiReq.nickname, "Find X9 สด 08/26");
});
