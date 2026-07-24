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
