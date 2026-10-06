import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type {
  LineChatFleetReadinessStore,
  LineChatOperationsSession,
  LineChatOperationsHealth,
  LineChatSafeJobFailure,
} from "../src/lib/api.ts";
import {
  buildLineChatOverview,
  sessionBrowserLabel,
  sessionWorkLabel,
} from "../src/app/operations/line-chat-health/line-chat-health-overview.ts";
import {
  getLineChatUiHealth,
  summarizeLineChatUiHealth,
} from "../src/app/operations/line-chat-health/line-chat-health-status.ts";
const now = Date.parse("2026-10-06T08:00:00Z");
const session: LineChatOperationsSession = {
  id: "session",
  sessionKey: "account-1",
  displayName: "Account",
  status: "ACTIVE",
  healthStatus: "CONNECTED",
  healthFailureStage: null,
  consecutiveAuthFailures: 0,
  mappedOaCount: 6,
  enabledOaCount: 6,
  activeProfileLeases: 0,
  activeLeaseOperation: null,
  browserState: "AVAILABLE",
  browserOperationKind: null,
  browserBusyUntil: null,
  lastAuthenticatedAt: null,
  lastSuccessfulRequestAt: null,
  lastAuthFailureAt: null,
  healthLastCheckedAt: new Date(now).toISOString(),
  healthLastHealthyAt: new Date(now).toISOString(),
  jobs: {
    pending: 0,
    processing: 0,
    success: 1,
    superseded: 0,
    total: 1,
    failed: 0,
    failedAuth: 0,
  },
  recentFailures: [],
  liveMirror: {
    telemetryStatus: "FRESH",
    profile: "A",
    mappedStores: 6,
    browser: "RUNNING",
    observedAt: new Date(now).toISOString(),
    completedAt: null,
    schedulerRunning: true,
    cycle: {
      attempted: 6,
      succeeded: 6,
      failed: 0,
      partial: 0,
      durationMs: 1000,
    },
  },
};
const store: LineChatFleetReadinessStore = {
  lineOfficialAccountId: "oa",
  lineOfficialAccountName: "OA",
  storeId: "store",
  storeName: "Store",
  storeCode: "20789",
  status: "READY",
  blockers: [],
  hasChatBotId: true,
  sessionKey: "account-1",
  sessionStatus: "ACTIVE",
  sessionHealthStatus: "CONNECTED",
  oaHealthStatus: "CONNECTED",
  mappedConversations: 0,
  totalConversations: 1,
  mappingCoveragePercent: 0,
  currentlyPilotEligible: false,
};

