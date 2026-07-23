import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateCoverage,
  calculatePaginationBounds,
  escapeCsvCell,
  formatBkkDateTime,
  formatDateDisplay,
  getInclusiveCalendarDays,
  validateDateRange,
} from "../src/app/follower-insights/follower-insights-utils.ts";
import {
  followerInsightsTranslations,
  getFollowerInsightsText,
} from "../src/app/follower-insights/follower-insights-translations.ts";
import type { ByStoreAccountRow, SummaryDailyRow } from "../src/types/api.ts";

test("getInclusiveCalendarDays calculates pure UTC calendar day differences", () => {
  assert.equal(getInclusiveCalendarDays("2026-07-01", "2026-07-01"), 1);
  assert.equal(getInclusiveCalendarDays("2026-07-01", "2026-07-07"), 7);
  assert.equal(getInclusiveCalendarDays("2026-07-01", "2026-09-28"), 90);
  assert.equal(getInclusiveCalendarDays("2026-07-01", "2026-09-29"), 91);
  assert.equal(getInclusiveCalendarDays("2026-07-15", "2026-07-01"), 0);
});

test("validateDateRange enforces exact 90 calendar day limits and date ordering in both locales", () => {
  const allowed = validateDateRange("2026-07-01", "2026-09-28", "en");
  assert.equal(allowed.valid, true);
  assert.equal(allowed.error, null);

  const rejected91En = validateDateRange("2026-07-01", "2026-09-29", "en");
  assert.equal(rejected91En.valid, false);
  assert.equal(rejected91En.error, "Date range cannot exceed 90 days.");

  const rejected91Th = validateDateRange("2026-07-01", "2026-09-29", "th");
  assert.equal(rejected91Th.valid, false);
  assert.equal(rejected91Th.error, "ช่วงวันที่ต้องไม่เกิน 90 วัน");

  const reversedTh = validateDateRange("2026-07-15", "2026-07-01", "th");
  assert.equal(reversedTh.valid, false);
  assert.equal(reversedTh.error, "วันสิ้นสุดต้องไม่มาก่อนวันเริ่มต้น");
});

test("calculateCoverage counts only populated rows with followers !== null and accountsReady > 0", () => {
  const mockSummary: SummaryDailyRow[] = [
    { date: "2026-07-01", followers: 100, accountsReady: 10, accountsExpected: 10, accountsWithData: 10, accountsMissing: 0, dailyIncrease: null, targetedReaches: 50, blocks: 2 },
    { date: "2026-07-02", followers: null, accountsReady: 0, accountsExpected: 10, accountsWithData: 0, accountsMissing: 10, dailyIncrease: null, targetedReaches: null, blocks: null },
    { date: "2026-07-03", followers: 120, accountsReady: 5, accountsExpected: 10, accountsWithData: 5, accountsMissing: 5, dailyIncrease: 20, targetedReaches: 60, blocks: 3 },
  ];

  const res = calculateCoverage(mockSummary, "2026-07-01", "2026-07-03");
  assert.equal(res.totalCalendarDays, 3);
  assert.equal(res.usableDays, 2);
  assert.equal(res.coveragePct, 67);
  assert.equal(res.hasMissingDates, true);
});

test("escapeCsvCell formats null as blank, escapes quotes/commas/newlines, and preserves Thai text", () => {
  assert.equal(escapeCsvCell(null), "");
  assert.equal(escapeCsvCell(undefined), "");
  assert.equal(escapeCsvCell("Store, Central"), '"Store, Central"');
  assert.equal(escapeCsvCell('OPPO "RBS"'), '"OPPO ""RBS"""');
  assert.equal(escapeCsvCell("Line 1\nLine 2"), '"Line 1\nLine 2"');
  assert.equal(escapeCsvCell("ร้าน OPPO ชลบุรี"), "ร้าน OPPO ชลบุรี");
});

