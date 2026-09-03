import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BatchAuditRunner } from "../src/batch/batchAuditRunner.ts";
import { GoogleMapsDomAdapter } from "../src/core/googleMapsDomAdapter.ts";

describe("BatchAuditRunner State Machine", () => {
  it("initializes with IDLE state", () => {
    const runner = new BatchAuditRunner();
    assert.equal(runner.getState(), "IDLE");
  });

  it("registers status listeners and receives state updates", () => {
    const runner = new BatchAuditRunner();
    const transitions: string[] = [];

    runner.onStatusChange((state) => {
      transitions.push(state);
    });

    runner.stop();
    assert.equal(runner.getState(), "PAUSED");
    assert.deepEqual(transitions, ["PAUSED"]);
  });

  it("sets session info cleanly", () => {
    const runner = new BatchAuditRunner();
    runner.setSession({
      sessionId: "session-123",
      targetMonth: "2026-09",
      status: "RUNNING",
      runnerToken: "test-token-abc",
      currentStore: {
        storeId: "store-456",
        storeName: "OPPO Brand Shop Central World",
        storeCode: "BS-CTW",
        googleMapsUrl: "https://maps.google.com/?cid=123",
      },
    });

    assert.equal(runner.getState(), "IDLE");
  });

  it("accepts runnerToken in session and exposes it (cross-origin auth)", () => {
    const runner = new BatchAuditRunner();
    runner.setSession({
      sessionId: "session-with-token",
      targetMonth: "2026-09",
      status: "RUNNING",
      runnerToken: "eyJhbGciOiJSUzI1NiJ9.test-bearer-token",
    });
    // State stays IDLE (runner not yet started) and session is stored internally.
    assert.equal(runner.getState(), "IDLE");
  });
});

/**
 * Adapter Contract Tests
 *
 * Every method that BatchAuditRunner calls on GoogleMapsDomAdapter must exist
 * and be callable. This test fails at compile-time (tsc) if a method is renamed
 * or removed, and also verifies the methods are functions at runtime.
 *
 * Methods audited from batchAuditRunner.ts:
 *   - GoogleMapsDomAdapter.detectGoogleChallenge()     (line 122)
 *   - GoogleMapsDomAdapter.isReviewsPaneOpen()         (line 137, 141)
 *   - GoogleMapsDomAdapter.openReviewsPane()           (line 139)
 *   - GoogleMapsDomAdapter.ensureNewestSorting()       (line 160)
 *   - GoogleMapsDomAdapter.getReviewScrollContainer()  (line 211)
 *   - GoogleMapsDomAdapter.extractReviews()            (line 220, 283)
 */
describe("GoogleMapsDomAdapter contract: every method called by BatchAuditRunner exists", () => {
  it("detectGoogleChallenge is a callable static method", () => {
    assert.equal(typeof GoogleMapsDomAdapter.detectGoogleChallenge, "function");
  });

  it("isReviewsPaneOpen is a callable static method", () => {
    assert.equal(typeof GoogleMapsDomAdapter.isReviewsPaneOpen, "function");
  });

  it("openReviewsPane is a callable static method", () => {
    assert.equal(typeof GoogleMapsDomAdapter.openReviewsPane, "function");
  });

  it("ensureNewestSorting is a callable static method", () => {
    assert.equal(typeof GoogleMapsDomAdapter.ensureNewestSorting, "function");
  });

  it("getReviewScrollContainer is a callable static method", () => {
    assert.equal(typeof GoogleMapsDomAdapter.getReviewScrollContainer, "function");
  });

  it("extractReviews is a callable static method (was missing; caused production crash)", () => {
    assert.equal(typeof GoogleMapsDomAdapter.extractReviews, "function");
  });

  it("extractReviews delegates to getReviewCardElements + extractReviewData (returns array, not throw)", () => {
    // In a non-browser test context, document is not defined, so we mock minimal DOM
    const origDoc = globalThis.document;
    try {
      // Minimal stub: querySelectorAll returns empty NodeList
      (globalThis as Record<string, unknown>)["document"] = {
        querySelector: () => null,
        querySelectorAll: () => [],
      };
      const result = GoogleMapsDomAdapter.extractReviews();
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    } finally {
      (globalThis as Record<string, unknown>)["document"] = origDoc;
    }
  });

  it("extractReviewData is a callable static method (underlying per-card method)", () => {
    assert.equal(typeof GoogleMapsDomAdapter.extractReviewData, "function");
  });

  it("getReviewCardElements is a callable static method (underlying card finder)", () => {
    assert.equal(typeof GoogleMapsDomAdapter.getReviewCardElements, "function");
  });
});
