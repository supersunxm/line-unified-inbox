import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { belowTarget24, rateBandOf, rateBands, splitByChatData, storesCsv, storesPassing24 } from "../src/lib/metrics/dashboard-model.ts";
import { FOLLOWER_MIN_BASE, followerDays, followerMovers, storeFollowerChanges, storesSeenBy, type FollowerAccountDay } from "../src/lib/metrics/followers.ts";
import { buildStoreRows, type MonthSummary, type RateResponse, type StoreInfo } from "../src/lib/metrics/store-model.ts";
import { countState, rateState } from "../src/lib/metrics/value-state.ts";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

// Synthetic fixtures only.
const rate = (within: number, total: number) => ({ rate24: rateState(within, total) });

test("24h-rate bands: <50 · 50–70 · 70–90 · ≥90 · small sample; no chats counted apart", () => {
  assert.equal(rateBandOf(rate(40, 100)), "lt50");
  assert.equal(rateBandOf(rate(50, 100)), "50to70");
  assert.equal(rateBandOf(rate(70, 100)), "70to90");
  assert.equal(rateBandOf(rate(89, 100)), "70to90");
  assert.equal(rateBandOf(rate(90, 100)), "ge90");
  assert.equal(rateBandOf(rate(0, 20)), "lt50", "a measured 0% is a rate");
  assert.equal(rateBandOf(rate(9, 9)), "low", "n below MIN_RATE_SAMPLE");
  assert.equal(rateBandOf(rate(0, 0)), null, "no customer chats: not a band");
  assert.deepEqual(rateBands([rate(40, 100), rate(95, 100), rate(91, 100), rate(3, 4), rate(0, 0), { rate24: { kind: "loading" } }]), { lt50: 1, "50to70": 0, "70to90": 0, ge90: 2, low: 1, noChats: 1 });
});

test("stores meeting the 24h target: X of the stores with enough sample", () => {
  assert.deepEqual(storesPassing24([rate(90, 100), rate(89, 100), rate(9, 9), rate(0, 0)]), { count: 1, total: 2 });
  assert.equal(belowTarget24(rate(89, 100)), true);
  assert.equal(belowTarget24(rate(5, 9)), false, "a small sample is never 'below target'");
  assert.equal(belowTarget24(rate(90, 100)), false);
});

const summary: MonthSummary = {
  overview: { total: 30, notReplied: 4, notifiedBm: 0, replied: 26 },
  stores: [
    { storeId: "a", storeName: "Alpha, \"East\"", total: 30, notReplied: 4, notifiedBm: 0, replied: 26 },
    { storeId: "b", storeName: "Beta", total: 0, notReplied: 0, notifiedBm: 0, replied: 0 },
  ],
};
const stores: StoreInfo[] = [
  { id: "a", name: "Alpha, \"East\"", region: "Eastern", province: "Chonburi", lineOaCount: 1 },
  { id: "b", name: "Beta", region: null, province: null, lineOaCount: 1 },
];
const rates: RateResponse = { overview: { total: 20, within24h: 18 }, stores: [{ storeId: "a", total: 20, within24h: 18 }] };

test("store table: stores without chat data go to the bottom; CSV is store-level, unknown is empty (never 0)", () => {
  const rows = buildStoreRows({ stores, current: { data: summary }, previous: { data: null, collected: false }, rates: { data: rates }, previousRates: { data: null, collected: false } });
  const split = splitByChatData(rows);
  assert.deepEqual(split.withData.map((row) => row.storeId), ["a"]);
  assert.deepEqual(split.withoutData.map((row) => row.storeId), ["b"]);
  const csv = storesCsv(rows, new Map([["a", { storeId: "a", storeName: "Alpha", base: 500, adds: 12, blocks: 2, net: 10 }]]));
  const lines = csv.replace(/^﻿/, "").trim().split("\n");
  assert.equal(lines[0], "สาขา,ภาค,จังหวัด,แชท,ยังไม่ตอบ,ตอบแล้ว %,ตอบใน 24 ชม. %,ตอบใน 24 ชม. (n),Δ จุด (24 ชม.),ผู้ติดตามสุทธิ");
  assert.equal(lines[1], "\"Alpha, \"\"East\"\"\",ภาคตะวันออก,ชลบุรี,30,4,86.7,90,20,,10", "previous period not collected → empty Δ");
  assert.equal(lines[2], "Beta,,,0,0,,,,,", "a measured 0 chats is 0; rates with no chats and unknown followers are empty");
  assert.ok(storesCsv(rows, null, "en").includes("Store,Region,Province"));
});

test("followers: net = Δfollowers − Δblocks per store over OAs ready on both days; movers exclude small and new stores", () => {
  const day = (lineOaId: string, storeId: string, followers: number | null, blocks: number | null): FollowerAccountDay => ({ lineOaId, storeId, storeName: storeId.toUpperCase(), followers, blocks, status: followers === null ? "missing" : "ready" });
  const baseline = [day("oa1", "a", 1000, 100), day("oa2", "a", 200, 10), day("oa3", "b", 50, 0), day("oa4", "c", 400, 40), day("oa5", "d", 900, 90), day("oa6", "e", null, null)];
  const target = [day("oa1", "a", 1100, 110), day("oa2", "a", 190, 20), day("oa3", "b", 80, 0), day("oa4", "c", 380, 50), day("oa5", "d", 1000, 90), day("oa6", "e", 300, 0)];
  const changes = storeFollowerChanges(baseline, target);
  assert.deepEqual(changes.get("a"), { storeId: "a", storeName: "A", base: 1200, adds: 90, blocks: 20, net: 70 });
  assert.equal(changes.get("b")?.net, 30);
  assert.equal(changes.get("c")?.net, -30);
  assert.equal(changes.has("e"), false, "no baseline snapshot: no change, never 0");
  const seen = storesSeenBy([day("x", "a", 900, 0), day("y", "b", 40, 0), day("z", "c", 300, 0)]);
  const movers = followerMovers(changes, seen);
  assert.deepEqual(movers.growers.map((row) => row.storeId), ["a"], "b has fewer than FOLLOWER_MIN_BASE; d is new (not seen 30 days before)");
  assert.deepEqual(movers.decliners.map((row) => row.storeId), ["c"]);
  assert.deepEqual(movers.gained, { total: 200, stores: 3 });
  assert.deepEqual(movers.lost, { total: 30, stores: 1 });
  assert.equal(movers.excluded, 2);
  assert.equal(FOLLOWER_MIN_BASE, 100);
  assert.deepEqual(followerMovers(changes, seen, { inScope: new Set(["c"]) }).gained, { total: 0, stores: 0 });
});

