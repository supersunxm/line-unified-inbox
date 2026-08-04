import { TranslationBenchmarkReport } from "./translation-benchmark.types";

export type TranslationProviderDecisionState = "APPROVED_FOR_PILOT" | "NEEDS_IMPROVEMENT" | "REJECTED";

export type TranslationProviderDecisionInput = Pick<
  TranslationBenchmarkReport,
  | "provider"
  | "providerVersion"
  | "benchmarkVersion"
  | "structuralChecksPassed"
  | "protectedTermsPassed"
  | "intentMismatchCount"
  | "humanReviewPercent"
  | "overallHumanScore"
  | "overallScore"
>;

export type TranslationProviderDecision = {
  provider: string;
  providerVersion: string;
  benchmarkVersion: string;
  decision: TranslationProviderDecisionState;
  reasons: string[];
  blockingIssues: string[];
  automatedScore: number;
  humanScore: number | null;
  generatedAt: string;
};

export function createTranslationProviderDecision(
  report: TranslationProviderDecisionInput,
  generatedAt = new Date(),
): TranslationProviderDecision {
  if (!Number.isFinite(generatedAt.getTime())) throw new Error("generatedAt must be a valid date");

  const reasons: string[] = [];
  const rejectionIssues: string[] = [];
  const improvementIssues: string[] = [];

  if (report.structuralChecksPassed) reasons.push("Structural benchmark checks passed");
  else rejectionIssues.push("Structural benchmark checks failed");

  if (report.protectedTermsPassed) reasons.push("Protected OPPO terminology checks passed");
  else rejectionIssues.push("Protected OPPO terminology checks failed");

  if (report.intentMismatchCount === 0) reasons.push("No retail intent mismatches were detected");
  else rejectionIssues.push(`${report.intentMismatchCount} retail intent mismatch${report.intentMismatchCount === 1 ? "" : "es"} detected`);

  if (report.humanReviewPercent === 100) reasons.push("Human review coverage is complete");
  else improvementIssues.push(`Human review coverage is ${report.humanReviewPercent}%; 100% is required`);

  if (report.overallHumanScore !== null && report.overallHumanScore >= 4) reasons.push(`Overall human score ${report.overallHumanScore} meets the 4.0 pilot threshold`);
  else improvementIssues.push(report.overallHumanScore === null ? "Overall human score is unavailable" : `Overall human score ${report.overallHumanScore} is below the 4.0 pilot threshold`);

  const decision: TranslationProviderDecisionState = rejectionIssues.length
    ? "REJECTED"
    : improvementIssues.length
      ? "NEEDS_IMPROVEMENT"
      : "APPROVED_FOR_PILOT";

  return {
    provider: report.provider,
    providerVersion: report.providerVersion,
    benchmarkVersion: report.benchmarkVersion,
    decision,
    reasons,
    blockingIssues: [...rejectionIssues, ...improvementIssues],
    automatedScore: report.overallScore,
    humanScore: report.overallHumanScore,
    generatedAt: generatedAt.toISOString(),
  };
}
