import test from "node:test";
import assert from "node:assert/strict";
import { QualificationEngine } from "../src/core/qualificationEngine.ts";
import type { ExtractedRawReview } from "../src/core/googleMapsDomAdapter.ts";

function createMockElement(attributes: Record<string, string> = {}): Element {
  return {
    getAttribute: (name: string) => attributes[name] ?? null,
    querySelectorAll: () => [],
    textContent: "mock review text for testing deduplication",
  } as unknown as Element;
}

const thai16Words = "กบ มด นก กา ไก่ เป็ด หมู หมา ม้า วัว เสือ ปลา กุ้ง หอย ปู ช้าง";

test("QualificationEngine.calculateScanSummary deduplicates review cards appearing multiple times", () => {
  const ref = new Date("2026-09-02T12:00:00Z");

  const duplicateRawReviews: ExtractedRawReview[] = [
    {
      element: createMockElement({ "data-review-id": "review-abc" }),
      reviewId: "review-abc",
      dateText: "1 month ago",
      reviewText: thai16Words,
      hasCustomerPhoto: true,
      photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
      imageCaptureMonths: ["2026-08"],
    },
    // Duplicate of review-abc (e.g. re-rendered on scroll)
    {
      element: createMockElement({ "data-review-id": "review-abc" }),
      reviewId: "review-abc",
      dateText: "1 month ago",
      reviewText: thai16Words,
      hasCustomerPhoto: true,
      photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
      imageCaptureMonths: ["2026-08"],
    },
    {
      element: createMockElement({ "data-review-id": "review-def" }),
      reviewId: "review-def",
      dateText: "1 month ago",
      reviewText: thai16Words,
      hasCustomerPhoto: true,
      photoEvidence: "REVIEW_MEDIA_THUMBNAIL",
      imageCaptureMonths: ["2026-08"],
    },
  ];

  const summary = QualificationEngine.calculateScanSummary(duplicateRawReviews, "2026-08", ref);

  // Even though 3 items were passed in, only 2 unique reviews should be counted
  assert.equal(summary.reviewsChecked, 2);
  assert.equal(summary.reviewsWithPhoto, 2);
  assert.equal(summary.reviewsOver15ThaiWords, 2);
  assert.equal(summary.qualifiedReviews, 2);
});
