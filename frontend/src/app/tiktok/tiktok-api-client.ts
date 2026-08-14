import { API_BASE_URL } from "../../lib/runtime-config.ts";
import {
  DEFAULT_TIKTOK_REDIRECT_URI,
} from "./connect/tiktok-oauth.ts";
import type {
  TikTokStoreData,
  TikTokTokenDiagnosticInfo,
  TikTokTokenResponse,
  TikTokUserProfile,
  TikTokVideoItem,
} from "./tiktok-types.ts";

export const TIKTOK_TOKEN_ENDPOINT = "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_USER_INFO_ENDPOINT = "https://open.tiktokapis.com/v2/user/info/";
export const TIKTOK_VIDEO_LIST_ENDPOINT = "https://open.tiktokapis.com/v2/video/list/";

export const TIKTOK_USER_INFO_FIELDS = [
  "open_id",
  "union_id",
  "avatar_url",
  "avatar_url_100",
  "avatar_large_url",
  "display_name",
  "username",
  "bio_description",
  "profile_deep_link",
  "is_verified",
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
].join(",");

export const TIKTOK_VIDEO_LIST_FIELDS = [
  "id",
  "create_time",
  "cover_image_url",
  "share_url",
  "video_description",
  "duration",
  "title",
  "like_count",
  "comment_count",
  "share_count",
  "view_count",
].join(",");

/**
 * Diagnostic logger for token exchange results.
 * Emits strictly boolean sanity flags and counts - NEVER logs sensitive credentials, tokens, or codes.
 */
export function logTikTokTokenDiagnostic(diagnostic: TikTokTokenDiagnosticInfo): void {
  const payload = {
    event: "tiktok_token_diagnostic",
    tokenExchangeSucceeded: diagnostic.tokenExchangeSucceeded,
    accessTokenPresent: diagnostic.accessTokenPresent,
    refreshTokenPresent: diagnostic.refreshTokenPresent,
    openIdPresent: diagnostic.openIdPresent,
    grantedScopeCount: diagnostic.grantedScopeCount,
    expiresIn: diagnostic.expiresIn ?? null,
  };

  if (!diagnostic.tokenExchangeSucceeded) {
    console.warn(JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }
}

/**
 * Parses raw JSON token response from TikTok v2 token endpoint.
 * Supports standard flat payload as well as nested data envelope.
 */
export function parseTikTokTokenResponse(raw: unknown): TikTokTokenResponse {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid token response: payload is not an object");
  }

  const root = raw as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  const accessToken = typeof data.access_token === "string" ? data.access_token : "";
  const openId = typeof data.open_id === "string" ? data.open_id : "";
  const refreshToken = typeof data.refresh_token === "string" ? data.refresh_token : undefined;
  const scope = typeof data.scope === "string" ? data.scope : undefined;
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : undefined;
  const refreshExpiresIn =
    typeof data.refresh_expires_in === "number" ? data.refresh_expires_in : undefined;
  const tokenType = typeof data.token_type === "string" ? data.token_type : undefined;

  if (!accessToken || !openId) {
    const errorMsg =
      typeof root.error_description === "string"
        ? root.error_description
        : typeof root.error === "string"
        ? root.error
        : "Missing access_token or open_id in token response";
    throw new Error(`TikTok token exchange failed: ${errorMsg}`);
  }

  return {
    accessToken,
    refreshToken,
    openId,
    scope,
    expiresIn,
    refreshExpiresIn,
    tokenType,
  };
}

/**
 * Exchanges authorization code for access and refresh tokens.
 * Executes strictly server-side.
 */
export async function exchangeTikTokAuthorizationCode(
  code: string,
  redirectUri?: string
): Promise<TikTokTokenResponse> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  const effectiveRedirectUri = redirectUri || process.env.TIKTOK_REDIRECT_URI || DEFAULT_TIKTOK_REDIRECT_URI;

  if (!clientKey || !clientSecret) {
    throw new Error("TikTok client credentials not configured in environment");
  }

  const bodyParams = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code: code.trim(),
    grant_type: "authorization_code",
    redirect_uri: effectiveRedirectUri.trim(),
  });

  const response = await fetch(TIKTOK_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: bodyParams.toString(),
  });

  let rawJson: unknown = null;
  try {
    rawJson = await response.json();
  } catch {
    logTikTokTokenDiagnostic({
      tokenExchangeSucceeded: false,
      accessTokenPresent: false,
      refreshTokenPresent: false,
      openIdPresent: false,
      grantedScopeCount: 0,
    });
    throw new Error(`Failed to parse TikTok token endpoint response (HTTP ${response.status})`);
  }

  try {
    const parsed = parseTikTokTokenResponse(rawJson);
    const scopeCount = parsed.scope ? parsed.scope.split(",").filter(Boolean).length : 0;

    logTikTokTokenDiagnostic({
      tokenExchangeSucceeded: true,
      accessTokenPresent: Boolean(parsed.accessToken),
      refreshTokenPresent: Boolean(parsed.refreshToken),
      openIdPresent: Boolean(parsed.openId),
      grantedScopeCount: scopeCount,
      expiresIn: parsed.expiresIn,
    });

    return parsed;
  } catch (err) {
    logTikTokTokenDiagnostic({
      tokenExchangeSucceeded: false,
      accessTokenPresent: false,
      refreshTokenPresent: false,
      openIdPresent: false,
      grantedScopeCount: 0,
    });
    throw err;
  }
}

/**
 * Fetches user profile and account statistics via TikTok API v2 User Info endpoint.
 */
