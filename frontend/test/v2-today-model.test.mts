import assert from "node:assert/strict";
import test from "node:test";
import { buildTodayItems, weekComparison } from "../src/lib/v2/today-model.ts";
import type { StoreRow } from "../src/lib/v2/response-model.ts";

function row(storeId: string, patch: Partial<StoreRow> = {}): StoreRow {
  return {
    storeId, storeName: `ร้าน ${storeId}`, region: null, hasData: true, waitingCount: 0, longestBusinessMinutes: null, longestWaitingSince: null,
    needsFollowUp: false, rate7d: 95, ratePrev7d: 95, rateDelta: 0, trend: [], managerUrl: null, ...patch,
  };
}
const totals = (rate: number | null, total = 100) => ({ total, within24h: rate === null ? 0 : Math.round(total * rate / 100), over24h: 5, pending: 2, rate });
const loaded = { waitingLoaded: true, fleetLoaded: true };

test("nothing abnormal: an empty list", () => {
  assert.deepEqual(buildTodayItems({ ...loaded, storeRows: [row("a")], totals7d: totals(95), totalsPrev7d: totals(94), googleStores: [] }), []);
});

test("abnormal items appear in the fixed priority order with stores and an action", () => {
  const items = buildTodayItems({
    ...loaded,
    storeRows: [
      row("a", { needsFollowUp: true, waitingCount: 2, longestBusinessMinutes: 90, rate7d: 70, ratePrev7d: 90, rateDelta: -20 }),
      row("b", { needsFollowUp: true, waitingCount: 1, longestBusinessMinutes: 300 }),
      row("c", { rate7d: 80, ratePrev7d: 85, rateDelta: -5 }),
      row("z", { hasData: false, needsFollowUp: false, rate7d: 0, ratePrev7d: 100, rateDelta: -100 }),
    ],
    totals7d: totals(85),
    totalsPrev7d: totals(92),
    googleStores: [
      { name: "ร้าน a", kpiResult: { qualifiedReviews: 2, targetQualifiedReviews: 10, isPassed: false } },
      { name: "ร้าน b", kpiResult: { qualifiedReviews: 10, targetQualifiedReviews: 10, isPassed: true } },
      { name: "ร้าน c", kpiResult: null },
    ],
  });
  assert.deepEqual(items.map((item) => item.id), ["follow-up", "reply-rate", "google-review", "no-chat-data"]);
  // 1) longest wait first
  assert.deepEqual(items[0].stores.map((store) => store.name), ["ร้าน b", "ร้าน a"]);
  assert.match(items[0].comparison, /จาก 3 ร้านที่มีข้อมูล/);
  assert.equal(items[0].action.href, "/v2/response");
  // 2) below target; the biggest drops are named, and a no-data store never is
  assert.match(items[1].problem, /85\.0% ต่ำกว่าเป้า 90%/);
  assert.match(items[1].comparison, /7 วันก่อนหน้า 92\.0% \(−7\.0 จุด\)/);
  assert.deepEqual(items[1].stores.map((store) => store.name), ["ร้าน a", "ร้าน c"]);
  // 4) only checked stores count
  assert.match(items[2].comparison, /จาก 2 ร้านที่ตรวจแล้ว/);
  assert.deepEqual(items[2].stores, [{ name: "ร้าน a", detail: "2/10 รีวิว" }]);
  // 5) no chat data
  assert.deepEqual(items[3].stores.map((store) => store.name), ["ร้าน z"]);
});

test("a rate above target still shows when it fell vs last week", () => {
  const items = buildTodayItems({ ...loaded, storeRows: [row("a")], totals7d: totals(93), totalsPrev7d: totals(96), googleStores: [] });
  assert.deepEqual(items.map((item) => item.id), ["reply-rate"]);
  assert.match(items[0].problem, /ลดลงเหลือ 93\.0%/);
});

test("a source that failed to load leaves its item out instead of reporting it as fine", () => {
  const storeRows = [row("a", { needsFollowUp: true, longestBusinessMinutes: 120, waitingCount: 1 }), row("z", { hasData: false })];
  const items = buildTodayItems({ storeRows, waitingLoaded: false, fleetLoaded: false, totals7d: null, totalsPrev7d: null, googleStores: null });
  assert.deepEqual(items, []);
});

test("this week vs last week: three rows", () => {
  const rows = weekComparison(totals(85), totals(92));
  assert.deepEqual(rows.map((r) => r.label), ["ตอบใน 24 ชม.", "แชทเข้า", "ตอบเกิน 24 ชม. หรือยังไม่ตอบ"]);
  assert.equal(rows[0].better, false);
  assert.deepEqual(weekComparison(null, null), []);
});
