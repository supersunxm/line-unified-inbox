export type VisionVertex = {
  x?: number | null;
  y?: number | null;
};

export type VisionSymbol = {
  text?: string | null;
  confidence?: number | null;
};

export type VisionWord = {
  symbols?: VisionSymbol[] | null;
  confidence?: number | null;
};

export type VisionParagraph = {
  words?: VisionWord[] | null;
  confidence?: number | null;
  boundingBox?: {
    vertices?: VisionVertex[] | null;
  } | null;
};

export type VisionBlock = {
  paragraphs?: VisionParagraph[] | null;
};

export type VisionPage = {
  width?: number | null;
  height?: number | null;
  blocks?: VisionBlock[] | null;
};

export type VisionFullTextAnnotation = {
  text?: string | null;
  pages?: VisionPage[] | null;
};

export type ReviewVisionCandidate = {
  text: string;
  confidence: number | null;
};

export type ReviewVisionAnalysis = {
  candidates: ReviewVisionCandidate[];
  estimatedReviewCount: number;
};

type LayoutParagraph = {
  text: string;
  confidence: number | null;
  top: number;
  bottom: number;
  left: number;
  right: number;
  pageWidth: number;
  pageHeight: number;
  pageIndex: number;
};

type ReviewAnchorKind = "date" | "review-meta";

type ReviewAnchor = {
  kind: ReviewAnchorKind;
  paragraphIndex: number;
  paragraph: LayoutParagraph;
};

const ENGLISH_DATE =
  /\b(?:a|an|\d+)\s+(?:minute|hour|day|week|month|year)s?\s+ago\b/i;
const THAI_DATE =
  /(?:\d+|[๐-๙]+|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า)\s*(?:นาที|ชั่วโมง|วัน|สัปดาห์|เดือน|ปี)\s*(?:ที่แล้ว|ก่อน)/u;

const ENGLISH_REVIEW_META =
  /^(?:local\s*guide\s*[·•|\-]\s*)?\d+\s*(?:reviews?|photos?)(?:\s*[·•|\-]\s*\d+\s*(?:reviews?|photos?))*$/i;
const THAI_REVIEW_META =
  /^(?:local\s*guide\s*[·•|\-]\s*)?\d+\s*รีวิว(?:\s*[·•|\-]\s*\d+\s*(?:รูป|รูปภาพ))?$/iu;

const GOOGLE_UI =
  /(see\s+translation|translation\s*\(english\)|press\s+and\s+hold\s+to\s+react|อ่านเพิ่มเติม|ดูคำแปล|แสดงคำแปล|ถูกใจ|แชร์|ตอบกลับ|กดค้างเพื่อแสดงความรู้สึก)/i;

const GOOGLE_STATUS_BADGE = /^(?:new|edited|updated)$/i;

