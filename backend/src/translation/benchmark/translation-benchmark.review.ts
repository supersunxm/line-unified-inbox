import { TranslationTargetLanguage } from "../dto/create-message-translation.dto";
import { TranslationBenchmarkReview, TranslationBenchmarkSubmission } from "./translation-benchmark.types";

function validateScore(value: number, field: string, candidateKey: string) {
  if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error(`${field} must be an integer between 1 and 5 for ${candidateKey}`);
}

function validateReview(review: TranslationBenchmarkReview, expectedLanguages: ReadonlyMap<string, TranslationTargetLanguage>) {
  const candidateKey = typeof review.candidateKey === "string" ? review.candidateKey.trim() : "";
  if (!candidateKey || !expectedLanguages.has(candidateKey)) throw new Error(`Unknown review candidateKey ${candidateKey || "(empty)"}`);
  if (review.language !== "en" && review.language !== "zh") throw new Error(`Invalid review language for ${candidateKey}`);
  if (expectedLanguages.get(candidateKey) !== review.language) throw new Error(`Review language does not match candidateKey ${candidateKey}`);
  if (typeof review.reviewerAlias !== "string" || !review.reviewerAlias.trim()) throw new Error(`reviewerAlias is required for ${candidateKey}`);
  if (review.notes !== undefined && typeof review.notes !== "string") throw new Error(`notes must be a string for ${candidateKey}`);
  validateScore(review.adequacyScore, "adequacyScore", candidateKey);
  validateScore(review.fluencyScore, "fluencyScore", candidateKey);
  validateScore(review.terminologyScore, "terminologyScore", candidateKey);
  validateScore(review.safetyScore, "safetyScore", candidateKey);
  return { ...review, candidateKey, reviewerAlias: review.reviewerAlias.trim() };
}

export function collectTranslationBenchmarkReviews(
  submission: TranslationBenchmarkSubmission,
  expectedLanguages: ReadonlyMap<string, TranslationTargetLanguage>,
) {
  const reviews = new Map<string, TranslationBenchmarkReview>();
  const addReview = (review: TranslationBenchmarkReview) => {
    const validated = validateReview(review, expectedLanguages);
    if (reviews.has(validated.candidateKey)) throw new Error(`Duplicate review for ${validated.candidateKey}`);
    reviews.set(validated.candidateKey, validated);
  };

  for (const review of submission.reviews ?? []) addReview(review);
  for (const candidate of submission.candidates) {
    if (!candidate.humanReview) continue;
    addReview({
      candidateKey: `${candidate.caseId}:${candidate.targetLanguage}`,
      language: candidate.targetLanguage,
      adequacyScore: candidate.humanReview.adequacy,
      fluencyScore: candidate.humanReview.fluency,
      terminologyScore: candidate.humanReview.terminology,
      safetyScore: candidate.humanReview.safety,
      reviewerAlias: candidate.humanReview.reviewerId,
      notes: candidate.humanReview.notes,
    });
  }
  return reviews;
}
