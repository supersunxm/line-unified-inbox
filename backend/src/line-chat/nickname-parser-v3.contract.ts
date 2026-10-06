import { compactProductText, normalizeProductText } from "../classification/product-normalization";
import { parseNicknameSource, type ParsedSource, type SourceTag } from "./nickname-source-contract";

export const NICKNAME_PARSER_V3_RULE_VERSION = "nickname-parser-v3.0.1";

export type ParserV3Decision = "DETERMINISTIC" | "NO_SIGNAL" | "REVIEW" | "UNKNOWN";
export type ParserV3ProductAliasSafety = "SAFE_EXACT" | "SAFE_COMPACT" | "REVIEW_REQUIRED" | "BLOCKED";

export type ParserV3Product = {
  id: string;
  name: string;
  active: boolean;
  aliases: ReadonlyArray<{ alias: string; safety: ParserV3ProductAliasSafety }>;
};

export type ParserV3ProductResolution =
  | { kind: "MATCH"; productId: string; productName: string; alias: string; matchKind: "CANONICAL" | "APPROVED_ALIAS" }
  | { kind: "NO_MATCH" }
  | { kind: "AMBIGUOUS"; candidateCount: number };

export type ParserV3Values = {
  source: SourceTag | null;
  customerType: "ONLINE" | null;
  financeProvider: "SG_FINANCE" | "UFUND" | null;
  paymentMethod: "CASH" | "INSTALLMENT" | null;
  service: "FILM_INSTALLATION" | null;
  period: { year: number; month: number } | null;
  date: { year: number; month: number; day: number } | null;
  product: { id: string; name: string; matchedAlias: string; matchKind: "CANONICAL" | "APPROVED_ALIAS" } | null;
};

export type ParserV3Result = {
  ruleVersion: typeof NICKNAME_PARSER_V3_RULE_VERSION;
  decision: ParserV3Decision;
  values: ParserV3Values;
  legacySource: ParsedSource;
  ruleIds: string[];
  holdReasons: string[];
};

const TOKEN_CONTINUATION = String.raw`[\p{L}\p{N}_-]`;
const BUSINESS_MARKER = new RegExp(
  String.raw`(?<!${TOKEN_CONTINUATION})(Online|SG|UFUND|Film)(?!${TOKEN_CONTINUATION})`,
  "giu",
);
const CASH_WORD = new RegExp(String.raw`(?<!${TOKEN_CONTINUATION})(เงินสด|สด)(?!${TOKEN_CONTINUATION})`, "gu");
const INSTALLMENT_WORD = new RegExp(String.raw`(?<!${TOKEN_CONTINUATION})ผ่อน(?!${TOKEN_CONTINUATION})`, "gu");
const NUMERIC_DATE = new RegExp(
  String.raw`(?<![\p{L}\p{N}_])(\d{1,4})/(\d{1,4})(?:/(\d{1,4}))?(?![\p{L}\p{N}_])`,
  "gu",
);

type Span = { start: number; end: number };
type DateValue = ParserV3Values["period"] | ParserV3Values["date"];

export type NicknameDateAuditToken = {
  shape: string;
  disposition: "PERIOD" | "DATE" | "INVALID" | "UNSUPPORTED_SEPARATOR";
  normalizedYear: number | null;
  yearConvention: "TWO_DIGIT_26" | "TWO_DIGIT_69" | "GREGORIAN_YYYY" | "BUDDHIST_2569" | "UNSUPPORTED";
};

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function isControlOrTooLong(value: string): boolean {
  return value.length > 1000 || [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || (code >= 127 && code <= 159);
  });
}

