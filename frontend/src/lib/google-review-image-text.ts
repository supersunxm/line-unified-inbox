const DATE_MARKER =
  /\b(?:a|an|\d+)\s+(?:minute|hour|day|week|month|year)s?\s+ago\b/i;

const THAI_DATE_MARKER =
  /(เมื่อ\s*)?(?:\d+\s*)?(?:นาที|ชั่วโมง|วัน|สัปดาห์|เดือน|ปี)(?:ที่แล้ว|ก่อน)/;

const END_MARKER =
  /(see\s+translation|translation\s*\(english\)|press\s+and\s+hold\s+to\s+react|อ่านเพิ่มเติม|ดูคำแปล|แสดงคำแปล|ถูกใจ|แชร์|ตอบกลับ)/i;

const META_LINE =
  /^(reviews?|review|photos?|photo|reviews\s*·|\d+\s+reviews?|\d+\s+review|\d+\s+photos?|\d+\s+photo)$/i;

const STAR_ONLY = /^[★☆⭐\s]+$/u;
const NUMBER_META = /^\d+\s*(reviews?|photos?)?(\s*[·•]\s*\d+\s*(reviews?|photos?))?$/i;

export type ReviewCandidate = {
  text: string;
  sourceIndex: number;
};

export function normalizeOcrText(rawText?: string | null): string {
  if (!rawText) return "";
  return rawText
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

export function isReviewUiNoise(line: string): boolean {
  const value = line.trim();
  if (!value) return true;

  const lower = value.toLowerCase();
  if (
    lower === "reviews" ||
    lower === "review" ||
    lower === "more" ||
    lower === "new" ||
    lower === "google"
  ) {
    return true;
  }

  if (END_MARKER.test(value)) return true;
  if (META_LINE.test(value)) return true;
  if (STAR_ONLY.test(value)) return true;
  if (NUMBER_META.test(value)) return true;

  if (/^[⋮•·|\-–—]+$/u.test(value)) return true;
  if (/^oppo\s+experience\s+store\b/i.test(value)) return true;
  if (/^oppo\s+brand\s+shop\b/i.test(value)) return true;

  return false;
}

function stripDateMarker(line: string): string {
  return line
    .replace(/[★☆⭐]+/gu, " ")
    .replace(DATE_MARKER, " ")
    .replace(THAI_DATE_MARKER, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeReviewText(line: string): boolean {
  if (!line || isReviewUiNoise(line)) return false;
  if (!/[\p{L}]/u.test(line)) return false;

  const compact = line.replace(/\s+/g, "");
  if (compact.length < 2) return false;

  // Reviewer metadata often includes a review/photo count and should never be
  // treated as review body text.
  if (/\breviews?\b/i.test(line) || /\bphotos?\b/i.test(line)) return false;

  return true;
}

function compactCandidate(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractGoogleReviewCandidates(
  rawText?: string | null,
): ReviewCandidate[] {
  const normalized = normalizeOcrText(rawText);
  if (!normalized) return [];

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const results: ReviewCandidate[] = [];
  let collecting = false;
  let current: string[] = [];
  let sourceIndex = 0;

  const flush = () => {
    const text = compactCandidate(current);
    if (looksLikeReviewText(text)) {
      results.push({ text, sourceIndex });
      sourceIndex += 1;
    }
    current = [];
  };

  for (const originalLine of lines) {
    const line = originalLine.trim();
    const hasDateMarker = DATE_MARKER.test(line) || THAI_DATE_MARKER.test(line);

    if (hasDateMarker) {
      if (collecting && current.length > 0) {
        flush();
      }
      collecting = true;

      const remainder = stripDateMarker(line);
      if (looksLikeReviewText(remainder)) {
        current.push(remainder);
      }
      continue;
    }

    if (END_MARKER.test(line)) {
      if (collecting && current.length > 0) {
        flush();
      }
      collecting = false;
      continue;
    }

    if (!collecting) {
      continue;
    }

    if (isReviewUiNoise(line)) {
      continue;
    }

    if (looksLikeReviewText(line)) {
      current.push(line);
    }
  }

  if (collecting && current.length > 0) {
    flush();
  }

  // De-duplicate OCR repeats while preserving original order.
  const seen = new Set<string>();
  return results.filter((item) => {
    const key = item.text.toLocaleLowerCase("th").replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildFallbackReviewText(rawText?: string | null): string {
  const normalized = normalizeOcrText(rawText);
  if (!normalized) return "";

  return normalized
    .split("\n")
    .map((line) => stripDateMarker(line.trim()))
    .filter((line) => looksLikeReviewText(line))
    .filter((line) => !/^oppo\b/i.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
