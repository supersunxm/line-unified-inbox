import assert from "node:assert/strict";
import test from "node:test";
import {
  LINE_CHAT_HEALTH_SCHEDULER_TICK_MS,
  LINE_CHAT_OA_HEALTH_TARGET_MS,
  LINE_CHAT_SESSION_HEALTH_TARGET_MS,
  LineChatHealthSchedulerService,
  nextScheduledAt,
} from "./line-chat-health-scheduler.service";

function makeFixture(options: {
  nicknameBacklog?: number;
  sessionId?: string | null;
  oaId?: string | null;
  sessionOutcome?: "RECORDED" | "SKIPPED_BUSY";
  oaOutcome?: "RECORDED" | "SKIPPED_BUSY";
  recoveryCandidateId?: string | null;
  authRecovery?: any;
} = {}) {
  const calls: string[] = [];
  const updates: Array<{ entity: "SESSION" | "OA"; id: string; data: Record<string, unknown> }> = [];
  const prisma = {
    lineChatNicknameSyncJob: {
      count: async () => {
        calls.push("nickname-count");
        return options.nicknameBacklog ?? 0;
      },
    },
    lineChatProfileOperationLease: {
      count: async () => {
        calls.push("lease-count");
        return 0;
      },
    },
    lineChatSession: {
      findFirst: async (args?: any) => {
        if (args?.where?.healthStatus === "AUTH_REQUIRED") {
          calls.push("recovery-find");
          return options.recoveryCandidateId ? { id: options.recoveryCandidateId } : null;
        }
        calls.push("session-find");
        return options.sessionId === undefined ? null : options.sessionId ? { id: options.sessionId } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        calls.push("session-update");
        updates.push({ entity: "SESSION", id: where.id, data });
        return { id: where.id };
      },
    },
    lineOfficialAccount: {
      findFirst: async () => {
        calls.push("oa-find");
        return options.oaId === undefined ? null : options.oaId ? { id: options.oaId } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        calls.push("oa-update");
        updates.push({ entity: "OA", id: where.id, data });
        return { id: where.id };
      },
    },
  };
  const sessionProbe = {
    probeSession: async (id: string, source: string) => {
      calls.push(`session-probe:${id}:${source}`);
      if (options.sessionOutcome === "SKIPPED_BUSY") {
        return { outcome: "SKIPPED_BUSY" as const, sessionId: id, retryAfterMs: 5_000 };
      }
      return {
        outcome: "RECORDED" as const,
        sessionId: id,
        status: "CONNECTED" as const,
        failureStage: null,
        transitionEventCreated: false,
        durationMs: 50,
      };
    },
  };
  const oaProbe = {
    probeOa: async (id: string, source: string) => {
      calls.push(`oa-probe:${id}:${source}`);
      if (options.oaOutcome === "SKIPPED_BUSY") {
        return { outcome: "SKIPPED_BUSY" as const, lineOfficialAccountId: id, retryAfterMs: 5_000 };
      }
      return {
        outcome: "RECORDED" as const,
        lineOfficialAccountId: id,
        status: "CONNECTED" as const,
        failureStage: null,
        transitionEventCreated: false,
        sessionStatus: "CONNECTED" as const,
        sessionTransitionEventCreated: false,
        durationMs: 75,
      };
    },
  };
  return {
    service: new LineChatHealthSchedulerService(
      prisma as never,
      sessionProbe as never,
      oaProbe as never,
      options.authRecovery,
    ),
    calls,
    updates,
  };
}

test("scheduler constants keep the conservative rollout cadence with two-per-minute capacity", () => {
  assert.equal(LINE_CHAT_HEALTH_SCHEDULER_TICK_MS, 30_000);
  assert.equal(LINE_CHAT_SESSION_HEALTH_TARGET_MS, 12 * 60_000);
  assert.equal(LINE_CHAT_OA_HEALTH_TARGET_MS, 3 * 60 * 60_000);
});

test("stable scheduling jitter stays within the intended windows", () => {
  const checkedAt = new Date("2026-09-04T00:00:00.000Z");
  const sessionNext = nextScheduledAt("SESSION", "session-1", checkedAt).getTime() - checkedAt.getTime();
  const oaNext = nextScheduledAt("OA", "oa-1", checkedAt).getTime() - checkedAt.getTime();
  assert.ok(sessionNext >= 10 * 60_000 && sessionNext <= 14 * 60_000);
  assert.ok(oaNext >= 165 * 60_000 && oaNext <= 195 * 60_000);
  assert.equal(
    nextScheduledAt("SESSION", "session-1", checkedAt).toISOString(),
    nextScheduledAt("SESSION", "session-1", checkedAt).toISOString(),
  );
});

test("nickname backlog has priority and prevents any health browser work", async () => {
  const fixture = makeFixture({ nicknameBacklog: 2, sessionId: "session-1", oaId: "oa-1" });
  const result = await fixture.service.runTick(new Date("2026-09-04T00:00:00.000Z"));
  assert.equal(result, "SKIPPED_NICKNAME");
  assert.deepEqual(fixture.calls, ["nickname-count"]);
  assert.equal(fixture.updates.length, 0);
});