const failure: LineChatSafeJobFailure = {
  jobId: "j",
  oaId: "oa",
  oaName: "Store",
  failureCategory: "TIMEOUT",
  failureStage: "TIMEOUT",
  attemptCount: 1,
  createdAt: new Date(now).toISOString(),
  updatedAt: new Date(now).toISOString(),
  conversationId: null,
  recommendedAction: "RETRY_RECOMMENDED",
  isAutoFixable: true,
  resolutionState: "ACTIVE",
  isActionable: true,
};
function report(
  changes: Partial<LineChatOperationsHealth> = {},
): LineChatOperationsHealth {
  return {
    timestamp: new Date(now).toISOString(),
    sessions: [session],
    queue: session.jobs,
    mapping: {
      mappedReadyPending: 0,
      waitingForMapping: 0,
      oldestPendingAt: null,
    },
    rollout: {
      totalOas: 1,
      enabledOas: 1,
      disabledOas: 0,
      missingChatBotId: 0,
      missingSession: 0,
    },
    fleetReadiness: {
      generatedAt: new Date(now).toISOString(),
      summary: {
        totalStores: 999,
        ready: 999,
        needBotMapping: 0,
        needLogin: 0,
        blocked: 0,
        currentlyPilotEligible: 0,
      },
      stores: [store],
    },
    ...changes,
  };
}
test("six summaries count UI-ready sessions and stores from rows, not raw summary counters", () => {
  const overview = buildLineChatOverview(report(), now);
  assert.deepEqual(
    overview.cards.map((card) => card.title),
    [
      "Overall Status",
      "Live Mirror",
      "LINE Sessions",
      "Store Readiness",
      "Mapping Backlog",
      "Recent Issues",
    ],
  );
  assert.equal(overview.cards[2].value, "1 / 1 ready");
  assert.equal(overview.cards[3].value, "1 / 1 ready");
  assert.ok(overview.cards.every((card) => card.supporting.length <= 2));
  assert.equal(overview.overall.status, "READY");
  assert.deepEqual(overview.attention, []);
  assert.match(overview.emptyAttentionText, /healthy/);
});
test("historical resolved failures never trigger attention or unhealthy summaries", () => {
  const historical = {
    ...failure,
    resolutionState: "HISTORICAL" as const,
    isActionable: true,
  };
  const overview = buildLineChatOverview(
    report({
      sessions: [
        {
          ...session,
          jobs: { ...session.jobs, failed: 100, failedAuth: 5 },
          historicalFailures: 105,
          recentFailures: [historical],
        },
      ],
    }),
    now,
  );
  assert.equal(overview.activeIssueCount, 0);
  assert.equal(overview.currentIssues.length, 0);
  assert.equal(overview.historicalIssues.length, 1);
  assert.equal(overview.overall.status, "READY");
  assert.equal(overview.attention.length, 0);
});
for (const [name, changes, status] of [
  ["login", { healthStatus: "AUTH_REQUIRED" }, "LOGIN_REQUIRED"],
  [
    "recovering",
    { healthStatus: "AUTH_REQUIRED", authRecoveryInProgress: true },
    "RECOVERING",
  ],
  ["blocked", { status: "DISABLED" }, "BLOCKED"],
  [
    "degraded mirror",
    { liveMirror: { ...session.liveMirror!, browser: "STOPPED" } },
    "DEGRADED",
  ],
] as Array<[string, Partial<LineChatOperationsSession>, string]>) {
  test(`${name} appears with unified status and guidance`, () => {
    const changed = { ...session, ...changes };
    const overview = buildLineChatOverview(
      report({ sessions: [changed] }),
      now,
    );
    assert.equal(overview.attention[0].health.status, status);
    assert.deepEqual(
      overview.attention[0].health,
      getLineChatUiHealth({ kind: "session", session: changed }, now),
    );
    assert.equal(overview.overall.status, status);
  });
}
test("pending mapping is current attention without changing store eligibility", () => {
  const data = report({
    mapping: {
      waitingForMapping: 3,
      mappedReadyPending: 2,
      oldestPendingAt: null,
    },
  });
  const copy = structuredClone(data);
  const overview = buildLineChatOverview(data, now);
  assert.equal(overview.cards[4].value, "3 waiting");
  assert.equal(overview.cards[4].health.status, "NEED_SETUP");
  assert.equal(overview.attention[0].target, "mapping");
  assert.deepEqual(data, copy);
});
test("blocked stores are grouped without altering PR1 readiness decisions", () => {
  const stores = [
    store,
    {
      ...store,
      lineOfficialAccountId: "oa2",
      oaHealthStatus: "OA_ACCESS_LOST",
    },
    {
      ...store,
      lineOfficialAccountId: "oa3",
      oaHealthStatus: "OA_ACCESS_LOST",
    },
  ];
  const overview = buildLineChatOverview(
    report({ fleetReadiness: { ...report().fleetReadiness, stores } }),
    now,
  );
  assert.equal(overview.cards[3].value, "1 / 3 ready");
  assert.equal(overview.overall.status, "BLOCKED");
  assert.equal(overview.attention.length, 1);
  assert.match(overview.attention[0].title, /2 stores/);
  assert.match(overview.attention[0].health.recommendedAction, /access/);
});
test("only explicitly current actionable records count, without double counting aggregate totals", () => {
  const overview = buildLineChatOverview(
    report({
      sessions: [
        {
          ...session,
          activeActionableFailures: 4,
          recentFailures: [
            failure,
            { ...failure, jobId: "history", resolutionState: "HISTORICAL" },
            { ...failure, jobId: "unknown", resolutionState: undefined },
            { ...failure, jobId: "not-actionable", isActionable: false },
          ],
        },
      ],
    }),
    now,
  );
  assert.equal(overview.activeIssueCount, 4);
  assert.equal(overview.currentIssues.length, 1);
  assert.equal(overview.historicalIssues.length, 1);
  assert.equal(overview.otherIssues.length, 2);
  assert.equal(overview.overall.status, "DEGRADED");
  assert.match(overview.attention[0].title, /4 current issues/);
});
test("unconfirmed status never gets a falsely healthy empty state", () => {
  const overview = buildLineChatOverview(
    report({ sessions: [{ ...session, liveMirror: undefined }] }),
    now,
  );
  assert.equal(overview.overall.status, "UNKNOWN");
  assert.equal(overview.attention.length, 0);
  assert.doesNotMatch(overview.emptyAttentionText, /healthy/);
});
test("aggregate status follows the unchanged PR1 precedence independent of input order", () => {
  const data = [
    getLineChatUiHealth(
      {
        kind: "session",
        session: { ...session, authRecoveryInProgress: true },
      },
      now,
    ),
    getLineChatUiHealth(
      {
        kind: "session",
        session: { ...session, healthStatus: "AUTH_REQUIRED" },
      },
      now,
    ),
    getLineChatUiHealth(
      { kind: "session", session: { ...session, status: "DISABLED" } },
      now,
    ),
  ];
  assert.equal(summarizeLineChatUiHealth(data).status, "BLOCKED");
  assert.equal(summarizeLineChatUiHealth(data.reverse()).status, "BLOCKED");
});
test("session primary browser and work text is human readable", () => {
  assert.equal(
    sessionBrowserLabel({ ...session, browserState: "BUSY" }),
    "In use",
  );
  assert.equal(
    sessionWorkLabel({ ...session, activeLeaseOperation: "MIRROR_SYNC" }),
    "Syncing store chats",
  );
  assert.equal(
    sessionWorkLabel({ ...session, activeLeaseOperation: "FUTURE_CODE" }),
    "Account operation in progress",
  );
  assert.equal(
    sessionWorkLabel({ ...session, authRecoveryInProgress: true }),
    "Login recovery in progress",
  );
});
const view = readFileSync(
  new URL(
    "../src/app/operations/line-chat-health/line-chat-health-view.tsx",
    import.meta.url,
  ),
  "utf8",
);
test("PR3 preserves the PR486 header, overview and session presentation exactly", () => {
  const start = view.indexOf("        <PageHeader");
  const end = view.indexOf("        {report && <LineChatStoreReadiness");
  assert.ok(start >= 0 && end > start);
  assert.equal(
    createHash("sha256").update(view.slice(start, end)).digest("hex"),
    "72363f2b00c5d8490d454b1159c5c2bd1e3b8cb3f54eeb5837126045d91c008d",
  );
});
test("refresh and all existing retry/recovery attachment controls are preserved", () => {
  assert.match(view, /onClick=\{\(\) => void load\(\)\}/);
  assert.match(view, /data-session-actions=\{session.sessionKey\}/);
  assert.match(view, /executeTryRememberedLogin\(session.sessionKey\)/);
  assert.match(view, /setLegacyRetryTarget\(session\)/);
  for (const file of [
    "line-chat-novnc-recovery-action.tsx",
    "line-chat-pending-control-action.tsx",
  ]) {
    const control = readFileSync(
      new URL(
        `../src/app/operations/line-chat-health/${file}`,
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(control, /element.dataset.sessionActions/);
    assert.match(control, /if \(cardTarget\) return cardTarget/);
  }
});
