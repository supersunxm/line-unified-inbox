import { createHash, createHmac } from "node:crypto";

const FINGERPRINT_SECRET = process.env.GOOGLE_REVIEW_FINGERPRINT_SECRET || "oppo_line_oa_google_review_salt_2026";

/**
 * Computes a privacy-preserving, non-reversible fingerprint for a Google review card.
 * Absolutely zero PII (reviewer name, review body text, user photo/avatar, profile url) is retained.
 *
 * @param storeCode - Store code / externalStoreId
 * @param dataReviewId - Immutable Google Maps review element attribute data-review-id
 * @param fallbackMeta - Optional metadata in case dataReviewId is absent
 */
export function computeReviewFingerprint(
  storeCode: string,
  dataReviewId?: string | null,
  fallbackMeta?: {
    relativeDateText?: string;
    wordCount?: number;
    hasPhoto?: boolean;
    cardIndex?: number;
  }
): string {
  const cleanStore = String(storeCode).trim();

  if (dataReviewId && typeof dataReviewId === "string" && dataReviewId.trim().length > 0) {
    const raw = `${cleanStore}:${dataReviewId.trim()}`;
    return createHmac("sha256", FINGERPRINT_SECRET).update(raw).digest("hex");
  }

  // Fallback composite fingerprint if data-review-id is unexpectedly missing
  const fallbackStr = [
    cleanStore,
    fallbackMeta?.relativeDateText || "unknown_date",
    fallbackMeta?.wordCount ?? 0,
    fallbackMeta?.hasPhoto ? "1" : "0",
    fallbackMeta?.cardIndex ?? 0,
  ].join(":");

  return createHash("sha256").update(fallbackStr).digest("hex");
}
