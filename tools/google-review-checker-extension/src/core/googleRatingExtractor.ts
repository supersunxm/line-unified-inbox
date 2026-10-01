/**
 * Google Maps Store Aggregate Rating & Review Count Extractor.
 *
 * Extracts and validates the current overall store rating and lifetime review count
 * displayed at the top of the Google Maps Reviews panel (supporting Thai & English).
 *
 * Example:
 *   5.0
 *   92 reviews / 92 รีวิว
 */

export type ExtractedGoogleRatingData = {
  googleRating: number | null;
  googleReviewCount: number | null;
  googleRatingCheckedAt: string | null;
  diagnostic?: string;
};

/**
 * Parses numeric store rating from text or aria-label (range 1.0 to 5.0).
 * Returns null if invalid or not found.
 */
export function parseGoogleRating(text: string | null | undefined): number | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Reject negative numbers immediately
  if (/-\s*\d/.test(trimmed)) return null;

  // Pattern 1: Standalone numeric rating like "5.0", "4.9", "4.8"
  const exactMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (exactMatch) {
    const num = parseFloat(exactMatch[1]);
    if (num < 1.0 || num > 5.0) return null;
    return Math.round(num * 10) / 10;
  }

  // Pattern 2: Embedded rating with labels, e.g. "คะแนน 4.7 จาก 5", "4.8 stars", "Rating 4.9 out of 5"
  const match = trimmed.match(/(?:^|[^\d.-])([1-5](?:\.[0-9]+)?)(?:\s*(?:ดาว|stars?|\/|out of)|\s*$|[^\d.])/i);
  if (match) {
    const num = parseFloat(match[1]);
    if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
      return Math.round(num * 10) / 10;
    }
  }

  return null;
}

/**
 * Parses total lifetime review count from text or aria-label (non-negative integer).
 * Handles Thai ("92 รีวิว"), English ("92 reviews"), parenthesized ("(92)"), and comma-separated numbers ("1,234").
 */
export function parseGoogleReviewCount(text: string | null | undefined): number | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Reject negative numbers immediately
  if (/-\s*\d/.test(trimmed)) return null;

  // Priority 1: explicitly labeled review count (e.g. "92 reviews", "92 รีวิว", "1,234 reviews")
  const labelMatch = trimmed.match(/([\d,]+)\s*(?:รีวิว|reviews?)/i);
  if (labelMatch) {
    const parsed = parseInt(labelMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }

  // Priority 2: parenthesized count e.g. "(92)" or "(1,234)"
  const parenMatch = trimmed.match(/\(([\d,]+)\)/);
  if (parenMatch) {
    const parsed = parseInt(parenMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }

  // Priority 3: standalone digits string e.g. "92"
  const standaloneMatch = trimmed.match(/^([\d,]+)$/);
  if (standaloneMatch) {
    const parsed = parseInt(standaloneMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }

  return null;
}

/**
 * Extracts the current aggregate store rating and total review count from the DOM.
 */
export function extractStoreGoogleRating(doc?: Document): ExtractedGoogleRatingData {
  const targetDoc = doc || (typeof document !== "undefined" ? document : null);
  if (!targetDoc) {
    return {
      googleRating: null,
      googleReviewCount: null,
      googleRatingCheckedAt: null,
      diagnostic: "DOCUMENT_NOT_AVAILABLE",
    };
  }

  let rating: number | null = null;
  let reviewCount: number | null = null;

  // 1. Primary rating selector: review summary block (.jANrlb) at the top of the reviews tab
  const primaryRatingEl = targetDoc.querySelector("div.jANrlb .fontDisplayLarge, div.jANrlb span.ceNzKf");
  if (primaryRatingEl) {
    const text = primaryRatingEl.textContent?.trim() || primaryRatingEl.getAttribute("aria-label") || "";
    rating = parseGoogleRating(text);
  }

  // 2. Fallback rating selectors: global header or rating triggers
  if (rating === null) {
    const fallbackRatingEls = targetDoc.querySelectorAll(".F7nice span[aria-hidden='true'], .F7nice, span.ceNzKf, .fontDisplayLarge");
    for (const el of Array.from(fallbackRatingEls)) {
      const text = el.textContent?.trim() || el.getAttribute("aria-label") || "";
      const parsed = parseGoogleRating(text);
      if (parsed !== null) {
        rating = parsed;
        break;
      }
    }
  }

  // 3. Aria-label buttons fallback for rating
  if (rating === null) {
    const starButtons = targetDoc.querySelectorAll("button[aria-label*='ดาว' i], button[aria-label*='stars' i], button[aria-label*='star' i]");
    for (const el of Array.from(starButtons)) {
      const aria = el.getAttribute("aria-label") || "";
      const parsed = parseGoogleRating(aria);
      if (parsed !== null) {
        rating = parsed;
        break;
      }
    }
  }

  // 4. Primary review count selector: within review summary container (.jANrlb) or general review headers
  const primaryCountEl = targetDoc.querySelector(
    "div.jANrlb .fontBodySmall, div.jANrlb span.fontBodySmall, div.jANrlb .fontBodyMedium, div.jANrlb, .fontBodyMedium"
  );
  if (primaryCountEl) {
    const text = primaryCountEl.textContent?.trim() || primaryCountEl.getAttribute("aria-label") || "";
    reviewCount = parseGoogleReviewCount(text);
  }

  // 5. Fallback review count selectors: buttons, headers, or parent elements
  if (reviewCount === null) {
    const fallbackCountEls = targetDoc.querySelectorAll(
      "button[aria-label*='รีวิว' i], button[aria-label*='reviews' i], [aria-label*='รีวิว' i], [aria-label*='reviews' i], .LBgpqf, .skqShb, .F7nice"
    );
    for (const el of Array.from(fallbackCountEls)) {
      const text = el.textContent?.trim() || el.getAttribute("aria-label") || "";
      const parsed = parseGoogleReviewCount(text);
      if (parsed !== null) {
        reviewCount = parsed;
        break;
      }
    }
  }

  if (rating === null && reviewCount === null) {
    return {
      googleRating: null,
      googleReviewCount: null,
      googleRatingCheckedAt: null,
      diagnostic: "RATING_METADATA_UNAVAILABLE",
    };
  }

  return {
    googleRating: rating,
    googleReviewCount: reviewCount,
    googleRatingCheckedAt: new Date().toISOString(),
  };
}
