export function extractSessionTokenFromUrl(searchString: string): string | null {
  if (!searchString) return null;
  const params = new URLSearchParams(searchString);

  const directToken = params.get("token");
  if (directToken && isValidTokenFormat(directToken)) {
    return directToken.trim();
  }

  const liffStateRaw = params.get("liff.state") || params.get("state");
  if (liffStateRaw) {
    try {
      const decoded = decodeURIComponent(liffStateRaw);
      const searchPart = decoded.includes("?") ? decoded.substring(decoded.indexOf("?")) : decoded;
      const nestedParams = new URLSearchParams(searchPart);
      const nestedToken = nestedParams.get("token");
      if (nestedToken && isValidTokenFormat(nestedToken)) {
        return nestedToken.trim();
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function isValidTokenFormat(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed.startsWith("sat_")) return false;
  if (trimmed.length < 10 || trimmed.length > 128) return false;
  if (/[^a-zA-Z0-9_\-]/.test(trimmed)) return false;
  return true;
}

export function extractLiffIdFromUrl(searchString: string): string | null {
  if (!searchString) return null;
  const params = new URLSearchParams(searchString);

  const directLid = params.get("lid");
  if (directLid && directLid.trim()) {
    return directLid.trim();
  }

  const liffStateRaw = params.get("liff.state") || params.get("state");
  if (liffStateRaw) {
    try {
      const decoded = decodeURIComponent(liffStateRaw);
      const searchPart = decoded.includes("?") ? decoded.substring(decoded.indexOf("?")) : decoded;
      const nestedParams = new URLSearchParams(searchPart);
      const nestedLid = nestedParams.get("lid");
      if (nestedLid && nestedLid.trim()) {
        return nestedLid.trim();
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function isAttributionDebugEnabled(searchString?: string): boolean {
  const search = searchString ?? (typeof window !== "undefined" ? window.location.search : "");
  if (!search) return false;

  const params = new URLSearchParams(search);
  if (params.get("debug") === "1") return true;

  const liffStateRaw = params.get("liff.state") || params.get("state");
  if (liffStateRaw) {
    try {
      const decoded = decodeURIComponent(liffStateRaw);
      const searchPart = decoded.includes("?") ? decoded.substring(decoded.indexOf("?")) : decoded;
      const nestedParams = new URLSearchParams(searchPart);
      if (nestedParams.get("debug") === "1") return true;
    } catch {
      if (/[?&]debug=1(?:&|$)/.test(liffStateRaw)) return true;
    }
  }

  return false;
}
