import assert from "node:assert/strict";
import test from "node:test";
import {
  comparisonLabel,
  daysInMonth,
  monthStartMs,
  monthWindow,
  parseV2Month,
  periodDays,
  selectableMonths,
  shiftMonth,
  trendMonths,
} from "../src/lib/v2/month.ts";

const bkk = (iso: string) => Date.parse(`${iso}+07:00`);

test("month boundaries are Bangkok midnights", () => {
  assert.equal(new Date(monthStartMs("2026-10")).toISOString(), "2026-09-30T17:00:00.000Z");
  assert.equal(new Date(monthStartMs("2027-01")).toISOString(), "2026-12-31T17:00:00.000Z");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(daysInMonth("2028-02"), 29);
});

test("?month defaults to the current Bangkok month and accepts only /chats-selectable months", () => {
  // 2026-09-30 18:00 UTC is already 1 Oct in Bangkok.
  const now = Date.parse("2026-09-30T18:00:00Z");
  assert.equal(parseV2Month(null, now), "2026-10");
  assert.equal(parseV2Month("2026-09", now), "2026-09");
  assert.equal(parseV2Month("2026-08", now), "2026-10", "before reply-status coverage");
  assert.equal(parseV2Month("2026-11", now), "2026-10", "future");
  assert.equal(parseV2Month("all", now), "2026-10");
  assert.equal(parseV2Month("2026-9", now), "2026-10");
  assert.deepEqual(selectableMonths(now), ["2026-10", "2026-09"]);
});

test("month-to-date compares with the same days of the previous month, cut at the same elapsed time", () => {
  const now = bkk("2026-10-07T14:30:00");
  const window = monthWindow("2026-10", now);
  assert.equal(window.inProgress, true);
  assert.equal(window.current.dateFrom, "2026-10-01");
  assert.equal(window.current.dateTo, "2026-10-07");
  assert.equal(window.current.lastDay, 7);
  assert.equal(window.current.endMs, now);
  assert.equal(window.previous.dateFrom, "2026-09-01");
  assert.equal(window.previous.dateTo, "2026-09-07");
  assert.equal(window.previous.lastDay, 7);
  assert.equal(window.previous.endMs, bkk("2026-09-07T14:30:00"));
  assert.equal(window.previous.wholeMonth, false);
  assert.equal(window.current.lastDay, window.previous.lastDay, "same number of days");
  assert.equal(comparisonLabel(window), "1–7 ต.ค. 2026 เทียบ 1–7 ก.ย. 2026");
});

test("the first day of a month compares day 1 with day 1", () => {
  const window = monthWindow("2026-10", bkk("2026-10-01T00:05:00"));
  assert.equal(window.current.lastDay, 1);
  assert.equal(window.previous.dateTo, "2026-09-01");
  assert.equal(window.previous.endMs, bkk("2026-09-01T00:05:00"));
  assert.equal(comparisonLabel(window), "1 ต.ค. 2026 เทียบ 1 ก.ย. 2026");
});

test("late in a long month, the shorter previous month is capped and said to be whole", () => {
  const window = monthWindow("2027-03", bkk("2027-03-30T09:00:00"));
  assert.equal(window.current.lastDay, 30);
  assert.equal(window.previous.month, "2027-02");
  assert.equal(window.previous.lastDay, 28);
  assert.equal(window.previous.dateTo, "2027-02-28");
  assert.equal(window.previous.endMs, monthStartMs("2027-03"));
  assert.equal(window.previous.wholeMonth, true);
  assert.equal(comparisonLabel(window), "1–30 มี.ค. 2027 เทียบ ทั้งเดือน ก.พ. 2027");
});

test("a closed month compares whole month with whole month", () => {
  const window = monthWindow("2026-10", bkk("2026-11-03T10:00:00"));
  assert.equal(window.inProgress, false);
  assert.equal(window.current.dateTo, "2026-10-31");
  assert.equal(window.current.endMs, monthStartMs("2026-11"));
  assert.equal(window.previous.dateTo, "2026-09-30");
  assert.equal(window.previous.endMs, monthStartMs("2026-10"));
  assert.equal(comparisonLabel(window), "ทั้งเดือน ต.ค. 2026 เทียบ ทั้งเดือน ก.ย. 2026");
});

test("the coverage month's previous month is marked not collected", () => {
  assert.equal(monthWindow("2026-09", bkk("2026-10-07T10:00:00")).previousCollected, false);
  assert.equal(monthWindow("2026-10", bkk("2026-10-07T10:00:00")).previousCollected, true);
});

test("trend months never start before the coverage month; period days list every day", () => {
  assert.deepEqual(trendMonths("2026-10"), ["2026-09", "2026-10"]);
  assert.deepEqual(trendMonths("2027-04"), ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"]);
  const days = periodDays(monthWindow("2026-10", bkk("2026-10-07T10:00:00")).current);
  assert.deepEqual(days, ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"]);
});
