import { TranslationTargetLanguage } from "../dto/create-message-translation.dto";

export type TranslationBenchmarkCase = {
  id: string;
  sourceLanguage: "th";
  sourceText: string;
  references: Record<TranslationTargetLanguage, string>;
  protectedTerms: string[];
  tags: string[];
};

export type TranslationBenchmarkCategory = "product-inquiry" | "promotion-payment" | "service-warranty" | "stock-pickup" | "casual-mixed";

export type TranslationHumanReview = {
  adequacy: number;
  fluency: number;
  terminology: number;
  safety: number;
  reviewerId: string;
  notes?: string;
};

export type TranslationBenchmarkReview = {
  candidateKey: string;
  language: TranslationTargetLanguage;
  adequacyScore: number;
  fluencyScore: number;
  terminologyScore: number;
  safetyScore: number;
  reviewerAlias: string;
  notes?: string;
};

export type TranslationBenchmarkCandidate = {
  caseId: string;
  targetLanguage: TranslationTargetLanguage;
  translatedText: string;
  humanReview?: TranslationHumanReview;
};

export type TranslationBenchmarkSubmission = {
  benchmarkVersion: string;
  systemName: string;
  generatedAt: string;
  provider?: string;
  providerVersion?: string;
  pricing?: TranslationBenchmarkPricing;
  candidates: TranslationBenchmarkCandidate[];
  reviews?: TranslationBenchmarkReview[];
};

export type TranslationBenchmarkPricing = { currency: string; costPerMillionCharacters: number };
export type TranslationBenchmarkCostEstimate = TranslationBenchmarkPricing & { amount: number };

export type TranslationBenchmarkCategoryScore = { category: TranslationBenchmarkCategory; weightPercent: number; score: number; candidateCount: number };
export type TranslationBenchmarkIssue = { candidateKey: string; term: string; category: string };
export type TranslationIntentMismatch = { candidateKey: string; expectedConcept: string };

export type TranslationBenchmarkReport = {
  benchmarkVersion: string;
  systemName: string;
  generatedAt: string;
  provider: string;
  providerVersion: string;
  snapshotIdentifier: string;
  language: "en+zh";
  estimatedCharacters: number;
  estimatedCost: TranslationBenchmarkCostEstimate | null;
  overallScore: number;
  categoryScores: TranslationBenchmarkCategoryScore[];
  languageScores: Record<TranslationTargetLanguage, number>;
  expectedCandidates: number;
  receivedCandidates: number;
  coveragePercent: number;
  referenceSimilarityPercent: number;
  protectedTermPassPercent: number;
  missingProtectedTerms: TranslationBenchmarkIssue[];
  intentMismatchCount: number;
  intentMismatches: TranslationIntentMismatch[];
  sourceCopyCount: number;
  emptyCount: number;
  missingCandidateKeys: string[];
  duplicateCandidateKeys: string[];
  unknownCandidateKeys: string[];
  humanReviewedCount: number;
  humanReviewPercent: number;
  humanScoreAverage: number | null;
  averageAdequacy: number | null;
  averageFluency: number | null;
  averageTerminology: number | null;
  averageSafety: number | null;
  overallHumanScore: number | null;
  requiresHumanReview: boolean;
  structuralChecksPassed: boolean;
  protectedTermsPassed: boolean;
  automaticGatesPassed: boolean;
  readyForProviderDecision: boolean;
  readinessDecision: "READY_FOR_HUMAN_DECISION" | "NOT_READY";
};
