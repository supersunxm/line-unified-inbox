import assert from "node:assert/strict";
import test from "node:test";
import { TRANSLATION_BENCHMARK_CORPUS, TRANSLATION_BENCHMARK_VERSION } from "./translation-benchmark.corpus";
import { evaluateTranslationBenchmark } from "./translation-benchmark";
import { TranslationBenchmarkReview, TranslationBenchmarkSubmission } from "./translation-benchmark.types";
import { generateTranslationBenchmarkSubmission, TranslationBenchmarkRunner } from "./translation-benchmark.runner";
import { glossaryEntriesForSource, OPPO_RETAIL_TRANSLATION_GLOSSARY } from "./oppo-retail-glossary";
import { TRANSLATION_BENCHMARK_CASE_CATEGORIES, TRANSLATION_BENCHMARK_CATEGORY_WEIGHTS } from "./translation-benchmark.metadata";
import { compareTranslationBenchmarkSnapshots, createTranslationBenchmarkSnapshot, parseTranslationBenchmarkSnapshot, serializeTranslationBenchmarkSnapshot } from "./translation-benchmark.snapshot";

function referenceSubmission(withHumanReview = false): TranslationBenchmarkSubmission {
  return {
    benchmarkVersion: TRANSLATION_BENCHMARK_VERSION,
    systemName: "offline-reference",
    generatedAt: "2026-08-03T00:00:00.000Z",
    candidates: TRANSLATION_BENCHMARK_CORPUS.flatMap((testCase) => (["en", "zh"] as const).map((targetLanguage) => ({
      caseId: testCase.id,
      targetLanguage,
      translatedText: testCase.references[targetLanguage],
      ...(withHumanReview ? { humanReview: { adequacy: 5, fluency: 5, terminology: 5, safety: 5, reviewerId: "reviewer-a", notes: "Synthetic reference review" } } : {}),
    }))),
  };
}

function explicitReviews(submission: TranslationBenchmarkSubmission): TranslationBenchmarkReview[] {
  return submission.candidates.map(({ caseId, targetLanguage }) => ({
    candidateKey: `${caseId}:${targetLanguage}`,
    language: targetLanguage,
    adequacyScore: 4,
    fluencyScore: 3,
    terminologyScore: 5,
    safetyScore: 2,
    reviewerAlias: "reviewer-a",
    notes: "Synthetic benchmark review",
  }));
}

test("corpus is synthetic, uniquely keyed, Thai source, and covers English and Chinese", () => {
  assert.ok(TRANSLATION_BENCHMARK_CORPUS.length >= 10);
  assert.equal(new Set(TRANSLATION_BENCHMARK_CORPUS.map(({ id }) => id)).size, TRANSLATION_BENCHMARK_CORPUS.length);
  for (const testCase of TRANSLATION_BENCHMARK_CORPUS) {
    assert.equal(testCase.sourceLanguage, "th");
    assert.ok(testCase.sourceText.trim());
    assert.ok(testCase.references.en.trim());
    assert.ok(testCase.references.zh.trim());
    assert.equal(Object.isFrozen(testCase), true);
  }
  assert.equal(Object.isFrozen(TRANSLATION_BENCHMARK_CORPUS), true);
  assert.equal(Object.keys(TRANSLATION_BENCHMARK_CASE_CATEGORIES).length, TRANSLATION_BENCHMARK_CORPUS.length);
});

test("OPPO retail glossary contains every required product, technology, and retail term", () => {
  const terms = new Set(OPPO_RETAIL_TRANSLATION_GLOSSARY.map(({ term }) => term));
  for (const term of ["OPPO", "Find X9 Pro", "Find X9 Ultra", "Reno16", "Reno16 Pro", "OPPO Pad", "OPPO Watch", "ColorOS", "SUPERVOOC", "AirVOOC", "AI Eraser", "AI Studio", "UFS", "AMOLED", "installment", "down payment", "promotion", "stock", "warranty", "repair", "pickup", "trade-in"]) assert.ok(terms.has(term), `Missing glossary term ${term}`);
  assert.ok(glossaryEntriesForSource("ดาวน์เท่าไหร่ครับ").some(({ term }) => term === "down payment"));
  assert.ok(glossaryEntriesForSource("มีของไหมครับ").some(({ term }) => term === "stock"));
});

