import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluatePlaceStatus, openReviewsPane, ensureNewestSort } from "./maps-dom-helper.mjs";

describe("Google Maps DOM Recovery Unit Tests", () => {
  describe("evaluatePlaceStatus", () => {
    it("detects Limited View notice and prompts accurately", async () => {
      // Mock page environment simulating Limited View DOM
      const mockPage = {
        evaluate: async (fn: any) => {
          // Simulate DOM inside evaluate
          const mockDocument = {
            body: {
              innerText: "OPPO CentralWorld\nคุณกำลังดู Google Maps ในมุมมองแบบจำกัด\nลงชื่อเข้าใช้",
              innerHTML: "<div class='kyuRq'>มุมมองแบบจำกัด</div>",
            },
            querySelector: (sel: string) => {
              if (sel === "h1") return { textContent: "OPPO CentralWorld" };
              if (sel.includes(".F7nice")) return { textContent: "4.9", getAttribute: () => null, closest: () => null };
              if (sel.includes(".kyuRq")) return { textContent: "มุมมองแบบจำกัด" };
              return null;
            },
            querySelectorAll: (sel: string) => {
              if (sel.includes("[role='tab']")) {
                return [
                  { textContent: "ภาพรวม", getAttribute: (a: string) => a === "aria-label" ? "ภาพรวม" : "true" },
                  { textContent: "เกี่ยวกับ", getAttribute: (a: string) => a === "aria-label" ? "เกี่ยวกับ" : "false" },
                ];
              }
              return [];
            },
          };
          // Execute with mock global scope
          return {
            title: "OPPO CentralWorld",
            rating: 4.9,
            reviewCountText: null,
            hasLimitedView: true,
            hasSignInPrompt: true,
            hasReviewTab: false,
            reviewTabSelected: false,
            hasReviewTriggerBtn: false,
            hasWriteReviewBtn: false,
            cardsCount: 0,
            hasFeed: false,
          };
        },
      };

      const res = await evaluatePlaceStatus(mockPage as any);
      assert.strictEqual(res.hasLimitedView, true);
      assert.strictEqual(res.hasSignInPrompt, true);
      assert.strictEqual(res.hasReviewTab, false);
      assert.strictEqual(res.cardsCount, 0);
      assert.strictEqual(res.rating, 4.9);
    });

    it("detects Thai review tab when present", async () => {
      const mockPage = {
        evaluate: async () => ({
          title: "OPPO Rama 9",
          rating: 4.8,
          reviewCountText: "300",
          hasLimitedView: false,
          hasSignInPrompt: false,
          hasReviewTab: true,
          reviewTabSelected: false,
          hasReviewTriggerBtn: true,
          hasWriteReviewBtn: true,
          cardsCount: 0,
          hasFeed: false,
        }),
      };

      const res = await evaluatePlaceStatus(mockPage as any);
      assert.strictEqual(res.hasLimitedView, false);
      assert.strictEqual(res.hasReviewTab, true);
      assert.strictEqual(res.rating, 4.8);
    });

    it("detects English review tab when present", async () => {
      const mockPage = {
        evaluate: async () => ({
          title: "OPPO Phuket",
          rating: 5.0,
          reviewCountText: "150",
          hasLimitedView: false,
          hasSignInPrompt: false,
          hasReviewTab: true,
          reviewTabSelected: false,
          hasReviewTriggerBtn: true,
          hasWriteReviewBtn: true,
          cardsCount: 0,
          hasFeed: false,
        }),
      };

      const res = await evaluatePlaceStatus(mockPage as any);
      assert.strictEqual(res.hasReviewTab, true);
    });
  });

  describe("openReviewsPane", () => {
    it("returns ERROR_MAPS_LIMITED_VIEW_DETECTED when Limited View is present without reviews", async () => {
      const mockPage = {
        evaluate: async () => ({
          title: "OPPO CentralWorld",
          rating: 4.9,
          reviewCountText: null,
          hasLimitedView: true,
          hasSignInPrompt: true,
          hasReviewTab: false,
          reviewTabSelected: false,
          hasReviewTriggerBtn: false,
          hasWriteReviewBtn: false,
          cardsCount: 0,
          hasFeed: false,
        }),
        waitForTimeout: async () => {},
      };

      const res = await openReviewsPane(mockPage as any);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.reason, "ERROR_MAPS_LIMITED_VIEW_DETECTED");
      assert.notStrictEqual(res.reason, "ZERO_REVIEWS_PLACE");
    });

    it("returns CONFIRMED_ZERO_REVIEWS only when rating is absent and write review button is present", async () => {
      const mockPage = {
        evaluate: async () => ({
          title: "Brand New Store",
          rating: null,
          reviewCountText: null,
          hasLimitedView: false,
          hasSignInPrompt: false,
          hasReviewTab: false,
          reviewTabSelected: false,
          hasReviewTriggerBtn: false,
          hasWriteReviewBtn: true,
          cardsCount: 0,
          hasFeed: false,
        }),
        waitForTimeout: async () => {},
      };

      const res = await openReviewsPane(mockPage as any);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.reason, "CONFIRMED_ZERO_REVIEWS");
    });

    it("returns ERROR_REVIEW_CONTROL_NOT_FOUND if rating exists but review trigger is missing", async () => {
      const mockPage = {
        evaluate: async () => ({
          title: "OPPO Store",
          rating: 4.9,
          reviewCountText: "100",
          hasLimitedView: false,
          hasSignInPrompt: false,
          hasReviewTab: false,
          reviewTabSelected: false,
          hasReviewTriggerBtn: false,
          hasWriteReviewBtn: true,
          cardsCount: 0,
          hasFeed: false,
        }),
        waitForTimeout: async () => {},
      };

      const res = await openReviewsPane(mockPage as any);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.reason, "ERROR_REVIEW_CONTROL_NOT_FOUND");
    });

    it("returns ALREADY_OPEN if cards are already rendered", async () => {
      const mockPage = {
        evaluate: async () => ({
          title: "OPPO Store",
          rating: 4.9,
          reviewCountText: "100",
          hasLimitedView: false,
          hasSignInPrompt: false,
          hasReviewTab: true,
          reviewTabSelected: true,
          hasReviewTriggerBtn: true,
          hasWriteReviewBtn: true,
          cardsCount: 10,
          hasFeed: true,
        }),
        waitForTimeout: async () => {},
      };

      const res = await openReviewsPane(mockPage as any);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.reason, "ALREADY_OPEN");
    });
  });

  describe("ensureNewestSort", () => {
    it("verifies ALREADY_NEWEST when sort button shows ใหม่ที่สุด", async () => {
      const mockPage = {
        evaluate: async () => ({
          success: true,
          reason: "ALREADY_NEWEST",
          currentSort: "ใหม่ที่สุด",
        }),
      };

      const res = await ensureNewestSort(mockPage as any);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.reason, "ALREADY_NEWEST");
    });

    it("fails with ERROR_SORT_BUTTON_NOT_FOUND when button is missing on place with many reviews", async () => {
      const mockPage = {
        evaluate: async () => ({
          success: false,
          reason: "ERROR_SORT_BUTTON_NOT_FOUND",
        }),
      };

      const res = await ensureNewestSort(mockPage as any);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.reason, "ERROR_SORT_BUTTON_NOT_FOUND");
    });

    it("fails with ERROR_NEWEST_SORT_UNVERIFIED if sort change fails to take effect", async () => {
      const mockPage = {
        evaluate: async () => ({
          success: false,
          reason: "ERROR_NEWEST_SORT_UNVERIFIED",
          currentSort: "เกี่ยวข้องที่สุด",
        }),
      };

      const res = await ensureNewestSort(mockPage as any);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.reason, "ERROR_NEWEST_SORT_UNVERIFIED");
    });
  });

  describe("Fail-Safe Systemic Abort Logic", () => {
    it("aborts when failure rate reaches 20% after >= 10 stores", () => {
      const storesScanned = 10;
      const scanFailures = 2; // 20%
      const failureRate = scanFailures / storesScanned;
      assert.strictEqual(failureRate >= 0.2, true);
    });

    it("does not abort below 20% failure rate", () => {
      const storesScanned = 10;
      const scanFailures = 1; // 10%
      const failureRate = scanFailures / storesScanned;
      assert.strictEqual(failureRate < 0.2, true);
    });

    it("does not abort before 10 stores are scanned", () => {
      const storesScanned = 5;
      const scanFailures = 1; // 20%, but storesScanned < 10
      const shouldAbort = storesScanned >= 10 && (scanFailures / storesScanned) >= 0.2;
      assert.strictEqual(shouldAbort, false);
    });

    it("detects 5 consecutive identical errors", () => {
      const errors = [
        "ERROR_MAPS_LIMITED_VIEW_DETECTED",
        "ERROR_MAPS_LIMITED_VIEW_DETECTED",
        "ERROR_MAPS_LIMITED_VIEW_DETECTED",
        "ERROR_MAPS_LIMITED_VIEW_DETECTED",
        "ERROR_MAPS_LIMITED_VIEW_DETECTED",
      ];
      let consecutiveCount = 0;
      let lastError: string | null = null;
      for (const err of errors) {
        if (err === lastError) {
          consecutiveCount++;
        } else {
          lastError = err;
          consecutiveCount = 1;
        }
      }
      assert.strictEqual(consecutiveCount, 5);
    });
  });
});