test("follower dates: the day before day 1 vs the last day with a snapshot (yesterday for the open month)", () => {
  assert.deepEqual(followerDays({ dateFrom: "2026-10-01", dateTo: "2026-10-08" }, "2026-10-08"), { baseline: "2026-09-30", target: "2026-10-07", seenBy: "2026-08-31" });
  assert.deepEqual(followerDays({ dateFrom: "2026-09-01", dateTo: "2026-09-30" }, "2026-10-08"), { baseline: "2026-08-31", target: "2026-09-30", seenBy: "2026-08-01" });
  assert.equal(followerDays({ dateFrom: "2026-10-01", dateTo: "2026-10-01" }, "2026-10-01"), null, "day 1: no snapshot of the month yet");
});

test("dashboard reads the metrics layer, the /chats month selector and links stores to Store 360", () => {
  const view = read("app/dashboard/dashboard-view.tsx");
  assert.match(view, /<MonthlyDashboard \/>/);
  const dashboard = read("app/dashboard/monthly-dashboard.tsx");
  assert.match(dashboard, /const data = useMonthlyMetrics\(month\);/);
  assert.match(dashboard, /const month = parseV2Month\(params\.get\("month"\)\);/);
  assert.match(dashboard, /<MetricsMonthSelect month=\{month\} \/>/);
  assert.match(read("lib/metrics/links.ts"), /return `\/store-360\?\$\{new URLSearchParams\(\{ storeId, month \}\)\.toString\(\)\}`;/);
  assert.match(dashboard, /import \{ store360Href \} from "@\/lib\/metrics\/links";/);
  assert.match(dashboard, /<section id="stores"/, "Home's ดูทุกสาขา → lands on /dashboard#stores");
  assert.match(dashboard, /<HowCounted kpi="replied" \/>[\s\S]*<HowCounted kpi="rate24" \/>[\s\S]*t\("kpiDifference"\)/);
  assert.match(dashboard, /sortStoreRows\(filterStoreRows\(data\.storeRows, \{ region: region \|\| null, search \}\), "rate24"\)/, "default sort: 24h gap to target, low sample last");
  assert.match(dashboard, /<CountCell value=\{row\.unreplied\} \/>/, "counts neutral");
  const select = read("components/metrics/month-select.tsx");
  assert.match(select, /getChatPeriodOptions\(language\)\.filter\(\(option\) => option\.value !== "all"\)/);
  assert.match(select, /next\.set\("month", event\.target\.value\);/);
});

test("removed from the dashboard: partner table, แจ้งเตือนแล้ว, speed tiers, peak hour, product signals, connection cards, donut", () => {
  const sources = [read("app/dashboard/monthly-dashboard.tsx"), read("app/dashboard/dashboard-view.tsx")].join("\n");
  assert.doesNotMatch(sources, /partner|Partner/);
  assert.doesNotMatch(sources, /แจ้งเตือนแล้ว|bmNotified|NOTIFIED_BM/);
  assert.doesNotMatch(sources, /response-bucket|under4h|avgResponseMinutes|medianResponseMinutes/);
  assert.doesNotMatch(sources, /peakHour|peakWindow|13:00/);
  assert.doesNotMatch(sources, /topProducts|product-interest|customerDemand/);
  assert.doesNotMatch(sources, /connectedStoreCount|ข้อมูลเสถียร/);
  assert.doesNotMatch(sources, /Donut|donut|<circle[^>]*strokeDasharray/);
  assert.doesNotMatch(sources, /storeFollowersRanking|bottom10|สาขาที่ต้องการการดูแล/, "follower-count lists replaced by net movers");
});

test("count state: a known 0 renders 0, an unknown follower net is a reasoned dash", () => {
  assert.equal(countState(0).kind, "true-zero");
  assert.match(read("app/dashboard/monthly-dashboard.tsx"), /\(change \? countState\(change\.net\) : \{ kind: "not-collected" \}\)/);
});

test("the dashboard is already translated: the workspace phrase boundary skips it (no Buddhist-year rewrite)", () => {
  assert.match(read("app/dashboard/monthly-dashboard.tsx"), /<div data-monthly-dashboard data-legacy-i18n-skip /);
  const boundary = read("app/legacy-i18n-boundary.tsx");
  assert.match(boundary, /const SKIP_ATTRIBUTE = "data-legacy-i18n-skip";/);
  assert.match(boundary, /if \(isSkipped\(node\)\) return;/);
  assert.match(boundary, /candidate\.hasAttribute\(SKIP_ATTRIBUTE\) \? NodeFilter\.FILTER_REJECT/);
});
