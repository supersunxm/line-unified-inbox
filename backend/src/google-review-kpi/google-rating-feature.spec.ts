import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseGoogleRating,
  parseGoogleReviewCount,
  extractStoreGoogleRating,
} from "../../../tools/google-review-checker-extension/src/core/googleRatingExtractor.ts";
import { validateAndPreviewImport } from "./google-review-import.util.ts";

describe("Google Maps Store Aggregate Rating Extraction & Parsing", () => {
  it("correctly parses valid ratings within 1.0 to 5.0", () => {
    assert.equal(parseGoogleRating("5.0"), 5.0);
    assert.equal(parseGoogleRating("4.9"), 4.9);
    assert.equal(parseGoogleRating("1.0"), 1.0);
    assert.equal(parseGoogleRating("4.85"), 4.9);
    assert.equal(parseGoogleRating("คะแนน 4.7 จาก 5"), 4.7);
  });

  it("rejects out-of-bounds or invalid rating formats", () => {
    assert.equal(parseGoogleRating("0.5"), null);
    assert.equal(parseGoogleRating("5.5"), null);
    assert.equal(parseGoogleRating("10.0"), null);
    assert.equal(parseGoogleRating("-4.5"), null);
    assert.equal(parseGoogleRating("abc"), null);
    assert.equal(parseGoogleRating(null), null);
    assert.equal(parseGoogleRating(""), null);
  });

  it("correctly parses review counts in Thai and English", () => {
    assert.equal(parseGoogleReviewCount("92 reviews"), 92);
    assert.equal(parseGoogleReviewCount("92 รีวิว"), 92);
    assert.equal(parseGoogleReviewCount("(92)"), 92);
    assert.equal(parseGoogleReviewCount("1,234 reviews"), 1234);
    assert.equal(parseGoogleReviewCount("1,234 รีวิว"), 1234);
    assert.equal(parseGoogleReviewCount("0 รีวิว"), 0);
  });

  it("returns null for invalid or negative review count strings", () => {
    assert.equal(parseGoogleReviewCount("no reviews"), null);
    assert.equal(parseGoogleReviewCount("-5 รีวิว"), null);
    assert.equal(parseGoogleReviewCount(""), null);
    assert.equal(parseGoogleReviewCount(null), null);
  });

  it("extracts store rating from DOM structure gracefully", () => {
    const mockDoc = {
      querySelector: (selector: string) => {
        if (selector.includes("fontDisplayLarge")) {
          return { textContent: "4.8" };
        }
        if (selector.includes("fontBodyMedium")) {
          return { textContent: "150 รีวิว" };
        }
        return null;
      },
      querySelectorAll: () => [],
    };

    const res = extractStoreGoogleRating(mockDoc as any);
    assert.equal(res.googleRating, 4.8);
    assert.equal(res.googleReviewCount, 150);
  });
});

describe("Google Review Import Validation with Ratings", () => {
  const existingStores = [
    { id: "store-uuid-1", code: "25610", name: "OPPO Brand Shop Central Rama 2" },
    { id: "store-uuid-2", code: "BKK001", name: "OPPO Brand Shop Siam Paragon" },
  ];
  const existingKpiMap = new Map([
    ["store-uuid-1", { qualifiedReviews: 12, reviewsChecked: 15 }],
    ["store-uuid-2", { qualifiedReviews: 8, reviewsChecked: 10 }],
  ]);

  it("validates legacy payload without ratings (backward compatible)", () => {
    const dto = {
      month: "2026-09",
      importType: "GAP_FILL" as const,
      data: {
        stores: {
          "25610": {
            definiteNewSeptemberReviews: 2,
            definiteNewQualifiedReviews: 2,
          },
        },
      },
    };

    const res = validateAndPreviewImport(dto, existingStores, existingKpiMap);
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
    assert.equal(res.previewStores.length, 1);
    assert.equal(res.previewStores[0].beforeQualified, 12);
    assert.equal(res.previewStores[0].deltaQualified, 2);
    assert.equal(res.previewStores[0].afterQualified, 14);
  });

  it("validates payload with new googleRating and googleReviewCount", () => {
    const dto = {
      month: "2026-09",
      importType: "FULL_MONTH" as const,
      data: {
        stores: [
          {
            storeCode: "25610",
            qualifiedReviews: 14,
            reviewsChecked: 17,
            googleRating: 4.9,
            googleReviewCount: 95,
          },
        ],
      },
    };

    const res = validateAndPreviewImport(dto, existingStores, existingKpiMap);
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
    assert.equal(res.previewStores[0].googleRating, 4.9);
    assert.equal(res.previewStores[0].googleReviewCount, 95);
  });

  it("rejects invalid rating out of range 1.0 to 5.0", () => {
    const dto = {
      month: "2026-09",
      importType: "FULL_MONTH" as const,
      data: {
        stores: [
          {
            storeCode: "25610",
            qualifiedReviews: 14,
            reviewsChecked: 17,
            googleRating: 6.0, // Invalid
          },
        ],
      },
    };

    const res = validateAndPreviewImport(dto, existingStores, existingKpiMap);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("คะแนน Google Rating ต้องอยู่ระหว่าง 1.0 ถึง 5.0")));
  });

  it("rejects negative googleReviewCount", () => {
    const dto = {
      month: "2026-09",
      importType: "FULL_MONTH" as const,
      data: {
        stores: [
          {
            storeCode: "25610",
            qualifiedReviews: 14,
            reviewsChecked: 17,
            googleReviewCount: -10, // Invalid
          },
        ],
      },
    };

    const res = validateAndPreviewImport(dto, existingStores, existingKpiMap);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("จำนวนรีวิว Google Review Count ต้องเป็นจำนวนเต็มไม่ติดลบ")));
  });
});
