import test from "node:test";
import assert from "node:assert/strict";
import { parseGoogleReviewDateToMonth, parseGoogleReviewDate } from "../src/core/googleReviewDateParser.ts";

test("parseGoogleReviewDateToMonth parses relative English date strings", () => {
  const ref = new Date("2026-09-02T12:00:00Z");

  // Today / hours ago -> 2026-09
  assert.equal(parseGoogleReviewDateToMonth("2 hours ago", ref), "2026-09");
  assert.equal(parseGoogleReviewDateToMonth("today", ref), "2026-09");
  assert.equal(parseGoogleReviewDateToMonth("yesterday", ref), "2026-09");

  // 2 days ago -> 2026-08 (August 31)
  assert.equal(parseGoogleReviewDateToMonth("2 days ago", ref), "2026-08");

  // 1 week ago -> 2026-08 (August 26)
  assert.equal(parseGoogleReviewDateToMonth("1 week ago", ref), "2026-08");
  assert.equal(parseGoogleReviewDateToMonth("3 weeks ago", ref), "2026-08");

  // a month ago -> 2026-08
  assert.equal(parseGoogleReviewDateToMonth("a month ago", ref), "2026-08");
  assert.equal(parseGoogleReviewDateToMonth("1 month ago", ref), "2026-08");
  assert.equal(parseGoogleReviewDateToMonth("2 months ago", ref), "2026-07");
  assert.equal(parseGoogleReviewDateToMonth("a year ago", ref), "2025-09");
});

test("parseGoogleReviewDateToMonth parses relative Thai date strings", () => {
  const ref = new Date("2026-09-02T12:00:00Z");

  assert.equal(parseGoogleReviewDateToMonth("3 ชั่วโมงที่แล้ว", ref), "2026-09");
  assert.equal(parseGoogleReviewDateToMonth("เมื่อวานนี้", ref), "2026-09");
  assert.equal(parseGoogleReviewDateToMonth("2 วันที่แล้ว", ref), "2026-08");
  assert.equal(parseGoogleReviewDateToMonth("1 สัปดาห์ที่แล้ว", ref), "2026-08");
  assert.equal(parseGoogleReviewDateToMonth("3 สัปดาห์ที่แล้ว", ref), "2026-08");
  assert.equal(parseGoogleReviewDateToMonth("1 เดือนที่แล้ว", ref), "2026-08");
  assert.equal(parseGoogleReviewDateToMonth("2 เดือนที่แล้ว", ref), "2026-07");
  assert.equal(parseGoogleReviewDateToMonth("1 ปีที่แล้ว", ref), "2025-09");
});

test("parseGoogleReviewDateToMonth parses explicit dates", () => {
  const ref = new Date("2026-09-02T12:00:00Z");

  assert.equal(parseGoogleReviewDateToMonth("2026-08-15", ref), "2026-08");
  assert.equal(parseGoogleReviewDateToMonth("August 2026", ref), "2026-08");
  assert.equal(parseGoogleReviewDateToMonth("สิงหาคม 2569", ref), "2026-08");
});

test("parseGoogleReviewDateToMonth handles edited reviews by failing closed to null (ORIGINAL_DATE_UNKNOWN)", () => {
  const ref = new Date("2026-09-02T12:00:00Z");

  // English: Edited X ago
  assert.equal(parseGoogleReviewDateToMonth("Edited 4 weeks ago", ref), null);
  assert.equal(parseGoogleReviewDateToMonth("Edited 2 days ago", ref), null);
  assert.equal(parseGoogleReviewDateToMonth("Edited a month ago", ref), null);
  assert.equal(parseGoogleReviewDateToMonth("Edited yesterday", ref), null);

  // Thai: แก้ไขเมื่อ X ที่แล้ว
  assert.equal(parseGoogleReviewDateToMonth("แก้ไขเมื่อ 4 สัปดาห์ที่แล้ว", ref), null);
  assert.equal(parseGoogleReviewDateToMonth("แก้ไขเมื่อ 2 วันที่แล้ว", ref), null);
  assert.equal(parseGoogleReviewDateToMonth("แก้ไขเมื่อ 1 เดือนที่แล้ว", ref), null);

  // Detailed parse result check
  const parsed = parseGoogleReviewDate("Edited 4 weeks ago", ref);
  assert.equal(parsed.isEdited, true);
  assert.equal(parsed.month, null);
  assert.equal(parsed.status, "EDITED_ORIGINAL_UNKNOWN");

  const parsedThai = parseGoogleReviewDate("แก้ไขเมื่อ 4 สัปดาห์ที่แล้ว", ref);
  assert.equal(parsedThai.isEdited, true);
  assert.equal(parsedThai.month, null);
  assert.equal(parsedThai.status, "EDITED_ORIGINAL_UNKNOWN");
});

test("parseGoogleReviewDateToMonth returns null (UNKNOWN_DATE) for invalid or uncertain strings", () => {
  assert.equal(parseGoogleReviewDateToMonth(""), null);
  assert.equal(parseGoogleReviewDateToMonth("   "), null);
  assert.equal(parseGoogleReviewDateToMonth(null), null);
  assert.equal(parseGoogleReviewDateToMonth("some random text"), null);
});
