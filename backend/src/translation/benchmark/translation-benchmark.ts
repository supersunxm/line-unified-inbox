import { TRANSLATION_BENCHMARK_CORPUS, TRANSLATION_BENCHMARK_VERSION } from "./translation-benchmark.corpus";
import { glossaryEntriesForSource, glossaryTargetPreserved } from "./oppo-retail-glossary";
import { TRANSLATION_BENCHMARK_CASE_CATEGORIES, TRANSLATION_BENCHMARK_CATEGORY_WEIGHTS, TRANSLATION_BENCHMARK_INTENTS } from "./translation-benchmark.metadata";
import { TranslationBenchmarkCandidate, TranslationBenchmarkCategory, TranslationBenchmarkReport, TranslationBenchmarkSubmission, TranslationHumanReview } from "./translation-benchmark.types";

const targetLanguages = ["en", "zh"] as const;

function candidateKey(candidate: Pick<TranslationBenchmarkCandidate, "caseId" | "targetLanguage">) {
  return `${candidate.caseId}:${candidate.targetLanguage}`;
}

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function bigrams(value: string) {
  const normalized = normalize(value);
  if (normalized.length < 2) return new Set(normalized ? [normalized] : []);
  return new Set(Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2)));
}

function diceSimilarity(left: string, right: string) {
  const leftSet = bigrams(left);
  const rightSet = bigrams(right);
  if (!leftSet.size && !rightSet.size) return 1;
  let overlap = 0;
  for (const item of leftSet) if (rightSet.has(item)) overlap += 1;
  return (2 * overlap) / (leftSet.size + rightSet.size);
}

