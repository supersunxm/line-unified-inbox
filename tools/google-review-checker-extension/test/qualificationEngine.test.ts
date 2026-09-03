import test from "node:test";
import assert from "node:assert/strict";
import { QualificationEngine } from "../src/core/qualificationEngine.ts";
import type { ExtractedRawReview } from "../src/core/googleMapsDomAdapter.ts";

function createMockElement(attributes: Record<string, string> = {}): Element {
  return {
    getAttribute: (name: string) => attributes[name] ?? null,
    querySelectorAll: () => [],
    textContent: "mock review text",
  } as unknown as Element;
}

const thai16Words = "กบ มด นก กา ไก่ เป็ด หมู หมา ม้า วัว เสือ ปลา กุ้ง หอย ปู ช้าง";
const thai15Words = "กบ มด นก กา ไก่ เป็ด หมู หมา ม้า วัว เสือ ปลา กุ้ง หอย ปู";
const thai14Words = "กบ มด นก กา ไก่ เป็ด หมู หมา ม้า วัว เสือ ปลา กุ้ง หอย";

test("QualificationEngine: correct month + image + 16 words -> qualified === true", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-1" }),
    reviewId: "rev-1",
    dateText: "1 month ago", // August 2026
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-08", 0, ref);
  assert.equal(evalItem.isDateInMonth, true);
  assert.equal(evalItem.hasPhoto, true);
  assert.equal(evalItem.isAtLeast15Words, true);
  assert.equal(evalItem.isQualified, true);
});

test("QualificationEngine: correct month + image + 15 words -> qualified === true (New >= 15 threshold PASS)", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-2" }),
    reviewId: "rev-2",
    dateText: "1 month ago",
    reviewText: thai15Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-08", 0, ref);
  assert.equal(evalItem.isDateInMonth, true);
  assert.equal(evalItem.hasPhoto, true);
  assert.equal(evalItem.isAtLeast15Words, true); // exactly 15 is >= 15 PASS
  assert.equal(evalItem.isQualified, true);
});

test("QualificationEngine: correct month + image + 14 words -> qualified === false (14 words is NOT PASS)", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-14w" }),
    reviewId: "rev-14w",
    dateText: "1 month ago",
    reviewText: thai14Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-08", 0, ref);
  assert.equal(evalItem.isDateInMonth, true);
  assert.equal(evalItem.hasPhoto, true);
  assert.equal(evalItem.isAtLeast15Words, false); // 14 words fails
  assert.equal(evalItem.isQualified, false);
});

test("QualificationEngine: correct month + no image + 16 words -> qualified === false", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-3" }),
    reviewId: "rev-3",
    dateText: "1 month ago",
    reviewText: thai16Words,
    hasCustomerPhoto: false,
    photoEvidence: "NONE",
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-08", 0, ref);
  assert.equal(evalItem.isDateInMonth, true);
  assert.equal(evalItem.hasPhoto, false);
  assert.equal(evalItem.isOver15Words, true);
  assert.equal(evalItem.isQualified, false);
});

test("QualificationEngine: wrong month + image + 16 words -> qualified === false", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-4" }),
    reviewId: "rev-4",
    dateText: "today", // September 2026
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-08", 0, ref);
  assert.equal(evalItem.isDateInMonth, false);
  assert.equal(evalItem.hasPhoto, true);
  assert.equal(evalItem.isOver15Words, true);
  assert.equal(evalItem.isQualified, false);
});

test("QualificationEngine: unknown date + image + 16 words -> qualified === false", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-5" }),
    reviewId: "rev-5",
    dateText: "unknown date text",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-08", 0, ref);
  assert.equal(evalItem.isDateInMonth, false);
  assert.equal(evalItem.month, null);
  assert.equal(evalItem.isQualified, false);
});

test("QualificationEngine: Edited review with unknown original date -> excluded from qualified count", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const raw: ExtractedRawReview = {
    element: createMockElement({ "data-review-id": "rev-edited-1" }),
    reviewId: "rev-edited-1",
    dateText: "Edited 4 weeks ago",
    reviewText: thai16Words,
    hasCustomerPhoto: true,
    photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-08", 0, ref);
  assert.equal(evalItem.isEdited, true);
  assert.equal(evalItem.month, null);
  assert.equal(evalItem.isDateInMonth, false);
  assert.equal(evalItem.isQualified, false);
});

// =================== COMPLETION CONDITION TESTS ===================

