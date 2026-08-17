import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_TIKTOK_REDIRECT_URI,
  TIKTOK_OAUTH_STATE_COOKIE,
  TIKTOK_STATE_COOKIE_OPTIONS,
  buildTikTokAuthUrl,
  generateOAuthState,
  getPublicAppUrl,
} from "./tiktok-oauth";

export const dynamic = "force-dynamic";

/**
 * Public entry route for TikTok retail store authorization.
 * Generates a secure OAuth state, stores in HttpOnly cookie, and immediately 302 redirects to TikTok OAuth.
 * Accessible publicly by store staff without requiring prior login.
 */
export async function GET(request: NextRequest) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim() || DEFAULT_TIKTOK_REDIRECT_URI;
  const publicOrigin = getPublicAppUrl();

  if (!clientKey) {
    const errorUrl = new URL("/tiktok/connect/error", publicOrigin);
    errorUrl.searchParams.set("reason", "oauth_failed");
    return NextResponse.redirect(errorUrl, 302);
  }

  const state = generateOAuthState();
  let authUrl: string;
  try {
    authUrl = buildTikTokAuthUrl({
      clientKey,
      redirectUri,
      state,
    });
  } catch {
    const errorUrl = new URL("/tiktok/connect/error", publicOrigin);
    errorUrl.searchParams.set("reason", "oauth_failed");
    return NextResponse.redirect(errorUrl, 302);
  }

  const response = NextResponse.redirect(authUrl, 302);
  response.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, state, TIKTOK_STATE_COOKIE_OPTIONS);

  return response;
}
