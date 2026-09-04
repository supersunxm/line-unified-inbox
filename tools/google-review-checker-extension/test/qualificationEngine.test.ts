import test from "node:test";
import assert from "node:assert/strict";
import { QualificationEngine } from "../src/core/qualificationEngine.ts";
import type { ExtractedRawReview } from "../src/core/googleMapsDomAdapter.ts";

function createMockElement(attributes: Record<string, string> = {}): Element {
  return {
    getAttribute: (name: string) => attributes[name] ?? null,
    querySelectorAll: () => [],
    querySelector: () => null,
    textContent: "mock review text",
  } as unknown as Element;
}

const thai16Words = "กบ มด นก กา ไก่ เป็ด หมู หมา ม้า วัว เสือ ปลา กุ้ง หอย ปู ช้าง";
const thai15Words = "กบ มด นก กา ไก่ เป็ด หมู หมา ม้า วัว เสือ ปลา กุ้ง หอย ปู";
const thai14Words = "กบ มด นก กา ไก่ เป็ด หมู หมา ม้า วัว เสือ ปลา กุ้ง หอย";

test("QualificationEngine: correct image capture month + image + 16 words -> qualified === true", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-1" }),
    reviewId: "rev-1",
    dateText: "3 weeks ago",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-09"],
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-09", 0, ref);
  assert.equal(evalItem.hasPhoto, true);
  assert.equal(evalItem.resolvedImageCaptureMonth, "2026-09");
  assert.equal(evalItem.isTargetImageMonth, true);
  assert.equal(evalItem.isAtLeast15Words, true);
  assert.equal(evalItem.isQualified, true);
  assert.equal(evalItem.qualificationRuleVersion, "IMAGE_CAPTURE_MONTH_V1");
});

test("QualificationEngine: 15 words boundary (15 words = PASS, 14 words = FAIL)", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw15: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-15" }),
    reviewId: "rev-15",
    dateText: "1 week ago",
    reviewText: thai15Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-09"],
  };
  const eval15 = QualificationEngine.evaluateReview(raw15, "2026-09", 0, ref);
  assert.equal(eval15.isAtLeast15Words, true);
  assert.equal(eval15.isQualified, true);

  const raw14: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-14" }),
    reviewId: "rev-14",
    dateText: "1 week ago",
    reviewText: thai14Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-09"],
  };
  const eval14 = QualificationEngine.evaluateReview(raw14, "2026-09", 0, ref);
  assert.equal(eval14.isAtLeast15Words, false);
  assert.equal(eval14.isQualified, false);
});

test("QualificationEngine: text-only review (no image) -> skipped from photo qualification", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-text-only" }),
    reviewId: "rev-text-only",
    dateText: "1 week ago",
    reviewText: thai16Words,
    hasCustomerPhoto: false,
    photoEvidence: "NONE",
    imageCaptureMonths: [],
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-09", 0, ref);
  assert.equal(evalItem.hasPhoto, false);
  assert.equal(evalItem.imageMonthStatus, "NO_IMAGES");
  assert.equal(evalItem.isQualified, false);
});

test("QualificationEngine: image capture month mismatch (Aug 2026 vs Sep 2026 target) -> qualified === false", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-aug" }),
    reviewId: "rev-aug",
    dateText: "yesterday", // Review posted in Sep, but photo taken in Aug
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-08"],
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-09", 0, ref);
  assert.equal(evalItem.hasPhoto, true);
  assert.equal(evalItem.resolvedImageCaptureMonth, "2026-08");
  assert.equal(evalItem.isTargetImageMonth, false);
  assert.equal(evalItem.isQualified, false);
});

test("QualificationEngine: multiple photos with same month -> RESOLVED and qualifies", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-multi-same" }),
    reviewId: "rev-multi-same",
    dateText: "3 days ago",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_GALLERY",
    imageCaptureMonths: ["2026-09", "2026-09"],
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-09", 0, ref);
  assert.equal(evalItem.imageMonthStatus, "RESOLVED");
  assert.equal(evalItem.resolvedImageCaptureMonth, "2026-09");
  assert.equal(evalItem.isQualified, true);
});

test("QualificationEngine: multiple photos with different months -> MIXED_IMAGE_MONTH and qualified === false", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-multi-diff" }),
    reviewId: "rev-multi-diff",
    dateText: "3 days ago",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_GALLERY",
    imageCaptureMonths: ["2026-08", "2026-09"],
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-09", 0, ref);
  assert.equal(evalItem.imageMonthStatus, "MIXED_IMAGE_MONTH");
  assert.equal(evalItem.resolvedImageCaptureMonth, null);
  assert.equal(evalItem.isQualified, false);
});

test("QualificationEngine: missing/unknown image metadata -> IMAGE_MONTH_UNKNOWN and qualified === false", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-unknown-img" }),
    reviewId: "rev-unknown-img",
    dateText: "3 days ago",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: [], // Cannot be read
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-09", 0, ref);
  assert.equal(evalItem.imageMonthStatus, "IMAGE_MONTH_UNKNOWN");
  assert.equal(evalItem.isQualified, false);
});

