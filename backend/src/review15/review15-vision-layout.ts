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

type LayoutParagraph = {
  text: string;
  confidence: number | null;
  top: number;
  bottom: number;
  left: number;
  right: number;
  pageHeight: number;
};

const ENGLISH_DATE =
  /\b(?:a|an|\d+)\s+(?:minute|hour|day|week|month|year)s?\s+ago\b/i;
const THAI_DATE =
  /(?:\d+|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า)\s*(?:นาที|ชั่วโมง|วัน|สัปดาห์|เดือน|ปี)\s*(?:ที่แล้ว|ก่อน)/u;
const GOOGLE_UI =
  /(see\s+translation|translation\s*\(english\)|press\s+and\s+hold\s+to\s+react|อ่านเพิ่มเติม|ดูคำแปล|แสดงคำแปล|ถูกใจ|แชร์|ตอบกลับ)/i;

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

function hasDateMarker(text: string): boolean {
  return ENGLISH_DATE.test(text) || THAI_DATE.test(text);
}

function stripDateMarker(text: string): string {
  return text
    .replace(/[★☆⭐]+/gu, " ")
    .replace(ENGLISH_DATE, " ")
    .replace(THAI_DATE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoise(text: string): boolean {
  const value = text.trim();
  if (!value) return true;
  if (GOOGLE_UI.test(value)) return true;
  if (/^[★☆⭐\s]+$/u.test(value)) return true;
  if (/^(reviews?|photos?|local\s+guide)$/i.test(value)) return true;
  if (/^\d+\s*(reviews?|photos?)(?:\s*[·•]\s*\d+\s*(reviews?|photos?))?$/i.test(value)) return true;
  if (/^[⋮•·|\-–—]+$/u.test(value)) return true;
  if (!/[\p{L}]/u.test(value)) return true;
  return false;
}

function looksLikeReviewBody(text: string): boolean {
  if (isNoise(text)) return false;
  if (hasDateMarker(text)) return false;
  if (/\breviews?\b/i.test(text) || /\bphotos?\b/i.test(text)) return false;
  return text.replace(/\s+/g, "").length >= 3;
}

function confidenceOf(paragraphs: LayoutParagraph[]): number | null {
  const values = paragraphs
    .map((paragraph) => paragraph.confidence)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function collectLayoutParagraphs(annotation: VisionFullTextAnnotation): LayoutParagraph[] {
  const output: LayoutParagraph[] = [];

  for (const page of annotation.pages ?? []) {
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
          pageHeight,
        });
      }
    }
  }

  return output.sort((a, b) => {
    const y = a.top - b.top;
    if (Math.abs(y) > 6) return y;
    return a.left - b.left;
  });
}

function extractFromLayout(annotation: VisionFullTextAnnotation): ReviewVisionCandidate[] {
  const paragraphs = collectLayoutParagraphs(annotation);
  if (!paragraphs.length) return [];

  const candidates: ReviewVisionCandidate[] = [];

  for (let index = 0; index < paragraphs.length; index += 1) {
    const anchor = paragraphs[index];
    if (!hasDateMarker(anchor.text)) continue;

    const inlineRemainder = stripDateMarker(anchor.text);
    const collected: LayoutParagraph[] = [];
    const textParts: string[] = [];

    if (looksLikeReviewBody(inlineRemainder)) {
      textParts.push(inlineRemainder);
      collected.push(anchor);
    }

    const pageHeight = Math.max(anchor.pageHeight, 600);
    const firstGapLimit = Math.max(54, pageHeight * 0.052);
    const continuationGapLimit = Math.max(32, pageHeight * 0.024);
    const totalWindow = Math.max(115, pageHeight * 0.105);

    let previousBottom = anchor.bottom;
    let firstBodyTop: number | null = textParts.length ? anchor.top : null;

    for (let cursor = index + 1; cursor < paragraphs.length; cursor += 1) {
      const paragraph = paragraphs[cursor];

      if (hasDateMarker(paragraph.text)) break;
      if (GOOGLE_UI.test(paragraph.text)) break;

      const gap = Math.max(0, paragraph.top - previousBottom);
      const limit = textParts.length ? continuationGapLimit : firstGapLimit;
      if (gap > limit) break;

      if (
        firstBodyTop !== null &&
        paragraph.bottom - firstBodyTop > totalWindow
      ) {
        break;
      }

      if (!looksLikeReviewBody(paragraph.text)) {
        // Reviewer metadata can sit between OCR blocks. Before a review body is
        // found we can skip it; after body text begins it marks the end.
        if (textParts.length) break;
        previousBottom = Math.max(previousBottom, paragraph.bottom);
        continue;
      }

      // Review body text normally starts at the same left gutter as reviewer
      // metadata. Very narrow/centered text shortly after it is often text
      // printed on the attached product photo.
      const width = Math.max(1, paragraph.right - paragraph.left);
      const pageWidthEstimate = Math.max(paragraph.right, 1);
      if (
        textParts.length > 0 &&
        width < pageWidthEstimate * 0.18 &&
        paragraph.left > pageWidthEstimate * 0.16
      ) {
        break;
      }

      if (firstBodyTop === null) firstBodyTop = paragraph.top;
      textParts.push(paragraph.text);
      collected.push(paragraph);
      previousBottom = Math.max(previousBottom, paragraph.bottom);

      if (textParts.length >= 3) break;
    }

    const text = textParts
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (looksLikeReviewBody(text)) {
      candidates.push({
        text,
        confidence: confidenceOf(collected),
      });
    }
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.text.toLocaleLowerCase("th").replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractFromPlainText(text?: string | null): ReviewVisionCandidate[] {
  if (!text) return [];

  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const results: ReviewVisionCandidate[] = [];
  let collecting = false;
  let body: string[] = [];

  const flush = () => {
    const textValue = body.join(" ").replace(/\s+/g, " ").trim();
    if (looksLikeReviewBody(textValue)) {
      results.push({ text: textValue, confidence: null });
    }
    body = [];
  };

  for (const line of lines) {
    if (hasDateMarker(line)) {
      if (body.length) flush();
      collecting = true;
      const remainder = stripDateMarker(line);
      if (looksLikeReviewBody(remainder)) body.push(remainder);
      continue;
    }

    if (GOOGLE_UI.test(line)) {
      if (body.length) flush();
      collecting = false;
      continue;
    }

    if (!collecting) continue;
    if (isNoise(line)) continue;

    if (looksLikeReviewBody(line)) {
      body.push(line);
      if (body.length >= 2) {
        // Plain-text fallback has no geometry. Keep it intentionally bounded
        // so product-photo text cannot inflate the review count indefinitely.
        flush();
        collecting = false;
      }
    }
  }

  if (body.length) flush();

  return results;
}

export function extractReviewCandidatesFromVision(
  annotation?: VisionFullTextAnnotation | null,
): ReviewVisionCandidate[] {
  if (!annotation) return [];

  const layoutCandidates = extractFromLayout(annotation);
  if (layoutCandidates.length) return layoutCandidates;

  return extractFromPlainText(annotation.text);
}
