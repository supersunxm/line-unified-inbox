import { segmentThaiWords } from "./thaiWordCounter.ts";
import {
  parseGoogleReviewDate,
  classifyChronologicalRelation,
  type DateParseStatus,
  type ChronologicalRelation,
  type ChronologyClassification,
  type RelativeDateRange,
} from "./googleReviewDateParser.ts";
import { generateReviewFingerprint } from "./reviewFingerprint.ts";
import {
  parseImageCaptureMonth,
  resolveReviewImageMonths,
  type ImageMonthStatus,
} from "./imageCaptureExtractor.ts";
import type { ExtractedRawReview, PhotoEvidence } from "./googleMapsDomAdapter.ts";

export type AuditCoverageStatus =
  | "IN_PROGRESS"
  | "OLDER_THAN_TARGET_REACHED"
  | "END_OF_AVAILABLE_REVIEWS";

export type QualificationRuleVersion = "IMAGE_CAPTURE_MONTH_V1" | "REVIEW_CREATION_DATE_V1";

export type MonthRelation = "NEWER" | "TARGET" | "OLDER" | "UNKNOWN";

export type EvaluatedReview = {
  fingerprint: string;
  rawDateText: string | null;
  fullReviewText: string;

  // Review creation chronology (source of truth for feed navigation / stop boundary)
  month: string | null;
  isDateInMonth: boolean;
  isEdited: boolean;
  dateStatus: DateParseStatus;
  chronology: ChronologyClassification;
  chronologicalRelation: ChronologicalRelation;
  chronologicalBoundaryEligible: boolean;
  stopBoundaryTriggered: boolean;
  stopBoundaryReason: string | null;

  // Source of Truth: Customer Photo & Image Capture Month (KPI qualification source of truth)
  hasPhoto: boolean;
  photoEvidence: PhotoEvidence;
  imageCaptureMonths: string[];
  resolvedImageCaptureMonth: string | null; // e.g. "2026-09" or null
  imageMonthStatus: ImageMonthStatus;
  isTargetImageMonth: boolean;
  monthRelation: MonthRelation;

  // Thai word counting (Threshold: 0-14 FAIL, 15+ PASS)
  rawTokens: string[];
  finalTokens: string[];
  thaiWordCount: number;
  wordTokens: string[];
  isAtLeast15Words: boolean;
  isOver15Words: boolean; // backward compatibility alias

  // Final Qualification: hasCustomerPhoto && isTargetImageMonth && isAtLeast15Words
  isQualified: boolean;
  qualificationRuleVersion: QualificationRuleVersion;
};

export type KpiScanResult = {
  targetMonth: string;
  qualificationRuleVersion: QualificationRuleVersion;
  reviewsScanned: number;
  reviewsChecked: number; // backward compatibility alias for reviewsScanned
  reviewsWithPhoto: number; // backward compatibility alias for reviewsWithCustomerPhoto
  reviewsWithCustomerPhoto: number;
  photoReviewsInTargetMonth: number;
  reviewsOver15ThaiWords: number; // finalWordCount >= 15 (aligned with DB schema)
  reviewsAtLeast15Words: number; // alias
  qualifiedReviews: number;
  imageMonthUnknownCount: number;
  mixedImageMonthCount: number;
  unknownDateCount: number;
  editedReviewCount: number;
  hasReachedOlderReviews: boolean;
  isAtScrollBottom: boolean;
  auditCoverageStatus: AuditCoverageStatus;
  firstOlderReviewDateText?: string | null;
  firstOlderImageCaptureMonth?: string | null; // backward compatibility
  stopBoundarySequence?: number | null;
  reviews: EvaluatedReview[];
};

/**
 * Defensible audit completion determination.
 * Stop Rule:
 * Condition 1 (Chronological Boundary): A defensible un-edited review creation timestamp is older than targetMonth.
 * Condition 2 (Scroll end): Physical end of review list reached.
 */
