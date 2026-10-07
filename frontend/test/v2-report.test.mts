import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMonthStoreRows, networkTotals, type MonthSummary, type RateResponse } from "../src/lib/v2/monthly-model.ts";
import { buildReportSummary, OPEN_MONTH_NOTE } from "../src/lib/v2/report-summary.ts";

// Synthetic fixtures only.
const summary: MonthSummary = {
  overview: { total: 70, notReplied: 12, notifiedBm: 0, replied: 58 },
  stores: [
    { storeId: "a", storeName: "OBS A By TG", total: 30, notReplied: 6, notifiedBm: 0, replied: 24 },
    { storeId: "b", storeName: "OBS B By TG", total: 25, notReplied: 4, notifiedBm: 0, replied: 21 },
    { storeId: "c", storeName: "OBS C By TG", total: 10, notReplied: 2, notifiedBm: 0, replied: 8 },
    { storeId: "d", storeName: "OBS D By TG", total: 5, notReplied: 0, notifiedBm: 0, replied: 5 },
  ],
};
const rates: RateResponse = { overview: { total: 60, within24h: 51 }, stores: [] };
const stores = summary.stores.map((store) => ({ id: store.storeId, name: store.storeName, region: null, province: null, lineOaCount: 1 }));
const rows = buildMonthStoreRows({ stores, current: { data: summary }, previous: { data: new Map([["a", { total: 20, notReplied: 2, replied: 18 }]]) }, rates: { data: rates }, previousRates: { data: { overview: { total: 50, within24h: 45 }, stores: [] } } });
const totals = networkTotals({ current: { data: summary }, previous: { data: { total: 20, notReplied: 2, replied: 18 } }, rates: { data: rates }, previousRates: { data: { overview: { total: 50, within24h: 45 }, stores: [] } } });

test("LINE summary: partner, month, key numbers, the 3 stores with most unreplied, open-month note", () => {
  const text = buildReportSummary({ monthLabel: "ต.ค. 2026", periodText: "1–7 ต.ค. 2026 เทียบ 1–7 ก.ย. 2026", scopeLabel: "Partner TG", totals, stores: rows, inProgress: true });
  assert.equal(text, [
    "สรุปเดือน ต.ค. 2026 · Partner TG",
    "ช่วง: 1–7 ต.ค. 2026 เทียบ 1–7 ก.ย. 2026",
    "แชท 70 · ยังไม่ตอบ 12 (+10)",
    "ตอบแล้ว 82.9% (−7.1 จุด) · ยังไม่กำหนดเป้า",
    "ตอบใน 24 ชม. 85.0% (−5.0 จุด) · เป้า 90%",
    "ยังไม่ตอบมากสุด: 1) OBS A By TG 6 แชท 2) OBS B By TG 4 แชท 3) OBS C By TG 2 แชท",
    OPEN_MONTH_NOTE,
  ].join("\n"));
});

test("LINE summary of a closed month has no open-month note; no unreplied says so", () => {
  const text = buildReportSummary({ monthLabel: "ก.ย. 2026", periodText: "ทั้งเดือน ก.ย. 2026 เทียบ ทั้งเดือน ส.ค. 2026", scopeLabel: "สาขา OBS D By TG", totals: rows[3], stores: [rows[3]], inProgress: false });
  assert.doesNotMatch(text, new RegExp(OPEN_MONTH_NOTE));
  assert.match(text, /ไม่มีแชทที่ยังไม่ตอบ/);
  assert.match(text, /ตอบแล้ว 100\.0% \(n=5\)/, "low sample keeps n");
});

test("report page: no navigation chrome, A4 light, open-month footer", () => {
  const report = readFileSync(new URL("../src/components/v2/month-report.tsx", import.meta.url), "utf8");
  const shellLayout = readFileSync(new URL("../src/app/v2/(shell)/layout.tsx", import.meta.url), "utf8");
  const rootLayout = readFileSync(new URL("../src/app/v2/layout.tsx", import.meta.url), "utf8");
  assert.match(shellLayout, /<V2Layout>\{children\}<\/V2Layout>/);
  assert.doesNotMatch(rootLayout, /V2Layout|V2Shell/, "the report is outside the shell");
  assert.doesNotMatch(report, /V2Shell|V2Layout/);
  assert.match(report, /@page \{ size: A4; margin: 12mm; \}/);
  assert.match(report, /color-scheme: light;/);
  assert.match(report, /\{data\.frame\.inProgress && <p data-v2-report-open-month[^>]*>\{OPEN_MONTH_NOTE\}<\/p>\}/);
  assert.equal(OPEN_MONTH_NOTE, "ตัวเลขเดือนที่ยังไม่ปิดอาจเปลี่ยนได้");
  assert.match(report, /data-v2-copy-summary/);
});