export async function fetchTikTokUserProfile(accessToken: string): Promise<TikTokUserProfile> {
  const url = new URL(TIKTOK_USER_INFO_ENDPOINT);
  url.searchParams.set("fields", TIKTOK_USER_INFO_FIELDS);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`TikTok User Info request failed with status HTTP ${response.status}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  const data = json.data as Record<string, unknown> | undefined;
  const user = (data?.user || {}) as Record<string, unknown>;

  const openId = typeof user.open_id === "string" ? user.open_id : "";
  if (!openId) {
    throw new Error("Invalid TikTok user info response: missing open_id");
  }

  return {
    open_id: openId,
    union_id: typeof user.union_id === "string" ? user.union_id : undefined,
    avatar_url: typeof user.avatar_url === "string" ? user.avatar_url : undefined,
    avatar_url_100: typeof user.avatar_url_100 === "string" ? user.avatar_url_100 : undefined,
    avatar_large_url: typeof user.avatar_large_url === "string" ? user.avatar_large_url : undefined,
    display_name: typeof user.display_name === "string" ? user.display_name : undefined,
    username: typeof user.username === "string" ? user.username : undefined,
    bio_description: typeof user.bio_description === "string" ? user.bio_description : undefined,
    profile_deep_link: typeof user.profile_deep_link === "string" ? user.profile_deep_link : undefined,
    profile_web_link: typeof user.profile_web_link === "string" ? user.profile_web_link : undefined,
    is_verified: typeof user.is_verified === "boolean" ? user.is_verified : undefined,
    follower_count: typeof user.follower_count === "number" ? user.follower_count : undefined,
    following_count: typeof user.following_count === "number" ? user.following_count : undefined,
    likes_count: typeof user.likes_count === "number" ? user.likes_count : undefined,
    video_count: typeof user.video_count === "number" ? user.video_count : undefined,
  };
}

/**
 * Fetches recent public videos for the authorized TikTok account.
 */
export async function fetchTikTokVideoList(
  accessToken: string,
  maxCount = 20
): Promise<TikTokVideoItem[]> {
  const url = new URL(TIKTOK_VIDEO_LIST_ENDPOINT);
  url.searchParams.set("fields", TIKTOK_VIDEO_LIST_FIELDS);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      max_count: Math.min(Math.max(1, maxCount), 20),
    }),
  });

  if (!response.ok) {
    throw new Error(`TikTok Video List request failed with status HTTP ${response.status}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  const data = json.data as Record<string, unknown> | undefined;
  const rawVideos = Array.isArray(data?.videos) ? (data?.videos as Array<Record<string, unknown>>) : [];

  return rawVideos.map((video) => ({
    id: String(video.id || ""),
    create_time: typeof video.create_time === "number" ? video.create_time : undefined,
    title: typeof video.title === "string" ? video.title : undefined,
    video_description: typeof video.video_description === "string" ? video.video_description : undefined,
    cover_image_url: typeof video.cover_image_url === "string" ? video.cover_image_url : undefined,
    share_url: typeof video.share_url === "string" ? video.share_url : undefined,
    duration: typeof video.duration === "number" ? video.duration : undefined,
    view_count: typeof video.view_count === "number" ? video.view_count : undefined,
    like_count: typeof video.like_count === "number" ? video.like_count : undefined,
    comment_count: typeof video.comment_count === "number" ? video.comment_count : undefined,
    share_count: typeof video.share_count === "number" ? video.share_count : undefined,
  }));
}

/**
 * Persists authorized TikTok account, tokens, profile, and videos to PostgreSQL database via backend API.
 */
export async function syncTikTokAccountToBackend(params: {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
  grantedScopes?: string;
  profile: TikTokUserProfile;
  videos: TikTokVideoItem[];
  storeMasterId?: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tiktok/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync TikTok account to backend database (HTTP ${response.status})`);
  }
}

/**
 * Fetches the latest persisted TikTok account overview and video metrics from backend PostgreSQL.
 */
export async function fetchLatestTikTokAccountFromBackend(): Promise<TikTokStoreData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/tiktok/latest`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data || !data.openId) {
      return null;
    }

    return {
      profile: {
        open_id: data.openId,
        union_id: data.unionId || undefined,
        username: data.username || undefined,
        display_name: data.displayName,
        avatar_url: data.avatarUrl || undefined,
        avatar_url_100: data.avatarUrl100 || undefined,
        avatar_large_url: data.avatarLargeUrl || undefined,
        bio_description: data.bioDescription || undefined,
        profile_deep_link: data.profileDeepLink || undefined,
        profile_web_link: data.profileWebLink || undefined,
        is_verified: data.isVerified,
        follower_count: data.followerCount,
        following_count: data.followingCount,
        likes_count: data.likesCount,
        video_count: data.videoCount,
      },
      videos: (data.videos || []).map((v: any) => ({
        id: v.tikTokVideoId,
        title: v.title || undefined,
        video_description: v.videoDescription || undefined,
        create_time: v.createTime ? Math.floor(new Date(v.createTime).getTime() / 1000) : undefined,
        cover_image_url: v.coverImageUrl || undefined,
        share_url: v.shareUrl || undefined,
        duration: v.duration ?? undefined,
        view_count: v.viewCount ?? 0,
        like_count: v.likeCount ?? 0,
        comment_count: v.commentCount ?? 0,
        share_count: v.shareCount ?? 0,
      })),
      updatedAt: data.lastSyncedAt,
      storeMasterId: data.storeMasterId || null,
      storeMaster: data.storeMaster || null,
    };
  } catch {
    return null;
  }
}

