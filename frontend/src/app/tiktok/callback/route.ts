import { NextRequest, NextResponse } from "next/server";
import {
  TIKTOK_OAUTH_STATE_COOKIE,
  getPublicAppUrl,
} from "../connect/tiktok-oauth.ts";
import {
  exchangeTikTokAuthorizationCode,
  fetchEnrichedTikTokVideoList,
  fetchTikTokUserProfile,
  syncTikTokAccountToBackend,
} from "../tiktok-api-client.ts";
import type {
  TikTokTokenResponse,
  TikTokUserProfile,
  TikTokVideoItem,
} from "../tiktok-types.ts";
import {
  logTikTokCallbackDiagnostic,
  processTikTokCallbackParams,
  timingSafeStringEqual,
} from "./tiktok-callback-validator.ts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const cookieState = request.cookies.get(TIKTOK_OAUTH_STATE_COOKIE)?.value || null;

  // Safe server-side diagnostics (booleans/metadata only, never sensitive values)
  const callbackStatePresent = Boolean(state);
  const stateCookiePresent = Boolean(cookieState);
  const stateLengthsMatch = Boolean(
    state && cookieState && state.length === cookieState.length
  );
  const stateMatched = Boolean(
    state && cookieState && timingSafeStringEqual(state, cookieState)
  );

  const sessionToken = request.cookies.get("oppo_session")?.value?.trim() || null;
  const requestHasOppoSession = Boolean(sessionToken);

  logTikTokCallbackDiagnostic({
    callbackStatePresent,
    stateCookiePresent,
    stateLengthsMatch,
    stateMatched,
    hasCode: Boolean(code),
    hasError: Boolean(error),
    requestHasOppoSession,
  });

  const validationResult = processTikTokCallbackParams({
    code,
    state,
    error,
    errorDescription,
    cookieState,
  });

  const publicOrigin = getPublicAppUrl();

  // Helper to create redirect response with atomic cookie consumption
  const createRedirectResponse = (destinationUrl: URL): NextResponse => {
    const response = NextResponse.redirect(destinationUrl, 302);
    response.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return response;
  };

  // If state validation failed or error was returned by TikTok
  if (validationResult.status !== "SUCCESS" || !code) {
    const resultUrl = new URL("/tiktok/callback/result", publicOrigin);
    if (validationResult.status === "STATE_MISMATCH") {
      resultUrl.searchParams.set("status", "state_mismatch");
    } else if (validationResult.status === "ERROR") {
      resultUrl.searchParams.set("status", "error");
      if ("errorMessage" in validationResult && validationResult.errorMessage) {
        resultUrl.searchParams.set("error_message", validationResult.errorMessage);
      }
    } else {
      resultUrl.searchParams.set("status", "invalid");
    }
    return createRedirectResponse(resultUrl);
  }

  // 1. Exchange authorization code for tokens
  let tokenResponse: TikTokTokenResponse;
  try {
    tokenResponse = await exchangeTikTokAuthorizationCode(code);
  } catch {
    const resultUrl = new URL("/tiktok/callback/result", publicOrigin);
    resultUrl.searchParams.set("status", "token_error");
    return createRedirectResponse(resultUrl);
  }

  // 2. Fetch TikTok user profile & statistics
  let userProfile: TikTokUserProfile;
  try {
    userProfile = await fetchTikTokUserProfile(tokenResponse.accessToken);
  } catch {
    const resultUrl = new URL("/tiktok/callback/result", publicOrigin);
    resultUrl.searchParams.set("status", "profile_error");
    return createRedirectResponse(resultUrl);
  }

  // 3. Fetch recent public videos with enriched metrics and fresh cover URLs
  let videos: TikTokVideoItem[] = [];
  try {
    videos = await fetchEnrichedTikTokVideoList(tokenResponse.accessToken, 20);
  } catch {
    videos = [];
  }

  // 4. Save retrieved account data into PostgreSQL backend store (tokens encrypted at rest)
  if (!sessionToken) {
    const loginUrl = new URL("/login", publicOrigin);
    return createRedirectResponse(loginUrl);
  }

  try {
    await syncTikTokAccountToBackend({
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      expiresIn: tokenResponse.expiresIn,
      refreshExpiresIn: tokenResponse.refreshExpiresIn,
      grantedScopes: tokenResponse.scope,
      profile: userProfile,
      videos,
      sessionToken,
    });
  } catch (syncErr) {
    console.error("Failed to sync TikTok account to backend database", syncErr);
  }

  // 5. Redirect user to account dashboard at /tiktok
  const tiktokDashboardUrl = new URL("/tiktok", publicOrigin);
  return createRedirectResponse(tiktokDashboardUrl);
}
