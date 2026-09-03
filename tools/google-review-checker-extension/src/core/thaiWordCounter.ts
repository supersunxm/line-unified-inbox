/**
 * Accurately segments and counts Thai words in a given text using browser-native
 * Intl.Segmenter("th", { granularity: "word" }) with Thai compound prefix merging
 * and compound dictionary support.
 *
 * PIPELINE:
 * Full Review Text
 *   ↓
 * Strip Google Maps UI phrases (cleanReviewText)
 *   ↓
 * Intl.Segmenter("th", { granularity: "word" })
 *   ↓
 * Keep meaningful word-like tokens (exclude pure numbers, punct, emoji, symbols, UI words)
 *   ↓
 * Apply Compound Dictionary (matches full sequence only)
 *   ↓
 * Apply Thai Compound-Prefix Merge Rules (การ, ความ, น่า, ผู้, นัก, ชาว, ช่าง)
 *   ↓
 * Final counted tokens
 *   ↓
 * finalWordCount >= 15
 */

export const THAI_COMPOUND_PREFIXES = new Set([
  "การ",
  "ความ",
  "น่า",
  "ผู้",
  "นัก",
  "ชาว",
  "ช่าง",
]);

export const THAI_COMPOUND_DICTIONARY: string[][] = [
  ["ท่อง", "เที่ยว"],
  ["ต่าง", "ชาติ"],
  ["โรง", "พยาบาล"],
  ["เครื่อง", "ใช้"],
  ["แม่", "บ้าน"],
];

const EXCLUDED_UI_WORDS = new Set([
  "new",
  "see",
  "translation",
  "translate",
  "like",
  "share",
  "reply",
  "more",
  "original",
  "google",
  "อ่านเพิ่มเติม",
  "ดูเพิ่มเติม",
  "ดูคำแปล",
  "แสดงคำแปล",
  "ถูกใจ",
  "แชร์",
  "ตอบกลับ",
  "ข้อความต้นฉบับ",
  "ต้นฉบับ",
]);

export type ThaiWordSegmentation = {
  rawTokens: string[];
  finalTokens: string[];
  count: number;
};

/**
 * Strips Google Maps UI noise phrases from review text.
 */
export function cleanReviewText(rawText?: string | null): string {
  if (!rawText) return "";
  let text = rawText;

  // Remove known Google Maps UI phrases (case-insensitive)
  const uiRegexes = [
    /\b(see\s+translation|translation|translate|show\s+original|more|like|share|reply|new)\b/gi,
    /(อ่านเพิ่มเติม|ดูเพิ่มเติม|ดูคำแปล|แสดงคำแปล|ข้อความต้นฉบับ|ถูกใจ|แชร์|ตอบกลับ)/g,
    /\(แปลโดย\s*Google\)/g,
    /\(ต้นฉบับ\)/g,
    /\(Original\)/gi,
    /ฯลฯ/g,
  ];

  for (const regex of uiRegexes) {
    text = text.replace(regex, " ");
  }

  // Normalize whitespace
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Checks if a token is a meaningful word token.
 * Excludes whitespace, punctuation, emoji, symbols, pure numbers, Google UI text,
 * and Thai repetition/abbreviation marks (ๆ, ฯ, ฯลฯ, ๏, ๚, ๛, ฿).
 * Words containing letters (e.g. "OPPO", "Reno", "ดี", "เยอะ") count normally.
 */
export function isMeaningfulToken(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) return false;

  // Exclude Thai repetition notation and standalone punctuation marks (ๆ, ฯ, ฯลฯ, ๏, ๚, ๛, ฿)
  const withoutThaiPunct = trimmed.replace(/ฯลฯ/g, "").replace(/[ๆฯ฿๏๚๛]/g, "").trim();
  if (!withoutThaiPunct) return false;

  // Exclude Google Maps UI text (case-insensitive)
  const lower = withoutThaiPunct.toLowerCase();
  if (EXCLUDED_UI_WORDS.has(lower)) return false;

  // Exclude pure numbers (Arabic digits 0-9 and Thai digits ๐-๙)
  if (/^[0-9๐-๙]+$/.test(withoutThaiPunct)) return false;

  // Exclude pure punctuation, symbols, rating stars, and emojis
  // Must contain at least one unicode letter (\p{L})
  if (!/\p{L}/u.test(withoutThaiPunct)) return false;

  return true;
}

/**
 * Merges Thai compound prefixes (การ, ความ, น่า, ผู้, นัก, ชาว, ช่าง)
 * with the subsequent meaningful token.
 * Normal phrases (ไม่+ดี, ดี+มาก, บริการ+ดี) are NOT merged.
 */
export function mergeThaiCompoundPrefixes(tokens: string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cur = tokens[i];
    const next = tokens[i + 1];

    if (THAI_COMPOUND_PREFIXES.has(cur) && next) {
      result.push(cur + next);
      i += 2;
    } else {
      result.push(cur);
      i += 1;
    }
  }
  return result;
}

/**
 * Merges explicit compound dictionary sequences.
 * Matches full configured sequence only; never merges arbitrary words.
 */
export function applyCompoundDictionary(
  tokens: string[],
  dictionary: string[][] = THAI_COMPOUND_DICTIONARY,
): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    for (const seq of dictionary) {
      if (seq.length === 0) continue;
      let matchSeq = true;
      for (let j = 0; j < seq.length; j++) {
        if (tokens[i + j] !== seq[j]) {
          matchSeq = false;
          break;
        }
      }
      if (matchSeq) {
        result.push(seq.join(""));
        i += seq.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result.push(tokens[i]);
      i += 1;
    }
  }
  return result;
}

/**
 * Executes the complete Thai review word counting pipeline.
 */
export function segmentThaiWords(text?: string | null): ThaiWordSegmentation {
  if (!text || typeof text !== "string") {
    return { rawTokens: [], finalTokens: [], count: 0 };
  }

  // Pre-filter: strip Google Maps UI noise phrases
  const cleaned = cleanReviewText(text);
  if (!cleaned) {
    return { rawTokens: [], finalTokens: [], count: 0 };
  }

  // 1. Intl.Segmenter with "th" locale
  let rawExtracted: string[] = [];
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new (Intl as any).Segmenter("th", { granularity: "word" });
    const segments = Array.from(segmenter.segment(cleaned)) as Array<{ segment: string; isWordLike?: boolean }>;
    rawExtracted = segments.map((s) => s.segment);
  } else {
    // Fallback heuristic if Intl.Segmenter is not present
    const cleanChars = cleaned.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]/g, " ");
    rawExtracted = cleanChars.split(/\s+/).filter(Boolean);
  }

  // 2. Keep meaningful word-like tokens (remove punctuation, pure numbers, emoji, UI text, and Thai notation marks like ๆ, ฯ)
  const rawTokens = rawExtracted
    .filter((tok) => isMeaningfulToken(tok))
    .map((t) => t.replace(/[ๆฯ]/g, "").trim())
    .filter(Boolean);

  // 3. Apply compound dictionary
  const dictMerged = applyCompoundDictionary(rawTokens);

  // 4. Apply Thai compound-prefix merge rules
  const prefixMerged = mergeThaiCompoundPrefixes(dictMerged);

  // 5. Final pass of compound dictionary if prefix merge created candidates
  const finalTokens = applyCompoundDictionary(prefixMerged);

  return {
    rawTokens,
    finalTokens,
    count: finalTokens.length,
  };
}

export function countThaiWords(text?: string | null): number {
  return segmentThaiWords(text).count;
}
