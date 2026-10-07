import assert from "node:assert/strict";
import test from "node:test";
import { LineChatNicknameSyncJobStatus, LineChatSessionStatus } from "@prisma/client";
import {
  LineChatProfileOperationCoordinator,
  PROFILE_OPERATION_LEASE_DURATION_MS,
  type LineChatProfileOperationKind,
} from "./line-chat-profile-operation-coordinator.service";
import { LineChatNicknameWorkerService } from "./line-chat-nickname-worker.service";

type LeaseRow = {
  id: string;
  sessionId: string;
  ownerToken: string;
  operationKind: LineChatProfileOperationKind;
  acquiredAt: Date;
  leaseUntil: Date;
};

type RenewGate = {
  started: Promise<void>;
  markStarted: () => void;
  released: Promise<void>;
  release: () => void;
};

type CoordinatorInternals = {
  acquireDatabaseLease: (
    sessionId: string,
    ownerToken: string,
    operationKind: "NICKNAME_UPDATE",
  ) => Promise<{ id: string; ownerToken: string; acquiredAt: Date; leaseUntil: Date } | null>;
  renewDatabaseLease: (sessionId: string, ownerToken: string) => Promise<boolean>;
  releaseDatabaseLease: (sessionId: string, ownerToken: string) => Promise<void>;
};

function createRenewGate(): RenewGate {
  let markStarted!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const released = new Promise<void>((resolve) => { release = resolve; });
  return { started, markStarted, released, release };
}

function coordinatorInternals(coordinator: LineChatProfileOperationCoordinator): CoordinatorInternals {
  return coordinator as unknown as CoordinatorInternals;
}

