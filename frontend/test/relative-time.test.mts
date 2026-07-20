import assert from "node:assert/strict";
import test from "node:test";
import { formatRelativeTime } from "../src/app/relative-time.ts";

const now = new Date("2026-07-20T12:00:00.000Z");
const ago = (milliseconds: number) => new Date(now.getTime() - milliseconds).toISOString();
const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

test("formats Thai relative-time boundaries", () => {
  const cases: Array<[string, string]> = [
    [ago(30_000), "เมื่อสักครู่"],
    [ago(minute), "1 นาทีที่แล้ว"],
    [ago(59 * minute), "59 นาทีที่แล้ว"],
    [ago(hour), "1 ชั่วโมงที่แล้ว"],
    [ago(hour + minute), "1 ชั่วโมง 1 นาทีที่แล้ว"],
    [ago(90 * minute), "1 ชั่วโมง 30 นาทีที่แล้ว"],
    [ago(day), "1 วันที่แล้ว"],
    [ago(2 * day), "2 วันที่แล้ว"],
    [ago(30 * day), "1 เดือนที่แล้ว"],
    [ago(75 * day), "2 เดือนที่แล้ว"],
    [ago(365 * day), "1 ปีที่แล้ว"],
    [ago(730 * day), "2 ปีที่แล้ว"],
  ];
  for (const [timestamp, expected] of cases) {
    assert.equal(formatRelativeTime(timestamp, "th", now), expected);
  }
});

test("handles invalid and missing timestamps safely", () => {
  assert.equal(formatRelativeTime("not-a-date", "th", now), "-");
  assert.equal(formatRelativeTime(null, "th", now), "-");
  assert.equal(formatRelativeTime(undefined, "th", now), "-");
});
