export function isValidGoogleMapsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "maps.app.goo.gl") return true;
    if (host === "goo.gl" && url.pathname.startsWith("/maps")) return true;
    if (host.startsWith("maps.google.")) return true;
    if (
      (host === "google.com" ||
        host.endsWith(".google.com") ||
        host === "google.co.th" ||
        host.endsWith(".google.co.th") ||
        /^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/i.test(host)) &&
      url.pathname.startsWith("/maps")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

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
  [key: string]: unknown;
};

export type TemplateValidationStatus = "READY" | "BLOCKED";

export type TemplateValidationResult = {
  status: TemplateValidationStatus;
  missingVariables: string[];
  reason?: string;
};

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

export function getStoreVariableValue(
  variable: string,
  store?: StoreVariableContext | null,
): string | null {
  if (!store) return null;
  const normalized = variable.trim();
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
    const value = getStoreVariableValue(v, store);
    const prop = v.startsWith("store.") ? v.slice(6) : v;

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