function createFakePrisma() {
  const leases = new Map<string, LeaseRow>();
  const clock = { nowMs: Date.parse("2026-09-03T00:00:00.000Z") };
  const queries: string[] = [];
  let renewGate: RenewGate | null = null;
  let sequence = 0;
  const databaseNow = () => new Date(clock.nowMs);

  const prisma = {
    leases,
    clock,
    queries,
    pauseNextRenew: () => {
      renewGate = createRenewGate();
      return renewGate;
    },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join(" ");
      queries.push(query);
      if (query.includes("INSERT INTO \"LineChatProfileOperationLease\"")) {
        const sessionId = String(values[1]);
        const ownerToken = String(values[2]);
        assert.equal(values.some((value) => value instanceof Date), false);
        assert.match(query, /CURRENT_TIMESTAMP \+ INTERVAL '90 seconds'/);
        const existing = leases.get(sessionId);
        if (existing && existing.leaseUntil > databaseNow()) return [];
        const row: LeaseRow = {
          id: `lease-${++sequence}`,
          sessionId,
          ownerToken,
          operationKind: values[3] as LineChatProfileOperationKind,
          acquiredAt: databaseNow(),
          leaseUntil: new Date(clock.nowMs + PROFILE_OPERATION_LEASE_DURATION_MS),
        };
        leases.set(sessionId, row);
        return [{
          id: row.id,
          ownerToken: row.ownerToken,
          acquiredAt: row.acquiredAt,
          leaseUntil: row.leaseUntil,
        }];
      }

      if (query.includes("UPDATE \"LineChatProfileOperationLease\"")) {
        assert.equal(values.some((value) => value instanceof Date), false);
        assert.match(query, /CURRENT_TIMESTAMP \+ INTERVAL '90 seconds'/);
        const sessionId = String(values[0]);
        const ownerToken = String(values[1]);
        if (renewGate) {
          const activeGate = renewGate;
          renewGate = null;
          activeGate.markStarted();
          await activeGate.released;
        }
        const existing = leases.get(sessionId);
        if (!existing || existing.ownerToken !== ownerToken || existing.leaseUntil <= databaseNow()) return [];
        existing.leaseUntil = new Date(clock.nowMs + PROFILE_OPERATION_LEASE_DURATION_MS);
        return [{ id: existing.id }];
      }

      if (query.includes("SELECT \"operationKind\", \"acquiredAt\", \"leaseUntil\"")) {
        const sessionId = String(values[0]);
        const existing = leases.get(sessionId);
        if (!existing || existing.leaseUntil <= databaseNow()) return [];
        return [{
          operationKind: existing.operationKind,
          acquiredAt: existing.acquiredAt,
          leaseUntil: existing.leaseUntil,
        }];
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

function assertDbClockLeaseQuery(query: string): void {
  assert.match(query, /CURRENT_TIMESTAMP \+ INTERVAL '90 seconds'/);
  assert.doesNotMatch(query, /Date\.now/);
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
    { sessionId: "session-a", operationKind: "HEALTH_SESSION" },
    async () => "not-run",
  );
  assert.equal(second.acquired, false);
  if (!second.acquired) assert.equal(second.reason, "PROFILE_OPERATION_BUSY");
  releaseFirst();
  const firstResult = await first;
  assert.equal(firstResult.acquired, true);
});

test("Mirror ownership blocks same-profile health locally and across workers while another profile can probe", async () => {
  const prisma = createFakePrisma();
  const mirrorCoordinator = new LineChatProfileOperationCoordinator(prisma as never);
  const healthCoordinator = new LineChatProfileOperationCoordinator(prisma as never);
  let releaseMirror!: () => void;
  let mirrorStarted!: () => void;
  const held = new Promise<void>((resolve) => { releaseMirror = resolve; });
  const started = new Promise<void>((resolve) => { mirrorStarted = resolve; });
  const mirror = mirrorCoordinator.withProfileOperation(
    { sessionId: "profile-b", operationKind: "MIRROR_SYNC" },
    async () => { mirrorStarted(); await held; },
  );
  let busyProfileDiagnostics = 0;
  try {
    await started;
    for (const coordinator of [mirrorCoordinator, healthCoordinator]) {
      const result = await coordinator.withProfileOperation(
        { sessionId: "profile-b", operationKind: "HEALTH_SESSION" },
        async () => { busyProfileDiagnostics += 1; },
      );
      assert.equal(result.acquired, false);
      if (!result.acquired) assert.equal(result.holderOperationKind, "MIRROR_SYNC");
    }
    const idle = await healthCoordinator.withProfileOperation(
      { sessionId: "account-1", operationKind: "HEALTH_SESSION" },
      async () => {
        assert.equal(prisma.leases.size, 2);
        assert.equal(prisma.leases.get("profile-b")?.operationKind, "MIRROR_SYNC");
        assert.equal(prisma.leases.get("account-1")?.operationKind, "HEALTH_SESSION");
        return "CONNECTED";
      },
    );
    assert.equal(idle.acquired, true);
    assert.equal(busyProfileDiagnostics, 0);
    assert.equal(prisma.leases.size, 1);
  } finally {
    releaseMirror();
    await mirror;
  }
  assert.equal(prisma.leases.size, 0);
});

test("contention logs correlate acquisition, busy owner, release, and durations without secrets", async () => {
  const prisma = createFakePrisma();
  const coordinator = new LineChatProfileOperationCoordinator(prisma as never);
  const events: Array<Record<string, unknown>> = [];
  (coordinator as unknown as { logger: { log: (value: string) => void; warn: (value: string) => void } }).logger = {
    log: (value) => events.push(JSON.parse(value) as Record<string, unknown>),
    warn: (value) => events.push(JSON.parse(value) as Record<string, unknown>),
  };
  let releaseFirst!: () => void;
  const firstHold = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const first = coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "NICKNAME_UPDATE" },
    async () => firstHold,
  );

  await new Promise((resolve) => setImmediate(resolve));
  const second = await coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "HEALTH_SESSION" },
    async () => "must-not-run",
  );
  assert.equal(second.acquired, false);
  releaseFirst();
  assert.equal((await first).acquired, true);

  const acquired = events.find((event) => event.event === "line_chat_profile_operation_acquired");
  const busy = events.find((event) => event.event === "line_chat_profile_operation_busy");
  const released = events.find((event) => event.event === "line_chat_profile_operation_released");
  assert.ok(acquired);
  assert.ok(busy);
  assert.ok(released);
  assert.equal(busy?.holderOperationKind, "NICKNAME_UPDATE");
  assert.equal(busy?.holderRequestId, acquired?.requestId);
  assert.equal(released?.requestId, acquired?.requestId);
  assert.equal(typeof acquired?.acquiredAt, "string");
  assert.equal(typeof busy?.holderAcquiredAt, "string");
  assert.equal(typeof busy?.waitedMs, "number");
  assert.equal(typeof released?.heldMs, "number");
  assert.ok(Number(busy?.waitedMs) >= 0);
  assert.ok(Number(released?.heldMs) >= 0);

  const serialized = JSON.stringify(events);
  assert.doesNotMatch(serialized, /ownerToken|cookie|credential|password|authorization|messageText|localStorage/i);
  assert.doesNotMatch(serialized, /owner-a|owner-b|secret|token-value/i);
});

