import { createHmac, timingSafeEqual } from "node:crypto";

export const TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE = "tiktok_store_owner_analytics_session";

interface TikTokStoreOwnerSessionPayload {
  accountId: string;
  storeMasterId: string;
  expiresAt: number;
}

function getSigningSecret(): string | null {
  const secret = process.env.TIKTOK_INTERNAL_SYNC_SECRET?.trim();
  return secret || null;
}

function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function readCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE}=`));
  return cookie?.slice(`${TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE}=`.length) || null;
}

/**
 * Verifies the short-lived browser session issued after a public TikTok store
 * binding is confirmed. The backend re-verifies it so internal callers cannot
 * substitute an account or store identifier in a request path or header.
 */
export function verifyTikTokStoreOwnerSession(
  cookieHeader?: string,
): TikTokStoreOwnerSessionPayload | null {
  const value = readCookie(cookieHeader);
  const secret = getSigningSecret();
  if (!value || !secret) return null;

  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;

  const expected = signBody(body, secret);
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<TikTokStoreOwnerSessionPayload>;
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
