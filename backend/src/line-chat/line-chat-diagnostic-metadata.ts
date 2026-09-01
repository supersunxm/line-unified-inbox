import type {
  DiagnosticArrayLength,
  DiagnosticChatListContractSummary,
  DiagnosticQueryMetadata,
  DiagnosticResponseSchemaSummary,
} from "./line-chat.types";
import { isLineChatUserId } from "./line-chat-chat-discovery";

const SAFE_PAGINATION_KEYS = new Set(["limit", "offset", "page", "size"]);
const REDACTED_QUERY_KEY_PATTERN = /(cursor|token|auth|authorization|session|secret|key|xsrf|csrf)/i;
const MAX_SAFE_SCALAR_LENGTH = 9;
const MAX_KEYS_PER_OBJECT = 100;
const MAX_ARRAY_ITEMS_TO_INSPECT = 20;
const MAX_NESTED_DEPTH = 3;
const SAFE_CHAT_TYPE_CATEGORY_PATTERN = /^[A-Z][A-Z0-9_]{0,31}$/;

export interface SanitizedDiagnosticUrl {
  url: string;
  query: DiagnosticQueryMetadata;
}

export interface SanitizedNavigationMetadata {
  url: string;
  origin: string;
  pathname: string;
  documentTitle: string | null;
}

/**
 * Returns only origin/pathname plus query names and safe pagination metadata.
 * Query values, cookies, credentials, and customer identifiers are never
 * copied into the diagnostic result.
 */
export function sanitizeDiagnosticUrl(rawUrl: string): SanitizedDiagnosticUrl {
  try {
    const parsed = new URL(rawUrl);
    const parameterNames = [...new Set([...parsed.searchParams.keys()])];
    const safeScalars: Record<string, string> = {};
    const redactedParameters: string[] = [];

    for (const name of parameterNames) {
      const values = parsed.searchParams.getAll(name);
      const value = values[0];
      const normalizedName = name.toLowerCase();

      if (
        SAFE_PAGINATION_KEYS.has(normalizedName) &&
        value !== undefined &&
        /^\d{1,9}$/.test(value) &&
        value.length <= MAX_SAFE_SCALAR_LENGTH
      ) {
        safeScalars[name] = value;
      }

      if (REDACTED_QUERY_KEY_PATTERN.test(name) && value !== undefined) {
        redactedParameters.push(`${name}=PRESENT_REDACTED`);
      }
    }

    return {
      url: `${parsed.origin}${redactCustomerPathSegments(parsed.pathname)}`,
      query: { parameterNames, safeScalars, redactedParameters },
    };
  } catch {
    return {
      url: "[unparseable-url]",
      query: { parameterNames: [], safeScalars: {}, redactedParameters: [] },
    };
  }
}

/**
 * Sanitizes a final browser URL and title for navigation diagnostics. URL
 * queries are intentionally discarded; titles are retained only when they
 * look like a generic LINE/authentication title, otherwise they are redacted
 * to avoid leaking account or customer names.
 */
export function sanitizeNavigationMetadata(
  rawUrl: string,
  rawTitle?: string | null,
): SanitizedNavigationMetadata {
  try {
    const parsed = new URL(rawUrl);
    const pathname = redactCustomerPathSegments(parsed.pathname);
    const origin = parsed.origin;
    return {
      url: `${origin}${pathname}`,
      origin,
      pathname,
      documentTitle: sanitizeDiagnosticTitle(rawTitle),
    };
  } catch {
    return {
      url: "[unparseable-url]",
      origin: "[unknown-origin]",
      pathname: "[unknown-path]",
      documentTitle: sanitizeDiagnosticTitle(rawTitle),
    };
  }
}

/**
 * Returns a title only for known generic LINE/authentication surfaces. A
 * dynamic or unknown title is represented without retaining its value.
 */
export function sanitizeDiagnosticTitle(rawTitle?: string | null): string | null {
  const title = rawTitle
    ?.split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return null;
  if (
    /^(?:line(?: official account(?: manager)?| chat)?|official account manager|sign[ -]?in(?: to line)?|log[ -]?in(?: to line)?|authentication(?: required)?|session expired)$/i.test(title)
    && title.length <= 120
  ) {
    return title;
  }
  return "[redacted]";
}

export function isLoginLikeNavigationUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return /(login|sign[ -]?in|auth|oauth|sso|account|verify|verification|relogin|session[-_ ]?expired)/i.test(
      `${parsed.hostname}${parsed.pathname}`,
    );
  } catch {
    return false;
  }
}

