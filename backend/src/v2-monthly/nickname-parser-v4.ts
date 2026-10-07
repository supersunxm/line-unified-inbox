import type { ParserV3ProductResolution } from "../line-chat/nickname-parser-v3.contract";
import type { SourceTag } from "../line-chat/nickname-source-contract";

/**
 * Parser v4 (owner decisions of 2026-10-07, B3). Reads the same Manager nickname as Parser v3
 * but never holds a whole name for review: each recognised tag stands on its own, unknown words
 * are free text, and a conflict drops only the conflicting field.
 *
 * Changes from v3 (`nickname-parser-v3.0.1`):
 * - MM/YY: any two-digit year is 20YY (v3 accepted only 26 and the Buddhist 69). A four-digit
 *   year is Gregorian (1900–2199) or Buddhist (2400–2699, minus 543). Months outside 1–12 and
 *   impossible dates are rejected (left as free text). The last purchase month in a name wins.
 * - Film service: Thai ฟิล์ม and its spellings (ฟิมล์, ฟิลม์, with ติด… / …กระจก) anywhere in the
 *   name, and the English word film in any case.
 * - Extra words no longer drop the recognised tags.
 * - Platforms (TikTok, Facebook/FB, Instagram/IG, LINE, Website, Lemon8) are read anywhere, not
 *   only in the v2 `<source> <MM/YY>` form; ออนไลน์ is read as Online.
 * - Products: the same safe catalog aliases as v3 (tag-analysis.md §5), matched on the longest
 *   run of words in the leftover text; more than one product can be read.
 *
 * Pure function; it never returns the nickname or the free text, only whether there was any.
 */
export const NICKNAME_PARSER_V4_RULE_VERSION = "nickname-parser-v4.0.0";

export type ParserV4Decision = "TAGGED" | "NO_SIGNAL" | "UNREADABLE";
export type ParserV4Period = { year: number; month: number };
export type ParserV4Date = { year: number; month: number; day: number };

export type ParserV4Values = {
  source: SourceTag | null;
  customerType: "ONLINE" | null;
  financeProvider: "SG_FINANCE" | "UFUND" | null;
  paymentMethod: "CASH" | "INSTALLMENT" | null;
  services: Array<"FILM_INSTALLATION">;
  period: ParserV4Period | null;
  date: ParserV4Date | null;
  products: Array<{ id: string; name: string }>;
};

export type ParserV4Result = {
  ruleVersion: typeof NICKNAME_PARSER_V4_RULE_VERSION;
  decision: ParserV4Decision;
  values: ParserV4Values;
  hasFreeText: boolean;
  /** Fields dropped because the name carries two different values for them. */
  conflicts: string[];
  /** Date-like tokens that were not a valid date or MM/YY. */
  invalidDateTokens: number;
  ruleIds: string[];
};

type Span = { start: number; end: number };

const LATIN_BOUNDARY_BEFORE = String.raw`(?<![A-Za-z0-9])`;
const LATIN_BOUNDARY_AFTER = String.raw`(?![A-Za-z0-9])`;
const THAI_BOUNDARY_BEFORE = String.raw`(?<![฀-๿])`;
const THAI_BOUNDARY_AFTER = String.raw`(?![฀-๿])`;

const PLATFORMS: ReadonlyArray<[RegExp, SourceTag]> = [
  [/tiktok/, "TikTok"],
  [/facebook|fb/, "Facebook"],
  [/instagram|ig/, "Instagram"],
  [/line/, "LINE"],
  [/website/, "Website"],
  [/lemon8/, "Lemon8"],
];
const LATIN_MARKER = new RegExp(
  `${LATIN_BOUNDARY_BEFORE}(online|sg|ufund|film|tiktok|facebook|fb|instagram|ig|line|website|lemon8)${LATIN_BOUNDARY_AFTER}`,
  "giu",
);
const THAI_ONLINE = /ออนไลน์/gu;
// ติดฟิล์ม, ฟิล์ม, ฟิล์มกระจก and the common misspellings ฟิมล์ / ฟิลม์. Thai is written without
// spaces, so these are read anywhere in the name.
const THAI_FILM = /(?:ติด)?(?:ฟิล์ม|ฟิมล์|ฟิลม์)(?:กระจก)?/gu;
const CASH_MONEY = /เงินสด/gu;
const CASH_SHORT = new RegExp(`${THAI_BOUNDARY_BEFORE}สด${THAI_BOUNDARY_AFTER}`, "gu");
const INSTALLMENT = new RegExp(`${THAI_BOUNDARY_BEFORE}ผ่อน${THAI_BOUNDARY_AFTER}`, "gu");
const NUMERIC_DATE = /(?<![\p{L}\p{N}_/])(\d{1,4})\/(\d{1,4})(?:\/(\d{1,4}))?(?![\p{L}\p{N}_/])/gu;