test("QualificationEngine: edited review is entirely excluded from qualification even with matching photo & 15+ words", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const rawEdited: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-edited-matching-photo" }),
    reviewId: "rev-edited-matching-photo",
    dateText: "แก้ไขเมื่อ 2 วันที่แล้ว", // Edited 2 days ago
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-09"], // Matching target month
  };

  const evalItem = QualificationEngine.evaluateReview(rawEdited, "2026-09", 0, ref);
  assert.equal(evalItem.isEdited, true);
  assert.equal(evalItem.hasPhoto, true);
  assert.equal(evalItem.resolvedImageCaptureMonth, "2026-09");
  assert.equal(evalItem.isTargetImageMonth, true);
  assert.equal(evalItem.isAtLeast15Words, true);
  // MUST NOT QUALIFY because isEdited === true
  assert.equal(evalItem.isQualified, false);
  assert.equal(evalItem.stopBoundaryTriggered, false);
});

test("QualificationEngine: old review-date data cannot qualify a review by itself", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  // Review creation date is in target month ("today" = Sep 2026), but photo was captured in Aug 2026
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-old-rule" }),
    reviewId: "rev-old-rule",
    dateText: "today",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-08"],
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-09", 0, ref);
  // Old review date parsed to target month
  assert.equal(evalItem.isDateInMonth, true);
  // BUT new image capture month is Aug 2026, so NOT target image month and NOT qualified!
  assert.equal(evalItem.isTargetImageMonth, false);
  assert.equal(evalItem.isQualified, false);
});

test("QualificationEngine: deduplicates multiple occurrences of same review", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-dup" }),
    reviewId: "rev-dup",
    dateText: "1 week ago",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-09"],
  };

  // Same review card appearing twice in raw array
  const summary = QualificationEngine.calculateScanSummary([raw, raw], "2026-09", ref, false);
  assert.equal(summary.reviewsChecked, 1);
  assert.equal(summary.qualifiedReviews, 1);
});

test("Audit Completion: Physical scroll bottom -> END_OF_AVAILABLE_REVIEWS", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-end" }),
    reviewId: "rev-end",
    dateText: "12 hours ago",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-09"],
  };

  const summary = QualificationEngine.calculateScanSummary([raw], "2026-09", ref, true);
  assert.equal(summary.auditCoverageStatus, "END_OF_AVAILABLE_REVIEWS");
});

test("Audit Completion: Older photo inside recent review does NOT stop scan; unedited older review STOPS scan", () => {
  const ref = new Date("2026-09-04T12:00:00Z");

  // Review 1: 12 hours ago (Sep 2026), Photo Sep 2026, 16 words -> QUALIFIED
  const r1: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-1" }),
    reviewId: "rev-1",
    dateText: "12 hours ago",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-09"],
  };

  // Review 2: 3 days ago (Sep 2026), Photo Sep 2026, 14 words -> NOT qualified (words < 15), NOT stop
  const r2: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-2" }),
    reviewId: "rev-2",
    dateText: "3 days ago",
    reviewText: thai14Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-09"],
  };

  // Review 3 (Similar to CentralWorld #6): Edited 21 hours ago, Photo Jan 2026 -> NOT qualified, MUST NOT STOP
  const r3EditedOldPhoto: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-3" }),
    reviewId: "rev-3",
    dateText: "แก้ไขเมื่อ 21 ชั่วโมงที่ผ่านมา",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-01"], // Old photo
  };

  // Review 4: 2 days ago (Sep 2026), Photo Sep 2026, 16 words -> Processed! QUALIFIED
  const r4AfterR3: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-4" }),
    reviewId: "rev-4",
    dateText: "2 days ago",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-09"],
  };

  // Review 5 (Chronological stop): 1 month ago (Aug 2026 on Sep 4) -> Chronological boundary reached! STOPS scan
  const r5OlderChronology: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-5" }),
    reviewId: "rev-5",
    dateText: "1 month ago",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-08"],
  };

  // Review 6 (After stop): 2 months ago -> Should NOT be scanned
  const r6AfterStop: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-6" }),
    reviewId: "rev-6",
    dateText: "2 months ago",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    imageCaptureMonths: ["2026-07"],
  };

  // Test individual review evaluation for r3 (CentralWorld #6 scenario)
  const evalR3 = QualificationEngine.evaluateReview(r3EditedOldPhoto, "2026-09", 2, ref);
  assert.equal(evalR3.isEdited, true);
  assert.equal(evalR3.chronologicalBoundaryEligible, false);
  assert.equal(evalR3.isTargetImageMonth, false);
  assert.equal(evalR3.isQualified, false);
  assert.equal(evalR3.stopBoundaryTriggered, false); // MUST NOT STOP!

  // Test individual review evaluation for r5 (Chronological boundary stop)
  const evalR5 = QualificationEngine.evaluateReview(r5OlderChronology, "2026-09", 4, ref);
  assert.equal(evalR5.isEdited, false);
  assert.equal(evalR5.chronologicalBoundaryEligible, true);
  assert.equal(evalR5.chronologicalRelation, "OLDER");
  assert.equal(evalR5.stopBoundaryTriggered, true); // STOPS!

  // Test batch summary
  const summary = QualificationEngine.calculateScanSummary(
    [r1, r2, r3EditedOldPhoto, r4AfterR3, r5OlderChronology, r6AfterStop],
    "2026-09",
    ref,
    false,
  );

  assert.equal(summary.auditCoverageStatus, "OLDER_THAN_TARGET_REACHED");
  assert.equal(summary.reviewsScanned, 5); // Processed r1, r2, r3, r4, r5. r6 was never processed!
  assert.equal(summary.firstOlderReviewDateText, "1 month ago");
  assert.equal(summary.stopBoundarySequence, 5);
  assert.equal(summary.qualifiedReviews, 2); // r1 and r4 are qualified
});

