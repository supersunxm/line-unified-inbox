import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KPI_DIFFERENCE_NOTE, KPI_HOW_COUNTED, NO_TARGET_LABEL, RATE24_TARGET, REPLIED_RATE_TARGET, targetLabel, targetState } from "../src/lib/v2/kpi.ts";
import { buildMonthStoreRows, coverageText, partnerRows, previousCoverage, type MonthSummary } from "../src/lib/v2/monthly-model.ts";
import { countState, rateState } from "../src/lib/v2/value-state.ts";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("two KPIs with their own targets: ตอบแล้ว % has none yet, 24h is 90%", () => {
  assert.equal(REPLIED_RATE_TARGET, null);
  assert.equal(RATE24_TARGET, 90);
  assert.deepEqual(targetState(rateState(50, 100), REPLIED_RATE_TARGET), { kind: "no-target" });
  assert.equal(targetLabel(targetState(rateState(50, 100), REPLIED_RATE_TARGET), REPLIED_RATE_TARGET), NO_TARGET_LABEL);
  assert.equal(NO_TARGET_LABEL, "ยังไม่กำหนดเป้า");
  assert.deepEqual(targetState(rateState(80, 100), RATE24_TARGET), { kind: "below", target: 90, gap: 10 });
  assert.equal(targetLabel(targetState(rateState(80, 100), RATE24_TARGET), RATE24_TARGET), "เป้า 90% · ต่ำกว่าเป้า 10.0 จุด");
  assert.equal(targetState(rateState(95, 100), RATE24_TARGET).kind, "met");
  assert.equal(targetState(rateState(4, 5), RATE24_TARGET).kind, "low-sample", "no target colour below the sample");
  assert.equal(targetState(rateState(0, 0), RATE24_TARGET).kind, "unmeasured");
});

test("rate changes carry the colour; count changes are neutral everywhere", () => {
  const ui = read("components/v2/v2-ui.tsx");
  assert.match(ui, /const muted = kind === "count" \|\| state\.kind === "low-sample" \|\| state\.kind === "stale";/);
  for (const file of ["components/v2/month-overview.tsx", "components/v2/store-scorecard-view.tsx", "components/v2/month-report.tsx"]) {
    const source = read(file);
    assert.match(source, /<RateCell value=\{row\.rate24\} delta=\{row\.rate24Delta\} target=\{RATE24_TARGET\}/, file);
    assert.match(source, /<RateCell value=\{row\.replyRate\} delta=\{row\.replyRateDelta\} target=\{REPLIED_RATE_TARGET\}/, file);
    assert.match(source, /<CountCell value=\{row\.unreplied\} delta=\{row\.unrepliedDelta\}/, file);
    assert.doesNotMatch(source, /เทียบเดือนก่อน<\/TableHead>|>เทียบ<\/th>/, `${file}: no count-only comparison column`);
  }
  assert.match(read("components/v2/kpi-cards.tsx"), /kind=\{row\.format === "percent" \? "points" : "count"\}/, "drawer and report table");
});

test("every view says how each KPI is counted, and why 24h can be higher", () => {
  assert.match(KPI_HOW_COUNTED.replied, /ข้อความล่าสุด/);
  assert.match(KPI_HOW_COUNTED.rate24, /ข้อความแรก/);
  assert.match(KPI_DIFFERENCE_NOTE, /ตอบใน 24 ชม\.” และ “ยังไม่ตอบ” พร้อมกัน/);
  assert.match(read("components/v2/kpi-cards.tsx"), /<details data-v2-how-counted=\{kpi\}/, "a disclosure, not a tooltip");
  assert.match(read("components/v2/month-overview.tsx"), /<TwoKpiCards totals=\{data\.network\} frame=\{data\.frame\} \/>/);
  assert.match(read("components/v2/store-scorecard-view.tsx"), /<HowCounted kpi="replied" \/>[\s\S]*<HowCounted kpi="rate24" \/>[\s\S]*\{KPI_DIFFERENCE_NOTE\}/);
  assert.match(read("components/v2/store-scorecard-drawer.tsx"), /<KpiCompareTable totals=\{row\} frame=\{data\.frame\} \/>[\s\S]*\{KPI_DIFFERENCE_NOTE\}/);
  assert.match(read("components/v2/month-report.tsx"), /\{KPI_HOW_COUNTED\.replied\}[\s\S]*\{KPI_HOW_COUNTED\.rate24\}/);
});

// Synthetic fixtures only.
const summary: MonthSummary = {
  overview: { total: 79, notReplied: 9, notifiedBm: 0, replied: 70 },
  stores: [
    { storeId: "a", storeName: "OBS A By TG", total: 40, notReplied: 4, notifiedBm: 0, replied: 36 },
    { storeId: "b", storeName: "OBS B By OPPO", total: 35, notReplied: 3, notifiedBm: 0, replied: 32 },
    { storeId: "c", storeName: "OBS C By Com7", total: 4, notReplied: 2, notifiedBm: 0, replied: 2 },
  ],
};
const PARTNERS: Record<string, string> = { a: "TG", b: "OPPO", c: "Com7" };
const stores = summary.stores.map((store) => ({ id: store.storeId, name: store.storeName, region: null, province: null, lineOaCount: 1, partner: PARTNERS[store.storeId] }));
const rates = { overview: { total: 75, within24h: 64 }, stores: [{ storeId: "a", total: 40, within24h: 38 }, { storeId: "b", total: 31, within24h: 24 }, { storeId: "c", total: 4, within24h: 2 }] };

test("partner table: worst 24h gap to target first, low-sample partners last", () => {
  const rows = buildMonthStoreRows({ stores, current: { data: summary }, previous: { data: new Map([["a", { total: 30, notReplied: 1, replied: 29 }]]) }, rates: { data: rates }, previousRates: { data: null, collected: false } });
  assert.deepEqual(partnerRows(rows, { data: rates }, { data: null, collected: false }).map((row) => row.partner), ["OPPO", "TG", "Com7"]);
});

test("coverage for both compared periods; an uncollected period says so", () => {
  const rows = buildMonthStoreRows({ stores, current: { data: summary }, previous: { data: new Map([["a", { total: 30, notReplied: 1, replied: 29 }]]) }, rates: { data: rates }, previousRates: { data: null } });
  assert.deepEqual(previousCoverage(rows), { withChats: 1, total: 3 });
  assert.equal(coverageText({ currentLabel: "1–7 ต.ค. 2026", previousLabel: "1–7 ก.ย. 2026", current: { withChats: 3, total: 3 }, previous: previousCoverage(rows), previousReason: null }), "สาขาที่มีข้อมูลแชท 1–7 ต.ค. 2026 3 ร้าน · 1–7 ก.ย. 2026 1 ร้าน (จาก 3 ร้าน)");
  const uncollected = buildMonthStoreRows({ stores, current: { data: summary }, previous: { data: null, collected: false }, rates: { data: rates }, previousRates: { data: null, collected: false } });
  assert.equal(previousCoverage(uncollected), null);
  assert.match(coverageText({ currentLabel: "ทั้งเดือน ก.ย. 2026", previousLabel: "ทั้งเดือน ส.ค. 2026", current: { withChats: 3, total: 3 }, previous: null, previousReason: "ระบบยังไม่ได้เก็บข้อมูลช่วงนี้" }), /ส\.ค\. 2026 — \(ระบบยังไม่ได้เก็บข้อมูลช่วงนี้\)/);
  assert.equal(countState(0).kind, "true-zero");
});