test("a due session wins over OA and only one health operation runs", async () => {
  const fixture = makeFixture({ sessionId: "session-1", oaId: "oa-1" });
  const result = await fixture.service.runTick(new Date("2026-09-04T00:00:00.000Z"));
  assert.equal(result, "SESSION");
  assert.deepEqual(fixture.calls.slice(0, 3), [
    "nickname-count",
    "session-find",
    "session-probe:session-1:SCHEDULED",
  ]);
  assert.equal(fixture.calls.includes("oa-find"), false);
  assert.equal(fixture.updates.length, 1);
  assert.equal(fixture.updates[0].entity, "SESSION");
  assert.ok(fixture.updates[0].data.healthNextCheckAt instanceof Date);
});

test("OA runs when no session is due and schedules its next staggered check", async () => {
  const fixture = makeFixture({ sessionId: null, oaId: "oa-1" });
  const result = await fixture.service.runTick(new Date("2026-09-04T00:00:00.000Z"));
  assert.equal(result, "OA");
  assert.deepEqual(fixture.calls.slice(0, 4), [
    "nickname-count",
    "session-find",
    "oa-find",
    "oa-probe:oa-1:SCHEDULED",
  ]);
  assert.equal(fixture.updates.length, 1);
  assert.equal(fixture.updates[0].entity, "OA");
  assert.ok(fixture.updates[0].data.healthNextCheckAt instanceof Date);
});

test("busy shared profile does not advance next-check timestamp", async () => {
  const fixture = makeFixture({ sessionId: "session-1", sessionOutcome: "SKIPPED_BUSY" });
  const result = await fixture.service.runTick();
  assert.equal(result, "SESSION");
  assert.equal(fixture.updates.length, 0);
});

test("idle scheduler performs no probe or mutation", async () => {
  const fixture = makeFixture({ sessionId: null, oaId: null });
  const result = await fixture.service.runTick();
  assert.equal(result, "IDLE");
  assert.equal(fixture.updates.length, 0);
  assert.deepEqual(fixture.calls, ["nickname-count", "session-find", "oa-find"]);
});

test("maintenance and disabled worker gates stop a tick before DB work", async () => {
  const fixture = makeFixture({ sessionId: "session-1" });
  const previousMaintenance = process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
  const previousDisabled = process.env.DISABLE_NICKNAME_WORKER;
  try {
    process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "true";
    assert.equal(await fixture.service.runTick(), "IDLE");
    assert.deepEqual(fixture.calls, []);

    process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "false";
    process.env.DISABLE_NICKNAME_WORKER = "true";
    assert.equal(await fixture.service.runTick(), "IDLE");
    assert.deepEqual(fixture.calls, []);
  } finally {
    if (previousMaintenance === undefined) delete process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
    else process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = previousMaintenance;
    if (previousDisabled === undefined) delete process.env.DISABLE_NICKNAME_WORKER;
    else process.env.DISABLE_NICKNAME_WORKER = previousDisabled;
  }
});

test("kill switch OFF: scheduler never queries or attempts auth recovery, proceeds to routine probes", async () => {
  const previous = process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED;
  try {
    delete process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED;

    let recoveryInvoked = false;
    const fixture = makeFixture({
      sessionId: "session-1",
      recoveryCandidateId: "session-auth-req",
      authRecovery: {
        isRecoveryInProgress: () => false,
        getCooldownRemainingMs: () => 0,
        recoverSession: async () => {
          recoveryInvoked = true;
          return { outcome: "RECOVERED_REMEMBERED_ACCOUNT" };
        },
      },
    });

    const result = await fixture.service.runTick(new Date("2026-09-04T00:00:00.000Z"));
    // With kill switch OFF, scheduler should NOT query recovery candidates or call recoverSession
    assert.equal(recoveryInvoked, false);
    assert.equal(fixture.calls.includes("recovery-find"), false);
    // It proceeds to normal session probe
    assert.equal(result, "SESSION");
    assert.equal(fixture.calls.includes("session-find"), true);
    assert.equal(fixture.calls.includes("session-probe:session-1:SCHEDULED"), true);
  } finally {
    if (previous === undefined) delete process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED;
    else process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED = previous;
  }
});

test("kill switch ON: scheduler executes automatic recovery for eligible session", async () => {
  const previous = process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED;
  try {
    process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED = "true";

    let recoveredSessionId: string | null = null;
    let recoveredTrigger: string | null = null;
    const fixture = makeFixture({
      sessionId: "session-1",
      recoveryCandidateId: "session-auth-req",
      authRecovery: {
        isRecoveryInProgress: () => false,
        getCooldownRemainingMs: () => 0,
        recoverSession: async (id: string, trigger: string) => {
          recoveredSessionId = id;
          recoveredTrigger = trigger;
          return { outcome: "RECOVERED_REMEMBERED_ACCOUNT" };
        },
      },
    });

    const result = await fixture.service.runTick(new Date("2026-09-04T00:00:00.000Z"));
    assert.equal(result, "SESSION");
    assert.equal(recoveredSessionId, "session-auth-req");
    assert.equal(recoveredTrigger, "SCHEDULED");
    assert.equal(fixture.calls.includes("recovery-find"), true);
    assert.equal(fixture.updates.length, 1);
    assert.equal(fixture.updates[0].entity, "SESSION");
    assert.equal(fixture.updates[0].id, "session-auth-req");
    assert.ok(fixture.updates[0].data.healthNextCheckAt instanceof Date);
  } finally {
    if (previous === undefined) delete process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED;
    else process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED = previous;
  }
});

