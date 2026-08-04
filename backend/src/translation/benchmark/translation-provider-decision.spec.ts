import assert from "node:assert/strict";
import test from "node:test";
import { createTranslationProviderDecision, TranslationProviderDecisionInput } from "./translation-provider-decision";

const currentGoogleBenchmark: TranslationProviderDecisionInput = {
  provider: "google-cloud-translation-v3",
  providerVersion: "v3",
  benchmarkVersion: "oppo-th-en-zh-v2",
  structuralChecksPassed: true,
  protectedTermsPassed: true,
  intentMismatchCount: 0,
  humanReviewPercent: 100,
  overallHumanScore: 4.38,
  overallScore: 78.92,
};

const generatedAt = new Date("2026-08-04T03:30:00.000Z");

test("current Google benchmark is approved for pilot", () => {
  const recommendation = createTranslationProviderDecision(currentGoogleBenchmark, generatedAt);
  assert.equal(recommendation.decision, "APPROVED_FOR_PILOT");
  assert.equal(recommendation.provider, "google-cloud-translation-v3");
  assert.equal(recommendation.providerVersion, "v3");
  assert.equal(recommendation.benchmarkVersion, "oppo-th-en-zh-v2");
  assert.equal(recommendation.automatedScore, 78.92);
  assert.equal(recommendation.humanScore, 4.38);
  assert.equal(recommendation.generatedAt, generatedAt.toISOString());
  assert.deepEqual(recommendation.blockingIssues, []);
});

test("missing human review needs improvement", () => {
  const recommendation = createTranslationProviderDecision({ ...currentGoogleBenchmark, humanReviewPercent: 0, overallHumanScore: null }, generatedAt);
  assert.equal(recommendation.decision, "NEEDS_IMPROVEMENT");
  assert.ok(recommendation.blockingIssues.some((issue) => issue.includes("100%")));
  assert.ok(recommendation.blockingIssues.some((issue) => issue.includes("unavailable")));
});

test("protected terminology failure rejects the provider", () => {
  const recommendation = createTranslationProviderDecision({ ...currentGoogleBenchmark, protectedTermsPassed: false }, generatedAt);
  assert.equal(recommendation.decision, "REJECTED");
  assert.ok(recommendation.blockingIssues.some((issue) => issue.includes("terminology")));
});

test("low human score needs improvement", () => {
  const recommendation = createTranslationProviderDecision({ ...currentGoogleBenchmark, overallHumanScore: 3.99 }, generatedAt);
  assert.equal(recommendation.decision, "NEEDS_IMPROVEMENT");
  assert.ok(recommendation.blockingIssues.some((issue) => issue.includes("below")));
});