function paragraphText(paragraph: VisionParagraph): string {
  return (paragraph.words ?? [])
    .map((word) =>
      (word.symbols ?? [])
        .map((symbol) => symbol.text ?? "")
        .join(""),
    )
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function bounds(paragraph: VisionParagraph) {
  const vertices = paragraph.boundingBox?.vertices ?? [];
  const xs = vertices
    .map((vertex) => vertex.x)
    .filter((value): value is number => typeof value === "number");
  const ys = vertices
    .map((vertex) => vertex.y)
    .filter((value): value is number => typeof value === "number");

  return {
    left: xs.length ? Math.min(...xs) : 0,
    right: xs.length ? Math.max(...xs) : 0,
    top: ys.length ? Math.min(...ys) : 0,
    bottom: ys.length ? Math.max(...ys) : 0,
  };
}

function normalizeLine(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasDateMarker(text: string): boolean {
  const value = normalizeLine(text);
  return ENGLISH_DATE.test(value) || THAI_DATE.test(value);
}

function looksLikeDateMetadata(text: string): boolean {
  const value = normalizeLine(text);
  if (hasDateMarker(value)) return true;

  if (value.length > 48) return false;

  const compact = value
    .toLocaleLowerCase("th")
    .replace(/[★☆⭐]/gu, " ")
    .replace(/[.,:;()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    /(?:\d+|[๐-๙]+)\s*(?:นาที|ชั่วโมง|วัน|สัปดาห์|เดือน|ปี)/u.test(
      compact,
    )
  ) {
    return true;
  }

  if (
    /(?:\d+|a|an)\s*(?:minute|hour|day|week|month|year)s?/i.test(
      compact,
    )
  ) {
    return true;
  }

  return false;
}

function isReviewMeta(text: string): boolean {
  const value = normalizeLine(text);
  return ENGLISH_REVIEW_META.test(value) || THAI_REVIEW_META.test(value);
}

function stripDateMarker(text: string): string {
  return normalizeLine(text)
    .replace(/[★☆⭐]+/gu, " ")
    .replace(ENGLISH_DATE, " ")
    .replace(THAI_DATE, " ")
    .replace(/\bNEW\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoise(text: string): boolean {
  const value = normalizeLine(text);
  if (!value) return true;
  if (GOOGLE_UI.test(value)) return true;
  if (GOOGLE_STATUS_BADGE.test(value)) return true;
  if (looksLikeDateMetadata(value)) return true;
  if (isReviewMeta(value)) return true;
  if (/^[★☆⭐*\s]+$/u.test(value)) return true;
  if (/^(reviews?|photos?|local\s+guide)$/i.test(value)) return true;
  if (/^(รีวิว|รูปภาพ|อัปเดต|เกี่ยวกับ|ตัวกรอง|ความเกี่ยวข้อง)$/u.test(value)) {
    return true;
  }
  if (/^[⋮•·|\-–—]+$/u.test(value)) return true;
  if (!/[\p{L}]/u.test(value)) return true;
  return false;
}

function looksLikeReviewBody(text: string): boolean {
  const value = normalizeLine(text);
  if (isNoise(value)) return false;
  if (/\breviews?\b/i.test(value) || /\bphotos?\b/i.test(value)) {
    return false;
  }
  return value.replace(/\s+/g, "").length >= 3;
}

function confidenceOf(paragraphs: LayoutParagraph[]): number | null {
  const values = paragraphs
    .map((paragraph) => paragraph.confidence)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );

  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function collectLayoutParagraphs(
  annotation: VisionFullTextAnnotation,
): LayoutParagraph[] {
  const output: LayoutParagraph[] = [];

  (annotation.pages ?? []).forEach((page, pageIndex) => {
    const pageWidth = page.width ?? 0;
    const pageHeight = page.height ?? 0;

    for (const block of page.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        const text = paragraphText(paragraph);
        if (!text) continue;

        const box = bounds(paragraph);
        output.push({
          text,
          confidence:
            typeof paragraph.confidence === "number"
              ? paragraph.confidence
              : null,
          top: box.top,
          bottom: box.bottom,
          left: box.left,
          right: box.right,
          pageWidth,
          pageHeight,
          pageIndex,
        });
      }
    }
  });

  return output.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    const y = a.top - b.top;
    if (Math.abs(y) > 6) return y;
    return a.left - b.left;
  });
}

function collectReviewAnchors(paragraphs: LayoutParagraph[]): ReviewAnchor[] {
  const anchors: ReviewAnchor[] = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (isReviewMeta(paragraph.text)) {
      anchors.push({
        kind: "review-meta",
        paragraphIndex,
        paragraph,
      });
    }

    if (looksLikeDateMetadata(paragraph.text)) {
      anchors.push({
        kind: "date",
        paragraphIndex,
        paragraph,
      });
    }
  });

  return anchors;
}

