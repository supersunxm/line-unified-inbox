import {
  PILOT_MATCHER_VERSION,
} from "./auto-response-pilot.config";

export type PilotIntent = "STORE_LOCATION" | "FINANCE_INFO";
export type PilotMatchOutcome = "MATCHED" | "NO_MATCH" | "EXCLUDED" | "AMBIGUOUS";

export type PilotMatch = {
  outcome: PilotMatchOutcome;
  intent?: PilotIntent;
  matchedPatterns: string[];
  reason?: string;
  matcherVersion: number;
};

const LOCATION_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "ร้านอยู่ที่ไหน", pattern: /ร้าน\s*อยู่\s*(?:ที่ไหน|ไหน)/u },
  { name: "ร้านอยู่ตรงไหน", pattern: /ร้าน\s*อยู่\s*ตรงไหน/u },
  { name: "ร้านตั่งอยู่ไหน", pattern: /ร้าน\s*ตั่ง\s*อยู่\s*(?:ที่ไหน|ตรงไหน|ไหน)/u },
  { name: "ร้านอยู่ไหน", pattern: /ร้าน\s*อยู่\s*ไหน/u },
  { name: "หน้าร้านอยู่ที่ไหน", pattern: /หน้าร้าน\s*อยู่\s*(?:ที่ไหน|ไหน)/u },
  { name: "หน้าร้านอยู่ตรงไหน", pattern: /หน้าร้าน\s*อยู่\s*ตรงไหน/u },
  { name: "ขอพิกัด", pattern: /ขอ\s*พิกัด/u },
  { name: "พิกัดร้าน", pattern: /พิกัด\s*ร้าน/u },
  { name: "โลเคชั่น", pattern: /โลเคช(?:ั่น|ัน)|โลเกช(?:ั่น|ัน)/u },
  { name: "ชั้นไหน", pattern: /(?:ร้าน|หน้าร้าน|อยู่\s*)?ชั้น\s*ไหน/u },
];

const BROAD_LOCATION_PATTERN = /ร้าน|สาขา|หน้าร้าน|พิกัด|โลเคช|โลเกช|ชั้น|\blocation\b|\bmap\b/u;
const BROAD_FINANCE_PATTERN = /ผ่อน|สินเชื่อ|ไฟแนน|เครดิต|ดาวน์|เอกสาร|บัตรประชาชน|คนค้ำ|ผู้ค้ำ/u;

const FINANCE_HARD_EXCLUSIONS: Array<{ name: string; pattern: RegExp }> = [
  { name: "specific-down-payment", pattern: /ดาวน์.{0,40}(?:เท่าไหร่|เท่าไร|กี่บาท|\d+\s*บาท)/u },
  { name: "specific-installment", pattern: /(?:ผ่อน|ชำระ).{0,40}(?:เดือนละ|กี่เดือน|กี่งวด|เท่าไหร่|เท่าไร|กี่บาท|\d+\s*บาท)/u },
  { name: "specific-finance-value", pattern: /(?:เท่าไหร่|เท่าไร|กี่บาท|กี่เดือน|กี่งวด).{0,40}(?:ดาวน์|ผ่อน|ราคา)/u },
  { name: "price-question", pattern: /ราคา(?:เท่าไหร่|เท่าไร|กี่บาท)?|ราคากี่บาท/u },
  { name: "stock-colour-availability", pattern: /สต็อก|สต๊อก|พร้อมส่ง|มีสี|สี.{0,20}(?:ไหม|มั้ย)|(?:มี|เหลือ).{0,20}(?:ไหม|มั้ย)/u },
  { name: "term-question", pattern: /(?:กี่เดือน|กี่งวด|เดือนละ|ต่อเดือน)/u },
];

const FINANCE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "สนใจผ่อน", pattern: /สนใจ\s*ผ่อน/u },
  { name: "ผ่อนยังไง", pattern: /ผ่อน.{0,20}(?:ยังไง|อย่างไร)/u },
  { name: "ผ่อนต้องใช้อะไร", pattern: /ผ่อน.{0,30}(?:ต้องใช้|ใช้อะไร)/u },
  { name: "สมัครสินเชื่อ", pattern: /สมัคร\s*สินเชื่อ/u },
  { name: "สินเชื่อ", pattern: /สินเชื่อ/u },
  { name: "ไฟแนนซ์", pattern: /ไฟแนน(?:ซ์)?/u },
  { name: "เช็คเครดิต", pattern: /เช็ค\s*เครดิต/u },
  { name: "เครดิตบูโร", pattern: /เครดิตบูโร/u },
  { name: "คนค้ำ", pattern: /(?:ต้องใช้|ต้องมี|มี|ใช้)?\s*(?:คนค้ำ|ผู้ค้ำ)/u },
];

