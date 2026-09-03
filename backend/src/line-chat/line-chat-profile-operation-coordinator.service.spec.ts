import assert from "node:assert/strict";
import test from "node:test";
import { LineChatNicknameSyncJobStatus, LineChatSessionStatus } from "@prisma/client";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatNicknameWorkerService } from "./line-chat-nickname-worker.service";

type LeaseRow = {
  id: string;
  sessionId: string;
  ownerToken: string;
  leaseUntil: Date;
};

function createFakePrisma() {
  const leases = new Map<string, LeaseRow>();
  let sequence = 0;

  const prisma = {
    leases,
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join(" ");
      if (query.includes("INSERT INTO \"LineChatProfileOperationLease\"")) {
        const sessionId = String(values[1]);
        const ownerToken = String(values[2]);
        const requestedLeaseUntil = new Date(String(values[4]));
        const existing = leases.get(sessionId);
        if (existing && existing.leaseUntil > new Date()) return [];
        const row: LeaseRow = {
          id: `lease-${++sequence}`,
          sessionId,
          ownerToken,
          leaseUntil: requestedLeaseUntil,
        };
        leases.set(sessionId, row);
        return [{ id: row.id, ownerToken: row.ownerToken, leaseUntil: row.leaseUntil }];
      }

      if (query.includes("UPDATE \"LineChatProfileOperationLease\"")) {
        const requestedLeaseUntil = new Date(String(values[0]));
        const sessionId = String(values[1]);
        const ownerToken = String(values[2]);
        const existing = leases.get(sessionId);
        if (!existing || existing.ownerToken !== ownerToken || existing.leaseUntil <= new Date()) return [];
        existing.leaseUntil = requestedLeaseUntil;
        return [{ id: existing.id }];
      }

      throw new Error(`Unexpected fake query: ${query}`);
    },
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join(" ");
      if (!query.includes("DELETE FROM \"LineChatProfileOperationLease\"")) {
        throw new Error(`Unexpected fake execute: ${query}`);
      }
      const sessionId = String(values[0]);
      const ownerToken = String(values[1]);
      const existing = leases.get(sessionId);
      if (existing?.ownerToken === ownerToken) leases.delete(sessionId);
      return 1;
    },
  };

  return prisma;
}

test("coordinator blocks concurrent operations for the same session", async () => {
  const prisma = createFakePrisma();
  const coordinator = new LineChatProfileOperationCoordinator(prisma as never);
  let releaseFirst!: () => void;
  const firstHold = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const first = coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "NICKNAME_UPDATE" },
    async () => firstHold,
  );

  await new Promise((resolve) => setImmediate(resolve));
  const second = await coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "RECENT_RESOLUTION" },
    async () => "not-run",
  );
  assert.equal(second.acquired, false);
  if (!second.acquired) assert.equal(second.reason, "PROFILE_OPERATION_BUSY");
  releaseFirst();
  const firstResult = await first;
  assert.equal(firstResult.acquired, true);
});

test("different sessions operate concurrently", async () => {
  const prisma = createFakePrisma();
  const coordinator = new LineChatProfileOperationCoordinator(prisma as never);
  let releaseA!: () => void;
  let releaseB!: () => void;
  const holdA = new Promise<void>((resolve) => { releaseA = resolve; });
  const holdB = new Promise<void>((resolve) => { releaseB = resolve; });

  const first = coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "NICKNAME_UPDATE" },
    async () => holdA,
  );
  const second = coordinator.withProfileOperation(
    { sessionId: "session-b", operationKind: "NICKNAME_UPDATE" },
    async () => holdB,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(prisma.leases.size, 2);
  releaseA();
  releaseB();
  assert.equal((await first).acquired, true);
  assert.equal((await second).acquired, true);
});

test("database lease fences foreign release and permits expired takeover", async () => {
  const prisma = createFakePrisma();
  const coordinator = new LineChatProfileOperationCoordinator(prisma as never);
  let replaceOwner!: () => void;
  const hold = new Promise<void>((resolve) => { replaceOwner = resolve; });
  const first = coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "NICKNAME_UPDATE" },
    async () => hold,
  );
  await new Promise((resolve) => setImmediate(resolve));
  const lease = prisma.leases.get("session-a");
  assert.ok(lease);
  const otherCoordinator = new LineChatProfileOperationCoordinator(prisma as never);
  const contender = await otherCoordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "NICKNAME_UPDATE" },
    async () => "must-not-run",
  );
  assert.equal(contender.acquired, false);
  lease.ownerToken = "foreign-owner";
  replaceOwner();
  await assert.rejects(first, /lease was lost/);
  assert.equal(prisma.leases.get("session-a")?.ownerToken, "foreign-owner");

  const expired = prisma.leases.get("session-a");
  assert.ok(expired);
  expired.leaseUntil = new Date(Date.now() - 1_000);
  const takeover = await coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "NICKNAME_UPDATE" },
    async () => "reacquired",
  );
  assert.equal(takeover.acquired, true);
  if (takeover.acquired) assert.equal(takeover.value, "reacquired");
});

