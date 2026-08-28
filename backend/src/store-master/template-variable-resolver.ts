import { isValidGoogleMapsUrl } from "./store-master.utils";

export type GoogleMapsReadinessStatus = "CONFIGURED" | "MISSING" | "INVALID";

export type GoogleMapsReadiness = {
  status: GoogleMapsReadinessStatus;
  ready: boolean;
  reason: string | null;
};

export function getStoreGoogleMapsReadiness(
  store?: { googleMapsUrl?: string | null } | null | string,
): GoogleMapsReadiness {
  const rawUrl = typeof store === "string" ? store : store?.googleMapsUrl;
  const url = rawUrl?.trim();
  if (!url) {
    return {
      status: "MISSING",
      ready: false,
      reason: "Missing Google Maps URL",
    };
  }
  if (isValidGoogleMapsUrl(url)) {
    return {
      status: "CONFIGURED",
      ready: true,
      reason: null,
    };
  }
  return {
    status: "INVALID",
    ready: false,
    reason: "Invalid Google Maps URL",
  };
}

export type StoreVariableContext = {
  id?: string | null;
  name?: string | null;
  storeName?: string | null;
  code?: string | null;
  storeId?: string | null;
  externalStoreId?: string | null;
  accountName?: string | null;
  province?: string | null;
  region?: string | null;
  lineId?: string | null;
  lineOaLink?: string | null;
  lineManagerUrl?: string | null;
  tiktokUsername?: string | null;
  tiktokProfileUrl?: string | null;
  googleMapsUrl?: string | null;
  user?: { displayName?: string | null; name?: string | null } | null;
  account?: { name?: string | null } | null;
  lineOfficialAccountName?: string | null;
  userDisplayName?: string | null;
  userName?: string | null;
  [key: string]: unknown;
};

export type TemplateValidationStatus = "READY" | "BLOCKED";

export type TemplateValidationResult = {
  status: TemplateValidationStatus;
  missingVariables: string[];
  reason?: string;
};

/**
 * Extracts variable names inside {{...}} delimiters.
 */
export function extractTemplateVariables(template: string): string[] {
  if (!template) return [];
  const matches = template.match(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g);
  if (!matches) return [];
  const vars = new Set<string>();
  for (const m of matches) {
    const raw = m.slice(2, -2).trim();
    if (raw) vars.add(raw);
  }
  return Array.from(vars);
}

/**
 * Resolves a variable expression like "store.googleMapsUrl", "user.displayName", or "account.name" against context.
 */
export function getStoreVariableValue(
  variable: string,
  store?: StoreVariableContext | null,
): string | null {
  if (!store) return null;
  const normalized = variable.trim();

  if (
    normalized === "user.displayName" ||
    normalized === "user.name" ||
    normalized === "customer.displayName"
  ) {
    if (
      store.user &&
      typeof store.user === "object" &&
      typeof store.user.displayName === "string"
    ) {
      return store.user.displayName.trim() || null;
    }
    if (typeof store.userDisplayName === "string") {
      return store.userDisplayName.trim() || null;
    }
    if (typeof store.userName === "string") {
      return store.userName.trim() || null;
    }
    return null;
  }

  if (
    normalized === "account.name" ||
    normalized === "lineOfficialAccount.name" ||
    normalized === "oa.name"
  ) {
    if (
      store.account &&
      typeof store.account === "object" &&
      typeof store.account.name === "string"
    ) {
      return store.account.name.trim() || null;
    }
    if (typeof store.lineOfficialAccountName === "string") {
      return store.lineOfficialAccountName.trim() || null;
    }
    if (typeof store.accountName === "string") {
      return store.accountName.trim() || null;
    }
    return store.storeName?.trim() || store.name?.trim() || null;
  }

  // Support both "store.xxx" and "xxx"
  const prop = normalized.startsWith("store.") ? normalized.slice(6) : normalized;

  switch (prop) {
    case "googleMapsUrl":
      return store.googleMapsUrl?.trim() || null;
    case "name":
    case "storeName":
      return store.storeName?.trim() || store.name?.trim() || null;
    case "storeId":
    case "externalStoreId":
    case "code":
      return store.storeId?.trim() || store.externalStoreId?.trim() || store.code?.trim() || null;
    case "accountName":
      return store.accountName?.trim() || null;
    case "province":
      return store.province?.trim() || null;
    case "region":
      return store.region?.trim() || null;
    case "lineId":
      return store.lineId?.trim() || null;
    case "lineOaLink":
      return store.lineOaLink?.trim() || null;
    case "lineManagerUrl":
      return store.lineManagerUrl?.trim() || null;
    case "tiktokUsername":
      return store.tiktokUsername?.trim() || null;
    case "tiktokProfileUrl":
      return store.tiktokProfileUrl?.trim() || null;
    default: {
      const val = store[prop];
      return typeof val === "string" && val.trim() ? val.trim() : null;
    }
  }
}

/**
 * Validates whether all required template variables can be resolved with valid values.
 * Context variables (like user.displayName) do not block store readiness.
 * Specifically for googleMapsUrl:
 * - URL exists & is valid => READY
 * - URL missing or invalid => BLOCKED / Missing Google Maps URL
 */
export function validateTemplateVariables(
  template: string,
  store?: StoreVariableContext | null,
): TemplateValidationResult {
  if (!template) {
    return { status: "READY", missingVariables: [] };
  }

  const variables = extractTemplateVariables(template);
  const missingVariables: string[] = [];
  const reasons: string[] = [];

  for (const v of variables) {
    const normalized = v.trim();
    if (
      normalized === "user.displayName" ||
      normalized === "user.name" ||
      normalized === "customer.displayName"
    ) {
      // Runtime context variable: evaluated during event execution, does not block store readiness
      continue;
    }

    const value = getStoreVariableValue(v, store);
    const prop = normalized.startsWith("store.") ? normalized.slice(6) : normalized;

    if (prop === "googleMapsUrl") {
      if (!value || !isValidGoogleMapsUrl(value)) {
        missingVariables.push(v);
        reasons.push("Missing Google Maps URL");
      }
    } else if (!value) {
      missingVariables.push(v);
      reasons.push(`Missing ${v}`);
    }
  }

  if (missingVariables.length > 0) {
    return {
      status: "BLOCKED",
      missingVariables,
      reason: reasons.join("; "),
    };
  }

  return {
    status: "READY",
    missingVariables: [],
  };
}

/**
 * Replaces all {{xxx}} template variables in the template string.
 */
export function resolveTemplateVariables(
  template: string,
  store?: StoreVariableContext | null,
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, varName: string) => {
    const val = getStoreVariableValue(varName, store);
    return val ?? "";
  });
}
