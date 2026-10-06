import assert from "node:assert/strict";
import test from "node:test";
import type { LineChatFleetReadinessStore, LineChatOperationsSession } from "../src/lib/api.ts";
import { getLineChatUiHealth, getOverallHealth } from "../src/app/operations/line-chat-health/line-chat-health-status.ts";

const now = Date.parse("2026-10-06T08:00:00Z");
const session: LineChatOperationsSession = {
  id: "session", sessionKey: "account-1", displayName: "Account", status: "ACTIVE",
  healthStatus: "CONNECTED", healthFailureStage: null, consecutiveAuthFailures: 0,
  mappedOaCount: 6, enabledOaCount: 6, activeProfileLeases: 0, activeLeaseOperation: null,
  browserState: "AVAILABLE", browserOperationKind: null, browserBusyUntil: null,
  lastAuthenticatedAt: null, lastSuccessfulRequestAt: null, lastAuthFailureAt: null,
  healthLastCheckedAt: new Date(now).toISOString(), healthLastHealthyAt: new Date(now).toISOString(),
  jobs: { pending: 0, processing: 0, success: 1, superseded: 0, total: 1, failed: 0, failedAuth: 0 },
  recentFailures: [],
  liveMirror: { telemetryStatus: "FRESH", profile: "A", mappedStores: 6, browser: "RUNNING",
    observedAt: new Date(now).toISOString(), completedAt: null, schedulerRunning: true,
    cycle: { attempted: 6, succeeded: 6, failed: 0, partial: 0, durationMs: 1000 } },
};
const store: LineChatFleetReadinessStore = {
  lineOfficialAccountId: "oa", lineOfficialAccountName: "OA", storeId: "store", storeName: "Store",
  storeCode: "20789", status: "READY", blockers: [], hasChatBotId: true, sessionKey: "account-1",
  sessionStatus: "ACTIVE", sessionHealthStatus: "CONNECTED", oaHealthStatus: "CONNECTED",
  mappedConversations: 0, totalConversations: 1, mappingCoveragePercent: 0, currentlyPilotEligible: false,
};
const accountHealth = (changes: Partial<LineChatOperationsSession> = {}) =>
  getLineChatUiHealth({ kind: "session", session: { ...session, ...changes } }, now);
const storeHealth = (changes: Partial<LineChatFleetReadinessStore> = {}, parent?: LineChatOperationsSession) =>
  getLineChatUiHealth({ kind: "store", store: { ...store, ...changes }, session: parent }, now);

const accountCases: Array<[string, Partial<LineChatOperationsSession>, string]> = [
  ["inactive account blocks recovery", { status: "INACTIVE", authRecoveryInProgress: true }, "BLOCKED"],
  ["conflicting ownership blocks recovery", { activeProfileLeases: 2, browserState: "RECOVERING" }, "BLOCKED"],
  ["browser lock is blocked without telemetry", { healthFailureStage: "PROFILE_LOCK", liveMirror: undefined }, "BLOCKED"],
  ["automatic recovery overrides expired login and missing telemetry", { authRecoveryInProgress: true, healthStatus: "AUTH_REQUIRED", liveMirror: undefined }, "RECOVERING"],
  ["manual recovery overrides expired login", { browserState: "RECOVERING", healthStatus: "AUTH_REQUIRED" }, "RECOVERING"],
  ["missing setup precedes login", { healthFailureStage: "PROFILE_MISSING", healthStatus: "AUTH_REQUIRED" }, "NEED_SETUP"],
  ["invalid setup is actionable without telemetry", { healthStatus: "CONFIG_ERROR", healthFailureStage: "PROFILE_PATH_INVALID", liveMirror: undefined }, "NEED_SETUP"],
  ["expired login precedes delayed work", { healthStatus: "AUTH_REQUIRED", activeStuckJobs: 1, liveMirror: undefined }, "LOGIN_REQUIRED"],
  ["lifecycle login requirement is respected", { status: "AUTH_REQUIRED" }, "LOGIN_REQUIRED"],
  ["known degraded check precedes missing telemetry", { healthStatus: "DEGRADED", healthFailureStage: "TIMEOUT", liveMirror: undefined }, "DEGRADED"],
  ["stuck current work is degraded without telemetry", { activeStuckJobs: 1, liveMirror: undefined }, "DEGRADED"],
  ["missing observation is unknown", { liveMirror: undefined }, "UNKNOWN"],
  ["unconfirmed health is unknown", { healthStatus: "UNKNOWN" }, "UNKNOWN"],
  ["future lifecycle values fail closed", { status: "FUTURE_STATUS" }, "UNKNOWN"],
  ["future health values fail closed", { healthStatus: "FUTURE_STATUS" }, "UNKNOWN"],
  ["normal work ownership is ready", { browserState: "BUSY", activeProfileLeases: 1 }, "READY"],
];
for (const [name, changes, status] of accountCases) {
  test(name, () => assert.equal(accountHealth(changes).status, status));
}

test("historical failed jobs never degrade a healthy account", () => {
  assert.equal(accountHealth({ jobs: { ...session.jobs, failed: 20, failedAuth: 5, total: 26 }, historicalFailures: 25 }).status, "READY");
});

test("only fresh failed or partial sync observations cause degraded status", () => {
  const liveMirror = { ...session.liveMirror!, cycle: { ...session.liveMirror!.cycle!, partial: 1 } };
  assert.equal(accountHealth({ liveMirror }).status, "DEGRADED");
  assert.equal(accountHealth({ liveMirror: { ...liveMirror, telemetryStatus: "STALE" } }).status, "UNKNOWN");
});