test("Audit Completion Test 1: August target + unedited July review exists -> OLDER_THAN_TARGET_REACHED", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const rawReviews: ExtractedRawReview[] = [
    {
      element: createMockElement({ "data-review-id": "rev-aug" }),
      reviewId: "rev-aug",
      dateText: "1 month ago", // August 2026
      reviewText: thai16Words,
      hasCustomerPhoto: true,
      photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    },
    {
      element: createMockElement({ "data-review-id": "rev-jul" }),
      reviewId: "rev-jul",
      dateText: "2 months ago", // July 2026
      reviewText: thai16Words,
      hasCustomerPhoto: true,
      photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    },
  ];

  const summary = QualificationEngine.calculateScanSummary(rawReviews, "2026-08", ref, false);
  assert.equal(summary.auditCoverageStatus, "OLDER_THAN_TARGET_REACHED");
  assert.equal(summary.hasReachedOlderReviews, true);
});

test("Audit Completion Test 2: August target + review list ends with August review at scroll bottom -> END_OF_AVAILABLE_REVIEWS", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const rawReviews: ExtractedRawReview[] = [
    {
      element: createMockElement({ "data-review-id": "rev-sep" }),
      reviewId: "rev-sep",
      dateText: "today", // September 2026
      reviewText: thai16Words,
      hasCustomerPhoto: true,
      photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    },
    {
      element: createMockElement({ "data-review-id": "rev-aug-1" }),
      reviewId: "rev-aug-1",
      dateText: "1 week ago", // August 2026
      reviewText: thai16Words,
      hasCustomerPhoto: true,
      photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    },
    {
      element: createMockElement({ "data-review-id": "rev-aug-2" }),
      reviewId: "rev-aug-2",
      dateText: "1 month ago", // August 2026 (oldest review available)
      reviewText: thai16Words,
      hasCustomerPhoto: true,
      photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    },
  ];

  // User reached bottom of scroll pane (isAtScrollBottom = true)
  const summary = QualificationEngine.calculateScanSummary(rawReviews, "2026-08", ref, true);
  assert.equal(summary.auditCoverageStatus, "END_OF_AVAILABLE_REVIEWS");
  assert.equal(summary.hasReachedOlderReviews, false);
});

test("Audit Completion Test 3: August target + user not at bottom + scan returns +0 -> still IN_PROGRESS", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const rawReviews: ExtractedRawReview[] = [
    {
      element: createMockElement({ "data-review-id": "rev-aug-1" }),
      reviewId: "rev-aug-1",
      dateText: "1 month ago", // August 2026
      reviewText: thai16Words,
      hasCustomerPhoto: true,
      photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    },
  ];

  // User is in middle of pane (isAtScrollBottom = false)
  const summary = QualificationEngine.calculateScanSummary(rawReviews, "2026-08", ref, false);
  assert.equal(summary.auditCoverageStatus, "IN_PROGRESS");
  assert.equal(summary.hasReachedOlderReviews, false);
});

test("Audit Completion Test 4: August target + Edited July-looking review only -> must NOT trigger older-month completion", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const rawReviews: ExtractedRawReview[] = [
    {
      element: createMockElement({ "data-review-id": "rev-edited" }),
      reviewId: "rev-edited",
      dateText: "Edited 2 months ago", // Edited review (looks like July, but creation date unknown)
      reviewText: thai16Words,
      hasCustomerPhoto: true,
      photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    },
  ];

  // When not at bottom, edited review must NOT satisfy Condition A
  const summary = QualificationEngine.calculateScanSummary(rawReviews, "2026-08", ref, false);
  assert.equal(summary.auditCoverageStatus, "IN_PROGRESS");
  assert.equal(summary.hasReachedOlderReviews, false);
});

test("Audit Completion Test 5: August target + UNKNOWN_DATE review only -> must NOT trigger older-month completion", () => {
  const ref = new Date("2026-09-02T12:00:00Z");
  const rawReviews: ExtractedRawReview[] = [
    {
      element: createMockElement({ "data-review-id": "rev-unknown" }),
      reviewId: "rev-unknown",
      dateText: "some unknown date string",
      reviewText: thai16Words,
      hasCustomerPhoto: true,
      photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
    },
  ];

  const summary = QualificationEngine.calculateScanSummary(rawReviews, "2026-08", ref, false);
  assert.equal(summary.auditCoverageStatus, "IN_PROGRESS");
  assert.equal(summary.hasReachedOlderReviews, false);
});