function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    // NFKC decomposes Thai SARA AM (ำ); restore the composed form so
    // reviewed Thai aliases remain stable across LINE/client encodings.
    .replace(/\u0E4D\u0E32/gu, "\u0E33")
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizePilotText(text: string): string {
  return normalizeText(typeof text === "string" ? text : "");
}

export function matchPilotInboundText(text: string): PilotMatch {
  const normalized = normalizeText(text);
  if (!normalized) {
    return {
      outcome: "NO_MATCH",
      matchedPatterns: [],
      reason: "EMPTY_TEXT",
      matcherVersion: PILOT_MATCHER_VERSION,
    };
  }

  const locationMatches = LOCATION_PATTERNS.filter(({ pattern }) => pattern.test(normalized));
  const locationMatched = locationMatches.length > 0;
  const broadLocationMatched = BROAD_LOCATION_PATTERN.test(normalized);

  const exclusion = FINANCE_HARD_EXCLUSIONS.find(({ pattern }) => pattern.test(normalized));
  if (exclusion) {
    return {
      outcome: "EXCLUDED",
      matchedPatterns: [exclusion.name],
      reason: `FINANCE_${exclusion.name.toUpperCase().replaceAll("-", "_")}`,
      matcherVersion: PILOT_MATCHER_VERSION,
    };
  }

  const financeMatches = FINANCE_PATTERNS.filter(({ pattern }) => pattern.test(normalized));
  if (/ผ่อน\s*ออนไลน์/u.test(normalized)) {
    return {
      outcome: "EXCLUDED",
      matchedPatterns: ["ผ่อนออนไลน์"],
      reason: "FINANCE_ONLINE_TERM_NOT_ENABLED",
      matcherVersion: PILOT_MATCHER_VERSION,
    };
  }

  const financeContext = /(?:ผ่อน|สินเชื่อ|ไฟแนน|เครดิต|สมัคร)/u.test(normalized);
  const contextualFinanceMatches = [
    /เอกสาร\s*(?:อะไร|ต้องใช้|บ้าง)/u.test(normalized) && financeContext ? "เอกสารการเงิน" : null,
    /บัตรประชาชน/u.test(normalized) && financeContext ? "บัตรประชาชนการเงิน" : null,
    /คนค้ำ|ผู้ค้ำ/u.test(normalized) ? "คนค้ำ" : null,
  ].filter((value): value is string => Boolean(value));
  const financePatternNames = [
    ...financeMatches.map(({ name }) => name),
    ...contextualFinanceMatches,
  ];
  const financeMatched = financePatternNames.length > 0;

  if (locationMatched && (financeMatched || /ผ่อน|สินเชื่อ|ไฟแนน|เครดิต|ดาวน์/u.test(normalized))) {
    return {
      outcome: "AMBIGUOUS",
      matchedPatterns: [...locationMatches.map(({ name }) => name), ...financePatternNames],
      reason: "MULTIPLE_INTENTS",
      matcherVersion: PILOT_MATCHER_VERSION,
    };
  }

  if (locationMatched) {
    return {
      outcome: "MATCHED",
      intent: "STORE_LOCATION",
      matchedPatterns: locationMatches.map(({ name }) => name),
      matcherVersion: PILOT_MATCHER_VERSION,
    };
  }

  if (financeMatched) {
    if (broadLocationMatched) {
      return {
        outcome: "AMBIGUOUS",
        matchedPatterns: financePatternNames,
        reason: "LOCATION_CONTEXT_PRESENT",
        matcherVersion: PILOT_MATCHER_VERSION,
      };
    }
    return {
      outcome: "MATCHED",
      intent: "FINANCE_INFO",
      matchedPatterns: financePatternNames,
      matcherVersion: PILOT_MATCHER_VERSION,
    };
  }

  if (BROAD_FINANCE_PATTERN.test(normalized)) {
    return {
      outcome: "EXCLUDED",
      matchedPatterns: [],
      reason: "FINANCE_NOT_HIGH_CONFIDENCE",
      matcherVersion: PILOT_MATCHER_VERSION,
    };
  }

  return {
    outcome: "NO_MATCH",
    matchedPatterns: [],
    reason: broadLocationMatched ? "LOCATION_NOT_HIGH_CONFIDENCE" : "NO_APPROVED_PATTERN",
    matcherVersion: PILOT_MATCHER_VERSION,
  };
}
