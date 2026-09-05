import { createHash, createHmac } from "node:crypto";

const FINGERPRINT_SECRET = process.env.GOOGLE_REVIEW_FINGERPRINT_SECRET || "oppo_line_oa_google_review_salt_2026";

export function computeReviewFingerprint(storeCode, dataReviewId, fallbackMeta) {
  const cleanStore = String(storeCode).trim();

  if (dataReviewId && typeof dataReviewId === "string" && dataReviewId.trim().length > 0) {
    const raw = `${cleanStore}:${dataReviewId.trim()}`;
    return createHmac("sha256", FINGERPRINT_SECRET).update(raw).digest("hex");
  }

  const fallbackStr = [
    cleanStore,
    fallbackMeta?.relativeDateText || "unknown_date",
    fallbackMeta?.wordCount ?? 0,
    fallbackMeta?.hasPhoto ? "1" : "0",
    fallbackMeta?.cardIndex ?? 0,
  ].join(":");

  return createHash("sha256").update(fallbackStr).digest("hex");
}
