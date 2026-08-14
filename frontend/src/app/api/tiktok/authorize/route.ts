import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_TIKTOK_REDIRECT_URI,
  TIKTOK_OAUTH_STATE_COOKIE,
  TIKTOK_STATE_COOKIE_OPTIONS,
  buildTikTokAuthUrl,
  generateOAuthState,
} from "../../../tiktok/connect/tiktok-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || DEFAULT_TIKTOK_REDIRECT_URI;

  if (!clientKey) {
    const connectUrl = new URL("/tiktok/connect", request.url);
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

export async function POST(request: NextRequest) {
  return GET(request);
}