test("automatic checks pass reference output but provider decision still requires human review", () => {
  const report = evaluateTranslationBenchmark(referenceSubmission());
  assert.equal(report.coveragePercent, 100);
  assert.equal(report.referenceSimilarityPercent, 100);
  assert.equal(report.protectedTermPassPercent, 100);
  assert.equal(report.overallScore, 100);
  assert.deepEqual(report.languageScores, { en: 100, zh: 100 });
  assert.equal(report.provider, "offline-reference");
  assert.equal(report.providerVersion, "unspecified");
  assert.equal(report.language, "en+zh");
  assert.ok(report.estimatedCharacters > 0);
  assert.equal(report.estimatedCost, null);
  assert.match(report.snapshotIdentifier, /^translation-[a-f0-9]{20}$/);
  assert.equal(report.intentMismatchCount, 0);
  assert.equal(report.automaticGatesPassed, true);
  assert.equal(report.requiresHumanReview, true);
  assert.equal(report.readyForProviderDecision, false);
  assert.equal(report.readinessDecision, "NOT_READY");
});

test("cost estimate counts the frozen source corpus for both target languages with configurable pricing", () => {
  const submission = { ...referenceSubmission(), provider: "fixture-provider", providerVersion: "2026.08", pricing: { currency: "USD", costPerMillionCharacters: 20 } };
  const report = evaluateTranslationBenchmark(submission);
  const expectedCharacters = TRANSLATION_BENCHMARK_CORPUS.reduce((total, testCase) => total + [...testCase.sourceText].length * 2, 0);
  assert.equal(report.estimatedCharacters, expectedCharacters);
  assert.deepEqual(report.estimatedCost, { currency: "USD", costPerMillionCharacters: 20, amount: Math.round((expectedCharacters / 1_000_000) * 20 * 1_000_000) / 1_000_000 });
  assert.equal(report.provider, "fixture-provider");
  assert.equal(report.providerVersion, "2026.08");
  assert.throws(() => evaluateTranslationBenchmark({ ...referenceSubmission(), pricing: { currency: "USD", costPerMillionCharacters: -1 } }), /non-negative/);
  assert.throws(() => evaluateTranslationBenchmark({ ...referenceSubmission(), pricing: { currency: " ", costPerMillionCharacters: 20 } }), /currency is required/);
});

test("regression snapshot serialization stores metadata and results without benchmark messages", () => {
  const submission = { ...referenceSubmission(true), provider: "fixture-provider", providerVersion: "v1", pricing: { currency: "USD", costPerMillionCharacters: 20 } };
  const report = evaluateTranslationBenchmark(submission);
  const snapshot = createTranslationBenchmarkSnapshot(report, new Date("2026-08-03T01:00:00.000Z"));
  const serialized = serializeTranslationBenchmarkSnapshot(snapshot);
  const restored = parseTranslationBenchmarkSnapshot(serialized);
  assert.deepEqual(restored, snapshot);
  assert.equal(serialized.includes(TRANSLATION_BENCHMARK_CORPUS[0].sourceText), false);
  assert.equal(serialized.includes(TRANSLATION_BENCHMARK_CORPUS[0].references.en), false);
  assert.equal(serialized.includes("Synthetic reference review"), false);
  assert.equal(serialized.includes("translatedText"), false);
  assert.equal(restored.snapshotIdentifier, report.snapshotIdentifier);
});

test("snapshot comparison supports future provider regression deltas", () => {
  const baseline = createTranslationBenchmarkSnapshot(evaluateTranslationBenchmark({ ...referenceSubmission(true), provider: "provider-a", providerVersion: "v1", pricing: { currency: "USD", costPerMillionCharacters: 20 } }));
  const degradedSubmission = { ...referenceSubmission(true), provider: "provider-b", providerVersion: "v2", pricing: { currency: "USD", costPerMillionCharacters: 25 } };
  degradedSubmission.candidates[0].translatedText = "Unrelated result";
  const candidate = createTranslationBenchmarkSnapshot(evaluateTranslationBenchmark(degradedSubmission));
  const comparison = compareTranslationBenchmarkSnapshots(baseline, candidate);
  assert.ok(comparison.overallScoreDelta < 0);
  assert.ok(comparison.estimatedCostDelta! > 0);
  assert.notEqual(comparison.baselineSnapshotIdentifier, comparison.candidateSnapshotIdentifier);
});

test("complete valid human review makes a structurally valid submission decision-ready", () => {
  const report = evaluateTranslationBenchmark(referenceSubmission(true));
  assert.equal(report.humanReviewPercent, 100);
  assert.equal(report.humanScoreAverage, 5);
  assert.equal(report.requiresHumanReview, false);
  assert.equal(report.readyForProviderDecision, true);
  assert.equal(report.readinessDecision, "READY_FOR_HUMAN_DECISION");
});

