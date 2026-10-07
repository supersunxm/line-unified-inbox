import assert from "node:assert/strict";
import test from "node:test";
import type {
  LineChatOperationsHealth,
  LineChatOperationsSession,
  LineChatFleetReadinessStore,
} from "../src/lib/api.ts";
import { buildLineChatOverview } from "../src/app/operations/line-chat-health/line-chat-health-overview.ts";
import {
  getSessionConnection,
  getRecoveryStage,
  RECOVERY_LABELS,
  SESSION_HEALTH_FRESHNESS_MS,
  hasActiveMirrorWork,
  applyRecoveryObservation,
} from "../src/app/operations/line-chat-health/line-chat-core-health.ts";
const now = Date.parse("2026-10-07T02:00:00Z");
const at = (offset = 0) => new Date(now + offset).toISOString();
const base: LineChatOperationsSession = {
  id: "a",
  sessionKey: "account-1",
  displayName: "Sunn-OBS",
  status: "ACTIVE",
  healthStatus: "CONNECTED",
  healthFailureStage: null,
  consecutiveAuthFailures: 0,
  mappedOaCount: 72,
  enabledOaCount: 7,
  activeProfileLeases: 1,
  activeLeaseOperation: "MIRROR_SYNC",
  browserState: "BUSY",
  browserOperationKind: "MIRROR_SYNC",
  browserBusyUntil: at(60_000),
  lastAuthenticatedAt: at(-60_000),
  lastSuccessfulRequestAt: at(-60_000),
  lastAuthFailureAt: null,
  healthLastCheckedAt: at(-12 * 60_000),
  healthLastHealthyAt: at(-12 * 60_000),
  jobs: {
    pending: 0,
    processing: 0,
    success: 251,
    failed: 2,
    failedAuth: 0,
    superseded: 3,
    total: 256,
  },
  recentFailures: [],
};
const available: LineChatOperationsSession = {
  ...base,
  id: "b",
  sessionKey: "profile-b",
  displayName: "OBS-Sunx2",
  browserState: "AVAILABLE",
  browserOperationKind: null,
  browserBusyUntil: null,
  activeProfileLeases: 0,
  activeLeaseOperation: null,
  healthLastCheckedAt: at(-24 * 60_000),
  healthLastHealthyAt: at(-24 * 60_000),
};
test("an old background recovery read cannot clear a newer operator request or an in-flight remembered login", () => {
  const signal = { observedAt: now, stage: "REQUESTED" as const };
  const signals = { "account-1": signal };
  assert.equal(
    applyRecoveryObservation(signals, "account-1", undefined, now - 1),
    signals,
  );
  const inFlight = { "account-1": { ...signal, clientPending: true } };
  assert.equal(
    applyRecoveryObservation(inFlight, "account-1", undefined, now + 1),
    inFlight,
  );
  assert.equal(
    getRecoveryStage(
      base,
      { ...signal, clientPending: true, observedAt: now - 180_000 },
      now,
    ),
    "REQUESTED",
  );
  assert.equal(
    applyRecoveryObservation(signals, "account-1", undefined, now + 1)[
      "account-1"
    ],
    undefined,
  );
  assert.equal(
    applyRecoveryObservation(inFlight, "account-1", undefined)["account-1"],
    undefined,
  );
});
const store: LineChatFleetReadinessStore = {
  lineOfficialAccountId: "oa",
  lineOfficialAccountName: "Example OA",
  storeId: "store",
  storeName: "Example store",
  storeCode: "20789",
  status: "READY",
  blockers: [],
  hasChatBotId: true,
  sessionKey: "account-1",
  sessionStatus: "ACTIVE",
  sessionHealthStatus: "CONNECTED",
  oaHealthStatus: "CONNECTED",
  mappedConversations: 3,
  totalConversations: 4,
  mappingCoveragePercent: 75,
  currentlyPilotEligible: true,
};
function report(sessions = [base, available]): LineChatOperationsHealth {
  return {
    timestamp: at(),
    sessions,
    queue: base.jobs,
    mapping: {
      mappedReadyPending: 0,
      waitingForMapping: 2,
      oldestPendingAt: at(),
    },
    rollout: {
      totalOas: 144,
      enabledOas: 7,
      disabledOas: 137,
      missingChatBotId: 137,
      missingSession: 0,
    },
    fleetReadiness: {
      generatedAt: at(),
      summary: {
        totalStores: 144,
        ready: 7,
        needBotMapping: 137,
        needLogin: 0,
        blocked: 0,
        currentlyPilotEligible: 7,
      },
      stores: Array.from({ length: 144 }, (_, i) => ({
        ...store,
        lineOfficialAccountId: `oa-${i}`,
        hasChatBotId: i < 7,
        status: i < 7 ? "READY" : "NEED_BOT_MAPPING",
        currentlyPilotEligible: i < 7,
      })),
    },
  };
}
test("production-shaped missing telemetry yields Operational, Running and 2/2 connected with setup still actionable", () => {
  const data = report();
  const before = structuredClone(data);
  const overview = buildLineChatOverview(data, now);
  assert.equal(overview.overall.status, "OPERATIONAL");
  assert.equal(overview.cards[1].value, "Running");
  assert.equal(overview.cards[2].value, "2 / 2 connected");
  assert.deepEqual(
    overview.sessions.map((item) => item.health.label),
    ["In use", "Connected"],
  );
  assert.equal(
    overview.stores.filter((item) => item.health.status === "NEED_SETUP")
      .length,
    137,
  );
  assert.ok(
    overview.attention.some(
      (item) => item.target === "store" && item.health.status === "NEED_SETUP",
    ),
  );
  assert.deepEqual(data, before);
});
test("store setup, mapping backlog and individual store access blocks never override healthy core connections", () => {
  const data = report();
  data.fleetReadiness.stores[0] = {
    ...store,
    oaHealthStatus: "OA_ACCESS_LOST",
  };
  const overview = buildLineChatOverview(data, now);
  assert.equal(overview.overall.label, "Operational");
  assert.equal(overview.stores[0].health.status, "BLOCKED");
  assert.equal(overview.cards[4].health.label, "Needs setup");
  assert.ok(overview.attention.some((item) => item.target === "mapping"));
});
test("recent healthy available/in-use sessions do not require optional mirror telemetry", () => {
  for (const session of [
    base,
    available,
    {
      ...available,
      liveMirror: {
        telemetryStatus: "STALE" as const,
        profile: "B" as const,
        mappedStores: null,
        browser: "UNKNOWN" as const,
        observedAt: at(-300_000),
        completedAt: null,
        schedulerRunning: null,
        cycle: null,
      },
    },
  ]) {
    assert.ok(
      ["CONNECTED", "IN_USE"].includes(
        getSessionConnection(session, now).status,
      ),
    );
  }
  assert.equal(
    getSessionConnection(
      { ...available, healthFailureStage: "MANAGER_AUTH" },
      now,
    ).status,
    "CONNECTED",
  );
});
test("session freshness uses backend's 30-minute boundary and rejects invalid/future/expired evidence with a reason", () => {
  assert.equal(SESSION_HEALTH_FRESHNESS_MS, 30 * 60_000);
  for (const [offset, expected] of [
    [-30 * 60_000, "CONNECTED"],
    [-30 * 60_000 - 1, "UNKNOWN"],
    [5_000, "CONNECTED"],
    [5_001, "UNKNOWN"],
  ] as const) {
    const result = getSessionConnection(
      {
        ...available,
        healthLastHealthyAt: at(offset),
        healthLastCheckedAt: at(offset),
      },
      now,
    );
    assert.equal(result.status, expected);
    assert.ok(result.reason);
  }
  assert.equal(
    getSessionConnection(
      {
        ...available,
        healthLastHealthyAt: "invalid",
        healthLastCheckedAt: null,
      },
      now,
    ).status,
    "UNKNOWN",
  );
  assert.match(
    getSessionConnection({ ...available, browserState: "UNKNOWN" }, now).reason,
    /browser availability is unconfirmed/,
  );
  assert.match(
    getSessionConnection({ ...base, browserBusyUntil: at(-1) }, now).reason,
    /expired/,
  );
});
test("failed refresh cannot preserve a falsely current status after the report freshness limit", () => {
  const data = report();
  data.timestamp = at(-90_001);
  const overview = buildLineChatOverview(data, now);
  assert.equal(overview.overall.status, "UNKNOWN");
  assert.equal(overview.mirrorHealth.status, "UNKNOWN");
  assert.ok(
    overview.sessions.every((item) =>
      item.health.reason.includes("report is stale"),
    ),
  );
});
test("a newer inconclusive check justifies Unknown without silently discarding recent healthy evidence", () => {
  const result = getSessionConnection(
    { ...available, healthStatus: "UNKNOWN", healthLastCheckedAt: at(-10_000) },
    now,
  );
  assert.equal(result.status, "UNKNOWN");
  assert.match(result.reason, /latest check could not confirm/);
  assert.equal(
    getSessionConnection({ ...available, healthStatus: "UNKNOWN" }, now).status,
    "CONNECTED",
  );
});
test("recovery wins over login and degraded; explicit login wins over degraded", () => {
  const auth = {
    ...available,
    healthStatus: "AUTH_REQUIRED",
    activeJobRisk: "CRITICAL" as const,
  };
  assert.equal(getSessionConnection(auth, now).status, "LOGIN_REQUIRED");
  assert.equal(
    getSessionConnection({ ...auth, authRecoveryInProgress: true }, now).status,
    "RECOVERING",
  );
  assert.equal(
    getSessionConnection(auth, now, { observedAt: now, pending: true }).status,
    "RECOVERING",
  );
  const overview = buildLineChatOverview(
    report([
      { ...auth, authRecoveryInProgress: true },
      { ...base, healthStatus: "AUTH_REQUIRED" },
    ]),
    now,
  );
  assert.equal(overview.overall.status, "RECOVERING");
  assert.equal(
    getSessionConnection(
      { ...auth, status: "DISABLED", authRecoveryInProgress: true },
      now,
    ).blocked,
    true,
  );
});
test("partial login loss is Degraded while all unavailable sessions are Blocked", () => {
  assert.equal(
    buildLineChatOverview(
      report([base, { ...available, healthStatus: "AUTH_REQUIRED" }]),
      now,
    ).overall.status,
    "DEGRADED",
  );
  assert.equal(
    buildLineChatOverview(
      report([
        { ...base, healthStatus: "AUTH_REQUIRED" },
        { ...available, healthStatus: "AUTH_REQUIRED" },
      ]),
      now,
    ).overall.status,
    "BLOCKED",
  );
  assert.equal(
    buildLineChatOverview(
      report([
        { ...base, status: "DISABLED" },
        { ...available, status: "DISABLED" },
      ]),
      now,
    ).overall.status,
    "BLOCKED",
  );
});
test("historical failed job counts and records do not degrade core connection health", () => {
  const data = report([
    {
      ...base,
      jobs: { ...base.jobs, failed: 999, failedAuth: 99 },
      historicalFailures: 1098,
      recentFailures: [
        {
          jobId: "history",
          oaId: "oa",
          oaName: "Example OA",
          failureCategory: "AUTHENTICATION",
          failureStage: "MANAGER_AUTH",
          attemptCount: 10,
          createdAt: at(-86_400_000),
          updatedAt: at(-86_400_000),
          conversationId: null,
          recommendedAction: "RE_LOGIN_REQUIRED",
          isAutoFixable: false,
          resolutionState: "HISTORICAL",
          isActionable: false,
        },
      ],
    },
    available,
  ]);
  const overview = buildLineChatOverview(data, now);
  assert.equal(overview.overall.status, "OPERATIONAL");
  assert.equal(overview.activeIssueCount, 0);
  assert.equal(overview.mirrorHealth.status, "RUNNING");
  assert.equal(overview.sessions[0].health.status, "IN_USE");
});
test("active MIRROR_SYNC lease wins over absent or stale mirror telemetry", () => {
  const data = report();
  data.liveMirrorFleet = {
    observedAt: at(-300_000),
    configuredStores: 144,
    cycleRunning: false,
    lastCycle: null,
  };
  const overview = buildLineChatOverview(data, now);
  assert.equal(overview.mirrorHealth.status, "RUNNING");
  assert.equal(
    hasActiveMirrorWork({ ...base, browserBusyUntil: at(-1) }, now, at()),
    false,
  );
  assert.equal(
    hasActiveMirrorWork({ ...base, browserBusyUntil: "invalid" }, now, at()),
    false,
  );
  assert.equal(hasActiveMirrorWork(base, now, at(-90_001)), false);
});
test("fresh fleet cycle reports Running, cycle counts and last known completion independently of session Ready", () => {
  const data = report([available]);
  data.liveMirrorFleet = {
    observedAt: at(),
    configuredStores: 144,
    cycleRunning: true,
    lastCycle: {
      completedAt: at(-600_000),
      attempted: 140,
      succeeded: 140,
      failed: 0,
      partial: 0,
      skipped: 4,
      durationMs: 1000,
    },
  };
  const overview = buildLineChatOverview(data, now);
  assert.equal(overview.mirrorHealth.status, "RUNNING");
  assert.match(overview.mirrorHealth.supporting[0], /Last known cycle/);
  assert.match(
    overview.mirrorHealth.supporting[1],
    /140 processed \/ 144 configured/,
  );
  data.liveMirrorFleet.cycleRunning = false;
  assert.equal(buildLineChatOverview(data, now).mirrorHealth.status, "IDLE");
});
test("current partial cycle is Catching up; confirmed paused scheduler is Paused", () => {
  const mirror: NonNullable<LineChatOperationsSession["liveMirror"]> = {
    telemetryStatus: "FRESH",
    profile: "A",
    mappedStores: 72,
    browser: "RUNNING",
    observedAt: at(),
    completedAt: null,
    schedulerRunning: true,
    cycle: {
      attempted: 20,
      succeeded: 20,
      failed: 0,
      partial: 0,
      durationMs: 1000,
    },
  };
  const catching = buildLineChatOverview(
    report([{ ...base, liveMirror: mirror }]),
    now,
  ).mirrorHealth;
  assert.equal(catching.status, "CATCHING_UP");
  assert.match(catching.supporting[1], /20 processed \/ 72 configured/);
  const paused = buildLineChatOverview(
    report([
      {
        ...available,
        liveMirror: { ...mirror, cycle: null, schedulerRunning: false },
      },
    ]),
    now,
  );
  assert.equal(paused.mirrorHealth.status, "PAUSED");
  assert.equal(paused.overall.status, "DEGRADED");
});
test("old failed cycle does not degrade current health; a fresh failed cycle does", () => {
  const data = report();
  data.liveMirrorFleet = {
    observedAt: at(),
    configuredStores: 144,
    cycleRunning: true,
    lastCycle: {
      completedAt: at(-86_400_000),
      attempted: 144,
      succeeded: 140,
      failed: 4,
      partial: 0,
      skipped: 0,
      durationMs: 1000,
    },
  };
  assert.equal(buildLineChatOverview(data, now).overall.status, "OPERATIONAL");
  data.liveMirrorFleet.lastCycle!.completedAt = at(-10_000);
  assert.equal(
    buildLineChatOverview(data, now).mirrorHealth.status,
    "DEGRADED",
  );
});
test("no active work or telemetry is genuinely Unknown without making recently healthy connections Unknown", () => {
  const overview = buildLineChatOverview(report([available]), now);
  assert.equal(overview.mirrorHealth.status, "UNKNOWN");
  assert.match(overview.mirrorHealth.reason, /No mirror telemetry/);
  assert.equal(overview.sessions[0].health.status, "CONNECTED");
  assert.equal(overview.overall.status, "OPERATIONAL");
});
test("recovery stages follow observed signals, retain active mirror while pending, and never expose raw codes", () => {
  assert.equal(
    getRecoveryStage(base, { observedAt: now, stage: "REQUESTED" }, now),
    "REQUESTED",
  );
  assert.equal(
    getRecoveryStage(base, { observedAt: now, pending: true }, now),
    "WAITING_MIRROR",
  );
  assert.equal(
    getRecoveryStage(available, { observedAt: now, pending: true }, now),
    "OPENING_BROWSER",
  );
  assert.equal(
    getRecoveryStage(
      available,
      { observedAt: now, active: true, readyToOpen: true },
      now,
    ),
    "WAITING_LOGIN",
  );
  assert.equal(
    getRecoveryStage(
      {
        ...available,
        authRecoveryInProgress: true,
        activeLeaseOperation: "HEALTH_SESSION",
      },
      undefined,
      now,
    ),
    "VALIDATING",
  );
  assert.equal(
    getRecoveryStage(available, { observedAt: now, stage: "RESUMING" }, now),
    "RESUMING",
  );
  assert.equal(
    getRecoveryStage(base, { observedAt: now, stage: "RESUMING" }, now),
    null,
  );
  assert.equal(
    getRecoveryStage(
      available,
      { observedAt: now - 90_001, pending: true },
      now,
    ),
    null,
  );
  assert.deepEqual(Object.values(RECOVERY_LABELS), [
    "Recovery requested",
    "Waiting for Mirror",
    "Opening browser",
    "Waiting for LINE login",
    "Validating session",
    "Resuming Mirror",
  ]);
  const data = report([base]);
  const overview = buildLineChatOverview(data, now, {
    "account-1": { observedAt: now, pending: true },
  });
  assert.equal(overview.overall.status, "RECOVERING");
  assert.equal(overview.mirrorHealth.status, "RUNNING");
  assert.equal(overview.sessions[0].health.reason, "Waiting for Mirror");
});
test("session primary actions are inspect, reconnect, view recovery or refresh according to evidence", () => {
  for (const [session, expected] of [
    [base, "INSPECT"],
    [available, "INSPECT"],
    [{ ...available, healthStatus: "AUTH_REQUIRED" }, "RECONNECT"],
    [{ ...available, authRecoveryInProgress: true }, "VIEW_RECOVERY"],
    [{ ...available, healthStatus: "DEGRADED" }, "INSPECT"],
    [{ ...available, browserState: "UNKNOWN" }, "REFRESH"],
  ] as Array<[LineChatOperationsSession, string]>) {
    assert.equal(getSessionConnection(session, now).primaryAction, expected);
  }
});