test("bounded wait override lets a background mirror operation queue behind the current holder", async () => {
  const prisma = createFakePrisma();
  const coordinator = new LineChatProfileOperationCoordinator(prisma as never);
  let releaseFirst!: () => void;
  const firstHold = new Promise<void>((resolve) => { releaseFirst = resolve; });

  const first = coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "NICKNAME_UPDATE" },
    async () => firstHold,
  );

  await new Promise((resolve) => setImmediate(resolve));

  const queued = coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "MIRROR_SYNC" },
    async () => "materialized",
    { waitForLock: true, waitForLockMs: 5_000 },
  );

  await new Promise((resolve) => setImmediate(resolve));
  releaseFirst();

  assert.equal((await first).acquired, true);
  const queuedResult = await queued;
  assert.equal(queuedResult.acquired, true);
  if (queuedResult.acquired) assert.equal(queuedResult.value, "materialized");
});

test("Mirror sync waits for an already-running profile health check", async () => {
  const prisma = createFakePrisma();
  const coordinator = new LineChatProfileOperationCoordinator(prisma as never);
  let releaseHealth!: () => void;
  const healthHold = new Promise<void>((resolve) => { releaseHealth = resolve; });
  const health = coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "HEALTH_SESSION" },
    async () => healthHold,
  );
  await new Promise((resolve) => setImmediate(resolve));

  const mirror = coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "MIRROR_SYNC" },
    async () => "synced",
  );
  await new Promise((resolve) => setImmediate(resolve));
  releaseHealth();

  assert.equal((await health).acquired, true);
  const mirrorResult = await mirror;
  assert.equal(mirrorResult.acquired, true);
  if (mirrorResult.acquired) assert.equal(mirrorResult.value, "synced");
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

test("lease acquisition uses the database clock instead of worker Date.now", async () => {
  const prisma = createFakePrisma();
  const coordinator = new LineChatProfileOperationCoordinator(prisma as never);
  const workerNow = Date.now;
  let leaseUntil = 0;
  try {
    Date.now = () => prisma.clock.nowMs + 10 * PROFILE_OPERATION_LEASE_DURATION_MS;
    const result = await coordinator.withProfileOperation(
      { sessionId: "session-a", operationKind: "NICKNAME_UPDATE" },
      async () => {
        leaseUntil = prisma.leases.get("session-a")?.leaseUntil.getTime() ?? 0;
        return "ok";
      },
    );
    assert.equal(result.acquired, true);
  } finally {
    Date.now = workerNow;
  }

  assert.equal(leaseUntil, prisma.clock.nowMs + PROFILE_OPERATION_LEASE_DURATION_MS);
  for (const query of prisma.queries) assertDbClockLeaseQuery(query);
});

