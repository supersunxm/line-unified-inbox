import assert from "node:assert/strict";
import test from "node:test";
import { closeDueAt, isBackfill, MONTH_CLOSE_GRACE_DAYS, monthDays, monthHasEnded, monthsDueForClose } from "./month-close-rules";

void test("a month closes at 00:00 Bangkok on day (1 + grace) of the next month", () => {
  assert.equal(MONTH_CLOSE_GRACE_DAYS, 1);
  assert.equal(closeDueAt("2026-09").toISOString(), "2026-10-01T17:00:00.000Z", "2 Oct 00:00 Bangkok");
  assert.equal(closeDueAt("2026-12").toISOString(), "2027-01-01T17:00:00.000Z", "year boundary");
  assert.equal(closeDueAt("2027-02", 3).toISOString(), "2027-03-03T17:00:00.000Z");
});

void test("months due: from the coverage month, only once their due time has passed", () => {
  assert.deepEqual(monthsDueForClose(new Date("2026-10-01T16:59:59Z")), []);
  assert.deepEqual(monthsDueForClose(new Date("2026-10-01T17:00:00Z")), ["2026-09"]);
  assert.deepEqual(monthsDueForClose(new Date("2026-10-07T05:00:00Z")), ["2026-09"]);
  assert.deepEqual(monthsDueForClose(new Date("2026-11-01T17:00:00Z")), ["2026-09", "2026-10"]);
});

void test("September 2026 closed today is a backfill; an on-time close is not", () => {
  assert.equal(isBackfill(closeDueAt("2026-09"), new Date("2026-10-07T06:00:00Z")), true);
  assert.equal(isBackfill(closeDueAt("2026-10"), new Date("2026-11-01T17:10:00Z")), false);
});

void test("a month can be closed only after it ends; month day bounds", () => {
  assert.equal(monthHasEnded("2026-10", new Date("2026-10-31T16:59:59Z")), false);
  assert.equal(monthHasEnded("2026-10", new Date("2026-10-31T17:00:00Z")), true);
  assert.deepEqual(monthDays("2028-02"), { dateFrom: "2028-02-01", dateTo: "2028-02-29" });
});