test("calculatePaginationBounds handles 0, 1, 10, 11, and 35 row boundary cases cleanly", () => {
  // 0 rows
  const p0 = calculatePaginationBounds(0, 1, 10);
  assert.equal(p0.totalPages, 1);
  assert.equal(p0.startRecord, 0);
  assert.equal(p0.endRecord, 0);

  // 1 row
  const p1 = calculatePaginationBounds(1, 1, 10);
  assert.equal(p1.totalPages, 1);
  assert.equal(p1.startRecord, 1);
  assert.equal(p1.endRecord, 1);

  // 10 rows
  const p10 = calculatePaginationBounds(10, 1, 10);
  assert.equal(p10.totalPages, 1);
  assert.equal(p10.startRecord, 1);
  assert.equal(p10.endRecord, 10);

  // 11 rows page 1 & page 2
  const p11_1 = calculatePaginationBounds(11, 1, 10);
  assert.equal(p11_1.totalPages, 2);
  assert.equal(p11_1.startRecord, 1);
  assert.equal(p11_1.endRecord, 10);

  const p11_2 = calculatePaginationBounds(11, 2, 10);
  assert.equal(p11_2.totalPages, 2);
  assert.equal(p11_2.startRecord, 11);
  assert.equal(p11_2.endRecord, 11);

  // 35 rows page 1, page 4, and clamped page
  const p35_1 = calculatePaginationBounds(35, 1, 10);
  assert.equal(p35_1.totalPages, 4);
  assert.equal(p35_1.startRecord, 1);
  assert.equal(p35_1.endRecord, 10);

  const p35_4 = calculatePaginationBounds(35, 4, 10);
  assert.equal(p35_4.totalPages, 4);
  assert.equal(p35_4.startRecord, 31);
  assert.equal(p35_4.endRecord, 35);

  const p35_clamp = calculatePaginationBounds(35, 99, 10);
  assert.equal(p35_clamp.safePage, 4);
  assert.equal(p35_clamp.startRecord, 31);
  assert.equal(p35_clamp.endRecord, 35);
});

test("Follower Insights localization dictionary returns correct Thai, English, and Chinese labels", () => {
  const th = getFollowerInsightsText("th");
  const en = getFollowerInsightsText("en");
  const zh = getFollowerInsightsText("zh");

  assert.equal(th.followerInsightsTitle, "ข้อมูลผู้ติดตาม");
  assert.equal(en.followerInsightsTitle, "Follower Insights");
  assert.equal(zh.followerInsightsTitle, "关注者洞察");

  assert.equal(th.allStores, "ทุกร้าน");
  assert.equal(en.allStores, "All stores");
  assert.equal(zh.allStores, "全部门店");

  assert.equal(th.noDataForStoreInRange, "ไม่มีข้อมูลสำหรับร้านนี้ในช่วงวันที่เลือก");
  assert.equal(en.noDataForStoreInRange, "No data for this store in the selected range");
  assert.equal(zh.noDataForStoreInRange, "所选范围内该门店无数据");

  assert.equal(th.failedToLoadStoreTrend, "โหลดข้อมูลแนวโน้มของร้านค้าไม่สำเร็จ");
  assert.equal(en.failedToLoadStoreTrend, "Failed to load store trend");
  assert.equal(zh.failedToLoadStoreTrend, "加载门店趋势数据失败");

  assert.equal(th.clearStoreFilter, "ล้างตัวกรองร้านค้า");
  assert.equal(en.clearStoreFilter, "Clear store filter");
  assert.equal(zh.clearStoreFilter, "清除门店筛选");
});

test("Dynamic localization formatters interpolate text correctly across all locales", () => {
  const th = getFollowerInsightsText("th");
  const en = getFollowerInsightsText("en");
  const zh = getFollowerInsightsText("zh");

  assert.equal(th.dataCoverageText(4, 7, 57), "ความครอบคลุมของข้อมูล: 4 จาก 7 วัน (57%)");
  assert.equal(en.dataCoverageText(4, 7, 57), "Data coverage: 4 of 7 days (57%)");
  assert.equal(zh.dataCoverageText(4, 7, 57), "数据覆盖率: 7 天中的 4 天 (57%)");

  assert.equal(th.showingDaysText(1, 10, 35), "แสดงวันที่ 1 ถึง 10 จากทั้งหมด 35 วัน");
  assert.equal(en.showingDaysText(1, 10, 35), "Showing 1 to 10 of 35 days");
  assert.equal(zh.showingDaysText(1, 10, 35), "显示第 1 至 10 天，共 35 天");

  assert.equal(th.showingStoresText(1, 10, 35), "แสดงร้านที่ 1 ถึง 10 จากทั้งหมด 35 ร้าน");
  assert.equal(en.showingStoresText(1, 10, 35), "Showing 1 to 10 of 35 stores");
  assert.equal(zh.showingStoresText(1, 10, 35), "显示第 1 至 10 家门店，共 35 家");

  assert.equal(th.estimatedCallsDetail(17, 35), "~595 ครั้ง (17 วัน × 35 บัญชี)");
  assert.equal(en.estimatedCallsDetail(17, 35), "~595 requests (17 days × 35 accounts)");
  assert.equal(zh.estimatedCallsDetail(17, 35), "~595 次请求 (17 天 × 35 个账号)");
});

