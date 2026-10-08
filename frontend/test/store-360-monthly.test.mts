import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildReportSummary } from "../src/lib/metrics/report-summary.ts";
import { buildStoreRows, type MonthSummary, type RateResponse, type StoreInfo } from "../src/lib/metrics/store-model.ts";
import { customerTagMix, LAST_STORE_KEY, rate24Rank, readLastStore, storeToOpen, tagValueLabel, writeLastStore } from "../src/lib/metrics/store-view.ts";
import { monthWindow } from "../src/lib/metrics/month.ts";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const view = read("app/store-360/store-360-monthly.tsx");

// Synthetic fixtures only.
const summary: MonthSummary = {
  overview: { total: 0, notReplied: 0, notifiedBm: 0, replied: 0 },
  stores: [
    { storeId: "a", storeName: "Alpha", total: 40, notReplied: 4, notifiedBm: 0, replied: 36 },
    { storeId: "b", storeName: "Beta", total: 30, notReplied: 2, notifiedBm: 0, replied: 28 },
    { storeId: "c", storeName: "Gamma", total: 20, notReplied: 6, notifiedBm: 0, replied: 14 },
    { storeId: "d", storeName: "Delta", total: 5, notReplied: 1, notifiedBm: 0, replied: 4 },
  ],
};
const stores: StoreInfo[] = ["a", "b", "c", "d"].map((id) => ({ id, name: id, region: null, province: null, lineOaCount: 1 }));
const rates: RateResponse = { overview: { total: 0, within24h: 0 }, stores: [{ storeId: "a", total: 30, within24h: 27 }, { storeId: "b", total: 20, within24h: 18 }, { storeId: "c", total: 20, within24h: 10 }, { storeId: "d", total: 5, within24h: 5 }] };
const rows = buildStoreRows({ stores, current: { data: summary }, previous: { data: null, collected: false }, rates: { data: rates }, previousRates: { data: null, collected: false } });

test("อันดับ X จาก N: 24h rate among stores above the sample minimum; ties share a rank", () => {
  assert.deepEqual(rate24Rank(rows, "a"), { rank: 1, total: 3 });
  assert.deepEqual(rate24Rank(rows, "b"), { rank: 1, total: 3 }, "90% = 90%");
  assert.deepEqual(rate24Rank(rows, "c"), { rank: 3, total: 3 });
  assert.equal(rate24Rank(rows, "d"), null, "n=5 is not ranked");
});

test("/store-360 without a store: the last viewed store if in scope, never an arbitrary store; storage errors are safe", () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
  assert.equal(readLastStore(storage), null);
  writeLastStore(storage, "c");
  assert.equal(memory.get(LAST_STORE_KEY), "c");
  assert.equal(storeToOpen(readLastStore(storage), rows), "c");
  assert.equal(storeToOpen("gone", rows), null, "a store no longer in scope opens the picker");
  assert.equal(storeToOpen(null, rows), null);
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(readLastStore(blocked), null);
  assert.doesNotThrow(() => writeLastStore(blocked, "a"));
  assert.equal(readLastStore(null), null);
});

