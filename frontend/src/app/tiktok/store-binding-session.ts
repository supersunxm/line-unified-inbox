import { createHmac, timingSafeEqual } from "node:crypto";

export const TIKTOK_STORE_BINDING_SESSION_COOKIE = "tiktok_store_binding_session";
const STORE_BINDING_SESSION_TTL_SECONDS = 15 * 60;

interface StoreBindingSessionPayload {
  accountId: string;
  expiresAt: number;
}

function getSigningSecret(): string {
  const secret = process.env.TIKTOK_INTERNAL_SYNC_SECRET?.trim();
  if (!secret) {
    throw new Error("TIKTOK_INTERNAL_SYNC_SECRET is required for TikTok store binding sessions");
  }
  return secret;
}

function signBody(body: string): string {
  return createHmac("sha256", getSigningSecret()).update(body).digest("base64url");
}

export function createTikTokStoreBindingSession(accountId: string): string {
  const payload: StoreBindingSessionPayload = {
    accountId: accountId.trim(),
    expiresAt: Date.now() + STORE_BINDING_SESSION_TTL_SECONDS * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signBody(body)}`;
}

export function verifyTikTokStoreBindingSession(value?: string | null): StoreBindingSessionPayload | null {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;

  const expected = signBody(body);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StoreBindingSessionPayload;
    if (!payload.accountId || typeof payload.accountId !== "string") return null;
    if (!payload.expiresAt || typeof payload.expiresAt !== "number") return null;
    if (Date.now() >= payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

export const TIKTOK_STORE_BINDING_SESSION_MAX_AGE = STORE_BINDING_SESSION_TTL_SECONDS;