test("explicit Phase 2F reviews aggregate each dimension and unlock readiness at complete coverage", () => {
  const submission = referenceSubmission();
  submission.reviews = explicitReviews(submission);
  const report = evaluateTranslationBenchmark(submission);
  assert.equal(report.humanReviewedCount, 30);
  assert.equal(report.humanReviewPercent, 100);
  assert.equal(report.averageAdequacy, 4);
  assert.equal(report.averageFluency, 3);
  assert.equal(report.averageTerminology, 5);
  assert.equal(report.averageSafety, 2);
  assert.equal(report.overallHumanScore, 3.5);
  assert.equal(report.humanScoreAverage, 3.5);
  assert.equal(report.readyForProviderDecision, true);
  assert.equal(report.readinessDecision, "READY_FOR_HUMAN_DECISION");
});

test("partial human review remains valid input but cannot satisfy readiness coverage", () => {
  const submission = referenceSubmission();
  submission.reviews = explicitReviews(submission).slice(0, 1);
  const report = evaluateTranslationBenchmark(submission);
  assert.equal(report.humanReviewedCount, 1);
  assert.equal(report.humanReviewPercent, 3.33);
  assert.equal(report.requiresHumanReview, true);
  assert.equal(report.readyForProviderDecision, false);
  assert.equal(report.readinessDecision, "NOT_READY");
});

test("review validation rejects invalid scores, aliases, duplicates, unknown keys, and language mismatches", () => {
  const submission = referenceSubmission();
  const review = explicitReviews(submission)[0];
  assert.throws(() => evaluateTranslationBenchmark({ ...submission, reviews: [{ ...review, adequacyScore: 0 }] }), /adequacyScore must be an integer between 1 and 5/);
  assert.throws(() => evaluateTranslationBenchmark({ ...submission, reviews: [{ ...review, reviewerAlias: " " }] }), /reviewerAlias is required/);
  assert.throws(() => evaluateTranslationBenchmark({ ...submission, reviews: [{ ...review, reviewerAlias: undefined } as unknown as TranslationBenchmarkReview] }), /reviewerAlias is required/);
  assert.throws(() => evaluateTranslationBenchmark({ ...submission, reviews: [review, { ...review }] }), /Duplicate review/);
  assert.throws(() => evaluateTranslationBenchmark({ ...submission, reviews: [{ ...review, candidateKey: "unknown:en" }] }), /Unknown review candidateKey/);
  assert.throws(() => evaluateTranslationBenchmark({ ...submission, reviews: [{ ...review, language: review.language === "en" ? "zh" : "en" }] }), /does not match candidateKey/);
});

test("review notes do not affect aggregation or snapshot identity", () => {
  const first = referenceSubmission();
  first.reviews = explicitReviews(first);
  const second = referenceSubmission();
  second.reviews = explicitReviews(second).map((review) => ({ ...review, notes: "Different optional note" }));
  const firstReport = evaluateTranslationBenchmark(first);
  const secondReport = evaluateTranslationBenchmark(second);
  assert.equal(secondReport.overallHumanScore, firstReport.overallHumanScore);
  assert.equal(secondReport.snapshotIdentifier, firstReport.snapshotIdentifier);
});

test("protected glossary detects corrupted OPPO product and technology terms", () => {
  const submission = referenceSubmission(true);
  const product = submission.candidates.find(({ caseId, targetLanguage }) => caseId === "find-x9-ultra-display" && targetLanguage === "en")!;
  product.translatedText = product.translatedText.replace("Find X9 Ultra", "Find X9 Ultimate").replace("AMOLED", "display technology");
  const report = evaluateTranslationBenchmark(submission);
  assert.equal(report.protectedTermsPassed, false);
  assert.ok(report.missingProtectedTerms.some(({ candidateKey, term }) => candidateKey === "find-x9-ultra-display:en" && term === "Find X9 Ultra"));
  assert.ok(report.missingProtectedTerms.some(({ term }) => term === "AMOLED"));
  assert.ok(report.protectedTermPassPercent < 100);
  assert.equal(report.readyForProviderDecision, false);
});