test("heartbeat renewal uses the database clock instead of worker Date.now", async () => {
  const prisma = createFakePrisma();
  const coordinator = new LineChatProfileOperationCoordinator(prisma as never);
  const workerNow = Date.now;
  let before = 0;
  let after = 0;
  try {
    Date.now = () => prisma.clock.nowMs - 10 * PROFILE_OPERATION_LEASE_DURATION_MS;
    const result = await coordinator.withProfileOperation(
      { sessionId: "session-a", operationKind: "NICKNAME_UPDATE" },
      async (context) => {
        before = prisma.leases.get(context.sessionId)?.leaseUntil.getTime() ?? 0;
        prisma.clock.nowMs += 1_000;
        const renewed = await coordinatorInternals(coordinator).renewDatabaseLease(
          context.sessionId,
          context.ownerToken,
        );
        assert.equal(renewed, true);
        after = prisma.leases.get(context.sessionId)?.leaseUntil.getTime() ?? 0;
        return "ok";
      },
    );
    assert.equal(result.acquired, true);
  } finally {
    Date.now = workerNow;
  }

  assert.ok(after > before);
  assert.equal(after, prisma.clock.nowMs + PROFILE_OPERATION_LEASE_DURATION_MS);
  for (const query of prisma.queries) assertDbClockLeaseQuery(query);
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
  if (!contender.acquired) {
    assert.equal(contender.busyStage, "DATABASE_LEASE");
    assert.equal(contender.holderOperationKind, "NICKNAME_UPDATE");
    assert.ok(contender.holderAcquiredAt instanceof Date);
    assert.ok(contender.holderLeaseUntil instanceof Date);
  }
  lease.ownerToken = "foreign-owner";
  replaceOwner();
  await assert.rejects(first, /lease was lost/);
  assert.equal(prisma.leases.get("session-a")?.ownerToken, "foreign-owner");

  const expired = prisma.leases.get("session-a");
  assert.ok(expired);
  expired.leaseUntil = new Date(prisma.clock.nowMs - 1_000);
  const takeover = await coordinator.withProfileOperation(
    { sessionId: "session-a", operationKind: "NICKNAME_UPDATE" },
    async () => "reacquired",
  );
  assert.equal(takeover.acquired, true);
  if (takeover.acquired) assert.equal(takeover.value, "reacquired");
});

test("foreign owner cannot renew or release an unexpired lease", async () => {
  const prisma = createFakePrisma();
  const coordinator = new LineChatProfileOperationCoordinator(prisma as never);
  const internals = coordinatorInternals(coordinator);
  const acquired = await internals.acquireDatabaseLease("session-a", "owner-a", "NICKNAME_UPDATE");
  assert.ok(acquired);

  const renewed = await internals.renewDatabaseLease("session-a", "owner-b");
  assert.equal(renewed, false);
  await internals.releaseDatabaseLease("session-a", "owner-b");
  assert.equal(prisma.leases.get("session-a")?.ownerToken, "owner-a");
});

test("an in-flight old heartbeat cannot overwrite or release a replacement owner", async () => {
  const prisma = createFakePrisma();
  const oldCoordinator = new LineChatProfileOperationCoordinator(prisma as never);
  const oldInternals = coordinatorInternals(oldCoordinator);
  const oldLease = await oldInternals.acquireDatabaseLease("session-a", "owner-a", "NICKNAME_UPDATE");
  assert.ok(oldLease);

  const gate = prisma.pauseNextRenew();
  const oldRenewal = oldInternals.renewDatabaseLease("session-a", "owner-a");
  await gate.started;

  prisma.clock.nowMs = oldLease.leaseUntil.getTime() + 1;
  const newCoordinator = new LineChatProfileOperationCoordinator(prisma as never);
  const replacement = await coordinatorInternals(newCoordinator).acquireDatabaseLease(
    "session-a",
    "owner-b",
    "NICKNAME_UPDATE",
  );
  assert.equal(replacement?.ownerToken, "owner-b");

  gate.release();
  assert.equal(await oldRenewal, false);
  assert.equal(prisma.leases.get("session-a")?.ownerToken, "owner-b");
  await oldInternals.releaseDatabaseLease("session-a", "owner-a");
  assert.equal(prisma.leases.get("session-a")?.ownerToken, "owner-b");
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

test("persisted mapping and nickname PUT share one coordinator context without resolution", async () => {
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
    conversation: {
      findUnique: async () => ({
        lineOfficialAccountId: "oa-1",
        lineChatUserId: "Uchat",
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
    undefined,
    coordinator as never,
  );
  await worker.processSingleJob("job-1");
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