function estimateReviewCount(anchors: ReviewAnchor[]): number {
  if (!anchors.length) return 0;

  let count = 0;
  let previous: ReviewAnchor | null = null;

  for (const anchor of anchors) {
    if (!previous || previous.paragraph.pageIndex !== anchor.paragraph.pageIndex) {
      count += 1;
      previous = anchor;
      continue;
    }

    const pageHeight = Math.max(anchor.paragraph.pageHeight, 600);
    const sameCardDistance = Math.max(82, pageHeight * 0.075);
    const distance = anchor.paragraph.top - previous.paragraph.top;

    if (distance > sameCardDistance) {
      count += 1;
    }

    previous = anchor;
  }

  return count;
}

function extractCandidateAfterAnchor(
  paragraphs: LayoutParagraph[],
  anchor: ReviewAnchor,
): ReviewVisionCandidate | null {
  const collected: LayoutParagraph[] = [];
  const textParts: string[] = [];

  const inlineRemainder =
    anchor.kind === "date" ? stripDateMarker(anchor.paragraph.text) : "";

  if (looksLikeReviewBody(inlineRemainder)) {
    textParts.push(inlineRemainder);
    collected.push(anchor.paragraph);
  }

  const pageHeight = Math.max(anchor.paragraph.pageHeight, 600);
  const firstGapLimit =
    anchor.kind === "review-meta"
      ? Math.max(78, pageHeight * 0.075)
      : Math.max(54, pageHeight * 0.052);
  const continuationGapLimit = Math.max(34, pageHeight * 0.028);
  const totalWindow =
    anchor.kind === "review-meta"
      ? Math.max(190, pageHeight * 0.22)
      : Math.max(170, pageHeight * 0.2);

  let previousBottom = anchor.paragraph.bottom;
  let firstBodyTop: number | null = textParts.length
    ? anchor.paragraph.top
    : null;

  for (
    let cursor = anchor.paragraphIndex + 1;
    cursor < paragraphs.length;
    cursor += 1
  ) {
    const paragraph = paragraphs[cursor];

    if (paragraph.pageIndex !== anchor.paragraph.pageIndex) break;

    const isAnchor = isReviewMeta(paragraph.text) || looksLikeDateMetadata(paragraph.text);

    if (isAnchor) {
      if (textParts.length) break;

      const gap = Math.max(0, paragraph.top - previousBottom);
      if (gap > firstGapLimit) break;

      // Metadata + date normally belong to the same review card. Skip both
      // until we reach the review body.
      previousBottom = Math.max(previousBottom, paragraph.bottom);
      continue;
    }

    if (GOOGLE_UI.test(paragraph.text)) {
      if (textParts.length) break;
      previousBottom = Math.max(previousBottom, paragraph.bottom);
      continue;
    }

    const gap = Math.max(0, paragraph.top - previousBottom);
    const gapLimit = textParts.length
      ? continuationGapLimit
      : firstGapLimit;

    if (gap > gapLimit) break;

    if (
      firstBodyTop !== null &&
      paragraph.bottom - firstBodyTop > totalWindow
    ) {
      break;
    }

    if (!looksLikeReviewBody(paragraph.text)) {
      if (textParts.length) break;
      previousBottom = Math.max(previousBottom, paragraph.bottom);
      continue;
    }

    const width = Math.max(1, paragraph.right - paragraph.left);
    const pageWidth = Math.max(
      paragraph.pageWidth,
      paragraph.right,
      anchor.paragraph.pageWidth,
      1,
    );

    // Narrow centered text after a review body is commonly text printed on an
    // attached product photo, e.g. "OPPO A6c".
    if (
      textParts.length > 0 &&
      width < pageWidth * 0.24 &&
      paragraph.left > pageWidth * 0.14
    ) {
      break;
    }

    if (firstBodyTop === null) firstBodyTop = paragraph.top;
    textParts.push(normalizeLine(paragraph.text));
    collected.push(paragraph);
    previousBottom = Math.max(previousBottom, paragraph.bottom);

    if (textParts.join(" ").length >= 1200) break;
  }

  const text = textParts.join(" ").replace(/\s+/g, " ").trim();

  if (!looksLikeReviewBody(text)) return null;

  return {
    text,
    confidence: confidenceOf(collected),
  };
}

