import { NextRequest, NextResponse } from "next/server";
import {
  TIKTOK_OAUTH_STATE_COOKIE,
  getPublicAppUrl,
} from "../connect/tiktok-oauth";
import {
  exchangeTikTokAuthorizationCode,
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
 * to public success/error pages independently of any unrelated admin session cookie.
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

  // 3. Official review-ready scopes (user.info.basic, user.info.profile, user.info.stats)
  // Strictly omit video fetching and video.list permission
  const videos: TikTokVideoItem[] = [];

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

  // 5. Store association is decoupled from initial TikTok authorization.
  // The TikTok account is successfully authorized and stored with encrypted tokens.
  // StoreMaster association is maintained if already linked or resolved, but unassigned
  // accounts (e.g. sandbox reviewers) succeed and display their profile/stats safely.
  const isStoreBound = Boolean(syncedAccount.storeMasterId && syncedAccount.storeMaster);
  const storeName = syncedAccount.storeMaster?.storeName || "";

  // 6. Public store authorization always returns to the public success page.
  const successUrl = new URL("/connect/tiktok/success", publicOrigin);
  const response = createRedirectResponse(successUrl);

  const safeResultPayload = JSON.stringify({
    displayName: syncedAccount.displayName || userProfile.display_name || "",
    username: syncedAccount.username || userProfile.username || "",
    avatarUrl: syncedAccount.avatarUrl || userProfile.avatar_url || userProfile.avatar_url_100 || "",
    followerCount: syncedAccount.followerCount ?? userProfile.follower_count ?? 0,
    followingCount: syncedAccount.followingCount ?? userProfile.following_count ?? 0,
    likesCount: syncedAccount.likesCount ?? userProfile.likes_count ?? 0,
    videoCount: syncedAccount.videoCount ?? userProfile.video_count ?? 0,
    storeName,
    isStoreBound,
    bindingStatus: syncedAccount.bindingStatus || "STORE_NOT_FOUND",
    timestamp: Date.now(),
  });

  response.cookies.set("tiktok_connect_result", Buffer.from(safeResultPayload, "utf8").toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 120, // 2 minutes short-lived state
    path: "/",
  });

  return response;
}