test("weighted scoring uses the approved category weights", () => {
  assert.equal(Object.values(TRANSLATION_BENCHMARK_CATEGORY_WEIGHTS).reduce((total, weight) => total + weight, 0), 100);
  const reference = evaluateTranslationBenchmark(referenceSubmission(true));
  assert.equal(reference.overallScore, 100);
  assert.deepEqual(Object.fromEntries(reference.categoryScores.map(({ category, weightPercent }) => [category, weightPercent])), TRANSLATION_BENCHMARK_CATEGORY_WEIGHTS);

  const degradedSubmission = referenceSubmission(true);
  const candidate = degradedSubmission.candidates.find(({ caseId, targetLanguage }) => caseId === "storage-pad3" && targetLanguage === "en")!;
  candidate.translatedText = "Unrelated response";
  const degraded = evaluateTranslationBenchmark(degradedSubmission);
  assert.ok(degraded.categoryScores.find(({ category }) => category === "product-inquiry")!.score < 100);
  assert.ok(degraded.overallScore < 100);
});

test("retail intent validation flags possible down-payment and stock mismatches", () => {
  const submission = referenceSubmission(true);
  submission.candidates.find(({ caseId, targetLanguage }) => caseId === "down-payment-only" && targetLanguage === "en")!.translatedText = "How much does it cost?";
  submission.candidates.find(({ caseId, targetLanguage }) => caseId === "availability-only" && targetLanguage === "zh")!.translatedText = "多少钱？";
  const report = evaluateTranslationBenchmark(submission);
  assert.equal(report.intentMismatchCount, 2);
  assert.deepEqual(report.intentMismatches.map(({ expectedConcept }) => expectedConcept).sort(), ["availability/stock", "down payment"]);
});

test("missing, duplicate, unknown, empty, source-copy, and protected-term failures are reported", () => {
  const submission = referenceSubmission();
  submission.candidates.shift();
  submission.candidates.push({ ...submission.candidates[0] });
  submission.candidates.push({ caseId: "unknown", targetLanguage: "en", translatedText: "unknown" });
  const emptyCandidate = submission.candidates.find(({ caseId, targetLanguage }) => caseId === "stock-color-find-x9-pro" && targetLanguage === "zh")!;
  emptyCandidate.translatedText = "";
  const sourceCase = TRANSLATION_BENCHMARK_CORPUS[1];
  const sourceCandidate = submission.candidates.find(({ caseId, targetLanguage }) => caseId === sourceCase.id && targetLanguage === "en")!;
  sourceCandidate.translatedText = sourceCase.sourceText;
  const protectedCandidate = submission.candidates.find(({ caseId, targetLanguage }) => caseId === "storage-pad3" && targetLanguage === "zh")!;
  protectedCandidate.translatedText = "有这个版本吗？";

  const report = evaluateTranslationBenchmark(submission);
  assert.ok(report.missingCandidateKeys.length > 0);
  assert.ok(report.duplicateCandidateKeys.length > 0);
  assert.ok(report.unknownCandidateKeys.length > 0);
  assert.ok(report.emptyCount > 0);
  assert.ok(report.sourceCopyCount > 0);
  assert.ok(report.protectedTermPassPercent < 100);
  assert.equal(report.automaticGatesPassed, false);
  assert.equal(report.readyForProviderDecision, false);
});

test("benchmark rejects incompatible versions and malformed metadata", () => {
  assert.throws(() => evaluateTranslationBenchmark({ ...referenceSubmission(), benchmarkVersion: "other" }), /Expected benchmarkVersion/);
  assert.throws(() => evaluateTranslationBenchmark({ ...referenceSubmission(), systemName: " " }), /systemName is required/);
  assert.throws(() => evaluateTranslationBenchmark({ ...referenceSubmission(), generatedAt: "not-a-date" }), /generatedAt must be an ISO date-time/);
});

test("provider-neutral runner generates evaluator-compatible output without database access", async () => {
  let calls = 0;
  const runner: TranslationBenchmarkRunner = { async translate(_text, targetLanguage) { calls += 1; return { translatedText: targetLanguage === "en" ? "Synthetic English" : "合成中文" }; } };
  const submission = await generateTranslationBenchmarkSubmission(runner, "google-fixture", new Date("2026-08-03T00:00:00.000Z"));
  assert.equal(calls, TRANSLATION_BENCHMARK_CORPUS.length * 2);
  assert.equal(submission.candidates.length, TRANSLATION_BENCHMARK_CORPUS.length * 2);
  assert.equal(evaluateTranslationBenchmark(submission).coveragePercent, 100);
  assert.equal(submission.provider, "google-fixture");
});