export function isChatLineOrigin(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).origin === "https://chat.line.biz";
  } catch {
    return false;
  }
}

export function isRequestedWorkspacePath(finalUrl: string, requestedUrl: string): boolean {
  try {
    const finalParsed = new URL(finalUrl);
    const requestedParsed = new URL(requestedUrl);
    const normalize = (pathname: string) => pathname.replace(/\/+$/, "") || "/";
    return (
      finalParsed.origin === "https://chat.line.biz"
      && normalize(finalParsed.pathname) === normalize(requestedParsed.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * Masks customer identifiers in known LINE chat URL positions while retaining
 * the endpoint shape needed for diagnostics.
 */
function redactCustomerPathSegments(pathname: string): string {
  return pathname.replace(/(\/(?:chat|chats)\/)([^/]+)/gi, "$1<customer-id-redacted>");
}

export function isRelevantDiagnosticUrl(rawUrl: string): {
  relevant: boolean;
  isRestApi: boolean;
  isStreamingSse: boolean;
} {
  try {
    const parsed = new URL(rawUrl);
    const isChatManagerApi = parsed.hostname === "chat.line.biz" && parsed.pathname.startsWith("/api/");
    const isStreamingSse = parsed.hostname === "chat-streaming-api.line.biz" && parsed.pathname === "/api/v2/sse";
    return {
      relevant: isChatManagerApi || isStreamingSse,
      isRestApi: isChatManagerApi,
      isStreamingSse,
    };
  } catch {
    return { relevant: false, isRestApi: false, isStreamingSse: false };
  }
}

function jsonType(value: unknown): DiagnosticResponseSchemaSummary["topLevelType"] {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "object": return "object";
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    default: return "unknown";
  }
}

function isPaginationKey(key: string): boolean {
  return /(cursor|offset|limit|page|size|total|hasMore|hasNext|nextPage)/i.test(key);
}

function isCandidateField(key: string): boolean {
  return /(id|name|display|chat|user|message|last|timestamp|time)/i.test(key);
}

/**
 * Summarizes JSON structure without retaining or printing any payload value.
 */
export function summarizeDiagnosticJson(value: unknown): DiagnosticResponseSchemaSummary {
  const topLevelType = jsonType(value);
  const topLevelKeyNames = value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).slice(0, MAX_KEYS_PER_OBJECT)
    : [];
  const nestedKeyNames = new Set<string>();
  const paginationKeyNames = new Set<string>();
  const candidateFieldNames = new Set<string>();
  const arrayLengths: DiagnosticArrayLength[] = [];
  const seen = new WeakSet<object>();

  const inspect = (current: unknown, currentPath: string, depth: number): void => {
    if (current === null || typeof current !== "object" || seen.has(current)) return;
    seen.add(current);

    if (Array.isArray(current)) {
      arrayLengths.push({ path: currentPath || "$", length: current.length });
      if (depth >= MAX_NESTED_DEPTH) return;
      current.slice(0, MAX_ARRAY_ITEMS_TO_INSPECT).forEach((item, index) => {
        inspect(item, `${currentPath || "$"}[${index}]`, depth + 1);
      });
      return;
    }

    const keys = Object.keys(current).slice(0, MAX_KEYS_PER_OBJECT);
    for (const key of keys) {
      nestedKeyNames.add(key);
      if (isPaginationKey(key)) paginationKeyNames.add(key);
      if (isCandidateField(key)) candidateFieldNames.add(key);
      if (depth < MAX_NESTED_DEPTH) {
        inspect((current as Record<string, unknown>)[key], `${currentPath || "$"}.${key}`, depth + 1);
      }
    }
  };

  inspect(value, "$", 0);

  return {
    parseStatus: "JSON",
    topLevelType,
    topLevelKeyNames,
    nestedKeyNames: [...nestedKeyNames].sort(),
    arrayLengths,
    paginationKeyNames: [...paginationKeyNames].sort(),
    candidateFieldNames: [...candidateFieldNames].sort(),
  };
}

export function diagnosticResponseParseFailure(
  parseStatus: "NOT_JSON" | "PARSE_FAILED"
): DiagnosticResponseSchemaSummary {
  return {
    parseStatus,
    topLevelType: "unknown",
    topLevelKeyNames: [],
    nestedKeyNames: [],
    arrayLengths: [],
    paginationKeyNames: [],
    candidateFieldNames: [],
  };
}

function emptyIdentifierSummary(): DiagnosticChatListContractSummary["identifierShape"]["chatId"] {
  return {
    stringCount: 0,
    matchesUserIdPattern: 0,
    otherStringCount: 0,
    nullOrMissing: 0,
  };
}

function summarizeIdentifierField(values: unknown[]): DiagnosticChatListContractSummary["identifierShape"]["chatId"] {
  const summary = emptyIdentifierSummary();
  for (const value of values) {
    if (typeof value !== "string" || value.trim().length === 0) {
      summary.nullOrMissing += 1;
      continue;
    }
    summary.stringCount += 1;
    if (isLineChatUserId(value)) summary.matchesUserIdPattern += 1;
    else summary.otherStringCount += 1;
  }
  return summary;
}

function isPresentIdentifier(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function emptyChatIdPrefixCounts(): DiagnosticChatListContractSummary["chatIdStructure"]["prefixClass"] {
  return { validUserId: 0, invalidU: 0, R: 0, C: 0, other: 0 };
}

function chatIdPrefixClass(value: unknown): keyof DiagnosticChatListContractSummary["chatIdStructure"]["prefixClass"] | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (isLineChatUserId(normalized)) return "validUserId";
  if (value.trim()[0] === "U" || value.trim()[0] === "u") return "invalidU";
  if (normalized[0] === "R") return "R";
  if (normalized[0] === "C") return "C";
  return "other";
}

function summarizeChatIdStructure(values: unknown[]): DiagnosticChatListContractSummary["chatIdStructure"] {
  const prefixClass = emptyChatIdPrefixCounts();
  const lengthBuckets = {
    lte16: 0,
    from17To32: 0,
    from33To40: 0,
    gte41: 0,
  };
  let totalStrings = 0;

  for (const value of values) {
    const prefix = chatIdPrefixClass(value);
    if (!prefix || typeof value !== "string") continue;
    totalStrings += 1;
    prefixClass[prefix] += 1;
    const length = value.trim().length;
    if (length <= 16) lengthBuckets.lte16 += 1;
    else if (length <= 32) lengthBuckets.from17To32 += 1;
    else if (length <= 40) lengthBuckets.from33To40 += 1;
    else lengthBuckets.gte41 += 1;
  }

  return { totalStrings, prefixClass, lengthBuckets };
}

function safeChatTypeCategory(
  value: unknown,
  aliases: Map<string, string>,
): { category: string; present: boolean } {
  if (typeof value !== "string") {
    return value === null || value === undefined
      ? { category: "MISSING", present: false }
      : { category: "NON_STRING", present: true };
  }

  const normalized = value.trim();
  if (!normalized) return { category: "MISSING", present: false };
  if (SAFE_CHAT_TYPE_CATEGORY_PATTERN.test(normalized)) {
    return { category: normalized, present: true };
  }

  let alias = aliases.get(normalized);
  if (!alias) {
    let sequence = aliases.size;
    let suffix = "";
    do {
      suffix = String.fromCharCode(65 + (sequence % 26)) + suffix;
      sequence = Math.floor(sequence / 26) - 1;
    } while (sequence >= 0);
    alias = `TYPE_${suffix}`;
    aliases.set(normalized, alias);
  }
  return { category: alias, present: true };
}

function summarizeChatTypeCorrelation(
  list: unknown[],
  chatIdValues: unknown[],
): DiagnosticChatListContractSummary["chatTypeCorrelation"] {
  const aliases = new Map<string, string>();
  const matrix = new Map<string, DiagnosticChatListContractSummary["chatTypeCorrelation"]["matrix"][number]>();
  const chatTypePresence = { present: 0, missing: 0 };
  const friend = { trueCount: 0, falseCount: 0, otherOrMissing: 0 };
  const profile = { present: 0, missing: 0 };

  list.forEach((entry, index) => {
    const record = entry !== null && typeof entry === "object" && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : undefined;
    const chatType = safeChatTypeCategory(record?.chatType, aliases);
    if (chatType.present) chatTypePresence.present += 1;
    else chatTypePresence.missing += 1;

    let row = matrix.get(chatType.category);
    if (!row) {
      row = { category: chatType.category, count: 0, idShape: emptyChatIdPrefixCounts() };
      matrix.set(chatType.category, row);
    }
    row.count += 1;
    const prefix = chatIdPrefixClass(chatIdValues[index]);
    if (prefix) row.idShape[prefix] += 1;

    if (record?.friend === true) friend.trueCount += 1;
    else if (record?.friend === false) friend.falseCount += 1;
    else friend.otherOrMissing += 1;

    if (record && Object.prototype.hasOwnProperty.call(record, "profile") && record.profile !== null && record.profile !== undefined) {
      profile.present += 1;
    } else {
      profile.missing += 1;
    }
  });

  return {
    matrix: [...matrix.values()],
    chatTypePresence,
    friend,
    profile,
  };
}

function classifyNextString(value: string): DiagnosticChatListContractSummary["pagination"]["nextStringClassification"] {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "EMPTY";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return "URL";
  } catch {
    // Opaque pagination values are intentionally never retained.
  }
  return "OPAQUE_TOKEN";
}

function lengthBucket(value: string): DiagnosticChatListContractSummary["pagination"]["nextLengthBucket"] {
  if (value.length === 0) return "0";
  if (value.length <= 32) return "1-32";
  if (value.length <= 128) return "33-128";
  return "129+";
}

function summarizeNext(value: unknown, present: boolean): DiagnosticChatListContractSummary["pagination"] {
  if (!present) {
    return {
      nextPresent: "NO",
      nextType: "other",
      nextStringClassification: "NOT_APPLICABLE",
      nextLengthBucket: "NOT_APPLICABLE",
      nextObjectKeys: [],
    };
  }

  if (value === null) {
    return {
      nextPresent: "YES",
      nextType: "null",
      nextStringClassification: "NOT_APPLICABLE",
      nextLengthBucket: "NOT_APPLICABLE",
      nextObjectKeys: [],
    };
  }

  if (typeof value === "string") {
    return {
      nextPresent: "YES",
      nextType: "string",
      nextStringClassification: classifyNextString(value),
      nextLengthBucket: lengthBucket(value),
      nextObjectKeys: [],
    };
  }

  if (Array.isArray(value)) {
    return {
      nextPresent: "YES",
      nextType: "array",
      nextStringClassification: "NOT_APPLICABLE",
      nextLengthBucket: "NOT_APPLICABLE",
      nextObjectKeys: [],
    };
  }

  if (typeof value === "object") {
    return {
      nextPresent: "YES",
      nextType: "object",
      nextStringClassification: "NOT_APPLICABLE",
      nextLengthBucket: "NOT_APPLICABLE",
      nextObjectKeys: Object.keys(value).slice(0, MAX_KEYS_PER_OBJECT).sort(),
    };
  }

  return {
    nextPresent: "YES",
    nextType: "other",
    nextStringClassification: "NOT_APPLICABLE",
    nextLengthBucket: "NOT_APPLICABLE",
    nextObjectKeys: [],
  };
}

/**
 * Summarizes only the verified v2 chat-list identifier and pagination shape.
 * No identifier, pagination, customer, or message values are retained.
 */
export function summarizeChatListContractJson(
  value: unknown,
  knownChatId?: string,
): DiagnosticChatListContractSummary | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.list)) return undefined;

  const list = body.list as unknown[];
  const chatIdValues = list.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return undefined;
    return (entry as Record<string, unknown>).chatId;
  });
  const userIdValues = list.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return undefined;
    return (entry as Record<string, unknown>).userId;
  });

  const presenceCounts = {
    bothPresent: 0,
    chatIdOnly: 0,
    userIdOnly: 0,
    neither: 0,
  };
  for (let index = 0; index < list.length; index += 1) {
    const chatPresent = isPresentIdentifier(chatIdValues[index]);
    const userPresent = isPresentIdentifier(userIdValues[index]);
    if (chatPresent && userPresent) presenceCounts.bothPresent += 1;
    else if (chatPresent) presenceCounts.chatIdOnly += 1;
    else if (userPresent) presenceCounts.userIdOnly += 1;
    else presenceCounts.neither += 1;
  }

  const normalizedKnownChatId = knownChatId?.trim();
  const knownChatIdMatch = normalizedKnownChatId
    ? {
      chatId: chatIdValues.some((candidate) => typeof candidate === "string" && candidate.trim() === normalizedKnownChatId)
        ? "FOUND" as const
        : "NOT_FOUND" as const,
      userId: userIdValues.some((candidate) => typeof candidate === "string" && candidate.trim() === normalizedKnownChatId)
        ? "FOUND" as const
        : "NOT_FOUND" as const,
    }
    : undefined;

  return {
    identifierShape: {
      listCount: list.length,
      chatId: summarizeIdentifierField(chatIdValues),
      userId: summarizeIdentifierField(userIdValues),
      presenceCounts,
    },
    chatIdStructure: summarizeChatIdStructure(chatIdValues),
    chatTypeCorrelation: summarizeChatTypeCorrelation(list, chatIdValues),
    pagination: summarizeNext(body.next, Object.prototype.hasOwnProperty.call(body, "next")),
    ...(knownChatIdMatch ? { knownChatIdMatch } : {}),
  };
}