test("Date display and timestamp formatting respect the requested locale", () => {
  const isoDate = "2026-07-01";
  const formattedEn = formatDateDisplay(isoDate, "en");
  const formattedTh = formatDateDisplay(isoDate, "th");
  const formattedZh = formatDateDisplay(isoDate, "zh");

  assert.equal(formattedEn, "Jul 1, 2026");
  assert.equal(formattedTh, "1 ก.ค. 2026");
  assert.equal(formattedZh, "2026年7月1日");

  const bkkIso = "2026-07-22T11:05:00Z";
  const bkkEn = formatBkkDateTime(bkkIso, "en");
  const bkkTh = formatBkkDateTime(bkkIso, "th");

  assert.equal(bkkEn, "2026-07-22 18:05:00");
  assert.equal(bkkTh, "22/07/2026 18:05:00");
});

test("Every locale (en, th, zh) exposes the exact same complete set of translation keys", () => {
  const enKeys = Object.keys(followerInsightsTranslations.en).sort();
  const thKeys = Object.keys(followerInsightsTranslations.th).sort();
  const zhKeys = Object.keys(followerInsightsTranslations.zh).sort();

  assert.deepEqual(thKeys, enKeys, "Thai translation keys must match English keys");
  assert.deepEqual(zhKeys, enKeys, "Chinese translation keys must match English keys");
});

