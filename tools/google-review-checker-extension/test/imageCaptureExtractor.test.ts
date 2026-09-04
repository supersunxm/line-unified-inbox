import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseImageCaptureMonth,
  resolveReviewImageMonths,
  normalizeMonthNameTo2Digit,
  normalizeYearStringToGregorian,
} from "../src/core/imageCaptureExtractor.ts";

describe("Image Capture Extractor: parseImageCaptureMonth", () => {
  it("parses English short month format: Image capture: Sep 2026 -> 2026-09", () => {
    assert.equal(parseImageCaptureMonth("Image capture: Sep 2026"), "2026-09");
    assert.equal(parseImageCaptureMonth("Image capture: Aug 2026"), "2026-08");
    assert.equal(parseImageCaptureMonth("Image capture: Jan 2025"), "2025-01");
  });

  it("parses English full month format: Image capture: September 2026", () => {
    assert.equal(parseImageCaptureMonth("Image capture: September 2026"), "2026-09");
    assert.equal(parseImageCaptureMonth("Image capture: October 2024"), "2024-10");
  });

  it("parses English format with trailing copyright or spaces", () => {
    assert.equal(parseImageCaptureMonth("Image capture: Sep 2026 © 2026 Google"), "2026-09");
    assert.equal(parseImageCaptureMonth("Image capture :  May 2024 "), "2024-05");
  });

  it("parses Thai abbreviated month format: ถ่ายภาพเมื่อ: ก.ย. 2026 -> 2026-09", () => {
    assert.equal(parseImageCaptureMonth("ถ่ายภาพเมื่อ: ก.ย. 2026"), "2026-09");
    assert.equal(parseImageCaptureMonth("ถ่ายเมื่อ: ส.ค. 2026"), "2026-08");
    assert.equal(parseImageCaptureMonth("บันทึกภาพเมื่อ: ม.ค. 2026"), "2026-01");
  });

  it("parses Thai full month format: ถ่ายภาพเมื่อ: กันยายน 2026 -> 2026-09", () => {
    assert.equal(parseImageCaptureMonth("ถ่ายภาพเมื่อ: กันยายน 2026"), "2026-09");
    assert.equal(parseImageCaptureMonth("ถ่ายเมื่อ สิงหาคม 2026"), "2026-08");
  });

  it("converts Thai Buddhist Era (พ.ศ.) years accurately (e.g. 2569 -> 2026)", () => {
    assert.equal(parseImageCaptureMonth("ถ่ายภาพเมื่อ: ก.ย. 2569"), "2026-09");
    assert.equal(parseImageCaptureMonth("ถ่ายเมื่อ สิงหาคม 2567"), "2024-08");
  });

  it("returns null for invalid or missing image capture metadata", () => {
    assert.equal(parseImageCaptureMonth(""), null);
    assert.equal(parseImageCaptureMonth(null), null);
    assert.equal(parseImageCaptureMonth(undefined), null);
    assert.equal(parseImageCaptureMonth("random text without date"), null);
    assert.equal(parseImageCaptureMonth("22 hours ago"), null);
    assert.equal(parseImageCaptureMonth("3 weeks ago"), null);
  });
});

describe("Image Capture Resolver: resolveReviewImageMonths", () => {
  it("returns NO_IMAGES when review has empty image array", () => {
    const res = resolveReviewImageMonths([]);
    assert.equal(res.status, "NO_IMAGES");
    assert.equal(res.resolvedMonth, null);
  });

  it("single image resolves to exact month: [2026-09] -> 2026-09", () => {
    const res = resolveReviewImageMonths(["2026-09"]);
    assert.equal(res.status, "RESOLVED");
    assert.equal(res.resolvedMonth, "2026-09");
  });

  it("multiple images with identical month resolve cleanly: [2026-09, 2026-09] -> 2026-09", () => {
    const res = resolveReviewImageMonths(["2026-09", "2026-09", "2026-09"]);
    assert.equal(res.status, "RESOLVED");
    assert.equal(res.resolvedMonth, "2026-09");
  });

  it("multiple images with different months fail closed: [2026-08, 2026-09] -> MIXED_IMAGE_MONTH", () => {
    const res = resolveReviewImageMonths(["2026-08", "2026-09"]);
    assert.equal(res.status, "MIXED_IMAGE_MONTH");
    assert.equal(res.resolvedMonth, null);
  });

  it("any unknown/null image timestamp fails closed: [2026-09, null] -> IMAGE_MONTH_UNKNOWN", () => {
    const res1 = resolveReviewImageMonths(["2026-09", null]);
    assert.equal(res1.status, "IMAGE_MONTH_UNKNOWN");
    assert.equal(res1.resolvedMonth, null);

    const res2 = resolveReviewImageMonths([null]);
    assert.equal(res2.status, "IMAGE_MONTH_UNKNOWN");
    assert.equal(res2.resolvedMonth, null);
  });
});