test("customers and sales from name tags: products, channels, payment/finance; never a sales figure", () => {
  const mix = customerTagMix([
    { nicknameDerivedMetadata: { source: null, customerType: "ONLINE", product: { name: "Reno16" }, paymentMethod: "CASH", financeProvider: null, service: null, period: null, eventDate: null } },
    { nicknameDerivedMetadata: { source: "TikTok", customerType: null, product: { name: "Reno16" }, paymentMethod: "INSTALLMENT", financeProvider: "UFUND", service: null, period: null, eventDate: null } },
    { nicknameDerivedMetadata: { source: null, customerType: null, product: { name: "A6" }, paymentMethod: null, financeProvider: null, service: null, period: null, eventDate: null } },
    { nicknameDerivedMetadata: null },
    {},
  ]);
  assert.equal(mix.chats, 5);
  assert.equal(mix.tagged, 3);
  assert.deepEqual(mix.products, [{ key: "Reno16", count: 2 }, { key: "A6", count: 1 }]);
  assert.deepEqual(mix.sources, [{ key: "ONLINE", count: 1 }, { key: "TikTok", count: 1 }]);
  assert.deepEqual(mix.finance, [{ key: "CASH", count: 1 }, { key: "UFUND", count: 1 }]);
  assert.equal(tagValueLabel("CASH"), "เงินสด");
  assert.equal(tagValueLabel("INSTALLMENT", "en"), "Installment");
  assert.equal(tagValueLabel("TikTok"), "TikTok");
  assert.match(view, /t\("s360TagsDisclaimer"\)/);
  assert.match(view, /t\("s360NamesRead", \{ read: coverage\.read/);
});

test("scorecard: the same rows and functions as the Dashboard; Δ in points; target and rank", () => {
  assert.match(view, /const data = useMonthlyMetrics\(month, \{ google: true, tagCoverage: true, enabled: Boolean\(authUser\) \}\);/);
  assert.match(view, /const row = storeId \? data\.storeRows\.find\(\(entry\) => entry\.storeId === storeId\) \?\? null : null;/);
  for (const kpi of ["replied", "rate24", "unreplied", "followers"]) assert.match(view, new RegExp(`<Tile kpi="${kpi}"`));
  assert.match(view, /<DeltaValue state=\{row\.rate24Delta\} kind="points"[\s\S]*?<TargetText kpi="rate24"[\s\S]*?rate24Rank|const rank = rate24Rank\(data\.storeRows, row\.storeId\);/);
  assert.match(view, /<DeltaValue state=\{row\.unrepliedDelta\} kind="count"/);
});

test("a store with no chat data shows ONE state plus followers and Google Review, never a wall of ไม่มีข้อมูล", () => {
  assert.match(view, /const noChatData = latest\.data !== null && latest\.data\.total === 0;/);
  assert.match(view, /\{noChatData \? \(\n\s*<div data-s360-no-chat-data role="status"/);
  const noData = view.slice(view.indexOf("{noChatData ? ("), view.indexOf(") : row ? ("));
  assert.doesNotMatch(noData, /<Scorecard|<Trend|<CustomerTags/);
  assert.match(view, /<Followers storeId=\{storeId\} data=\{data\} followers=\{followers\} \/>\n\s*<GoogleReview storeId=\{storeId\} data=\{data\} \/>/);
  assert.match(view, /\{!noChatData && row && \(/, "tags, actions and Customer Voice only with chat data");
  assert.doesNotMatch(view, /ไม่มีข้อมูล|No data available/);
});

test("removed from Store 360: Customer Voice module, team performance, response analytics, first-response tiles, unique-customers headline", () => {
  assert.doesNotMatch(view, /CustomerVoicePanel|ResponderList|responders|medianFirstResponse|repliedWithin15Minutes|Unique customers|summary\.customers/);
  assert.match(read("app/store-360/page.tsx"), /<Store360Monthly \/>/);
  // The sub-routes keep working, unlinked (Customer Voice only at ≥ 20% coverage).
  assert.match(read("app/store-360/response/page.tsx"), /ResponseDrilldownView/);
  assert.match(read("app/store-360/customer-voice/page.tsx"), /CustomerVoiceDrilldownView/);
});

test("actions: this store's chats this month (/chats params), the store report, copy summary", () => {
  assert.match(view, /<Link href=\{chatsHref\(\{ storeId: row\.storeId, month: data\.month \}\)\}/);
  assert.match(view, /<Link href=\{kpiReportHref\(data\.month, row\.storeId\)\}/);
  const text = buildReportSummary({ monthLabel: "ต.ค. 2026", periodText: "1–8 ต.ค. 2026 เทียบ 1–8 ก.ย. 2026", scopeLabel: "สาขา Alpha", totals: rows[0], stores: [rows[0]], inProgress: monthWindow("2026-10", Date.parse("2026-10-08T09:00:00+07:00")).inProgress });
  assert.match(text, /สาขา Alpha/);
  assert.match(text, /ตอบใน 24 ชม\./);
});
