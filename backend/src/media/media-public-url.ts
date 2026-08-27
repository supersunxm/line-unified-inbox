import { createHmac, timingSafeEqual } from "node:crypto";

const defaultTtlSeconds = 7 * 24 * 60 * 60; // 7 days (604,800s)

export const PUBLIC_MEDIA_PREFIXES = [
  "line-media/outbound/",
  "line-media/auto-response/",
] as const;

export function isAllowedPublicMediaObjectKey(key: string): boolean {
  if (typeof key !== "string" || !key || key.length > 500) {
    return false;
  }
  // Reject traversal attempts: .., \, leading /, or encoded path traversal
  if (
    key.includes("..") ||
    key.includes("\\") ||
    key.startsWith("/") ||
    /%2e/i.test(key) ||
    /%2f/i.test(key) ||
    /%5c/i.test(key)
  ) {
    return false;
  }
  return PUBLIC_MEDIA_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function secret() {
  return process.env.LINE_CREDENTIAL_ENCRYPTION_KEY?.trim() || "development-media-url-secret";
}

function signature(key: string, expires: string) {
  return createHmac("sha256", secret()).update(`${key}.${expires}`).digest("hex");
}

export function createMediaPublicUrl(objectKey: string, ttlSeconds = defaultTtlSeconds) {
  const rawBase = process.env.PUBLIC_WEBHOOK_BASE_URL?.trim();
  if (process.env.NODE_ENV === "production" && (!rawBase || !rawBase.startsWith("https://"))) {
    throw new Error("PUBLIC_WEBHOOK_BASE_URL must be a valid public HTTPS URL in production");
  }
  const base = rawBase || "http://localhost:3001";
  const expires = String(Math.floor(Date.now() / 1000) + ttlSeconds);
  const params = new URLSearchParams({ key: objectKey, expires, signature: signature(objectKey, expires) });
  return `${base.replace(/\/$/, "")}/messages/media/public?${params}`;
}

export function extractMediaObjectKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    const key = parsed.searchParams.get("key");
    if (key && isAllowedPublicMediaObjectKey(key)) {
      return key;
    }
  } catch {
    /* ignore non-URL or invalid string */
  }
  return null;
}

export function verifyMediaPublicUrl(objectKey: string, expires: string, provided: string) {
  if (!isAllowedPublicMediaObjectKey(objectKey)) return false;
  if (!/^\d+$/.test(expires) || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  if (typeof provided !== "string" || !provided) return false;
  const expected = Buffer.from(signature(objectKey, expires));
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