function validHumanReview(review: TranslationHumanReview | undefined) {
  if (!review?.reviewerId.trim()) return false;
  if (review.notes !== undefined && typeof review.notes !== "string") return false;
  return [review.adequacy, review.fluency, review.terminology, review.safety].every((score) => Number.isInteger(score) && score >= 1 && score <= 5);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function roundCost(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function validatePricing(pricing: TranslationBenchmarkSubmission["pricing"]) {
  if (!pricing) return;
  if (!pricing.currency.trim()) throw new Error("pricing.currency is required");
  if (!Number.isFinite(pricing.costPerMillionCharacters) || pricing.costPerMillionCharacters < 0) throw new Error("pricing.costPerMillionCharacters must be a non-negative number");
}

function snapshotIdentifier(submission: TranslationBenchmarkSubmission) {
  const candidateDigests = submission.candidates
    .map((candidate) => ({ key: candidateKey(candidate), textDigest: createHash("sha256").update(candidate.translatedText).digest("hex"), reviewScores: candidate.humanReview ? [candidate.humanReview.adequacy, candidate.humanReview.fluency, candidate.humanReview.terminology, candidate.humanReview.safety] : null }))
    .sort((left, right) => left.key.localeCompare(right.key));
  const identity = JSON.stringify({ benchmarkVersion: submission.benchmarkVersion, provider: submission.provider ?? submission.systemName, providerVersion: submission.providerVersion ?? "unspecified", generatedAt: submission.generatedAt, pricing: submission.pricing ?? null, candidateDigests });
  return `translation-${createHash("sha256").update(identity).digest("hex").slice(0, 20)}`;
}

export function evaluateTranslationBenchmark(submission: TranslationBenchmarkSubmission): TranslationBenchmarkReport {
  if (submission.benchmarkVersion !== TRANSLATION_BENCHMARK_VERSION) throw new Error(`Expected benchmarkVersion ${TRANSLATION_BENCHMARK_VERSION}`);
  if (!submission.systemName.trim()) throw new Error("systemName is required");
  if (!Number.isFinite(Date.parse(submission.generatedAt))) throw new Error("generatedAt must be an ISO date-time");
  validatePricing(submission.pricing);

  const expected = new Map<string, { testCase: (typeof TRANSLATION_BENCHMARK_CORPUS)[number]; targetLanguage: (typeof targetLanguages)[number] }>(
    TRANSLATION_BENCHMARK_CORPUS.flatMap((testCase) => targetLanguages.map((targetLanguage) => [`${testCase.id}:${targetLanguage}`, { testCase, targetLanguage }] as const)),
  );
  const received = new Map<string, TranslationBenchmarkCandidate>();
  const duplicateCandidateKeys = new Set<string>();
  const unknownCandidateKeys = new Set<string>();

  for (const candidate of submission.candidates) {
    const key = candidateKey(candidate);
    if (!expected.has(key)) unknownCandidateKeys.add(key);
    if (received.has(key)) duplicateCandidateKeys.add(key);
    else received.set(key, candidate);
  }

  let emptyCount = 0;
  let sourceCopyCount = 0;
  let protectedTermsChecked = 0;
  let protectedTermsPassed = 0;
  let similarityTotal = 0;
  let evaluatedCount = 0;
  let humanReviewedCount = 0;
  let humanScoreTotal = 0;
  const missingProtectedTerms: TranslationBenchmarkReport["missingProtectedTerms"] = [];
  const intentMismatches: TranslationBenchmarkReport["intentMismatches"] = [];
  const categoryTotals = new Map<TranslationBenchmarkCategory, { total: number; count: number }>();
  const languageTotals: Record<(typeof targetLanguages)[number], { total: number; count: number }> = { en: { total: 0, count: 0 }, zh: { total: 0, count: 0 } };

  for (const [key, definition] of expected) {
    const candidate = received.get(key);
    if (!candidate) continue;
    evaluatedCount += 1;
    const output = candidate.translatedText.trim();
    if (!output) emptyCount += 1;
    if (output && normalize(output) === normalize(definition.testCase.sourceText)) sourceCopyCount += 1;
    const similarity = diceSimilarity(output, definition.testCase.references[definition.targetLanguage]);
    similarityTotal += similarity;
    const category = TRANSLATION_BENCHMARK_CASE_CATEGORIES[definition.testCase.id];
    if (!category) throw new Error(`Benchmark category is missing for ${definition.testCase.id}`);
    const categoryTotal = categoryTotals.get(category) ?? { total: 0, count: 0 };
    categoryTotal.total += similarity;
    categoryTotal.count += 1;
    categoryTotals.set(category, categoryTotal);
    languageTotals[definition.targetLanguage].total += similarity;
    languageTotals[definition.targetLanguage].count += 1;
    const glossaryEntries = glossaryEntriesForSource(definition.testCase.sourceText);
    const glossaryTerms = new Set(glossaryEntries.map(({ term }) => term));
    for (const entry of glossaryEntries) {
      protectedTermsChecked += 1;
      if (glossaryTargetPreserved(output, definition.targetLanguage, entry)) protectedTermsPassed += 1;
      else missingProtectedTerms.push({ candidateKey: key, term: entry.term, category: entry.category });
    }
    for (const term of definition.testCase.protectedTerms) {
      if (glossaryTerms.has(term)) continue;
      protectedTermsChecked += 1;
      if (normalize(output).includes(normalize(term))) protectedTermsPassed += 1;
      else missingProtectedTerms.push({ candidateKey: key, term, category: "case-specific" });
    }
    const intent = TRANSLATION_BENCHMARK_INTENTS[definition.testCase.id];
    if (intent && !intent.acceptedTargets[definition.targetLanguage].some((term) => normalize(output).includes(normalize(term)))) {
      intentMismatches.push({ candidateKey: key, expectedConcept: intent.concept });
    }
    if (validHumanReview(candidate.humanReview)) {
      humanReviewedCount += 1;
      const review = candidate.humanReview!;
      humanScoreTotal += review.adequacy + review.fluency + review.terminology + review.safety;
    }
  }

  const expectedCandidates = expected.size;
  const missingCandidateKeys = [...expected.keys()].filter((key) => !received.has(key));
  const coveragePercent = (evaluatedCount / expectedCandidates) * 100;
  const humanReviewPercent = (humanReviewedCount / expectedCandidates) * 100;
  const structuralChecksPassed = missingCandidateKeys.length === 0 && duplicateCandidateKeys.size === 0 && unknownCandidateKeys.size === 0 && emptyCount === 0 && sourceCopyCount === 0;
  const allProtectedTermsPassed = protectedTermsPassed === protectedTermsChecked;
  const automaticGatesPassed = structuralChecksPassed && allProtectedTermsPassed;
  const requiresHumanReview = humanReviewedCount !== expectedCandidates;
  const categories = Object.entries(TRANSLATION_BENCHMARK_CATEGORY_WEIGHTS) as Array<[TranslationBenchmarkCategory, number]>;
  const categoryScores = categories.map(([category, weightPercent]) => {
    const total = categoryTotals.get(category) ?? { total: 0, count: 0 };
    return { category, weightPercent, score: round(total.count ? (total.total / total.count) * 100 : 0), candidateCount: total.count };
  });
  const overallScore = round(categoryScores.reduce((total, category) => total + category.score * (category.weightPercent / 100), 0));
  const readyForProviderDecision = automaticGatesPassed && !requiresHumanReview;
  const estimatedCharacters = TRANSLATION_BENCHMARK_CORPUS.reduce((total, testCase) => total + [...testCase.sourceText].length * targetLanguages.length, 0);
  const estimatedCost = submission.pricing ? { ...submission.pricing, amount: roundCost((estimatedCharacters / 1_000_000) * submission.pricing.costPerMillionCharacters) } : null;

  return {
    benchmarkVersion: submission.benchmarkVersion,
    systemName: submission.systemName,
    generatedAt: submission.generatedAt,
    provider: submission.provider?.trim() || submission.systemName,
    providerVersion: submission.providerVersion?.trim() || "unspecified",
    snapshotIdentifier: snapshotIdentifier(submission),
    language: "en+zh",
    estimatedCharacters,
    estimatedCost,
    overallScore,
    categoryScores,
    languageScores: {
      en: round(languageTotals.en.count ? (languageTotals.en.total / languageTotals.en.count) * 100 : 0),
      zh: round(languageTotals.zh.count ? (languageTotals.zh.total / languageTotals.zh.count) * 100 : 0),
    },
    expectedCandidates,
    receivedCandidates: submission.candidates.length,
    coveragePercent: round(coveragePercent),
    referenceSimilarityPercent: round(evaluatedCount ? (similarityTotal / evaluatedCount) * 100 : 0),
    protectedTermPassPercent: round(protectedTermsChecked ? (protectedTermsPassed / protectedTermsChecked) * 100 : 100),
    missingProtectedTerms,
    intentMismatchCount: intentMismatches.length,
    intentMismatches,
    sourceCopyCount,
    emptyCount,
    missingCandidateKeys,
    duplicateCandidateKeys: [...duplicateCandidateKeys].sort(),
    unknownCandidateKeys: [...unknownCandidateKeys].sort(),
    humanReviewedCount,
    humanReviewPercent: round(humanReviewPercent),
    humanScoreAverage: humanReviewedCount ? round(humanScoreTotal / (humanReviewedCount * 4)) : null,
    requiresHumanReview,
    structuralChecksPassed,
    protectedTermsPassed: allProtectedTermsPassed,
    automaticGatesPassed,
    readyForProviderDecision,
    readinessDecision: readyForProviderDecision ? "READY_FOR_HUMAN_DECISION" : "NOT_READY",
  };
}
import { createHash } from "node:crypto";
