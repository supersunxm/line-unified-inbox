import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_CLOSE_MINUTE,
  BUSINESS_MINUTES_PER_DAY,
  BUSINESS_OPEN_MINUTE,
  FOLLOW_UP_THRESHOLD_MINUTES,
  RESPONSE_RATE_TARGET_PERCENT,
  businessMinutesBetween,
  formatSentAt,
  formatWaitMinutes,
  needsFollowUp,
  waitSpansClosedHours,
} from "../src/lib/v2/business-hours.ts";

// Bangkok local time, written as an ISO string with the +07:00 offset.
const bkk = (local: string) => `${local}+07:00`;

test("the defaults live in one place: 10:00-21:00, 60-minute follow-up, 90% target", () => {
  assert.equal(BUSINESS_OPEN_MINUTE, 600);
  assert.equal(BUSINESS_CLOSE_MINUTE, 1260);
  assert.equal(BUSINESS_MINUTES_PER_DAY, 660);
  assert.equal(FOLLOW_UP_THRESHOLD_MINUTES, 60);
  assert.equal(RESPONSE_RATE_TARGET_PERCENT, 90);
});

test("counts only open minutes within one day", () => {
  assert.equal(businessMinutesBetween(bkk("2026-10-04T10:30:00"), bkk("2026-10-04T11:15:00")), 45);
  assert.equal(businessMinutesBetween(bkk("2026-10-04T20:45:00"), bkk("2026-10-04T23:00:00")), 15);
  assert.equal(businessMinutesBetween(bkk("2026-10-04T21:30:00"), bkk("2026-10-04T22:00:00")), 0);
});

test("a message before opening starts counting at 10:00", () => {
  assert.equal(businessMinutesBetween(bkk("2026-10-04T08:00:00"), bkk("2026-10-04T10:30:00")), 30);
  assert.equal(businessMinutesBetween(bkk("2026-10-04T08:00:00"), bkk("2026-10-04T09:59:00")), 0);
});

test("an overnight message counts the evening and the next morning only", () => {
  // 20:30-21:00 (30) + 10:00-10:30 (30)
  assert.equal(businessMinutesBetween(bkk("2026-10-03T20:30:00"), bkk("2026-10-04T10:30:00")), 60);
  // Sent after closing: nothing counts until the next opening.
  assert.equal(businessMinutesBetween(bkk("2026-10-03T22:00:00"), bkk("2026-10-04T10:05:00")), 5);
});

test("multi-day waits add a full 11 hours per day in between", () => {
  // 20:00-21:00 (60) + one full day (660) + 10:00-11:00 (60)
  assert.equal(businessMinutesBetween(bkk("2026-10-01T20:00:00"), bkk("2026-10-03T11:00:00")), 780);
  assert.equal(businessMinutesBetween(bkk("2026-10-01T00:00:00"), bkk("2026-10-08T00:00:00")), 7 * 660);
});

test("uses Bangkok days, not UTC days, and has no DST shifts", () => {
  // 06:00 Bangkok is 23:00 UTC the previous day.
  assert.equal(businessMinutesBetween("2026-10-03T23:00:00Z", "2026-10-04T04:00:00Z"), 60);
  // Across the European (late March / late October) and US DST changes: still 660 a day.
  assert.equal(businessMinutesBetween(bkk("2026-03-28T00:00:00"), bkk("2026-03-31T00:00:00")), 3 * 660);
  assert.equal(businessMinutesBetween(bkk("2026-10-24T00:00:00"), bkk("2026-10-27T00:00:00")), 3 * 660);
  assert.equal(businessMinutesBetween(bkk("2026-11-01T00:00:00"), bkk("2026-11-02T00:00:00")), 660);
});

test("returns 0 when end is not after start, or for invalid input", () => {
  assert.equal(businessMinutesBetween(bkk("2026-10-04T12:00:00"), bkk("2026-10-04T11:00:00")), 0);
  assert.equal(businessMinutesBetween(bkk("2026-10-04T12:00:00"), bkk("2026-10-04T12:00:00")), 0);
  assert.equal(businessMinutesBetween("not a date", bkk("2026-10-04T12:00:00")), 0);
});

test("follow-up starts at the threshold", () => {
  assert.equal(needsFollowUp(59), false);
  assert.equal(needsFollowUp(60), true);
});

test("labels: wait duration, real send time, and whether they differ", () => {
  assert.equal(formatWaitMinutes(45), "45 นาที");
  assert.equal(formatWaitMinutes(125), "2 ชม. 5 นาที");
  assert.equal(formatWaitMinutes(780), "13 ชม.");
  const now = bkk("2026-10-04T10:30:00");
  assert.equal(formatSentAt(bkk("2026-10-04T10:05:00"), now), "วันนี้ 10:05");
  assert.equal(formatSentAt(bkk("2026-10-03T20:30:00"), now), "เมื่อวาน 20:30");
  assert.equal(formatSentAt(bkk("2026-10-01T09:12:00"), now), "1 ต.ค. 09:12");
  assert.equal(waitSpansClosedHours(bkk("2026-10-03T20:30:00"), now), true);
  assert.equal(waitSpansClosedHours(bkk("2026-10-04T10:05:00"), now), false);
});
