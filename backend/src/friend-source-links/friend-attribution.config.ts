import { createHmac } from "crypto";

export function getFriendAttributionPilotLineOaId(env: NodeJS.ProcessEnv = process.env): string | null {
  const val = env.FRIEND_ATTRIBUTION_PILOT_LINE_OA_ID?.trim();
  return val || null;
}

export function getFriendAttributionLiffBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.FRIEND_ATTRIBUTION_LIFF_BASE_URL?.trim();
  if (raw) {
    if (env.NODE_ENV === "production" && !raw.startsWith("https://")) {
      throw new Error("FRIEND_ATTRIBUTION_LIFF_BASE_URL must be a valid HTTPS URL in production");
    }
    return raw.replace(/\/+$/, "");
  }

  const liffId = env.FRIEND_ATTRIBUTION_LIFF_ID?.trim() || env.NEXT_PUBLIC_FRIEND_ATTRIBUTION_LIFF_ID?.trim();
  if (liffId) {
    return `https://liff.line.me/${liffId}`;
  }

  return null;
}

export function getFriendAttributionLineLoginChannelId(env: NodeJS.ProcessEnv = process.env): string | null {
  const val = env.FRIEND_ATTRIBUTION_LINE_LOGIN_CHANNEL_ID?.trim();
  return val || null;
}

export function getFriendAttributionSessionTtlSeconds(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.FRIEND_ATTRIBUTION_SESSION_TTL_SECONDS?.trim();
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 86400; // 24 hours default
}

export function getFriendAttributionHashSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.FRIEND_ATTRIBUTION_HASH_SECRET?.trim() || env.FRIEND_SOURCE_IP_HASH_KEY?.trim();
  const pilotId = getFriendAttributionPilotLineOaId(env);
  if (!key && pilotId) {
    if (env.NODE_ENV === "production") {
      throw new Error("Missing required production environment variable: FRIEND_ATTRIBUTION_HASH_SECRET (or FRIEND_SOURCE_IP_HASH_KEY)");
    }
  }
  return key || null;
}

/**
 * Hashes an opaque session token using HMAC-SHA256.
 */
export function hashPublicSessionToken(token: string, secret?: string | null): string {
  const effectiveSecret = secret || "fallback_session_secret_for_dev";
  return createHmac("sha256", effectiveSecret).update(token.trim()).digest("hex");
}

/**
 * Hashes a verified LINE User ID using HMAC-SHA256.
 */
export function hashLineUserId(lineUserId: string, secret?: string | null): string {
  const effectiveSecret = secret || "fallback_line_user_secret_for_dev";
  return createHmac("sha256", effectiveSecret).update(lineUserId.trim()).digest("hex");
}
