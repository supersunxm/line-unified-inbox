import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { OlderImageStreamingCounter } from "../src/core/olderImageStreamingCounter.ts";

describe("OlderImageStreamingCounter: Cumulative 5-Image Stop Boundary", () => {
  test("Test 1: Jul -> 1, Aug -> 1, Jul -> 2, Sep -> 2, Jan -> 3, Jul -> 4, Jun -> 5 -> STOP", () => {
    const counter = new OlderImageStreamingCounter("2026-08", 5);
    const photos = [
      { seq: 1, pIdx: 1, month: "2026-07" }, // older -> 1
      { seq: 2, pIdx: 1, month: "2026-08" }, // target -> still 1
      { seq: 3, pIdx: 1, month: "2026-07" }, // older -> 2
      { seq: 4, pIdx: 1, month: "2026-09" }, // newer -> still 2
      { seq: 5, pIdx: 1, month: "2026-01" }, // older -> 3
      { seq: 6, pIdx: 1, month: "2026-07" }, // older -> 4
      { seq: 7, pIdx: 1, month: "2026-06" }, // older -> 5 -> STOP
      { seq: 8, pIdx: 1, month: "2026-07" }, // Should not be processed!
    ];

    let stopEncountered = false;
    for (const p of photos) {
      if (counter.stopTriggered) {
        break;
      }
      const res = counter.processPhoto({
        reviewSequence: p.seq,
        photoIndex: p.pIdx,
        imageCaptureMonth: p.month,
      });
      if (res.isStop) {
        stopEncountered = true;
        break;
      }
    }

    assert.equal(stopEncountered, true, "Stop should have triggered");
    assert.equal(counter.olderImageCount, 5, "olderImageCount should be exactly 5");
    assert.equal(counter.totalPhotosInspected, 7, "Exactly 7 photos should have been inspected");
    assert.equal(counter.photoTrace.length, 7, "Exactly 7 trace entries recorded");
    assert.equal(counter.stopEvidenceImages.length, 5, "Exactly 5 older images in evidence");
    assert.equal(counter.stopTriggerDetail?.reviewSequence, 7);
    assert.equal(counter.stopTriggerDetail?.photoIndex, 1);
    assert.equal(counter.stopTriggerDetail?.imageCaptureMonth, "2026-06");
  });

  test("Test 2: Single review containing 7 July photos -> stops on photo #5, #6 and #7 never opened", () => {
    const counter = new OlderImageStreamingCounter("2026-08", 5);
    const reviewPhotos = [
      "2026-07",
      "2026-07",
      "2026-07",
      "2026-07",
      "2026-07",
      "2026-07",
      "2026-07",
    ];

    let photosInspectedForReview = 0;
    for (let i = 0; i < reviewPhotos.length; i++) {
      if (counter.stopTriggered) {
        break;
      }
      photosInspectedForReview++;
      counter.processPhoto({
        reviewSequence: 10,
        photoIndex: i + 1,
        imageCaptureMonth: reviewPhotos[i],
      });
    }

    assert.equal(photosInspectedForReview, 5, "Only first 5 photos should have been inspected");
    assert.equal(counter.olderImageCount, 5, "olderImageCount reached 5");
    assert.equal(counter.stopTriggered, true, "Stop triggered on photo #5");
    assert.equal(counter.stopEvidenceImages.length, 5);
  });

  test("Test 3: Counter persistence across batches: Batch 1 (2) -> Batch 2 (3) -> Batch 3 (5 -> STOP)", () => {
    const counter = new OlderImageStreamingCounter("2026-08", 5);

    // Batch 1
    const batch1 = ["2026-07", "2026-07"];
    for (let i = 0; i < batch1.length; i++) {
      if (counter.stopTriggered) break;
      counter.processPhoto({ reviewSequence: 1, photoIndex: i + 1, imageCaptureMonth: batch1[i] });
    }
    assert.equal(counter.olderImageCount, 2, "Batch 1: count should be 2");

    // Batch 2
    const batch2 = ["2026-08", "2026-07"];
    for (let i = 0; i < batch2.length; i++) {
      if (counter.stopTriggered) break;
      counter.processPhoto({ reviewSequence: 2, photoIndex: i + 1, imageCaptureMonth: batch2[i] });
    }
    assert.equal(counter.olderImageCount, 3, "Batch 2: count should be 3 (Aug did NOT reset)");

    // Batch 3
    const batch3 = ["2026-07", "2026-07"];
    for (let i = 0; i < batch3.length; i++) {
      if (counter.stopTriggered) break;
      counter.processPhoto({ reviewSequence: 3, photoIndex: i + 1, imageCaptureMonth: batch3[i] });
    }
    assert.equal(counter.olderImageCount, 5, "Batch 3: count should be 5");
    assert.equal(counter.stopTriggered, true, "Batch 3 should have triggered stop on 5th older image");
  });
});
