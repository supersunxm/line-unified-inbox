import assert from "node:assert/strict";
import test from "node:test";
import { matchesPreset, PERIOD_PRESETS, presetRange, selectDraftDate } from "../src/components/date-range/period-range.ts";
import { formatDateDisplay, getBkkDateStr, getInclusiveCalendarDays, validateDateRange } from "../src/app/follower-insights/follower-insights-utils.ts";

test("presets produce inclusive API dates across month, year, leap-day and DST boundaries", () => {
  for (const today of ["2026-09-08", "2026-01-03", "2024-03-01", "2026-03-10"]) {
    for (const days of PERIOD_PRESETS) {
      const range = presetRange(days, today);
      assert.equal(getInclusiveCalendarDays(range.dateFrom, range.dateTo), days);
      assert.equal(range.dateTo, today);
      assert.equal(matchesPreset(range, days, today), true);
      const params = new URLSearchParams(range);
      assert.equal(params.get("dateFrom"), range.dateFrom);
      assert.equal(params.get("dateTo"), today);
    }
  }
  assert.deepEqual(presetRange(7, "2026-09-08"), { dateFrom: "2026-09-02", dateTo: "2026-09-08" });
});

test("historical ranges of the same length do not activate a preset", () => {
  assert.equal(matchesPreset({ dateFrom: "2026-09-01", dateTo: "2026-09-07" }, 7, "2026-09-08"), false);
});

test("draft selection preserves committed data, sorts reverse selection, and restarts completed ranges", () => {
  const committed = { start: "2026-09-02", end: "2026-09-08" };
  const first = selectDraftDate(committed, "2026-08-20");
  assert.deepEqual(first, { start: "2026-08-20", end: null });
  assert.deepEqual(selectDraftDate(first, "2026-08-01"), { start: "2026-08-01", end: "2026-08-20" });
  assert.deepEqual(selectDraftDate(first, "2026-08-20"), { start: "2026-08-20", end: "2026-08-20" });
  assert.deepEqual(committed, { start: "2026-09-02", end: "2026-09-08" });
});

test("90 inclusive days pass and 91 days or reversed dates fail", () => {
  assert.equal(validateDateRange("2026-06-11", "2026-09-08").valid, true);
  assert.equal(validateDateRange("2026-06-10", "2026-09-08").valid, false);
  assert.equal(validateDateRange("2026-09-08", "2026-09-02").valid, false);
});

test("Thai labels retain Gregorian years and Bangkok determines today", () => {
  assert.equal(formatDateDisplay("2026-09-02", "th"), "2 ก.ย. 2026");
  assert.equal(getBkkDateStr(new Date("2026-09-07T18:00:00Z")), "2026-09-08");
});
