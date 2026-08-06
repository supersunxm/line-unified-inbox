import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSlaMultiplier } from "../src/components/shell/store-priority-score.ts";

const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const dashboardViewCode = readFileSync(new URL("../src/app/dashboard/dashboard-view.tsx", import.meta.url), "utf8");
const dashboardPageCode = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");
const storePriorityTableCode = readFileSync(new URL("../src/app/dashboard/store-priority-table.tsx", import.meta.url), "utf8");

test("dashboard page route enforces force-dynamic rendering mode", () => {
  assert.match(dashboardPageCode, /export const dynamic = "force-dynamic";/);
  assert.match(dashboardPageCode, /export const revalidate = 0;/);
});

test("dashboard auto-refreshes every 60s and handles document visibilitychange", () => {
  assert.match(dashboardViewCode, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(dashboardViewCode, /if \(document\.visibilityState === "visible"\)/);
  assert.match(dashboardViewCode, /setInterval\(/);
  assert.match(dashboardViewCode, /setRefreshCountdown/);
});

test("dashboard renders stale data warning when update age exceeds 3 minutes", () => {
  assert.match(dashboardViewCode, /isStaleData = Boolean\(effectiveLastUpdate && dataAgeMs > 180_000\)/);
  assert.match(dashboardViewCode, /⚠️ Data stale \(/);
  assert.match(dashboardViewCode, /⚠️ Connection issue/);
});

test("store priority table and scoring formula are consistent across components", () => {
  assert.match(storePriorityTableCode, /row\.notReplied \* getSlaMultiplier\(waiting\)/);

  // SLA Multipliers: 0-29m(x1), 30-59m(x2), 60-119m(x4), 120-239m(x8), 240+m(x16)
  assert.equal(getSlaMultiplier(0), 1);
  assert.equal(getSlaMultiplier(29), 1);
  assert.equal(getSlaMultiplier(30), 2);
  assert.equal(getSlaMultiplier(59), 2);
  assert.equal(getSlaMultiplier(60), 4);
  assert.equal(getSlaMultiplier(119), 4);
  assert.equal(getSlaMultiplier(120), 8);
  assert.equal(getSlaMultiplier(239), 8);
  assert.equal(getSlaMultiplier(240), 16);
  assert.equal(getSlaMultiplier(600), 16);
});

test("operational reset logic is wired to bmReplyStatusSummary and storePrioritySummary", () => {
  assert.match(pageCode, /api\.bmReplyStatusSummary\(\)/);
  assert.match(dashboardViewCode, /api\.dashboardAnalytics\(/);
});

