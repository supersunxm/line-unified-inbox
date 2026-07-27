export function safeDecodeURIComponentBounded(input: string, maxAttempts = 3): string {
  if (!input || typeof input !== "string") return "";
  let current = input;
  let attempts = 0;

  while (attempts < maxAttempts) {
    if (!current.includes("%")) break;
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
      attempts++;
    } catch {
      break;
    }
  }
  return current;
}

export function extractParamsFromUrlOrState(rawInput: string): URLSearchParams {
  const decoded = safeDecodeURIComponentBounded(rawInput, 3);
  let searchPart = decoded;

  if (searchPart.includes("?")) {
    searchPart = searchPart.substring(searchPart.indexOf("?"));
  } else if (!searchPart.startsWith("?")) {
    searchPart = "?" + searchPart;
  }

  try {
    return new URLSearchParams(searchPart);
  } catch {
    return new URLSearchParams("");
  }
}

export function isValidLiffIdFormat(liffId: string | null | undefined): boolean {
  if (!liffId || typeof liffId !== "string") return false;
  const trimmed = liffId.trim();
  if (trimmed.length < 5 || trimmed.length > 64) return false;
  if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) return false;
  if (/[/\?#&= \t\r\n]/.test(trimmed)) return false;
  return true;
}

export function isValidTokenFormat(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed.startsWith("sat_")) return false;
  if (trimmed.length < 10 || trimmed.length > 128) return false;
  if (/[^a-zA-Z0-9_\-]/.test(trimmed)) return false;
  return true;
}

export function extractSessionTokenFromUrl(searchString: string): string | null {
  if (!searchString) return null;
  const directParams = new URLSearchParams(searchString);

  const directToken = directParams.get("token") || directParams.get("sessionToken");
  if (directToken && isValidTokenFormat(directToken)) {
    return directToken.trim();
  }

  const liffStateRaw = directParams.get("liff.state") || directParams.get("state");
  if (liffStateRaw) {
    const nestedParams = extractParamsFromUrlOrState(liffStateRaw);
    const nestedToken = nestedParams.get("token") || nestedParams.get("sessionToken");
    if (nestedToken && isValidTokenFormat(nestedToken)) {
      return nestedToken.trim();
    }
  }

  return null;
}

export function extractLiffIdFromUrl(searchString: string): string | null {
  if (!searchString) return null;
  const directParams = new URLSearchParams(searchString);

  const directLid = directParams.get("lid");
  if (directLid && isValidLiffIdFormat(directLid)) {
    return directLid.trim();
  }

  const liffStateRaw = directParams.get("liff.state") || directParams.get("state");
  if (liffStateRaw) {
    const nestedParams = extractParamsFromUrlOrState(liffStateRaw);
    const nestedLid = nestedParams.get("lid");
    if (nestedLid && isValidLiffIdFormat(nestedLid)) {
      return nestedLid.trim();
    }
  }

  return null;
}

export function isAttributionDebugEnabled(searchString?: string): boolean {
  const search = searchString ?? (typeof window !== "undefined" ? window.location.search : "");
  if (!search) return false;

  const directParams = new URLSearchParams(search);
  if (directParams.get("debug") === "1") return true;

  const liffStateRaw = directParams.get("liff.state") || directParams.get("state");
  if (liffStateRaw) {
    const nestedParams = extractParamsFromUrlOrState(liffStateRaw);
    if (nestedParams.get("debug") === "1") return true;
  }

  return false;
}

export function isValidFallbackUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    return (parsed.protocol === "https:" || parsed.protocol === "http:") &&
           (parsed.hostname.includes("line.me") || parsed.hostname.includes("line-official-account"));
  } catch {
    return false;
  }
}