export function determineAuditCoverageStatus(params: {
  targetMonth: string;
  reviews: EvaluatedReview[];
  isAtScrollBottom: boolean;
}): AuditCoverageStatus {
  // Condition 1: Primary authoritative stop boundary:
  // First defensible un-edited review with chronologicalRelation === "OLDER"
  const hasOlderReview = params.reviews.some((r) => r.stopBoundaryTriggered);
  if (hasOlderReview) {
    return "OLDER_THAN_TARGET_REACHED";
  }

  // Condition 2: Physical bottom of available reviews pane
  if (params.isAtScrollBottom && params.reviews.length > 0) {
    return "END_OF_AVAILABLE_REVIEWS";
  }

  return "IN_PROGRESS";
}

export class QualificationEngine {
  /**
   * Evaluates a single review under the IMAGE_CAPTURE_MONTH_V1 business rule:
   *
   * QUALIFIED REVIEW =
   *   hasCustomerPhoto === true
   *   AND resolvedImageCaptureMonth === targetMonth
   *   AND finalWordCount >= 15
   *
   * STRICT PRIVACY: Zero PII, reviewer identity, review text, or photo URLs persisted.
   */
  static evaluateReview(
    raw: ExtractedRawReview,
    targetMonth: string,
    index: number,
    referenceDate: Date = new Date(),
  ): EvaluatedReview {
    const fingerprint = generateReviewFingerprint(raw.element, index);

    // Review creation chronology (source of truth for feed navigation / stop boundary)
    const dateParsed = parseGoogleReviewDate(raw.dateText, referenceDate);
    const estimatedCreationMonth = dateParsed.month;
    const isDateInMonth = estimatedCreationMonth === targetMonth;
    const chronology = classifyChronologicalRelation(raw.dateText, targetMonth, referenceDate);
    const chronologicalRelation = chronology.chronologicalRelation;
    const chronologicalBoundaryEligible = chronology.chronologicalBoundaryEligible;

    // Genuine customer photo attached (KPI qualification source of truth)
    const hasPhoto = raw.hasCustomerPhoto;
    const photoEvidence = raw.photoEvidence || (hasPhoto ? "REVIEW_MEDIA_THUMBNAIL" : "NONE");

    // Resolve Image Capture Month
    // If raw.imageCaptureMonths is provided, use it; otherwise parse from raw.element if text available
    let rawMonths: (string | null)[] = raw.imageCaptureMonths || [];
    if (hasPhoto && rawMonths.length === 0 && raw.element && typeof (raw.element as any).querySelector === "function") {
      // Check for inline image capture text on thumbnail / card
      const inlineCapture = raw.element.querySelector(
        "[aria-label*='capture' i], [aria-label*='ถ่าย' i], span[class*='capture' i], div[class*='capture' i]",
      );
      if (inlineCapture) {
        const parsed = parseImageCaptureMonth(
          inlineCapture.getAttribute("aria-label") || inlineCapture.textContent,
        );
        if (parsed) rawMonths = [parsed];
      }
    }

    const imageResolution = resolveReviewImageMonths(rawMonths);
    const resolvedImageCaptureMonth = imageResolution.resolvedMonth;
    const imageMonthStatus: ImageMonthStatus = hasPhoto
      ? imageResolution.status === "NO_IMAGES"
        ? "IMAGE_MONTH_UNKNOWN"
        : imageResolution.status
      : "NO_IMAGES";
    const isTargetImageMonth = hasPhoto && resolvedImageCaptureMonth === targetMonth;

    // Image Month relationship: NEWER, TARGET, OLDER, or UNKNOWN
    let monthRelation: MonthRelation = "UNKNOWN";
    if (hasPhoto && resolvedImageCaptureMonth) {
      if (resolvedImageCaptureMonth === targetMonth) {
        monthRelation = "TARGET";
      } else if (resolvedImageCaptureMonth > targetMonth) {
        monthRelation = "NEWER";
      } else {
        monthRelation = "OLDER";
      }
    }

    // Stop Boundary: Strictly based on REVIEW CREATION CHRONOLOGY (not photo image capture date).
    // An older photo in a recent review does NOT trigger a stop boundary.
    // Only an un-edited review whose creation date is definitively older than targetMonth triggers stop.
    const stopBoundaryTriggered = Boolean(chronologicalBoundaryEligible && chronologicalRelation === "OLDER");
    const stopBoundaryReason = stopBoundaryTriggered
      ? `Review creation chronology reached older than target month (${raw.dateText || "unknown"})`
      : null;

    // Thai word segmentation & threshold counting
    const segmentation = segmentThaiWords(raw.reviewText);
    const thaiWordCount = segmentation.count;
    const isAtLeast15Words = thaiWordCount >= 15;

    // Final Qualification Rule (IMAGE_CAPTURE_MONTH_V1 with Edited Review Exclusion):
    // A review is QUALIFIED only when ALL are true:
    // 1. isEdited === false (edited reviews are excluded entirely from KPI counting)
    // 2. hasCustomerPhoto === true
    // 3. resolvedImageCaptureMonth === targetMonth
    // 4. finalWordCount >= 15
    const isQualified = !dateParsed.isEdited && hasPhoto && isTargetImageMonth && isAtLeast15Words;

    return {
      fingerprint,
      rawDateText: raw.dateText,
      fullReviewText: raw.reviewText,
      month: estimatedCreationMonth,
      isDateInMonth,
      isEdited: dateParsed.isEdited,
      dateStatus: dateParsed.status,
      chronology,
      chronologicalRelation,
      chronologicalBoundaryEligible,
      stopBoundaryTriggered,
      stopBoundaryReason,
      hasPhoto,
      photoEvidence,
      imageCaptureMonths: imageResolution.rawMonths.filter((m): m is string => Boolean(m)),
      resolvedImageCaptureMonth,
      imageMonthStatus,
      isTargetImageMonth,
      monthRelation,
      rawTokens: segmentation.rawTokens,
      finalTokens: segmentation.finalTokens,
      thaiWordCount,
      wordTokens: segmentation.finalTokens,
      isAtLeast15Words,
      isOver15Words: isAtLeast15Words,
      isQualified,
      qualificationRuleVersion: "IMAGE_CAPTURE_MONTH_V1",
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
    let photoReviewsInTargetMonth = 0;
    let reviewsOver15ThaiWords = 0;
    let qualifiedReviews = 0;
    let imageMonthUnknownCount = 0;
    let mixedImageMonthCount = 0;
    let unknownDateCount = 0;
    let editedReviewCount = 0;
    let firstOlderReviewDateText: string | null = null;
    let stopBoundarySequence: number | null = null;

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
      if (evalItem.isTargetImageMonth) photoReviewsInTargetMonth++;
      if (evalItem.isAtLeast15Words) reviewsOver15ThaiWords++;
      if (evalItem.isQualified) qualifiedReviews++;

      if (evalItem.imageMonthStatus === "IMAGE_MONTH_UNKNOWN") imageMonthUnknownCount++;
      if (evalItem.imageMonthStatus === "MIXED_IMAGE_MONTH") mixedImageMonthCount++;

      if (evalItem.month === null) unknownDateCount++;
      if (evalItem.isEdited) editedReviewCount++;

      evaluated.push(evalItem);

      // Check if this review is the first stop boundary
      if (evalItem.stopBoundaryTriggered && !firstOlderReviewDateText) {
        firstOlderReviewDateText = evalItem.rawDateText;
        stopBoundarySequence = evaluated.length;
        // Stop processing further reviews immediately
        break;
      }
    }

    const auditCoverageStatus = determineAuditCoverageStatus({
      targetMonth,
      reviews: evaluated,
      isAtScrollBottom,
    });

    const hasReachedOlderReviews = auditCoverageStatus === "OLDER_THAN_TARGET_REACHED";

    return {
      targetMonth,
      qualificationRuleVersion: "IMAGE_CAPTURE_MONTH_V1",
      reviewsScanned: reviewsChecked,
      reviewsChecked,
      reviewsWithPhoto,
      reviewsWithCustomerPhoto: reviewsWithPhoto,
      photoReviewsInTargetMonth,
      reviewsOver15ThaiWords,
      reviewsAtLeast15Words: reviewsOver15ThaiWords,
      qualifiedReviews,
      imageMonthUnknownCount,
      mixedImageMonthCount,
      unknownDateCount,
      editedReviewCount,
      hasReachedOlderReviews,
      isAtScrollBottom,
      auditCoverageStatus,
      firstOlderReviewDateText,
      firstOlderImageCaptureMonth: firstOlderReviewDateText,
      stopBoundarySequence,
      reviews: evaluated,
    };
  }
}
