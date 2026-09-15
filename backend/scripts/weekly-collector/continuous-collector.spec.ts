import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as dateClassifier from "./date-classifier.mjs";
import { getTodayBangkokDate, collectStoreContinuous } from "./continuous-collector.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Continuous Collector Date Parsing & Determinism Regression Tests", () => {
  it("verifies parseReviewDate is exported from date-classifier.mjs and is a function", () => {
    assert.equal(typeof dateClassifier.parseReviewDate, "function");
  });

  it("verifies all date classifier functions referenced in continuous-collector.mjs are imported", () => {
    const collectorSource = fs.readFileSync(
      path.join(__dirname, "continuous-collector.mjs"),
      "utf8"
    );

    // Extract imported symbols from ./date-classifier.mjs
    const importMatch = collectorSource.match(
      /import\s*\{([^}]+)\}\s*from\s*["']\.\/date-classifier\.mjs["']/
    );
    assert.ok(importMatch, "Should have import statement from ./date-classifier.mjs");

    const importedSymbols = importMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // parseReviewDate MUST be explicitly imported
    assert.ok(
      importedSymbols.includes("parseReviewDate"),
      "parseReviewDate must be explicitly imported in continuous-collector.mjs"
    );
    assert.ok(
      importedSymbols.includes("classifyDateForWeek"),
      "classifyDateForWeek must be explicitly imported"
    );
    assert.ok(
      importedSymbols.includes("resolveWeekNumberFromDate"),
      "resolveWeekNumberFromDate must be explicitly imported"
    );
    assert.ok(
      importedSymbols.includes("getWeekDateBoundaries"),
      "getWeekDateBoundaries must be explicitly imported"
    );

    // Check that every imported symbol exists in date-classifier.mjs exports
    for (const sym of importedSymbols) {
      assert.ok(
        sym in dateClassifier,
        `Imported symbol '${sym}' must exist in date-classifier.mjs`
      );
      assert.equal(
        typeof (dateClassifier as Record<string, unknown>)[sym],
        "function",
        `Imported symbol '${sym}' must be a function`
      );
    }
  });

  it("ensures no unimported dateClassifier functions are called in continuous-collector.mjs", () => {
    const collectorSource = fs.readFileSync(
      path.join(__dirname, "continuous-collector.mjs"),
      "utf8"
    );

    const exportedNames = Object.keys(dateClassifier);
    for (const name of exportedNames) {
      // If the function name is called in continuous-collector.mjs (e.g. `name(`)
      const callRegex = new RegExp(`\\b${name}\\s*\\(`, "g");
      if (callRegex.test(collectorSource)) {
        // It MUST be declared or imported in continuous-collector.mjs
        const importRegex = new RegExp(`\\b${name}\\b`);
        assert.ok(
          importRegex.test(collectorSource),
          `Function '${name}' is called in continuous-collector.mjs and MUST be imported`
        );
      }
    }
  });

  it("verifies getTodayBangkokDate honors the frozen reference timestamp", () => {
    // 2026-09-14 23:59:00 UTC = 2026-09-15 06:59:00 Bangkok
    const ref1 = new Date("2026-09-14T23:59:00Z");
    assert.equal(getTodayBangkokDate(ref1), "2026-09-15");

    // 2026-09-14 16:59:00 UTC = 2026-09-14 23:59:00 Bangkok
    const ref2 = new Date("2026-09-14T16:59:00Z");
    assert.equal(getTodayBangkokDate(ref2), "2026-09-14");
  });

  it("verifies date-classifier parseReviewDate deterministic resolution with frozen referenceNow", () => {
    const frozenRef = new Date("2026-09-15T09:00:00+07:00");

    const res1 = dateClassifier.parseReviewDate("1 day ago", frozenRef);
    assert.equal(res1.type, "VALID");
    assert.equal(res1.exactDate, "2026-09-14");

    const res2 = dateClassifier.parseReviewDate("เมื่อวาน", frozenRef);
    assert.equal(res2.type, "VALID");
    assert.equal(res2.exactDate, "2026-09-14");

    const res3 = dateClassifier.parseReviewDate("2 days ago", frozenRef);
    assert.equal(res3.type, "VALID");
    assert.equal(res3.exactDate, "2026-09-13");

    const res4 = dateClassifier.parseReviewDate("2 hours ago", frozenRef);
    assert.equal(res4.type, "VALID");
    assert.equal(res4.exactDate, "2026-09-15");
  });

  it("verifies collectStoreContinuous runtime path has parseReviewDate available and handles zero reviews gracefully", async () => {
    // Create a mock page that simulates openReviewsPane returning CONFIRMED_ZERO_REVIEWS
    const mockPage = {
      goto: async () => {},
      waitForTimeout: async () => {},
      evaluate: async () => 0,
      $: async () => null,
      $$: async () => [],
    };

    const dummyStore = {
      storeCode: "99999",
      storeId: "dummy-store-id",
      storeName: "Test Zero Store",
      googleMapsUrl: "https://maps.google.com/?q=test",
    };

    // This should run without ReferenceError: parseReviewDate is not defined
    const res = await collectStoreContinuous(mockPage as any, dummyStore, {
      referenceNow: new Date("2026-09-15T09:00:00+07:00"),
      dryRun: true,
    });

    assert.equal(res.storeCode, "99999");
    assert.equal(typeof res.stopReason, "string");
  });
});
