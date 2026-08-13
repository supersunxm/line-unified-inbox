import { createHmac, timingSafeEqual } from "node:crypto";

const ttlSeconds = 10 * 60;

function secret() {
  return process.env.LINE_CREDENTIAL_ENCRYPTION_KEY?.trim() || "development-media-url-secret";
}

function signature(key: string, expires: string) {
  return createHmac("sha256", secret()).update(`${key}.${expires}`).digest("hex");
}

export function createMediaPublicUrl(objectKey: string) {
  const base = process.env.PUBLIC_WEBHOOK_BASE_URL?.trim();
  if (!base) throw new Error("PUBLIC_WEBHOOK_BASE_URL is required for outbound image delivery");
  const expires = String(Math.floor(Date.now() / 1000) + ttlSeconds);
  const params = new URLSearchParams({ key: objectKey, expires, signature: signature(objectKey, expires) });
  return `${base.replace(/\/$/, "")}/messages/media/public?${params}`;
}

export function verifyMediaPublicUrl(objectKey: string, expires: string, provided: string) {
  if (!/^\d+$/.test(expires) || Number(expires) < Math.floor(Date.now() / 1000) || objectKey.length > 500) return false;
  const expected = Buffer.from(signature(objectKey, expires));
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
