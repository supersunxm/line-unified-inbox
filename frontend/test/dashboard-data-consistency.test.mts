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

test("dashboard hero renders streamlined 4-level executive overview and removes duplicate store lists", () => {
  const heroCode = readFileSync(new URL("../src/app/dashboard/executive-hero.tsx", import.meta.url), "utf8");

  // ExecutiveHero integrated into dashboard-view
  assert.match(dashboardViewCode, /<ExecutiveHero/);

  // LEVEL 1: Single row 5 KPI cards
  assert.match(heroCode, /grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4/);
  assert.match(heroCode, /\{t\.messagesToday\}/);
  assert.match(heroCode, /\{t\.pending\}/);
  assert.match(heroCode, /\{t\.slaAchievement\}/);
  assert.match(heroCode, /\{t\.storesCritical\}/);
  assert.match(heroCode, /\{t\.followers\}/);

  // LEVEL 2: Operational Trend (60% 7-day trend / 40% reply status donut)
  assert.match(heroCode, /\{t\.volumeTrend\}/);
  assert.match(heroCode, /\{t\.replyStatusDonut\}/);
  assert.match(heroCode, /\{t\.notReplied\}/);
  assert.match(heroCode, /\{t\.notifiedBm\}/);
  assert.match(heroCode, /\{t\.replied\}/);

  // LEVEL 3: Followers by Store Top 10 vs Bottom 10
  assert.match(heroCode, /\{t\.followersByStore\}/);
  assert.match(heroCode, /\{t\.top10Stores\}/);
  assert.match(heroCode, /\{t\.bottom10Stores\}/);

  // LEVEL 4: Follower Distribution Summary
  assert.match(heroCode, /\{t\.followerDistribution\}/);
  assert.match(heroCode, /\{t\.top10Avg\}/);
  assert.match(heroCode, /\{t\.bottom10Avg\}/);
  assert.match(heroCode, /\{t\.ratioGap\}/);
  assert.match(heroCode, /ratioGap > 0 \? `\$\{ratioGap\}x` : "-"/);

  // Preserved below-hero sections
  assert.match(dashboardViewCode, /<CustomerDemandSignals/);
  assert.match(dashboardViewCode, /<StorePerformanceOverview/);
  assert.match(dashboardViewCode, /<MessageOverviewCard/);
  assert.match(dashboardViewCode, /<ResponseRateCard/);
  assert.match(dashboardViewCode, /<DashboardDataQualityCard/);
  assert.match(dashboardViewCode, /<AdminActivityHistoryCard/);
  assert.match(dashboardViewCode, /<StoreQuickViewDrawer/);

  // Removed duplicated hero store list cards from dashboard rendering
  assert.doesNotMatch(dashboardViewCode, /<TodayActionCenter/);
  assert.doesNotMatch(dashboardViewCode, /<AiRootCauseAnalysisPanel/);
  assert.doesNotMatch(dashboardViewCode, /<AiActionCenterPanel/);
  assert.doesNotMatch(dashboardViewCode, /<AiImpactDashboardPanel/);
  assert.doesNotMatch(dashboardViewCode, /<AiOperationalMemoryPanel/);
  assert.doesNotMatch(dashboardViewCode, /<AiExecutiveDailyBrief/);
  assert.doesNotMatch(dashboardViewCode, /<AiBiAssistantPanel/);
  assert.doesNotMatch(dashboardViewCode, /<OperationalInsightCard/);
});

