import { TranslationBenchmarkCategory, TranslationBenchmarkCategoryScore, TranslationBenchmarkCostEstimate, TranslationBenchmarkReport } from "./translation-benchmark.types";

export type TranslationBenchmarkSnapshot = {
  schemaVersion: "translation-benchmark-snapshot-v1";
  snapshotIdentifier: string;
  createdAt: string;
  benchmarkVersion: string;
  provider: string;
  providerVersion: string;
  language: "en+zh";
  estimatedCharacters: number;
  estimatedCost: TranslationBenchmarkCostEstimate | null;
  overallScore: number;
  categoryScores: TranslationBenchmarkCategoryScore[];
  languageScores: { en: number; zh: number };
  protectedTermPassPercent: number;
  humanReviewPercent: number;
  averageAdequacy: number | null;
  averageFluency: number | null;
  averageTerminology: number | null;
  averageSafety: number | null;
  overallHumanScore: number | null;
  structuralChecksPassed: boolean;
  protectedTermsPassed: boolean;
  readinessDecision: TranslationBenchmarkReport["readinessDecision"];
  issueCounts: { missingProtectedTerms: number; intentMismatches: number; missingCandidates: number; duplicateCandidates: number; unknownCandidates: number; sourceCopies: number; emptyCandidates: number };
};

export type TranslationBenchmarkSnapshotComparison = {
  baselineSnapshotIdentifier: string;
  candidateSnapshotIdentifier: string;
  overallScoreDelta: number;
  estimatedCostDelta: number | null;
  categoryScoreDeltas: Record<TranslationBenchmarkCategory, number>;
  readinessChanged: boolean;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function roundCost(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function createTranslationBenchmarkSnapshot(report: TranslationBenchmarkReport, createdAt = new Date()): TranslationBenchmarkSnapshot {
  return {
    schemaVersion: "translation-benchmark-snapshot-v1",
    snapshotIdentifier: report.snapshotIdentifier,
    createdAt: createdAt.toISOString(),
    benchmarkVersion: report.benchmarkVersion,
    provider: report.provider,
    providerVersion: report.providerVersion,
    language: report.language,
    estimatedCharacters: report.estimatedCharacters,
    estimatedCost: report.estimatedCost,
    overallScore: report.overallScore,
    categoryScores: report.categoryScores,
    languageScores: report.languageScores,
    protectedTermPassPercent: report.protectedTermPassPercent,
    humanReviewPercent: report.humanReviewPercent,
    averageAdequacy: report.averageAdequacy,
    averageFluency: report.averageFluency,
    averageTerminology: report.averageTerminology,
    averageSafety: report.averageSafety,
    overallHumanScore: report.overallHumanScore,
    structuralChecksPassed: report.structuralChecksPassed,
    protectedTermsPassed: report.protectedTermsPassed,
    readinessDecision: report.readinessDecision,
    issueCounts: {
      missingProtectedTerms: report.missingProtectedTerms.length,
      intentMismatches: report.intentMismatchCount,
      missingCandidates: report.missingCandidateKeys.length,
      duplicateCandidates: report.duplicateCandidateKeys.length,
      unknownCandidates: report.unknownCandidateKeys.length,
      sourceCopies: report.sourceCopyCount,
      emptyCandidates: report.emptyCount,
    },
  };
}

export function serializeTranslationBenchmarkSnapshot(snapshot: TranslationBenchmarkSnapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function parseTranslationBenchmarkSnapshot(serialized: string): TranslationBenchmarkSnapshot {
  const parsed = JSON.parse(serialized) as Partial<TranslationBenchmarkSnapshot>;
  if (parsed.schemaVersion !== "translation-benchmark-snapshot-v1" || typeof parsed.snapshotIdentifier !== "string" || !parsed.snapshotIdentifier || typeof parsed.provider !== "string" || typeof parsed.providerVersion !== "string" || !Array.isArray(parsed.categoryScores)) {
    throw new Error("Invalid translation benchmark snapshot");
  }
  return parsed as TranslationBenchmarkSnapshot;
}

export function compareTranslationBenchmarkSnapshots(baseline: TranslationBenchmarkSnapshot, candidate: TranslationBenchmarkSnapshot): TranslationBenchmarkSnapshotComparison {
  const baselineCategories = new Map(baseline.categoryScores.map(({ category, score }) => [category, score]));
  const categoryScoreDeltas = Object.fromEntries(candidate.categoryScores.map(({ category, score }) => [category, round(score - (baselineCategories.get(category) ?? 0))])) as Record<TranslationBenchmarkCategory, number>;
  return {
    baselineSnapshotIdentifier: baseline.snapshotIdentifier,
    candidateSnapshotIdentifier: candidate.snapshotIdentifier,
    overallScoreDelta: round(candidate.overallScore - baseline.overallScore),
    estimatedCostDelta: baseline.estimatedCost && candidate.estimatedCost && baseline.estimatedCost.currency === candidate.estimatedCost.currency ? roundCost(candidate.estimatedCost.amount - baseline.estimatedCost.amount) : null,
    categoryScoreDeltas,
    readinessChanged: baseline.readinessDecision !== candidate.readinessDecision,
  };
}