function isUnreadable(value: string): boolean {
  return value.length > 1000 || [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || (code >= 127 && code <= 159);
  });
}

/** Two digits → 20YY; four digits → Gregorian 1900–2199 or Buddhist 2400–2699 (−543). */
export function yearV4(token: string): number | null {
  if (!/^\d+$/u.test(token)) return null;
  if (token.length === 2) return 2000 + Number(token);
  if (token.length !== 4) return null;
  const year = Number(token);
  if (year >= 1900 && year <= 2199) return year;
  if (year >= 2400 && year <= 2699) return year - 543;
  return null;
}

/** MM/YY, M/YY, MM/YYYY, or DD/MM/YY(YY). Null when it is not a real month or date. */
export function parseDateTokenV4(first: string, second: string, third?: string): { period: ParserV4Period } | { date: ParserV4Date } | null {
  if (third === undefined) {
    if (first.length > 2) return null;
    const month = Number(first);
    const year = yearV4(second);
    if (year === null || month < 1 || month > 12) return null;
    return { period: { year, month } };
  }
  if (first.length > 2 || second.length > 2) return null;
  const day = Number(first);
  const month = Number(second);
  const year = yearV4(third);
  if (year === null || month < 1 || month > 12 || day < 1) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return { date: { year, month, day } };
}

function collect(pattern: RegExp, value: string, onMatch: (match: RegExpExecArray) => void, spans: Span[]) {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    spans.push({ start: match.index, end: match.index + match[0].length });
    onMatch(match);
  }
}

function residualText(value: string, spans: readonly Span[]): string {
  const ordered = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  let result = "";
  let cursor = 0;
  for (const span of ordered) {
    if (span.end <= cursor) continue;
    if (span.start > cursor) result += value.slice(cursor, span.start);
    result += " ";
    cursor = Math.max(cursor, span.end);
  }
  return result + value.slice(cursor);
}

/** One value per field: two different values drop the field and record a conflict. */
function single<T>(items: readonly T[], key: (item: T) => string, field: string, conflicts: string[]): T | null {
  const distinct = new Map(items.map((item) => [key(item), item]));
  if (distinct.size > 1) {
    conflicts.push(field);
    return null;
  }
  return items[0] ?? null;
}

