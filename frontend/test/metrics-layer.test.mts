import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { chatsStoreCounts, effectiveSummaryCounts } from "../src/app/reply-state.ts";
import { monthWindow, periodLabel } from "../src/lib/metrics/month.ts";
import { buildStoreRows, networkCounts, storesToWatch, unrepliedCount, type MonthSummary, type RateResponse, type StoreInfo } from "../src/lib/metrics/store-model.ts";
import { hasChatData, isPlaceholderStore, storeCoverage, storeScopeText, storesInScope } from "../src/lib/metrics/store-scope.ts";
import { numericValue } from "../src/lib/metrics/value-state.ts";
import * as v2Month from "../src/lib/v2/month.ts";
import * as v2Model from "../src/lib/v2/monthly-model.ts";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const bkk = (iso: string) => Date.parse(`${iso}+07:00`);

// Synthetic fixtures only.
const summary: MonthSummary = {
  overview: { total: 70, notReplied: 11, notifiedBm: 3, replied: 56 },
  stores: [
    { storeId: "focus-seven-store-group", storeName: "Focus group · 7 stores", total: 30, notReplied: 4, notifiedBm: 1, replied: 25 },
    { storeId: "a", storeName: "Alpha", total: 40, notReplied: 6, notifiedBm: 2, replied: 32, oldestWaitingMinutes: 600 },
    { storeId: "b", storeName: "Beta", total: 25, notReplied: 5, notifiedBm: 1, replied: 19 },
    { storeId: "c", storeName: "Gamma", total: 5, notReplied: 0, notifiedBm: 0, replied: 5 },
    { storeId: "d", storeName: "Delta", total: 0, notReplied: 0, notifiedBm: 0, replied: 0 },
    { storeId: "e", storeName: "Placeholder xxx", total: 0, notReplied: 0, notifiedBm: 0, replied: 0 },
  ],
};
const stores: StoreInfo[] = [
  { id: "a", name: "Alpha", region: "Eastern", province: "Chonburi", lineOaCount: 1 },
  { id: "b", name: "Beta", region: "Northern", province: "Chiang Mai", lineOaCount: 1 },
  { id: "c", name: "Gamma", region: null, province: null, lineOaCount: 2 },
  { id: "d", name: "Delta", region: null, province: null, lineOaCount: null },
  { id: "e", name: "Placeholder xxx", region: null, province: null, lineOaCount: 0 },
  { id: "z", name: "Not in the summary", region: null, province: null, lineOaCount: 1 },
];
const rates: RateResponse = { overview: { total: 60, within24h: 50 }, stores: [{ storeId: "a", total: 30, within24h: 20 }, { storeId: "b", total: 25, within24h: 15 }, { storeId: "c", total: 5, within24h: 5 }] };

