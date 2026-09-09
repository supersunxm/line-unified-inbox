import { createHmac, timingSafeEqual } from "node:crypto";

export const TIKTOK_STORE_BINDING_SESSION_COOKIE = "tiktok_store_binding_session";
const STORE_BINDING_SESSION_TTL_SECONDS = 15 * 60;
export const TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE = "tiktok_store_owner_analytics_session";
const STORE_OWNER_ANALYTICS_SESSION_TTL_SECONDS = 60 * 60;

interface StoreBindingSessionPayload {
  accountId: string;
  expiresAt: number;
}

export interface TikTokStoreOwnerAnalyticsSessionPayload {
  accountId: string;
  storeMasterId: string;
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
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;

  let expected: string;
  try {
    expected = signBody(body);
  } catch {
    return null;
  }
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

export function createTikTokStoreOwnerAnalyticsSession(
  accountId: string,
  storeMasterId: string,
): string {
  if (!accountId.trim() || !storeMasterId.trim()) {
    throw new Error("TikTok store-owner analytics session requires account and store IDs");
  }
  const payload: TikTokStoreOwnerAnalyticsSessionPayload = {
    accountId: accountId.trim(),
    storeMasterId: storeMasterId.trim(),
    expiresAt: Date.now() + STORE_OWNER_ANALYTICS_SESSION_TTL_SECONDS * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signBody(body)}`;
}

export function verifyTikTokStoreOwnerAnalyticsSession(
  value?: string | null,
): TikTokStoreOwnerAnalyticsSessionPayload | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;

  let expected: string;
  try {
    expected = signBody(body);
  } catch {
    return null;
  }
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<TikTokStoreOwnerAnalyticsSessionPayload>;
    if (
      typeof payload.accountId !== "string" ||
      !payload.accountId.trim() ||
      typeof payload.storeMasterId !== "string" ||
      !payload.storeMasterId.trim() ||
      typeof payload.expiresAt !== "number" ||
      Date.now() >= payload.expiresAt
    ) {
      return null;
    }
    return {
      accountId: payload.accountId.trim(),
      storeMasterId: payload.storeMasterId.trim(),
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

export const TIKTOK_STORE_OWNER_ANALYTICS_SESSION_MAX_AGE = STORE_OWNER_ANALYTICS_SESSION_TTL_SECONDS;