export function parseNicknameV4(
  nickname: string | null,
  readable: boolean,
  resolveProduct: (text: string) => ParserV3ProductResolution = () => ({ kind: "NO_MATCH" }),
): ParserV4Result {
  const empty: ParserV4Values = { source: null, customerType: null, financeProvider: null, paymentMethod: null, services: [], period: null, date: null, products: [] };
  const input = nickname ?? "";
  if (!readable || isUnreadable(input)) {
    return { ruleVersion: NICKNAME_PARSER_V4_RULE_VERSION, decision: "UNREADABLE", values: empty, hasFreeText: false, conflicts: [], invalidDateTokens: 0, ruleIds: [] };
  }
  const value = input.normalize("NFC").replace(/\s+/gu, " ").trim();
  const spans: Span[] = [];
  const ruleIds = new Set<string>();
  const conflicts: string[] = [];
  const sources: SourceTag[] = [];
  const providers: Array<"SG_FINANCE" | "UFUND"> = [];
  const payments: Array<"CASH" | "INSTALLMENT"> = [];
  const periods: ParserV4Period[] = [];
  const dates: ParserV4Date[] = [];
  let online = false;
  let film = false;
  let invalidDateTokens = 0;

  collect(LATIN_MARKER, value, (match) => {
    const token = match[1].toLowerCase();
    if (token === "online") { online = true; ruleIds.add("V4_ONLINE"); return; }
    if (token === "sg") { providers.push("SG_FINANCE"); ruleIds.add("V4_FINANCE_SG"); return; }
    if (token === "ufund") { providers.push("UFUND"); ruleIds.add("V4_FINANCE_UFUND"); return; }
    if (token === "film") { film = true; ruleIds.add("V4_FILM_LATIN"); return; }
    const platform = PLATFORMS.find(([pattern]) => new RegExp(`^(?:${pattern.source})$`, "u").test(token));
    if (platform) { sources.push(platform[1]); ruleIds.add("V4_SOURCE_PLATFORM"); }
  }, spans);
  collect(THAI_ONLINE, value, () => { online = true; ruleIds.add("V4_ONLINE_TH"); }, spans);
  collect(THAI_FILM, value, () => { film = true; ruleIds.add("V4_FILM_TH"); }, spans);
  collect(CASH_MONEY, value, () => { payments.push("CASH"); ruleIds.add("V4_PAYMENT_CASH"); }, spans);
  collect(CASH_SHORT, value, () => { payments.push("CASH"); ruleIds.add("V4_PAYMENT_CASH"); }, spans);
  collect(INSTALLMENT, value, () => { payments.push("INSTALLMENT"); ruleIds.add("V4_PAYMENT_INSTALLMENT"); }, spans);

  NUMERIC_DATE.lastIndex = 0;
  let dateMatch: RegExpExecArray | null;
  while ((dateMatch = NUMERIC_DATE.exec(value)) !== null) {
    const parsed = parseDateTokenV4(dateMatch[1], dateMatch[2], dateMatch[3]);
    if (!parsed) {
      // Not a real month or date: left in the text as a word, never a reason to drop other tags.
      invalidDateTokens++;
      ruleIds.add("V4_DATE_INVALID");
      continue;
    }
    spans.push({ start: dateMatch.index, end: dateMatch.index + dateMatch[0].length });
    if ("period" in parsed) { periods.push(parsed.period); ruleIds.add("V4_PERIOD"); } else { dates.push(parsed.date); ruleIds.add("V4_DATE"); }
  }

  // Products: the longest run of leftover words that is a safe catalog alias, then the next.
  const words = residualText(value, spans).split(/[\s,;+|]+/u).filter(Boolean);
  const used = new Array<boolean>(words.length).fill(false);
  const products = new Map<string, { id: string; name: string }>();
  // Product names are at most a few words; the cap bounds the work on a long name.
  for (let length = Math.min(words.length, 6); length >= 1; length--) {
    for (let start = 0; start + length <= words.length; start++) {
      if (used.slice(start, start + length).some(Boolean)) continue;
      const match = resolveProduct(words.slice(start, start + length).join(" "));
      if (match.kind !== "MATCH") continue;
      products.set(match.productId, { id: match.productId, name: match.productName });
      for (let index = start; index < start + length; index++) used[index] = true;
      ruleIds.add(match.matchKind === "CANONICAL" ? "V4_PRODUCT_CANONICAL" : "V4_PRODUCT_ALIAS");
    }
  }
  const hasFreeText = used.some((isUsed) => !isUsed);

  const values: ParserV4Values = {
    source: single(sources, (item) => item, "source", conflicts),
    customerType: online ? "ONLINE" : null,
    financeProvider: single(providers, (item) => item, "financeProvider", conflicts),
    paymentMethod: single(payments, (item) => item, "paymentMethod", conflicts),
    services: film ? ["FILM_INSTALLATION"] : [],
    // The last purchase month written in the name wins (tag-analysis.md §4).
    period: periods.at(-1) ?? null,
    date: single(dates, (item) => `${item.year}-${item.month}-${item.day}`, "date", conflicts),
    products: [...products.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
  const tagged = values.source !== null || values.customerType !== null || values.financeProvider !== null ||
    values.paymentMethod !== null || values.services.length > 0 || values.period !== null || values.date !== null || values.products.length > 0;
  return {
    ruleVersion: NICKNAME_PARSER_V4_RULE_VERSION,
    decision: tagged ? "TAGGED" : "NO_SIGNAL",
    values,
    hasFreeText,
    conflicts,
    invalidDateTokens,
    ruleIds: [...ruleIds].sort(),
  };
}