test("stopped and failed browsers need service inspection, not LINE login", () => {
  for (const browser of ["STOPPED", "START_FAILED"] as const) {
    const result = accountHealth({ liveMirror: { ...session.liveMirror!, browser } });
    assert.equal(result.status, "DEGRADED");
    assert.match(result.recommendedAction, /sync service/);
    assert.doesNotMatch(result.recommendedAction, /Reconnect LINE/);
  }
});

test("freshness limits reject invalid, expired and future observations", () => {
  for (const observedAt of ["invalid", new Date(now - 90_001).toISOString(), new Date(now + 5_001).toISOString()]) {
    assert.equal(accountHealth({ liveMirror: { ...session.liveMirror!, observedAt } }).status, "UNKNOWN");
  }
  for (const observedAt of [new Date(now - 90_000).toISOString(), new Date(now + 5_000).toISOString()]) {
    assert.equal(accountHealth({ liveMirror: { ...session.liveMirror!, observedAt } }).status, "READY");
  }
});

const storeCases: Array<[string, Partial<LineChatFleetReadinessStore>, string]> = [
  ["inactive store precedes setup and login", { status: "NEED_LOGIN", blockers: ["STORE_INACTIVE"], hasChatBotId: false }, "BLOCKED"],
  ["lost access requires permission review even when backend says need login", { status: "NEED_LOGIN", oaHealthStatus: "OA_ACCESS_LOST" }, "BLOCKED"],
  ["disabled parent blocks the store", { sessionStatus: "DISABLED", status: "NEED_LOGIN" }, "BLOCKED"],
  ["missing connection setup precedes login", { status: "NEED_LOGIN", hasChatBotId: false }, "NEED_SETUP"],
  ["missing session needs setup", { sessionKey: null, status: "BLOCKED", blockers: ["MISSING_LINE_CHAT_SESSION"] }, "NEED_SETUP"],
  ["missing store mapping needs setup", { storeId: null, status: "BLOCKED" }, "NEED_SETUP"],
  ["configuration error needs setup", { oaHealthStatus: "CONFIG_ERROR", status: "BLOCKED" }, "NEED_SETUP"],
  ["LINE login is required", { sessionHealthStatus: "AUTH_REQUIRED", status: "NEED_LOGIN" }, "LOGIN_REQUIRED"],
  ["degraded store check is recoverable", { oaHealthStatus: "DEGRADED", status: "BLOCKED" }, "DEGRADED"],
  ["unconfirmed health is unknown, not a generic block", { oaHealthStatus: "UNKNOWN", status: "BLOCKED", blockers: ["HEALTH_NOT_CONFIRMED_CONNECTED"] }, "UNKNOWN"],
  ["unexpected explicit blocker cannot become ready", { blockers: ["FUTURE_REQUIREMENT"] }, "BLOCKED"],
];
for (const [name, changes, status] of storeCases) {
  test(name, () => assert.equal(storeHealth(changes).status, status));
}

test("store recovery overrides older authentication warnings", () => {
  assert.equal(storeHealth({ status: "NEED_LOGIN" }, { ...session, authRecoveryInProgress: true }).status, "RECOVERING");
});

test("ready connection does not claim rollout eligibility or complete mapping", () => {
  assert.equal(storeHealth().status, "READY");
  assert.equal(storeHealth().recommendedAction, "No action is needed for the connection. Existing rollout limits still apply.");
});

test("all seven statuses have stable labels and actionable human wording", () => {
  const results = [accountHealth(), accountHealth({ healthStatus: "CONFIG_ERROR" }),
    accountHealth({ healthStatus: "AUTH_REQUIRED" }), accountHealth({ activeJobRisk: "WARNING" }),
    accountHealth({ status: "DISABLED" }), accountHealth({ authRecoveryInProgress: true }), accountHealth({ liveMirror: undefined })];
  assert.deepEqual(results.map(({ status, label, tone }) => ({ status, label, tone })), [
    { status: "READY", label: "Ready", tone: "success" },
    { status: "NEED_SETUP", label: "Needs setup", tone: "warning" },
    { status: "LOGIN_REQUIRED", label: "Login required", tone: "danger" },
    { status: "DEGRADED", label: "Degraded", tone: "warning" },
    { status: "BLOCKED", label: "Blocked", tone: "danger" },
    { status: "RECOVERING", label: "Recovering", tone: "warning" },
    { status: "UNKNOWN", label: "Unknown", tone: "neutral" },
  ]);
  for (const result of results) {
    assert.ok(result.reason.length > 20);
    assert.ok(result.recommendedAction.length > 20);
    assert.doesNotMatch(result.reason + result.recommendedAction, /AUTH_REQUIRED|PROFILE_LOCK|CHROMIUM|lease|coordinator/);
  }
  assert.equal(accountHealth({ healthStatus: "AUTH_REQUIRED" }).reason, "LINE login has expired or needs confirmation.");
  assert.equal(accountHealth({ healthStatus: "AUTH_REQUIRED" }).recommendedAction, "Reconnect LINE using the account that has access to the intended stores.");
  assert.equal(accountHealth({ liveMirror: undefined }).reason, "A recent observation of the sync browser is unavailable.");
  assert.equal(accountHealth({ authRecoveryInProgress: true }).recommendedAction, "Wait for recovery to finish before trying again.");
});

test("unknown technical details are not echoed and inputs stay unchanged", () => {
  const input = structuredClone({ ...session, healthFailureStage: "UNRECOGNIZED_INTERNAL_DETAIL" });
  const before = structuredClone(input);
  const result = getOverallHealth(Object.freeze(input), now);
  assert.equal(result.status, "UNKNOWN");
  assert.doesNotMatch(result.reason + result.recommendedAction, /UNRECOGNIZED_INTERNAL_DETAIL/);
  assert.deepEqual(input, before);
  assert.deepEqual(getOverallHealth(session, now), accountHealth());
});
