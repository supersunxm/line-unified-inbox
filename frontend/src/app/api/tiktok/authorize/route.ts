import { NextResponse } from "next/server";
import {
  DEFAULT_TIKTOK_REDIRECT_URI,
  TIKTOK_OAUTH_STATE_COOKIE,
  TIKTOK_STATE_COOKIE_OPTIONS,
  buildTikTokAuthUrl,
  generateOAuthState,
  getPublicAppUrl,
  isTikTokPublicConnectEnabled,
} from "../../../tiktok/connect/tiktok-oauth.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicOrigin = getPublicAppUrl();

  if (!isTikTokPublicConnectEnabled()) {
    const errorUrl = new URL("/tiktok/connect/error", publicOrigin);
    errorUrl.searchParams.set("reason", "integration_disabled");
    return NextResponse.redirect(errorUrl, 302);
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim() || DEFAULT_TIKTOK_REDIRECT_URI;

  if (!clientKey) {
    const connectUrl = new URL("/tiktok/connect", publicOrigin);
    connectUrl.searchParams.set("error", "missing_config");
    return NextResponse.redirect(connectUrl, 302);
  }

  const state = generateOAuthState();
  const authUrl = buildTikTokAuthUrl({
    clientKey,
    redirectUri,
    state,
  });

  const response = NextResponse.redirect(authUrl, 302);
  response.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, state, TIKTOK_STATE_COOKIE_OPTIONS);

  return response;
}

export async function POST() {
  return GET();
}
