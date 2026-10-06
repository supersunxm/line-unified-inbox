/**
 * Canonical Thai review word counter shared by the public 15-word checker
 * and the Google Review KPI tooling.
 *
 * PIPELINE:
 * Full Review Text
 *   ↓
 * Strip Google Maps UI phrases (cleanReviewText)
 *   ↓
 * Protect business-approved lexical units before segmentation
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

export const WORD_COUNT_RULE_VERSION = "THAI_REVIEW_WORDS_V2";

export const PROTECTED_LEXICON = [
  "โปรโมชั่น",
  "สมาร์ทโฟน",
  "ประทับใจ",
] as const;

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

export function cleanReviewText(rawText?: string | null): string {
  if (!rawText) return "";
  let text = rawText;

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

  return text.replace(/\s+/g, " ").trim();
}

type ProtectedLexiconResult = {
  text: string;
  restore: Map<string, string>;
};

export function protectLexicalUnits(
  text: string,
  lexicon: readonly string[] = PROTECTED_LEXICON,
): ProtectedLexiconResult {
  let protectedText = text;
  const restore = new Map<string, string>();

  const ordered = [...lexicon]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length || a.localeCompare(b, "th"));

  ordered.forEach((word, index) => {
    if (!protectedText.includes(word)) return;

    const placeholder = `R15LEXICON${index}TOKEN`;
    protectedText = protectedText.split(word).join(` ${placeholder} `);
    restore.set(placeholder, word);
  });

  return {
    text: protectedText.replace(/\s+/g, " ").trim(),
    restore,
  };
}

export function isMeaningfulToken(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) return false;

  const withoutThaiPunct = trimmed.replace(/ฯลฯ/g, "").replace(/[ๆฯ฿๏๚๛]/g, "").trim();
  if (!withoutThaiPunct) return false;

  const lower = withoutThaiPunct.toLowerCase();
  if (EXCLUDED_UI_WORDS.has(lower)) return false;

  if (/^[0-9๐-๙]+$/.test(withoutThaiPunct)) return false;
  if (!/\p{L}/u.test(withoutThaiPunct)) return false;

  return true;
}

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

export function segmentThaiWords(text?: string | null): ThaiWordSegmentation {
  if (!text || typeof text !== "string") {
    return { rawTokens: [], finalTokens: [], count: 0 };
  }

  const cleaned = cleanReviewText(text);
  if (!cleaned) {
    return { rawTokens: [], finalTokens: [], count: 0 };
  }

  const protectedLexicon = protectLexicalUnits(cleaned);

  let rawExtracted: string[] = [];
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new (Intl as any).Segmenter("th", { granularity: "word" });
    const segments = Array.from(segmenter.segment(protectedLexicon.text)) as Array<{ segment: string; isWordLike?: boolean }>;
    rawExtracted = segments.map((s) => s.segment);
  } else {
    const cleanChars = protectedLexicon.text.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]/g, " ");
    rawExtracted = cleanChars.split(/\s+/).filter(Boolean);
  }

  const rawTokens = rawExtracted
    .map((tok) => protectedLexicon.restore.get(tok) ?? tok)
    .filter((tok) => isMeaningfulToken(tok))
    .map((t) => t.replace(/[ๆฯ]/g, "").trim())
    .filter(Boolean);

  const dictMerged = applyCompoundDictionary(rawTokens);
  const prefixMerged = mergeThaiCompoundPrefixes(dictMerged);
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
