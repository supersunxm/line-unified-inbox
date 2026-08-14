import crypto from "node:crypto";

export const TIKTOK_AUTH_BASE_URL = "https://www.tiktok.com/v2/auth/authorize/";

export const TIKTOK_OAUTH_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
  "video.list",
] as const;

export const DEFAULT_PUBLIC_APP_URL = "https://lineoppo.click";
export const DEFAULT_TIKTOK_REDIRECT_URI = "https://lineoppo.click/tiktok/callback";
export const TIKTOK_OAUTH_STATE_COOKIE = "tiktok_oauth_state";

export function getPublicAppUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl && !envUrl.includes("0.0.0.0") && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/+$/, "");
  }
  return DEFAULT_PUBLIC_APP_URL;
}

export const TIKTOK_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600, // 10 minutes
  path: "/",
};

export interface TikTokAuthConfig {
  clientKey: string;
  redirectUri?: string;
  state: string;
}

export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function buildTikTokAuthUrl(config: TikTokAuthConfig): string {
  if (!config.clientKey) {
    throw new Error("Missing required TikTok Client Key");
  }

  const redirectUri = config.redirectUri || DEFAULT_TIKTOK_REDIRECT_URI;
  const scopeString = TIKTOK_OAUTH_SCOPES.join(",");

  const url = new URL(TIKTOK_AUTH_BASE_URL);
  url.searchParams.set("client_key", config.clientKey.trim());
  url.searchParams.set("scope", scopeString);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri.trim());
  url.searchParams.set("state", config.state.trim());

  return url.toString();
}