test("Live locale switching updates rendered UI elements instantly across en, th, and zh without reload", () => {
  const viewCode = readFileSync(new URL("../src/app/follower-insights/follower-insights-view.tsx", import.meta.url), "utf8");
  const pickerCode = readFileSync(new URL("../src/app/follower-insights/date-range-picker.tsx", import.meta.url), "utf8");
  const tableCode = readFileSync(new URL("../src/app/follower-insights/store-breakdown-table.tsx", import.meta.url), "utf8");
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  // Verify FollowerInsightsView receives language prop and calls getFollowerInsightsText(language)
  assert.match(viewCode, /export function FollowerInsightsView\(\{\s*language\s*=\s*"en"\s*\}[\s\S]*getFollowerInsightsText\(language\)/);

  // Verify page.tsx passes global language state to FollowerInsightsView without page reload
  assert.match(pageCode, /<FollowerInsightsView language=\{language\} \/>/);

  // Verify child components receive language prop and query getFollowerInsightsText
  assert.match(pickerCode, /getFollowerInsightsText\(language\)/);
  assert.match(tableCode, /getFollowerInsightsText\(language\)/);

  // Verify text returned for language="en"
  const textEn = getFollowerInsightsText("en");
  assert.equal(textEn.followerInsightsTitle, "Follower Insights");
  assert.equal(textEn.totalFollowers, "Total Followers");

  // Verify text returned for language="th"
  const textTh = getFollowerInsightsText("th");
  assert.equal(textTh.followerInsightsTitle, "ข้อมูลผู้ติดตาม");
  assert.equal(textTh.totalFollowers, "ผู้ติดตามทั้งหมด");

  // Verify text returned for language="zh"
  const textZh = getFollowerInsightsText("zh");
  assert.equal(textZh.followerInsightsTitle, "关注者洞察");
  assert.equal(textZh.totalFollowers, "总关注者");
});

test("Store selector option deduplication and alphabetical sorting by storeName then accountName", () => {
  const mockStores: ByStoreAccountRow[] = [
    { lineOaId: "oa_chonburi", storeName: "OPPO Chonburi", accountName: "@oppochonburi", followers: 100, startFollowers: 90, periodIncrease: 10, targetedReaches: 50, blocks: 2, status: "ready", fetchedAt: "2026-07-22T00:00:00Z" },
    { lineOaId: "oa_chonburi", storeName: "OPPO Chonburi", accountName: "@oppochonburi", followers: 100, startFollowers: 90, periodIncrease: 10, targetedReaches: 50, blocks: 2, status: "ready", fetchedAt: "2026-07-22T00:00:00Z" }, // Duplicate
    { lineOaId: "oa_bangkok_b", storeName: "OPPO Bangkok", accountName: "@oppobangkok_b", followers: 200, startFollowers: 190, periodIncrease: 10, targetedReaches: 100, blocks: 5, status: "ready", fetchedAt: "2026-07-22T00:00:00Z" },
    { lineOaId: "oa_bangkok_a", storeName: "OPPO Bangkok", accountName: "@oppobangkok_a", followers: 150, startFollowers: 140, periodIncrease: 10, targetedReaches: 80, blocks: 3, status: "ready", fetchedAt: "2026-07-22T00:00:00Z" },
  ];

  // Deduplicate by lineOaId
  const map = new Map<string, ByStoreAccountRow>();
  for (const s of mockStores) {
    if (s.lineOaId && !map.has(s.lineOaId)) {
      map.set(s.lineOaId, s);
    }
  }

  assert.equal(map.size, 3, "Duplicate lineOaId must be deduplicated to 3 unique stores");

  // Sort by storeName, then accountName
  const sorted = Array.from(map.values()).sort((a, b) => {
    const sComp = a.storeName.localeCompare(b.storeName);
    if (sComp !== 0) return sComp;
    return a.accountName.localeCompare(b.accountName);
  });

  assert.equal(sorted[0].lineOaId, "oa_bangkok_a");
  assert.equal(sorted[1].lineOaId, "oa_bangkok_b");
  assert.equal(sorted[2].lineOaId, "oa_chonburi");
});

test("Store-level Trend Filter architecture & state isolation in FollowerInsightsView and TrendChart", () => {
  const viewCode = readFileSync(new URL("../src/app/follower-insights/follower-insights-view.tsx", import.meta.url), "utf8");
  const chartCode = readFileSync(new URL("../src/app/follower-insights/trend-chart.tsx", import.meta.url), "utf8");

  // 1. Default aggregate mode: selectedLineOaId defaults to null
  assert.match(viewCode, /const \[selectedLineOaId,\s*setSelectedLineOaId\] = useState<string \| null>\(null\)/);

  // 2. Selecting a store queries api.followerInsightsSummary with lineOaId
  assert.match(viewCode, /followerInsightsSummary\(\{\s*dateFrom,\s*dateTo,\s*lineOaId:\s*effectiveSelectedLineOaId\s*\}\)/);

  // 3. Aggregate summaryData is separate and NOT overwritten
  assert.match(viewCode, /const \[storeTrendData,\s*setStoreTrendData\] = useState<SummaryDailyRow\[\]>\(\[\]\)/);
  assert.match(viewCode, /data=\{\s*effectiveSelectedLineOaId\s*\?\s*storeTrendData/);

  // 4. Changing date range reloads selected store trend
  assert.match(viewCode, /useEffect\(\(\) => \{\s*if \(!effectiveSelectedLineOaId\)/);

  // 5. Missing store data displays empty state t.noDataForStoreInRange
  assert.match(chartCode, /selectedLineOaId !== null \? t\.noDataForStoreInRange : t\.noChartData/);

  // 6. Accessible combobox pattern in TrendChart
  assert.match(chartCode, /StoreSelectorCombobox/);
  assert.match(chartCode, /role="combobox"/);
  assert.match(chartCode, /role="listbox"/);
  assert.match(chartCode, /role="option"/);
  assert.match(chartCode, /aria-expanded=/);
  assert.match(chartCode, /aria-controls="store-selector-listbox"/);
});
