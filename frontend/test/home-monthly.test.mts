import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DASHBOARD_STORES_HREF, chatsHref, kpiReportHref, store360Href } from "../src/lib/metrics/links.ts";
import { monthWindow, periodDaysLabel } from "../src/lib/metrics/month.ts";
import { systemProblems } from "../src/lib/metrics/system-health.ts";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const page = read("app/home/page.tsx");

test("Home is always the current month: 'ตุลาคม 2026 · 1–8 ต.ค.'", () => {
  const frame = monthWindow("2026-10", Date.parse("2026-10-08T09:42:00+07:00"));
  assert.equal(periodDaysLabel(frame.current), "1–8 ต.ค.");
  assert.equal(periodDaysLabel(frame.current, "en"), "Oct 1–8");
  assert.equal(periodDaysLabel(frame.current, "zh"), "10月1–8日");
  assert.equal(periodDaysLabel(monthWindow("2026-10", Date.parse("2026-10-01T09:00:00+07:00")).current), "1 ต.ค.");
  assert.match(page, /const month = useMemo\(\(\) => currentMonth\(\), \[\]\);/);
  assert.match(page, /const data = useMonthlyMetrics\(month, \{ enabled: Boolean\(authUser\) \}\);/);
  assert.doesNotMatch(page, /MetricsMonthSelect/, "no month selector on Home");
});

test("KPI strip: ตอบแล้ว % · ตอบใน 24 ชม. % (target) · ยังไม่ตอบ (เดือนนี้) · ผู้ติดตามสุทธิ, each with its comparison", () => {
  const tiles = page.match(/<KpiTile label=\{t\("(\w+)"\)\}/g)?.map((tile) => tile.replace(/.*t\("(\w+)"\).*/, "$1"));
  assert.deepEqual(tiles, ["repliedRate", "rate24", "unrepliedThisMonth", "followersNetThisMonth"]);
  assert.match(page, /<DeltaValue state=\{data\.network\.replyRateDelta\} kind="points"/);
  assert.match(page, /<DeltaValue state=\{data\.network\.rate24Delta\} kind="points"[\s\S]*?<TargetText kpi="rate24"/);
  assert.match(page, /<DeltaValue state=\{data\.network\.unrepliedDelta\} kind="count"/, "counts neutral");
  assert.match(page, /<StateValue state=\{data\.network\.unreplied\} \/>/, "the hook's unrepliedCount = the badge's");
  assert.match(page, /const badge = useChatsUnrepliedBadge\(Boolean\(authUser\)\);/);
});

test("สาขาที่ต้องดู: top 5 by unreplied (ties: lower 24h), to Store 360; ดูทุกสาขา → /dashboard#stores", () => {
  assert.match(page, /const watch = storesToWatch\(data\.storeRows\);/);
  assert.match(page, /<Link href=\{store360Href\(row\.storeId, month\)\}/);
  assert.match(page, /<Link href=\{DASHBOARD_STORES_HREF\}/);
  assert.equal(DASHBOARD_STORES_HREF, "/dashboard#stores");
  assert.equal(store360Href("s1", "2026-10"), "/store-360?storeId=s1&month=2026-10");
  assert.equal(chatsHref({ storeId: "s1", month: "2026-10" }), "/chats?storeId=s1&month=2026-10");
  assert.equal(kpiReportHref("2026-10"), "/v2/report?month=2026-10");
  assert.equal(kpiReportHref("2026-10", "s1"), "/v2/report?month=2026-10&store=s1");
});

test("data health: one line to LINE Chat Health, or a banner when backend, database or webhook is down", () => {
  assert.deepEqual(systemProblems({ backendApi: "HEALTHY", database: "HEALTHY", lineWebhookEnabled: true }), []);
  assert.deepEqual(systemProblems({ backendApi: "HEALTHY", database: "ERROR", lineWebhookEnabled: false }), ["database", "webhook"]);
  assert.deepEqual(systemProblems({ backendApi: "", database: "HEALTHY", lineWebhookEnabled: true }), ["backend"], "unknown is not healthy");
  assert.match(page, /\{problems\.length > 0 && \(\n\s*<div role="alert" data-home-system-banner/);
  assert.match(page, /<p data-home-data-health[\s\S]*?<Link href="\/operations\/line-chat-health"[\s\S]*?storeScopeText\(data\.coverage, language\)/);
});

test("three shortcuts only; the quick-access grid, ต้องจัดการ, วันนี้ cards, store/connection/followers totals and the status card are gone", () => {
  const nav = page.slice(page.indexOf("data-home-shortcuts"), page.indexOf("</nav>"));
  assert.equal(nav.match(/<Link /g)?.length, 3);
  assert.match(nav, /t\("shortcutChats"\)[\s\S]*data-home-chats-badge[\s\S]*t\("shortcutKpiReport"\)[\s\S]*t\("shortcutDashboard"\)/);
  for (const removed of [/quickLinks|ModuleGlyph/, /needsAttention|ต้องจัดการ/, /messagesToday|peakHourAnalysis|netToday/, /totalStores|connectedStoreCount|totalFriends/, /StatusRow|executive-store-health|dashboardAnalytics/]) {
    assert.doesNotMatch(page, removed);
  }
});
