import { NextRequest, NextResponse } from "next/server";
import {
  TIKTOK_OAUTH_STATE_COOKIE,
  getPublicAppUrl,
} from "../connect/tiktok-oauth";
import {
  exchangeTikTokAuthorizationCode,
  fetchEnrichedTikTokVideoList,
  fetchTikTokUserProfile,
  syncTikTokAccountInternallyToBackend,
} from "../tiktok-api-client";
import type {
  SafeTikTokSyncedAccountResponse,
  TikTokTokenResponse,
  TikTokUserProfile,
  TikTokVideoItem,
} from "../tiktok-types";
import {
  logTikTokCallbackDiagnostic,
  processTikTokCallbackParams,
  timingSafeStringEqual,
} from "./tiktok-callback-validator";

export const dynamic = "force-dynamic";

/**
 * Public OAuth callback route handler.
 * Consumes and validates HttpOnly OAuth state cookie, exchanges authorization code,
 * fetches profile/video data, binds StoreMaster via normalized username, and routes
 * to either public success/error pages or admin dashboard if authenticated.
 */
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

  // If user denied access or TikTok returned an OAuth authorization error
  if (error || validationResult.status === "ERROR") {
    const isDenied =
      error?.toLowerCase().includes("denied") ||
      error?.toLowerCase().includes("access_denied") ||
      errorDescription?.toLowerCase().includes("denied") ||
      errorDescription?.toLowerCase().includes("cancel");

    const errorUrl = new URL("/tiktok/connect/error", publicOrigin);
    errorUrl.searchParams.set("reason", isDenied ? "authorization_denied" : "oauth_failed");
    return createRedirectResponse(errorUrl);
  }

  // If state validation failed, expired, or code is missing
  if (validationResult.status !== "SUCCESS" || !code) {
    const errorUrl = new URL("/tiktok/connect/error", publicOrigin);
    errorUrl.searchParams.set("reason", "invalid_state");
    return createRedirectResponse(errorUrl);
  }

  // 1. Exchange authorization code for tokens (server-side only)
  let tokenResponse: TikTokTokenResponse;
  try {
    tokenResponse = await exchangeTikTokAuthorizationCode(code);
  } catch {
    const errorUrl = new URL("/tiktok/connect/error", publicOrigin);
    errorUrl.searchParams.set("reason", "oauth_failed");
    return createRedirectResponse(errorUrl);
  }

  // 2. Fetch TikTok user profile & statistics
  let userProfile: TikTokUserProfile;
  try {
    userProfile = await fetchTikTokUserProfile(tokenResponse.accessToken);
  } catch {
    const errorUrl = new URL("/tiktok/connect/error", publicOrigin);
    errorUrl.searchParams.set("reason", "oauth_failed");
    return createRedirectResponse(errorUrl);
  }

  // 3. Fetch recent public videos with enriched metrics and fresh cover URLs
  let videos: TikTokVideoItem[] = [];
  try {
    videos = await fetchEnrichedTikTokVideoList(tokenResponse.accessToken, 20);
  } catch {
    videos = [];
  }

  // 4. Save retrieved account data into PostgreSQL backend store via internal service-to-service API
  let syncedAccount: SafeTikTokSyncedAccountResponse;
  try {
    syncedAccount = await syncTikTokAccountInternallyToBackend({
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      expiresIn: tokenResponse.expiresIn,
      refreshExpiresIn: tokenResponse.refreshExpiresIn,
      grantedScopes: tokenResponse.scope,
      profile: userProfile,
      videos,
    });
  } catch (syncErr) {
    console.error("Failed to sync TikTok account via internal backend API", syncErr);
    const errorUrl = new URL("/tiktok/connect/error", publicOrigin);
    errorUrl.searchParams.set("reason", "oauth_failed");
    return createRedirectResponse(errorUrl);
  }

  // 5. StoreMaster matching validation
  if (syncedAccount.bindingStatus === "AMBIGUOUS_STORE_MATCH") {
    const errorUrl = new URL("/tiktok/connect/error", publicOrigin);
    errorUrl.searchParams.set("reason", "duplicate_store_mapping");
    return createRedirectResponse(errorUrl);
  }

  if (
    !syncedAccount.storeMasterId ||
    !syncedAccount.storeMaster ||
    syncedAccount.bindingStatus === "STORE_NOT_FOUND" ||
    syncedAccount.bindingStatus === "NO_USERNAME"
  ) {
    const errorUrl = new URL("/tiktok/connect/error", publicOrigin);
    errorUrl.searchParams.set("reason", "store_not_found");
    return createRedirectResponse(errorUrl);
  }

  // 6. Successful authorization routing
  if (requestHasOppoSession) {
    // Authenticated admin user: redirect back to admin dashboard
    const adminDestination = syncedAccount.id
      ? new URL(`/tiktok/dashboard/${encodeURIComponent(syncedAccount.id)}`, publicOrigin)
      : new URL("/tiktok", publicOrigin);
    return createRedirectResponse(adminDestination);
  }

  // Public retail store staff: redirect to public success page with safe short-lived cookie state
  const successUrl = new URL("/tiktok/connect/success", publicOrigin);
  const response = createRedirectResponse(successUrl);

  const safeResultPayload = JSON.stringify({
    displayName: syncedAccount.displayName || "",
    username: syncedAccount.username || "",
    storeName: syncedAccount.storeMaster?.storeName || "",
    timestamp: Date.now(),
  });

  response.cookies.set("tiktok_connect_result", Buffer.from(safeResultPayload, "utf8").toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60, // 60 seconds short-lived state
    path: "/tiktok/connect/success",
  });

  return response;
}