function normalizedNickname(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function removeSpans(value: string, spans: readonly Span[]): string {
  if (spans.length === 0) return value.trim();
  const ordered = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  let result = "";
  let cursor = 0;
  for (const span of ordered) {
    if (span.start < cursor) continue;
    result += `${value.slice(cursor, span.start)} `;
    cursor = span.end;
  }
  return result + value.slice(cursor).replace(/[\s,;+|/]+$/gu, "");
}

function yearFromToken(token: string): number | null {
  if (token.length === 2) {
    if (token === "26" || token === "69") return 2026;
    return null;
  }
  if (token === "2569") return 2026;
  const year = Number(token);
  return Number.isInteger(year) && year >= 1900 && year <= 2199 ? year : null;
}

function yearConvention(token: string): NicknameDateAuditToken["yearConvention"] {
  if (token === "26") return "TWO_DIGIT_26";
  if (token === "69") return "TWO_DIGIT_69";
  if (token === "2569") return "BUDDHIST_2569";
  return token.length === 4 && yearFromToken(token) !== null ? "GREGORIAN_YYYY" : "UNSUPPORTED";
}

function parseNumericDate(match: RegExpExecArray): {
  kind: "PERIOD" | "DATE" | "INVALID";
  value: DateValue;
} {
  const first = Number(match[1]);
  const second = Number(match[2]);
  const yearToken = match[3] ?? match[2];
  const year = yearFromToken(yearToken);
  if (year === null) return { kind: "INVALID", value: null };

  if (match[3] === undefined) {
    if (match[1].length > 2 || match[2].length !== 2 || first < 1 || first > 12) return { kind: "INVALID", value: null };
    return { kind: "PERIOD", value: { year, month: first } };
  }

  const day = first;
  const month = second;
  if (match[1].length > 2 || match[2].length > 2 || day < 1 || day > 31 || month < 1 || month > 12) {
    return { kind: "INVALID", value: null };
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    return { kind: "INVALID", value: null };
  }
  return { kind: "DATE", value: { year, month, day } };
}

function dateKey(value: DateValue): string {
  return value === null ? "" : "day" in value ? `D:${value.year}-${value.month}-${value.day}` : `P:${value.year}-${value.month}`;
}

function numericFieldShape(length: number, singular: string, plural: string): string {
  if (length === 1) return singular;
  if (length === 2) return plural;
  return `${length}D`;
}

function numericYearShape(length: number): string {
  if (length === 2) return "YY";
  if (length === 4) return "YYYY";
  return `${length}D`;
}

/** Analysis-only view of numeric date-like shapes; it never broadens parser syntax. */
export function auditNicknameDateTokens(value: string): NicknameDateAuditToken[] {
  const shapePattern = /(?<![\p{L}\p{N}_])(\d{1,4})([./-])(\d{1,4})(?:([./-])(\d{1,4}))?(?![\p{L}\p{N}_])/gu;
  const output: NicknameDateAuditToken[] = [];
  let match: RegExpExecArray | null;
  while ((match = shapePattern.exec(value)) !== null) {
    const hasThird = match[5] !== undefined;
    const fields = hasThird ? [match[1], match[3], match[5]] : [match[1], match[3]];
    const separators = hasThird ? `${match[2]}${match[4]}` : match[2];
    const shape = hasThird
      ? `${numericFieldShape(fields[0].length, "D", "DD")}${match[2]}${numericFieldShape(fields[1].length, "M", "MM")}${match[4]}${numericYearShape(fields[2].length)}`
      : `${numericFieldShape(fields[0].length, "M", "MM")}${match[2]}${numericYearShape(fields[1].length)}`;
    if (separators !== "/" && separators !== "//") {
      output.push({ shape, disposition: "UNSUPPORTED_SEPARATOR", normalizedYear: null, yearConvention: yearConvention(fields.at(-1) ?? "") });
      continue;
    }
    const synthetic = [match[0], fields[0], fields[1], fields[2]] as unknown as RegExpExecArray;
    const parsed = parseNumericDate(synthetic);
    output.push({
      shape,
      disposition: parsed.kind === "INVALID" ? "INVALID" : parsed.kind,
      normalizedYear: parsed.value?.year ?? null,
      yearConvention: yearConvention(fields.at(-1) ?? ""),
    });
  }
  return output;
}

/**
 * Creates an exact-only product resolver from active Product Master models and
 * aliases that the existing catalog policy has already marked auto-safe.
 * It deliberately does not use message substring, series, or fuzzy matching.
 */
export function createNicknameProductResolver(products: readonly ParserV3Product[]) {
  type ExactCandidate = { product: ParserV3Product; alias: string; canonical: boolean };
  const exact = new Map<string, Map<string, ExactCandidate>>();
  const compact = new Map<string, Map<string, { product: ParserV3Product; alias: string }>>();
  const canonicalOwners = new Map<string, Set<string>>();
  const canonicalWithoutTerminal5gOwners = new Map<string, Set<string>>();
  const addCanonicalOwner = (owners: Map<string, Set<string>>, key: string, productId: string) => {
    if (!key) return;
    const ids = owners.get(key) ?? new Set<string>();
    ids.add(productId);
    owners.set(key, ids);
  };
  const canonicalKeys = new Map<string, string>();
  for (const product of products) {
    if (!product.active) continue;
    const key = compactProductText(product.name);
    canonicalKeys.set(product.id, key);
    addCanonicalOwner(canonicalOwners, key, product.id);
    addCanonicalOwner(canonicalWithoutTerminal5gOwners, key.replace(/5g$/u, ""), product.id);
  }
  const competingCanonicalCount = (alias: string, productId: string): number => {
    const key = compactProductText(alias);
    const targetCanonicalKey = canonicalKeys.get(productId);
    const competitors = new Set(canonicalOwners.get(key) ?? []);
    // A shorthand such as Reno16F can collide with a separate canonical model
    // named Reno16 F 5G. Keep the target's own canonical spelling valid.
    if (key !== targetCanonicalKey) {
      for (const id of canonicalWithoutTerminal5gOwners.get(key) ?? []) competitors.add(id);
    }
    competitors.delete(productId);
    return competitors.size;
  };
  const addExact = (
    key: string,
    product: ParserV3Product,
    alias: string,
    canonical = false,
  ) => {
    if (!key) return;
    const candidates = exact.get(key) ?? new Map<string, ExactCandidate>();
    const existing = candidates.get(product.id);
    if (!existing?.canonical || canonical) candidates.set(product.id, { product, alias, canonical });
    exact.set(key, candidates);
  };

  for (const product of products) {
    if (!product.active) continue;
    addExact(normalizeProductText(product.name), product, product.name, true);
    for (const alias of product.aliases) {
      if (alias.safety !== "SAFE_EXACT" && alias.safety !== "SAFE_COMPACT") continue;
      addExact(normalizeProductText(alias.alias), product, alias.alias);
      if (alias.safety === "SAFE_COMPACT") {
        const key = compactProductText(alias.alias);
        if (key) {
          const candidates = compact.get(key) ?? new Map<string, { product: ParserV3Product; alias: string }>();
          candidates.set(product.id, { product, alias: alias.alias });
          compact.set(key, candidates);
        }
      }
    }
  }

  return (residual: string): ParserV3ProductResolution => {
    // NFKC compatibility folding can turn full-width or circled lookalikes into
    // real model names. Keep those for review rather than silently matching.
    if (/[\uFF01-\uFF5E]/u.test(residual)) return { kind: "NO_MATCH" };
    const exactMatches = exact.get(normalizeProductText(residual));
    if (exactMatches?.size === 1) {
      const [{ product, alias, canonical }] = [...exactMatches.values()];
      const competingCount = canonical ? 0 : competingCanonicalCount(alias, product.id);
      if (competingCount > 0) {
        return { kind: "AMBIGUOUS", candidateCount: competingCount + 1 };
      }
      return { kind: "MATCH", productId: product.id, productName: product.name, alias, matchKind: canonical ? "CANONICAL" : "APPROVED_ALIAS" };
    }
    if (exactMatches && exactMatches.size > 1) return { kind: "AMBIGUOUS", candidateCount: exactMatches.size };

    const compactKey = compactProductText(residual);
    const compactMatches = compact.get(compactKey);
    if (compactMatches?.size === 1) {
      const [{ product, alias }] = [...compactMatches.values()];
      const competingCount = competingCanonicalCount(alias, product.id);
      if (competingCount > 0) {
        return { kind: "AMBIGUOUS", candidateCount: competingCount + 1 };
      }
      return { kind: "MATCH", productId: product.id, productName: product.name, alias, matchKind: "APPROVED_ALIAS" };
    }
    return compactMatches && compactMatches.size > 1
      ? { kind: "AMBIGUOUS", candidateCount: compactMatches.size }
      : { kind: "NO_MATCH" };
  };
}

export function parseNicknameV3(
  nickname: string | null,
  readable: boolean,
  resolveProduct: (residual: string) => ParserV3ProductResolution = () => ({ kind: "NO_MATCH" }),
): ParserV3Result {
  const emptyValues: ParserV3Values = {
    source: null,
    customerType: null,
    financeProvider: null,
    paymentMethod: null,
    service: null,
    period: null,
    date: null,
    product: null,
  };
  const input = nickname ?? "";
  if (!readable || isControlOrTooLong(input)) {
    return {
      ruleVersion: NICKNAME_PARSER_V3_RULE_VERSION,
      decision: "UNKNOWN",
      values: emptyValues,
      legacySource: parseNicknameSource(nickname, false),
      ruleIds: [],
      holdReasons: ["NICKNAME_UNREADABLE"],
    };
  }

  const value = normalizedNickname(input);
  const values = { ...emptyValues };
  const ruleIds: string[] = [];
  const holdReasons: string[] = [];
  const removalSpans: Span[] = [];
  const markers = {
    customerTypes: [] as string[],
    financeProviders: [] as string[],
    paymentMethods: [] as string[],
    services: [] as string[],
  };

  let markerMatch: RegExpExecArray | null;
  BUSINESS_MARKER.lastIndex = 0;
  while ((markerMatch = BUSINESS_MARKER.exec(value)) !== null) {
    if (!/^[A-Za-z]+$/u.test(markerMatch[0])) continue;
    const token = markerMatch[0].toLowerCase();
    const span = { start: markerMatch.index, end: BUSINESS_MARKER.lastIndex };
    removalSpans.push(span);
    if (token === "online") {
      markers.customerTypes.push("ONLINE"); ruleIds.push("V3_CUSTOMER_TYPE_ONLINE");
    } else if (token === "sg") {
      markers.financeProviders.push("SG_FINANCE"); ruleIds.push("V3_FINANCE_PROVIDER_SG");
    } else if (token === "ufund") {
      markers.financeProviders.push("UFUND"); ruleIds.push("V3_FINANCE_PROVIDER_UFUND");
    } else if (token === "film") {
      markers.services.push("FILM_INSTALLATION"); ruleIds.push("V3_SERVICE_FILM");
    }
  }

  CASH_WORD.lastIndex = 0;
  let thaiMatch: RegExpExecArray | null;
  while ((thaiMatch = CASH_WORD.exec(value)) !== null) {
    removalSpans.push({ start: thaiMatch.index, end: CASH_WORD.lastIndex });
    markers.paymentMethods.push("CASH");
    ruleIds.push(thaiMatch[0] === "เงินสด" ? "V3_PAYMENT_CASH_MONEY" : "V3_PAYMENT_CASH_FRESH");
  }
  INSTALLMENT_WORD.lastIndex = 0;
  while ((thaiMatch = INSTALLMENT_WORD.exec(value)) !== null) {
    removalSpans.push({ start: thaiMatch.index, end: INSTALLMENT_WORD.lastIndex });
    markers.paymentMethods.push("INSTALLMENT");
    ruleIds.push("V3_PAYMENT_INSTALLMENT");
  }

  NUMERIC_DATE.lastIndex = 0;
  const periods: NonNullable<ParserV3Values["period"]>[] = [];
  const dates: NonNullable<ParserV3Values["date"]>[] = [];
  let dateMatch: RegExpExecArray | null;
  while ((dateMatch = NUMERIC_DATE.exec(value)) !== null) {
    removalSpans.push({ start: dateMatch.index, end: NUMERIC_DATE.lastIndex });
    const parsed = parseNumericDate(dateMatch);
    if (parsed.kind === "INVALID" || parsed.value === null) {
      holdReasons.push("UNSUPPORTED_OR_INVALID_NUMERIC_DATE");
      ruleIds.push("V3_DATE_REVIEW");
      continue;
    }
    if (parsed.kind === "PERIOD") {
      periods.push(parsed.value);
      ruleIds.push("V3_DATE_MONTH_YEAR");
    } else {
      dates.push(parsed.value as NonNullable<ParserV3Values["date"]>);
      ruleIds.push("V3_DATE_FULL_DATE");
    }
  }
  if (auditNicknameDateTokens(value).some(({ disposition }) => disposition === "UNSUPPORTED_SEPARATOR")) {
    holdReasons.push("UNSUPPORTED_NUMERIC_DATE_SEPARATOR");
    ruleIds.push("V3_DATE_REVIEW");
  }

  const legacySource = parseNicknameSource(value, true);
  if (legacySource.kind === "SIGNAL" && legacySource.tag !== null) {
    values.source = legacySource.tag;
    ruleIds.push(`V2_SOURCE_PRESERVED_${legacySource.tag.toUpperCase()}`);
    // Remove the source token only; the shared date span remains available to V3.
    const sourceToken = /^(TikTok|Facebook|Instagram|IG|LINE|Website|Lemon8)(?=\s)/i.exec(value);
    if (sourceToken) removalSpans.push({ start: sourceToken.index, end: sourceToken[0].length });
  } else if (legacySource.kind === "AMBIGUOUS") {
    holdReasons.push("LEGACY_SOURCE_V2_AMBIGUOUS");
  }

  const distinctTypes = unique(markers.customerTypes);
  const distinctProviders = unique(markers.financeProviders);
  const distinctPayments = unique(markers.paymentMethods);
  const distinctServices = unique(markers.services);
  if (distinctTypes.length > 1) holdReasons.push("CONFLICTING_CUSTOMER_TYPE_SIGNALS");
  if (distinctProviders.length > 1) holdReasons.push("CONFLICTING_FINANCE_PROVIDER_SIGNALS");
  if (distinctPayments.length > 1) holdReasons.push("CONFLICTING_PAYMENT_METHOD_SIGNALS");
  if (unique(periods.map(dateKey)).length > 1) holdReasons.push("CONFLICTING_PERIOD_SIGNALS");
  if (unique(dates.map(dateKey)).length > 1) holdReasons.push("CONFLICTING_FULL_DATE_SIGNALS");

  values.customerType = distinctTypes[0] as ParserV3Values["customerType"] ?? null;
  values.financeProvider = distinctProviders[0] as ParserV3Values["financeProvider"] ?? null;
  values.paymentMethod = distinctPayments[0] as ParserV3Values["paymentMethod"] ?? null;
  values.service = distinctServices.length > 0 ? "FILM_INSTALLATION" : null;
  values.period = periods[0] ?? null;
  values.date = dates[0] ?? null;

  const residual = removeSpans(value, removalSpans).replace(/[\s,;+|]+/gu, " ").trim();
  const hadRecognizedSignal = values.source !== null || markers.customerTypes.length > 0 ||
    markers.financeProviders.length > 0 || markers.paymentMethods.length > 0 ||
    markers.services.length > 0 || periods.length > 0 || dates.length > 0 || holdReasons.length > 0;
  if (residual) {
    const product = resolveProduct(residual);
    if (product.kind === "MATCH") {
      values.product = {
        id: product.productId,
        name: product.productName,
        matchedAlias: product.alias,
        matchKind: product.matchKind,
      };
      ruleIds.push(product.matchKind === "CANONICAL" ? "V3_PRODUCT_CANONICAL" : "V3_PRODUCT_APPROVED_ALIAS");
    } else if (hadRecognizedSignal || product.kind === "AMBIGUOUS") {
      holdReasons.push(product.kind === "AMBIGUOUS" ? "PRODUCT_ALIAS_COLLISION" : "UNRESOLVED_PRODUCT_OR_FREE_TEXT");
      ruleIds.push("V3_PRODUCT_REVIEW");
    }
  }

  const hasMeaning = values.source !== null || values.customerType !== null || values.financeProvider !== null ||
    values.paymentMethod !== null || values.service !== null || values.period !== null || values.date !== null || values.product !== null;
  const decision: ParserV3Decision = holdReasons.length > 0
    ? "REVIEW"
    : hasMeaning ? "DETERMINISTIC" : "NO_SIGNAL";

  return {
    ruleVersion: NICKNAME_PARSER_V3_RULE_VERSION,
    decision,
    values,
    legacySource,
    ruleIds: unique(ruleIds),
    holdReasons: unique(holdReasons),
  };
}