test("heartbeat renews ownership and profile-lock errors fail closed without file cleanup", async () => {
  const prisma = createFakePrisma();
  const coordinator = new LineChatProfileOperationCoordinator(prisma as never);
  let observedSessionId = "";
  let observedOwnerToken = "";
  const result = await coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "NICKNAME_UPDATE" },
    async (context) => {
      observedSessionId = context.sessionId;
      observedOwnerToken = context.ownerToken;
      const before = prisma.leases.get(context.sessionId)?.leaseUntil.getTime() ?? 0;
      const renewed = await (coordinator as unknown as {
        renewDatabaseLease: (sessionId: string, ownerToken: string) => Promise<boolean>;
      }).renewDatabaseLease(context.sessionId, context.ownerToken);
      const after = prisma.leases.get(context.sessionId)?.leaseUntil.getTime() ?? 0;
      assert.equal(renewed, true);
      assert.ok(after >= before);
      return "ok";
    },
  );
  assert.equal(result.acquired, true);
  assert.equal(observedSessionId, "session-a");
  assert.ok(observedOwnerToken.length > 0);
  assert.equal(prisma.leases.size, 0);

  await assert.rejects(
    coordinator.withProfileOperation(
      { sessionId: "session-b", operationKind: "NICKNAME_UPDATE" },
      async () => { throw new Error("PROFILE_LOCK"); },
    ),
    /PROFILE_LOCK/,
  );
  assert.equal(prisma.leases.size, 0);
});

test("nickname resolution and PUT share one coordinator context without deadlock", async () => {
  let resolverContext: unknown;
  let updateContext: unknown;
  let updatedJob: Record<string, unknown> | undefined;
  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-1",
        conversationId: "conversation-1",
        lineOfficialAccountId: "oa-1",
        lineChatUserId: null,
        nickname: "Find X9",
        status: LineChatNicknameSyncJobStatus.PROCESSING,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date("2026-09-03T00:00:00Z"),
      }),
      findFirst: async () => null,
      update: async (args: { data: Record<string, unknown> }) => {
        updatedJob = args.data;
        return {};
      },
    },
    lineOfficialAccount: {
      findUnique: async () => ({
        id: "oa-1",
        chatBotId: "Ubot",
        lineChatSession: {
          id: "session-1",
          sessionKey: "profile-a",
          status: LineChatSessionStatus.ACTIVE,
        },
      }),
    },
    lineChatSession: { update: async () => ({}) },
  };
  const sessionService = {
    resolveProfilePath: () => "/safe/profile",
    updateNickname: async (input: { operationContext?: unknown }) => {
      updateContext = input.operationContext;
      return { success: true, status: 200 };
    },
  };
  const resolver = {
    resolve: async (input: { operationContext?: unknown }) => {
      resolverContext = input.operationContext;
      return { status: "RESOLVED", lineChatUserId: "Uchat" } as const;
    },
  };
  const context = { sessionId: "session-1", ownerToken: "owner-1", operationKind: "NICKNAME_UPDATE", assertOwnership() {} };
  const coordinator = {
    withProfileOperation: async (_input: unknown, callback: (value: typeof context) => Promise<void>) => ({
      acquired: true as const,
      value: await callback(context),
      sessionId: "session-1",
      operationKind: "NICKNAME_UPDATE" as const,
    }),
  };

  const worker = new LineChatNicknameWorkerService(
    prisma as never,
    sessionService as never,
    resolver as never,
    coordinator as never,
  );
  await worker.processSingleJob("job-1");
  assert.equal(resolverContext, context);
  assert.equal(updateContext, context);
  assert.equal(updatedJob?.status, LineChatNicknameSyncJobStatus.SUCCESS);
});

test("profile contention is deferred and never classified as FAILED_AUTH", async () => {
  let updatedJob: Record<string, unknown> | undefined;
  const prisma = {
    lineChatNicknameSyncJob: {
      findUnique: async () => ({
        id: "job-busy",
        conversationId: "conversation-busy",
        lineOfficialAccountId: "oa-busy",
        lineChatUserId: "Uchat",
        nickname: "Online",
        status: LineChatNicknameSyncJobStatus.PROCESSING,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date("2026-09-03T00:00:00Z"),
      }),
      findFirst: async () => null,
      update: async (args: { data: Record<string, unknown> }) => {
        updatedJob = args.data;
        return {};
      },
    },
    lineOfficialAccount: {
      findUnique: async () => ({
        id: "oa-busy",
        chatBotId: "Ubot",
        lineChatSession: {
          id: "session-busy",
          sessionKey: "profile-a",
          status: LineChatSessionStatus.ACTIVE,
        },
      }),
    },
  };
  const sessionService = {
    resolveProfilePath: () => "/safe/profile",
  };
  const coordinator = {
    withProfileOperation: async () => ({
      acquired: false as const,
      reason: "PROFILE_OPERATION_BUSY" as const,
      retryAfterMs: 5_000,
      sessionId: "session-busy",
      operationKind: "NICKNAME_UPDATE" as const,
    }),
  };

  const worker = new LineChatNicknameWorkerService(
    prisma as never,
    sessionService as never,
    undefined,
    coordinator as never,
  );
  await worker.processSingleJob("job-busy");
  assert.equal(updatedJob?.status, LineChatNicknameSyncJobStatus.PENDING);
  assert.equal(updatedJob?.lastError, "PROFILE_OPERATION_BUSY");
  assert.notEqual(updatedJob?.status, LineChatNicknameSyncJobStatus.FAILED_AUTH);
});
