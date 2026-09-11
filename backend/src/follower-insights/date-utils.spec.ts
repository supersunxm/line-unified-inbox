import assert from "node:assert/strict";
import test from "node:test";
import { bangkokDateRangeToUtcBounds } from "./date-utils";

test("converts Bangkok calendar dates to a half-open UTC range", () => {
  const bounds = bangkokDateRangeToUtcBounds("2026-09-04", "2026-09-10");

  assert.equal(bounds.startUtc.toISOString(), "2026-09-03T17:00:00.000Z");
  assert.equal(bounds.endExclusiveUtc.toISOString(), "2026-09-10T17:00:00.000Z");
  assert.equal(new Date("2026-09-03T16:59:59.999Z") < bounds.startUtc, true);
  assert.equal(new Date("2026-09-03T17:00:00.000Z") >= bounds.startUtc, true);
  assert.equal(new Date("2026-09-10T16:59:59.999Z") < bounds.endExclusiveUtc, true);
  assert.equal(new Date("2026-09-10T17:00:00.000Z") >= bounds.endExclusiveUtc, true);
});

test("supports one-day, month-boundary, and year-boundary ranges", () => {
  assert.deepEqual(bangkokDateRangeToUtcBounds("2026-09-04", "2026-09-04"), {
    startUtc: new Date("2026-09-03T17:00:00.000Z"),
    endExclusiveUtc: new Date("2026-09-04T17:00:00.000Z"),
  });
  assert.deepEqual(bangkokDateRangeToUtcBounds("2026-08-31", "2026-09-01"), {
    startUtc: new Date("2026-08-30T17:00:00.000Z"),
    endExclusiveUtc: new Date("2026-09-01T17:00:00.000Z"),
  });
  assert.deepEqual(bangkokDateRangeToUtcBounds("2025-12-31", "2026-01-01"), {
    startUtc: new Date("2025-12-30T17:00:00.000Z"),
    endExclusiveUtc: new Date("2026-01-01T17:00:00.000Z"),
  });
});

test("rejects invalid and reversed reporting dates", () => {
  assert.throws(() => bangkokDateRangeToUtcBounds("2026-02-30", "2026-03-01"), /Invalid calendar date/);
  assert.throws(() => bangkokDateRangeToUtcBounds("2026-09-05", "2026-09-04"), /cannot be earlier/);
});
