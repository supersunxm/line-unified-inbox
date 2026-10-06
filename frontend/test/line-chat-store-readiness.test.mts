import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type {
  LineChatFleetReadinessStore,
  LineChatOperationsHealth,
  LineChatOperationsSession,
} from "../src/lib/api.ts";
import {
  buildStoreRows,
  DEFAULT_STORE_CONTROLS,
  filterStoreRows,
  storeFilterCounts,
} from "../src/app/operations/line-chat-health/line-chat-store-readiness-model.ts";
import { getLineChatUiHealth } from "../src/app/operations/line-chat-health/line-chat-health-status.ts";

const session: LineChatOperationsSession = {
  id: "s1",
  sessionKey: "account-1",
  displayName: "Sunn-OBS",
  status: "ACTIVE",
  healthStatus: "CONNECTED",
  healthFailureStage: null,
  consecutiveAuthFailures: 0,
  mappedOaCount: 2,
  enabledOaCount: 2,
  activeProfileLeases: 0,
  activeLeaseOperation: null,
  browserState: "AVAILABLE",
  browserOperationKind: null,
  browserBusyUntil: null,
  lastAuthenticatedAt: null,
  lastSuccessfulRequestAt: null,
  lastAuthFailureAt: null,
  healthLastCheckedAt: "2026-10-06T10:00:00Z",
  healthLastHealthyAt: null,
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
};
const store: LineChatFleetReadinessStore = {
  lineOfficialAccountId: "oa1",
  lineOfficialAccountName: "OA Chonburi",
  storeId: "s1",
  storeName: "RBS Chonburi",
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
const stores: LineChatFleetReadinessStore[] = [
  store,
  {
    ...store,
    lineOfficialAccountId: "setup",
    storeName: "Central Setup",
    storeCode: "10002",
    hasChatBotId: false,
    status: "NEED_BOT_MAPPING",
    currentlyPilotEligible: false,
  },
  {
    ...store,
    lineOfficialAccountId: "login",
    storeName: "Login Store",
    storeCode: "10003",
    status: "NEED_LOGIN",
    sessionHealthStatus: "AUTH_REQUIRED",
    currentlyPilotEligible: false,
  },
  {
    ...store,
    lineOfficialAccountId: "blocked",
    storeName: "Access Store",
    storeCode: "10004",
    oaHealthStatus: "OA_ACCESS_LOST",
    currentlyPilotEligible: false,
  },
  {
    ...store,
    lineOfficialAccountId: "degraded",
    storeCode: "10005",
    oaHealthStatus: "DEGRADED",
    currentlyPilotEligible: false,
  },
  {
    ...store,
    lineOfficialAccountId: "recovering",
    storeCode: "10006",
    sessionKey: "profile-b",
    status: "NEED_LOGIN",
    sessionHealthStatus: "AUTH_REQUIRED",
    currentlyPilotEligible: false,
  },
  {
    ...store,
    lineOfficialAccountId: "unknown",
    storeCode: "10007",
    sessionHealthStatus: "UNKNOWN",
    currentlyPilotEligible: false,
  },
];
function report(
  items = stores,
  sessions = [
    session,
    { ...session, sessionKey: "profile-b", authRecoveryInProgress: true },
  ],
): LineChatOperationsHealth {
  return {
    timestamp: session.healthLastCheckedAt!,
    sessions,
    queue: session.jobs,
    mapping: {
      mappedReadyPending: 0,
      waitingForMapping: 0,
      oldestPendingAt: null,
    },
    rollout: {
      totalOas: items.length,
      enabledOas: items.length,
      disabledOas: 0,
      missingChatBotId: 1,
      missingSession: 0,
    },
    fleetReadiness: {
      generatedAt: session.healthLastCheckedAt!,
      summary: {
        totalStores: items.length,
        ready: 1,
        needBotMapping: 1,
        needLogin: 2,
        blocked: 1,
        currentlyPilotEligible: 1,
      },
      stores: items,
    },
  };
}

test("store filter counts use unified statuses over the complete fleet", () => {
  const rows = buildStoreRows(report());
  assert.deepEqual(
    rows.map((row) => row.health.status),
    [
      "READY",
      "NEED_SETUP",
      "LOGIN_REQUIRED",
      "BLOCKED",
      "DEGRADED",
      "RECOVERING",
      "UNKNOWN",
    ],
  );
  assert.deepEqual(storeFilterCounts(rows), {
    ALL: 7,
    READY: 1,
    NEED_SETUP: 1,
    LOGIN_REQUIRED: 1,
    BLOCKED: 1,
  });
  for (const status of [
    "READY",
    "NEED_SETUP",
    "LOGIN_REQUIRED",
    "BLOCKED",
  ] as const) {
    assert.equal(
      filterStoreRows(rows, { ...DEFAULT_STORE_CONTROLS, status }).length,
      1,
    );
  }
  assert.deepEqual(storeFilterCounts([]), {
    ALL: 0,
    READY: 0,
    NEED_SETUP: 0,
    LOGIN_REQUIRED: 0,
    BLOCKED: 0,
  });
});
test("search matches trimmed case-insensitive store names and codes, and combines with filters", () => {
  const rows = buildStoreRows(report());
  assert.equal(
    filterStoreRows(rows, {
      ...DEFAULT_STORE_CONTROLS,
      search: "  rBs ChOn  ",
    })[0]?.store.lineOfficialAccountId,
    "oa1",
  );
  assert.equal(
    filterStoreRows(rows, { ...DEFAULT_STORE_CONTROLS, search: "10003" })[0]
      ?.health.status,
    "LOGIN_REQUIRED",
  );
  assert.equal(
    filterStoreRows(rows, {
      ...DEFAULT_STORE_CONTROLS,
      search: "10003",
      status: "READY",
    }).length,
    0,
  );
  assert.equal(
    filterStoreRows(rows, { ...DEFAULT_STORE_CONTROLS, search: "no match" })
      .length,
    0,
  );
});
test("actionable includes setup/login/blocked/degraded/recovery, with backend pilot eligibility unchanged", () => {
  const rows = buildStoreRows(report());
  assert.deepEqual(
    filterStoreRows(rows, {
      ...DEFAULT_STORE_CONTROLS,
      actionableOnly: true,
    }).map((row) => row.health.status),
    ["NEED_SETUP", "LOGIN_REQUIRED", "BLOCKED", "DEGRADED", "RECOVERING"],
  );
  assert.deepEqual(
    filterStoreRows(rows, { ...DEFAULT_STORE_CONTROLS, pilotOnly: true }).map(
      (row) => row.store.lineOfficialAccountId,
    ),
    ["oa1"],
  );
  assert.equal(
    filterStoreRows(rows, {
      ...DEFAULT_STORE_CONTROLS,
      pilotOnly: true,
      actionableOnly: true,
    }).length,
    0,
  );
  const readyNotPilot = buildStoreRows(
    report([{ ...store, currentlyPilotEligible: false }]),
  );
  assert.equal(readyNotPilot[0].health.status, "READY");
  assert.equal(
    filterStoreRows(readyNotPilot, {
      ...DEFAULT_STORE_CONTROLS,
      pilotOnly: true,
    }).length,
    0,
  );
});
test("PR482 precedence is delegated unchanged, including blocked > recovering > setup > login", () => {
  const combinations = stores.concat([
    {
      ...store,
      hasChatBotId: false,
      status: "NEED_LOGIN",
      sessionKey: "profile-b",
      oaHealthStatus: "OA_ACCESS_LOST",
    },
    {
      ...store,
      hasChatBotId: false,
      status: "NEED_LOGIN",
      sessionKey: "profile-b",
    },
    { ...store, hasChatBotId: false, status: "NEED_LOGIN" },
  ]);
  const input = report(combinations);
  const before = structuredClone(input);
  const rows = buildStoreRows(input);
  rows.forEach((row) =>
    assert.deepEqual(
      row.health,
      getLineChatUiHealth({
        kind: "store",
        store: row.store,
        session: row.session,
      }),
    ),
  );
  assert.deepEqual(
    rows.slice(-3).map((row) => row.health.status),
    ["BLOCKED", "RECOVERING", "NEED_SETUP"],
  );
  assert.deepEqual(input, before);
});
test("coverage preserves API percentages and counts, clamps only the visual bar, and represents absent coverage", () => {
  for (const [mapped, total, percent, progress] of [
    [3, 4, 75, 75],
    [1, 3, 33.3, 33.3],
    [0, 4, 0, 0],
    [4, 4, 100, 100],
    [0, 0, null, 0],
    [5, 4, 125, 100],
    [0, 4, -5, 0],
  ] as const) {
    const row = buildStoreRows(
      report([
        {
          ...store,
          mappedConversations: mapped,
          totalConversations: total,
          mappingCoveragePercent: percent,
        },
      ]),
    )[0];
    assert.deepEqual(row.coverage, { percent, progress });
    assert.equal(row.store.mappedConversations, mapped);
    assert.equal(row.store.totalConversations, total);
  }
});
test("details retain original diagnostics and refreshing replaces the selected row data without writes", () => {
  const original = report([
    {
      ...store,
      blockers: ["MANAGER_AUTH", "MISSING_CHAT_BOT_ID"],
      hasChatBotId: false,
    },
  ]);
  const before = structuredClone(original);
  const row = buildStoreRows(original)[0];
  assert.equal(row.store, original.fleetReadiness.stores[0]);
  assert.equal(row.session, original.sessions[0]);
  assert.equal(row.lastChecked, session.healthLastCheckedAt);
  assert.deepEqual(row.store.blockers, ["MANAGER_AUTH", "MISSING_CHAT_BOT_ID"]);
  assert.deepEqual(original, before);
  assert.equal(buildStoreRows(report([store]))[0].health.status, "READY");
});
test("all seven UI statuses provide the intended operator entry action", () => {
  assert.deepEqual(
    buildStoreRows(report()).map((row) => row.action),
    ["View", "Fix setup", "Reconnect", "Resolve", "Resolve", "View", "View"],
  );
});
test("details panel keeps diagnostics scoped and hands off to existing controls without new API calls", () => {
  const source = readFileSync(
    new URL(
      "../src/app/operations/line-chat-health/line-chat-store-details.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /Technical blockers/);
  assert.match(source, /store\.blockers\.map/);
  assert.match(source, /onSession\(store\.sessionKey!/);
  assert.match(source, /onMapping\(\)/);
  assert.match(source, /href="\/storemanagement"/);
  assert.match(source, /ID is not included in the health report/);
  assert.doesNotMatch(source, /\bapi\.|fetch\(/);
});
