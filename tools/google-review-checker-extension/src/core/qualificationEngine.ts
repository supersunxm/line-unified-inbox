import { segmentThaiWords } from "./thaiWordCounter.ts";
import { parseGoogleReviewDate, type DateParseStatus } from "./googleReviewDateParser.ts";
import { generateReviewFingerprint } from "./reviewFingerprint.ts";
import type { ExtractedRawReview, PhotoEvidence } from "./googleMapsDomAdapter.ts";

export type AuditCoverageStatus =
  | "IN_PROGRESS"
  | "OLDER_THAN_TARGET_REACHED"
  | "END_OF_AVAILABLE_REVIEWS";

export type EvaluatedReview = {
  fingerprint: string;
  rawDateText: string | null;
  fullReviewText: string;
  month: string | null;
  isDateInMonth: boolean;
  isEdited: boolean;
  dateStatus: DateParseStatus;
  hasPhoto: boolean;
  photoEvidence: PhotoEvidence;
  rawTokens: string[];
  finalTokens: string[];
  thaiWordCount: number;
  wordTokens: string[]; // alias for finalTokens preview in debug view
  isAtLeast15Words: boolean;
  isOver15Words: boolean; // backward compatibility alias for isAtLeast15Words
  isQualified: boolean;
};

export type KpiScanResult = {
  targetMonth: string;
  reviewsChecked: number;
  reviewsWithPhoto: number;
  reviewsOver15ThaiWords: number; // reflects finalWordCount >= 15 (aligned with DB schema)
  qualifiedReviews: number;
  unknownDateCount: number;
  editedReviewCount: number;
  hasReachedOlderReviews: boolean;
  isAtScrollBottom: boolean;
  auditCoverageStatus: AuditCoverageStatus;
  reviews: EvaluatedReview[];
};

export function determineAuditCoverageStatus(params: {
  targetMonth: string;
  reviews: EvaluatedReview[];
  isAtScrollBottom: boolean;
}): AuditCoverageStatus {
  // Condition A: At least one reliable, unedited review has month < targetMonth
  // IMPORTANT:
  // - Edited reviews (isEdited === true) must NOT trigger Condition A
  // - UNKNOWN_DATE reviews (month === null) must NOT trigger Condition A
  const hasOlder = params.reviews.some(
    (r) =>
      r.month !== null &&
      !r.isEdited &&
      r.dateStatus === "VALID" &&
      r.month < params.targetMonth
  );

  if (hasOlder) {
    return "OLDER_THAN_TARGET_REACHED";
  }

  // Condition B: User has physically reached the bottom of the review scroll pane
  // with at least one review loaded, even if the oldest review is inside or newer than targetMonth
  if (params.isAtScrollBottom && params.reviews.length > 0) {
    return "END_OF_AVAILABLE_REVIEWS";
  }

  // Neither condition met: Still in progress
  return "IN_PROGRESS";
}

export class QualificationEngine {
  /**
   * Evaluates a single review against the monthly KPI criteria.
   * STRICT PRIVACY: Keeps only anonymous evaluation attributes.
   *
   * QUALIFICATION RULE:
   * 1. Date matches target audit month
   * 2. Has customer uploaded photo
   * 3. Final Thai word count >= 15 (0-14 = FAIL, 15+ = PASS)
   */
  static evaluateReview(
    raw: ExtractedRawReview,
    targetMonth: string,
    index: number,
    referenceDate: Date = new Date(),
  ): EvaluatedReview {
    const fingerprint = generateReviewFingerprint(raw.element, index);
    const dateParsed = parseGoogleReviewDate(raw.dateText, referenceDate);
    const estimatedMonth = dateParsed.month;
    const isDateInMonth = estimatedMonth === targetMonth;
    const hasPhoto = raw.hasCustomerPhoto;
    const segmentation = segmentThaiWords(raw.reviewText);
    const thaiWordCount = segmentation.count;
    // Updated threshold: finalWordCount >= 15
    const isAtLeast15Words = thaiWordCount >= 15;

    // Strict Qualification Rule: All 3 must be true
    // (If review was edited and original date unknown, estimatedMonth is null, so isQualified is false)
    const isQualified = isDateInMonth && hasPhoto && isAtLeast15Words;

    return {
      fingerprint,
      rawDateText: raw.dateText,
      fullReviewText: raw.reviewText,
      month: estimatedMonth,
      isDateInMonth,
      isEdited: dateParsed.isEdited,
      dateStatus: dateParsed.status,
      hasPhoto,
      photoEvidence: raw.photoEvidence || (hasPhoto ? "REVIEW_MEDIA_THUMBNAIL" : "NONE"),
      rawTokens: segmentation.rawTokens,
      finalTokens: segmentation.finalTokens,
      thaiWordCount,
      wordTokens: segmentation.finalTokens,
      isAtLeast15Words,
      isOver15Words: isAtLeast15Words,
      isQualified,
    };
  }

  /**
   * Evaluates a collection of extracted raw reviews, deduplicating elements by fingerprint.
   */
  static calculateScanSummary(
    rawReviews: ExtractedRawReview[],
    targetMonth: string,
    referenceDate: Date = new Date(),
    isAtScrollBottom: boolean = false,
  ): KpiScanResult {
    const seenFingerprints = new Set<string>();
    const evaluated: EvaluatedReview[] = [];

    let reviewsChecked = 0;
    let reviewsWithPhoto = 0;
    let reviewsOver15ThaiWords = 0; // finalWordCount >= 15
    let qualifiedReviews = 0;
    let unknownDateCount = 0;
    let editedReviewCount = 0;

    for (let i = 0; i < rawReviews.length; i++) {
      const raw = rawReviews[i];
      const evalItem = this.evaluateReview(raw, targetMonth, i, referenceDate);

      // Deduplication: Ignore if already processed in this scan session
      if (seenFingerprints.has(evalItem.fingerprint)) {
        continue;
      }
      seenFingerprints.add(evalItem.fingerprint);

      reviewsChecked++;
      if (evalItem.hasPhoto) reviewsWithPhoto++;
      if (evalItem.isAtLeast15Words) reviewsOver15ThaiWords++;
      if (evalItem.isQualified) qualifiedReviews++;
      if (evalItem.month === null) unknownDateCount++;
      if (evalItem.isEdited) editedReviewCount++;

      evaluated.push(evalItem);
    }

    const auditCoverageStatus = determineAuditCoverageStatus({
      targetMonth,
      reviews: evaluated,
      isAtScrollBottom,
    });

    const hasReachedOlderReviews = auditCoverageStatus === "OLDER_THAN_TARGET_REACHED";

    return {
      targetMonth,
      reviewsChecked,
      reviewsWithPhoto,
      reviewsOver15ThaiWords,
      qualifiedReviews,
      unknownDateCount,
      editedReviewCount,
      hasReachedOlderReviews,
      isAtScrollBottom,
      auditCoverageStatus,
      reviews: evaluated,
    };
  }
}
