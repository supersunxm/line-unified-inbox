import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateRelativeDateRange,
  isDefinitelyNewerThanMonth,
} from "../src/core/googleReviewDateParser.ts";

test("estimateRelativeDateRange: boundary case on 2026-09-04", () => {
  const ref = new Date("2026-09-04T12:00:00Z");

  // 12 hours ago -> strictly September
  const h12 = estimateRelativeDateRange("12 hours ago", ref);
  assert.ok(h12);
  assert.equal(h12.startMonth, "2026-09");
  assert.equal(h12.endMonth, "2026-09");
  assert.equal(isDefinitelyNewerThanMonth("12 hours ago", "2026-08", ref), true);
  assert.equal(isDefinitelyNewerThanMonth("12 hours ago", "2026-09", ref), false);

  // 3 days ago from Sep 4 -> Sep 1 (strictly September)
  const d3 = estimateRelativeDateRange("3 days ago", ref);
  assert.ok(d3);
  assert.equal(d3.startMonth, "2026-09");
  assert.equal(d3.endMonth, "2026-09");
  assert.equal(isDefinitelyNewerThanMonth("3 days ago", "2026-08", ref), true);

  // 1 week ago from Sep 4 -> Aug 28 (enters August)
  const w1 = estimateRelativeDateRange("1 week ago", ref);
  assert.ok(w1);
  assert.equal(w1.startMonth, "2026-08");
  assert.equal(isDefinitelyNewerThanMonth("1 week ago", "2026-08", ref), false);

  // 3 weeks ago from Sep 4 -> mid-August (enters August)
  const w3 = estimateRelativeDateRange("3 weeks ago", ref);
  assert.ok(w3);
  assert.equal(w3.startMonth, "2026-08");
  assert.equal(isDefinitelyNewerThanMonth("3 weeks ago", "2026-08", ref), false);
});

test("estimateRelativeDateRange: boundary case on 2026-09-28", () => {
  const ref = new Date("2026-09-28T12:00:00Z");

  // 3 weeks ago from Sep 28 -> Sep 7 (strictly September!)
  const w3 = estimateRelativeDateRange("3 weeks ago", ref);
  assert.ok(w3);
  assert.equal(w3.startMonth, "2026-09");
  assert.equal(w3.endMonth, "2026-09");
  assert.equal(isDefinitelyNewerThanMonth("3 weeks ago", "2026-08", ref), true);
});

test("estimateRelativeDateRange: Thai relative strings", () => {
  const ref = new Date("2026-09-04T12:00:00Z");

  const d3Thai = estimateRelativeDateRange("3 วันที่แล้ว", ref);
  assert.ok(d3Thai);
  assert.equal(d3Thai.startMonth, "2026-09");
  assert.equal(isDefinitelyNewerThanMonth("3 วันที่แล้ว", "2026-08", ref), true);

  const w1Thai = estimateRelativeDateRange("1 สัปดาห์ที่แล้ว", ref);
  assert.ok(w1Thai);
  assert.equal(w1Thai.startMonth, "2026-08");
  assert.equal(isDefinitelyNewerThanMonth("1 สัปดาห์ที่แล้ว", "2026-08", ref), false);
});
