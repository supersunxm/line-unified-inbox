import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCoverage,
  calculatePaginationBounds,
  escapeCsvCell,
  getInclusiveCalendarDays,
  validateDateRange,
} from "../src/app/follower-insights/follower-insights-utils.ts";
import type { SummaryDailyRow } from "../src/types/api.ts";

test("getInclusiveCalendarDays calculates pure UTC calendar day differences", () => {
  assert.equal(getInclusiveCalendarDays("2026-07-01", "2026-07-01"), 1);
  assert.equal(getInclusiveCalendarDays("2026-07-01", "2026-07-07"), 7);
  assert.equal(getInclusiveCalendarDays("2026-07-01", "2026-09-28"), 90);
  assert.equal(getInclusiveCalendarDays("2026-07-01", "2026-09-29"), 91);
  assert.equal(getInclusiveCalendarDays("2026-07-15", "2026-07-01"), 0);
});

test("validateDateRange enforces exact 90 calendar day limits and date ordering", () => {
  const allowed = validateDateRange("2026-07-01", "2026-09-28");
  assert.equal(allowed.valid, true);
  assert.equal(allowed.error, null);

  const rejected91 = validateDateRange("2026-07-01", "2026-09-29");
  assert.equal(rejected91.valid, false);
  assert.equal(rejected91.error, "Date range cannot exceed 90 calendar days.");

  const reversed = validateDateRange("2026-07-15", "2026-07-01");
  assert.equal(reversed.valid, false);
  assert.equal(reversed.error, "End date cannot be earlier than start date.");
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