function dedupeCandidates(
  candidates: ReviewVisionCandidate[],
): ReviewVisionCandidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = candidate.text
      .toLocaleLowerCase("th")
      .replace(/[\s\p{P}\p{S}]+/gu, "")
      .trim();

    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractFromLayout(
  annotation: VisionFullTextAnnotation,
): ReviewVisionAnalysis {
  const paragraphs = collectLayoutParagraphs(annotation);
  if (!paragraphs.length) {
    return {
      candidates: [],
      estimatedReviewCount: 0,
    };
  }

  const anchors = collectReviewAnchors(paragraphs);
  const candidates = dedupeCandidates(
    anchors
      .map((anchor) => extractCandidateAfterAnchor(paragraphs, anchor))
      .filter(
        (candidate): candidate is ReviewVisionCandidate =>
          candidate !== null,
      ),
  );

  return {
    candidates,
    estimatedReviewCount: Math.max(
      estimateReviewCount(anchors),
      candidates.length,
    ),
  };
}

function looksLikePhotoOverlayText(text: string): boolean {
  const value = normalizeLine(text);
  if (!value || value.length > 48) return false;

  return /^(?:oppo\b|reno\b|find\b|a\d{1,3}\b|promotion\b|โปรโมชั่น\b)/i.test(
    value,
  );
}

function extractFromPlainText(
  text?: string | null,
): ReviewVisionCandidate[] {
  if (!text) return [];

  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  const results: ReviewVisionCandidate[] = [];
  let collecting = false;
  let current: string[] = [];

  const flush = () => {
    const candidate = current.join(" ").replace(/\s+/g, " ").trim();
    if (looksLikeReviewBody(candidate)) {
      results.push({ text: candidate, confidence: null });
    }
    current = [];
  };

  for (const line of lines) {
    if (isReviewMeta(line) || looksLikeDateMetadata(line)) {
      if (current.length) flush();
      collecting = true;

      const remainder = stripDateMarker(line);
      if (looksLikeReviewBody(remainder)) {
        current.push(remainder);
      }
      continue;
    }

    if (GOOGLE_UI.test(line)) {
      if (current.length) flush();
      collecting = false;
      continue;
    }

    if (!collecting || isNoise(line)) continue;

    if (looksLikePhotoOverlayText(line) && current.length) {
      flush();
      collecting = false;
      continue;
    }

    if (looksLikeReviewBody(line)) {
      current.push(line);

      if (current.length >= 10 || current.join(" ").length >= 1200) {
        flush();
        collecting = false;
      }
    }
  }

  if (current.length) flush();

  return dedupeCandidates(results);
}

export function analyzeReviewCandidatesFromVision(
  annotation?: VisionFullTextAnnotation | null,
): ReviewVisionAnalysis {
  if (!annotation) {
    return {
      candidates: [],
      estimatedReviewCount: 0,
    };
  }

  const layout = extractFromLayout(annotation);

  if (
    layout.candidates.length >= layout.estimatedReviewCount &&
    layout.candidates.length > 0
  ) {
    return layout;
  }

  const fallbackCandidates = extractFromPlainText(annotation.text);
  const combined = dedupeCandidates([
    ...layout.candidates,
    ...fallbackCandidates,
  ]);

  return {
    candidates: combined,
    estimatedReviewCount: Math.max(
      layout.estimatedReviewCount,
      combined.length,
    ),
  };
}

export function extractReviewCandidatesFromVision(
  annotation?: VisionFullTextAnnotation | null,
): ReviewVisionCandidate[] {
  return analyzeReviewCandidatesFromVision(annotation).candidates;
}
