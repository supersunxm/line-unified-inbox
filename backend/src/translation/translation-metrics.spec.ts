import assert from "node:assert/strict";
import test from "node:test";
import { TranslationMetrics } from "./translation-metrics";

test("pilot metrics aggregate outcomes, duration, and character counts", () => {
  const metrics = new TranslationMetrics();
  metrics.record({ outcome: "SUCCESS", durationMs: 20, characterCount: 10 });
  metrics.record({ outcome: "CACHED", durationMs: 10, characterCount: 20 });
  metrics.record({ outcome: "FAILURE", durationMs: 30, characterCount: 30, providerFailure: true });
  metrics.record({ outcome: "RATE_LIMITED", durationMs: 40, characterCount: 40 });
  assert.deepEqual(metrics.snapshot(), {
    totalTranslationRequests: 4,
    successfulTranslations: 1,
    failedTranslations: 1,
    providerFailures: 1,
    rateLimitedRequests: 1,
    averageDurationMs: 25,
    averageCharacterCount: 25,
    cacheHitCount: 1,
  });
});

test("pilot metrics retain aggregate metadata only", () => {
  const metrics = new TranslationMetrics();
  metrics.record({ outcome: "SUCCESS", durationMs: 5, characterCount: 12 });
  const serialized = JSON.stringify(metrics);
  assert.equal(serialized.includes("message"), false);
  assert.equal(serialized.includes("translation"), false);
  assert.deepEqual(Object.keys(metrics.snapshot()).sort(), [
    "averageCharacterCount",
    "averageDurationMs",
    "cacheHitCount",
    "failedTranslations",
    "providerFailures",
    "rateLimitedRequests",
    "successfulTranslations",
    "totalTranslationRequests",
  ]);
});

test("resetMetrics clears every aggregate counter", () => {
  const metrics = new TranslationMetrics();
  metrics.record({ outcome: "FAILURE", durationMs: 30, characterCount: 18, providerFailure: true });
  metrics.record({ outcome: "RATE_LIMITED", durationMs: 10, characterCount: 8 });
  metrics.resetMetrics();
  assert.deepEqual(metrics.snapshot(), {
    totalTranslationRequests: 0,
    successfulTranslations: 0,
    failedTranslations: 0,
    providerFailures: 0,
    rateLimitedRequests: 0,
    averageDurationMs: 0,
    averageCharacterCount: 0,
    cacheHitCount: 0,
  });
});
