import type {
  DiagnosticArrayLength,
  DiagnosticQueryMetadata,
  DiagnosticResponseSchemaSummary,
} from "./line-chat.types";

const SAFE_PAGINATION_KEYS = new Set(["limit", "offset", "page", "size"]);
const REDACTED_QUERY_KEY_PATTERN = /(cursor|token|auth|authorization|session|secret|key|xsrf|csrf)/i;
const MAX_SAFE_SCALAR_LENGTH = 9;
const MAX_KEYS_PER_OBJECT = 100;
const MAX_ARRAY_ITEMS_TO_INSPECT = 20;
const MAX_NESTED_DEPTH = 3;

export interface SanitizedDiagnosticUrl {
  url: string;
  query: DiagnosticQueryMetadata;
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