test("ยังไม่ตอบ: one function for the sidebar badge, Home, Dashboard, Store 360 and /chats", () => {
  assert.equal(unrepliedCount(summary), effectiveSummaryCounts(summary.overview).notReplied);
  assert.equal(unrepliedCount(summary), networkCounts(summary).notReplied);
  assert.equal(unrepliedCount(summary), 14, "notReplied + notifiedBm: two states in the UI");
  const rows = buildStoreRows({ stores: storesInScope(stores, summary).stores, current: { data: summary }, previous: { data: null, collected: false }, rates: { data: rates }, previousRates: { data: null } });
  for (const row of rows) {
    const source = summary.stores.find((store) => store.storeId === row.storeId)!;
    assert.equal(numericValue(row.unreplied), chatsStoreCounts(source).notReplied, row.storeId);
    assert.equal(numericValue(row.chats), chatsStoreCounts(source).total, row.storeId);
  }
  // The badge reads the same request through the shared cache, and counts with the same function.
  const badge = read("components/shell/chats-unreplied-badge.ts");
  assert.match(badge, /const summary = await sharedMonthSummary\(getCurrentBangkokMonth\(\)\);\n\s*return unrepliedCount\(summary\);/);
  const hook = read("lib/metrics/use-monthly-metrics.tsx");
  assert.match(hook, /export const SHARED_RESPONSE_TTL_MS = 2 \* 60 \* 1000;/);
  assert.match(hook, /const liveCurrent = useKeyedSource\("summary", on\(closeKnown && !currentClosed \? JSON\.stringify\(\{ month \}\) : null\)/, "the hook's summary key is the badge's key (summary:{month}#0)");
});

test("stores in scope: Store rows in the summary with a LINE OA; never by name; focus group never a store", () => {
  const scope = storesInScope(stores, summary);
  assert.deepEqual(scope.stores.map((store) => store.id), ["a", "b", "c", "d"], "unknown OA count (null) is not a placeholder signal");
  assert.deepEqual(scope.placeholders.map((store) => store.id), ["e"]);
  assert.equal(isPlaceholderStore({ id: "x", name: "xxx", region: null, province: null, lineOaCount: 3 }), false, "names are never pattern-matched");
  assert.deepEqual(storesInScope(stores, null).stores.map((store) => store.id), ["a", "b", "c", "d", "z"], "before the summary loads, every Store with an OA");
  const rows = buildStoreRows({ stores: scope.stores, current: { data: summary }, previous: { data: null, collected: false }, rates: { data: rates }, previousRates: { data: null } });
  assert.deepEqual(rows.filter(hasChatData).map((row) => row.storeId), ["a", "b", "c"]);
  assert.deepEqual(storeCoverage(rows), { withChats: 3, total: 4 });
  assert.equal(storeScopeText(storeCoverage(rows)), "3 จาก 4 ร้านที่มีข้อมูลแชท");
  assert.equal(storeScopeText({ withChats: 141, total: 1500 }, "en"), "141 of 1,500 stores with chat data");
  assert.equal(storeScopeText({ withChats: 141, total: 150 }, "zh"), "150 家门店中 141 家有聊天数据");
  // v2 reads the same definition.
  assert.equal(v2Model.v2Stores, storesInScope);
  assert.equal(v2Model.dataCoverage, storeCoverage);
});

test("stores to watch: most unreplied first, ties by the lower 24h rate; low-sample rates never break ties", () => {
  const tieSummary: MonthSummary = {
    overview: { total: 0, notReplied: 0, notifiedBm: 0, replied: 0 },
    stores: [
      { storeId: "a", storeName: "Alpha", total: 40, notReplied: 5, notifiedBm: 0, replied: 35 },
      { storeId: "b", storeName: "Beta", total: 40, notReplied: 5, notifiedBm: 0, replied: 35 },
      { storeId: "c", storeName: "Gamma", total: 6, notReplied: 5, notifiedBm: 0, replied: 1 },
      { storeId: "d", storeName: "Delta", total: 9, notReplied: 9, notifiedBm: 0, replied: 0 },
    ],
  };
  const tieRates: RateResponse = { overview: { total: 0, within24h: 0 }, stores: [{ storeId: "a", total: 30, within24h: 27 }, { storeId: "b", total: 30, within24h: 15 }, { storeId: "c", total: 4, within24h: 0 }] };
  const rows = buildStoreRows({ stores: stores.slice(0, 4), current: { data: tieSummary }, previous: { data: null, collected: false }, rates: { data: tieRates }, previousRates: { data: null } });
  assert.deepEqual(storesToWatch(rows).map((row) => row.storeId), ["d", "b", "a", "c"], "Delta (9, low sample) still counts; Gamma's 0% (n=4) sorts after measured rates");
  assert.equal(storesToWatch(rows, 2).length, 2);
});

test("same-day comparison: the current month to date vs the previous month's days 1–D", () => {
  const frame = monthWindow("2026-10", bkk("2026-10-08T09:42:00"));
  assert.equal(frame.inProgress, true);
  assert.deepEqual([frame.current.dateFrom, frame.current.dateTo], ["2026-10-01", "2026-10-08"]);
  assert.deepEqual([frame.previous.dateFrom, frame.previous.dateTo], ["2026-09-01", "2026-09-08"]);
  assert.equal(periodLabel(frame.current), "1–8 ต.ค. 2026");
  assert.equal(periodLabel(frame.previous), "1–8 ก.ย. 2026");
  // A previous month shorter than D days is used whole.
  const march = monthWindow("2027-03", bkk("2027-03-31T12:00:00"));
  assert.deepEqual([march.previous.dateFrom, march.previous.dateTo, march.previous.wholeMonth], ["2027-02-01", "2027-02-28", true]);
  // A closed month: whole month vs whole previous month.
  const closed = monthWindow("2026-09", bkk("2026-10-08T09:42:00"));
  assert.deepEqual([closed.current.wholeMonth, closed.previous.wholeMonth, closed.previousCollected], [true, true, false], "August 2026 is before reply-status coverage");
  // v2 re-exports the same functions.
  assert.equal(v2Month.monthWindow, monthWindow);
});
