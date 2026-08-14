import { API_BASE_URL } from "../../lib/runtime-config.ts";
import {
  DEFAULT_TIKTOK_REDIRECT_URI,
} from "./connect/tiktok-oauth.ts";
import type {
  TikTokHistoricalMetricsData,
  TikTokStoreData,
  TikTokTokenDiagnosticInfo,
  TikTokTokenResponse,
  TikTokUserProfile,
  TikTokVideoDiagnosticInfo,
  TikTokVideoItem,
} from "./tiktok-types.ts";

export const TIKTOK_TOKEN_ENDPOINT = "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_USER_INFO_ENDPOINT = "https://open.tiktokapis.com/v2/user/info/";
export const TIKTOK_VIDEO_LIST_ENDPOINT = "https://open.tiktokapis.com/v2/video/list/";
export const TIKTOK_VIDEO_QUERY_ENDPOINT = "https://open.tiktokapis.com/v2/video/query/";

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

export const TIKTOK_VIDEO_QUERY_FIELDS = TIKTOK_VIDEO_LIST_FIELDS;

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
 * Diagnostic logger for video retrieval, query, and metric enrichment.
 * Emits counts, metric completeness, and status - NEVER logs access tokens or secrets.
 */
export function logTikTokVideoDiagnostic(info: TikTokVideoDiagnosticInfo): void {
  const payload = {
    event: "tiktok_video_diagnostic",
    videoListCount: info.videoListCount,
    videoQueryCount: info.videoQueryCount,
    videosWithViewCount: info.videosWithViewCount,
    videosWithCoverImage: info.videosWithCoverImage,
    apiStatusCode: info.apiStatusCode ?? "ok",
    errorCode: info.errorCode ?? null,
  };

  if (info.errorCode) {
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
 * Safely parses a single raw video object from TikTok API response.
 * Preserves nullable/undefined metrics without premature coercion to zero.
 */
export function parseTikTokVideoItem(video: unknown): TikTokVideoItem | null {
  if (!video || typeof video !== "object") return null;
  const v = video as Record<string, unknown>;
  const id = String(v.id || "").trim();
  if (!id) return null;

  return {
    id,
    create_time: typeof v.create_time === "number" ? v.create_time : undefined,
    title: typeof v.title === "string" ? v.title : undefined,
    video_description: typeof v.video_description === "string" ? v.video_description : undefined,
    cover_image_url: typeof v.cover_image_url === "string" ? v.cover_image_url : undefined,
    share_url: typeof v.share_url === "string" ? v.share_url : undefined,
    duration: typeof v.duration === "number" ? v.duration : undefined,
    view_count: typeof v.view_count === "number" ? v.view_count : undefined,
    like_count: typeof v.like_count === "number" ? v.like_count : undefined,
    comment_count: typeof v.comment_count === "number" ? v.comment_count : undefined,
    share_count: typeof v.share_count === "number" ? v.share_count : undefined,
  };
}

/**
 * Merges video list items with detailed query items.
 * Query results take precedence for fresh cover_image_url and performance metrics.
 */
export function mergeTikTokVideoItems(
  listVideos: TikTokVideoItem[],
  queryVideos: TikTokVideoItem[]
): TikTokVideoItem[] {
  const queryMap = new Map<string, TikTokVideoItem>();
  for (const q of queryVideos) {
    if (q.id) queryMap.set(q.id, q);
  }

  return listVideos.map((lv) => {
    const qv = queryMap.get(lv.id);
    if (!qv) return lv;

    return {
      id: lv.id,
      create_time: qv.create_time ?? lv.create_time,
      title: qv.title ?? lv.title,
      video_description: qv.video_description ?? lv.video_description,
      // Fresh cover image from query endpoint takes precedence
      cover_image_url: qv.cover_image_url || lv.cover_image_url,
      share_url: qv.share_url || lv.share_url,
      duration: qv.duration ?? lv.duration,
      // Metrics from query endpoint take precedence if available
      view_count: qv.view_count ?? lv.view_count,
      like_count: qv.like_count ?? lv.like_count,
      comment_count: qv.comment_count ?? lv.comment_count,
      share_count: qv.share_count ?? lv.share_count,
    };
  });
}

/**
 * Fetches recent public videos for the authorized TikTok account via /v2/video/list/.
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

  return rawVideos
    .map(parseTikTokVideoItem)
    .filter((v): v is TikTokVideoItem => v !== null);
}

/**
 * Queries detailed performance metrics and fresh cover images for specific video IDs via /v2/video/query/.
 */
export async function queryTikTokVideoDetails(
  accessToken: string,
  videoIds: string[]
): Promise<TikTokVideoItem[]> {
  const validIds = videoIds.map((id) => String(id).trim()).filter(Boolean);
  if (validIds.length === 0) return [];

  const url = new URL(TIKTOK_VIDEO_QUERY_ENDPOINT);
  url.searchParams.set("fields", TIKTOK_VIDEO_QUERY_FIELDS);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      filters: {
        video_ids: validIds.slice(0, 20),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`TikTok Video Query request failed with status HTTP ${response.status}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  const data = json.data as Record<string, unknown> | undefined;
  const rawVideos = Array.isArray(data?.videos) ? (data?.videos as Array<Record<string, unknown>>) : [];

  return rawVideos
    .map(parseTikTokVideoItem)
    .filter((v): v is TikTokVideoItem => v !== null);
}

/**
 * Orchestrates full video sync: fetches list of recent videos, enriches via /video/query/,
 * refreshes cover_image_urls, and logs safe diagnostic telemetry.
 */
export async function fetchEnrichedTikTokVideoList(
  accessToken: string,
  maxCount = 20
): Promise<TikTokVideoItem[]> {
  let listVideos: TikTokVideoItem[] = [];
  try {
    listVideos = await fetchTikTokVideoList(accessToken, maxCount);
  } catch (err) {
    logTikTokVideoDiagnostic({
      videoListCount: 0,
      videoQueryCount: 0,
      videosWithViewCount: 0,
      videosWithCoverImage: 0,
      apiStatusCode: "list_error",
      errorCode: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const videoIds = listVideos.map((v) => v.id).filter(Boolean);
  let queryVideos: TikTokVideoItem[] = [];
  let queryError: string | undefined = undefined;

  if (videoIds.length > 0) {
    try {
      queryVideos = await queryTikTokVideoDetails(accessToken, videoIds);
    } catch (err) {
      queryError = err instanceof Error ? err.message : String(err);
    }
  }

  const finalVideos = queryVideos.length > 0
    ? mergeTikTokVideoItems(listVideos, queryVideos)
    : listVideos;

  const videosWithViewCount = finalVideos.filter((v) => typeof v.view_count === "number").length;
  const videosWithCoverImage = finalVideos.filter((v) => Boolean(v.cover_image_url)).length;

  logTikTokVideoDiagnostic({
    videoListCount: listVideos.length,
    videoQueryCount: queryVideos.length,
    videosWithViewCount,
    videosWithCoverImage,
    apiStatusCode: queryError ? "query_partial_error" : "ok",
    errorCode: queryError,
  });

  return finalVideos;
}

export interface SyncTikTokAccountParams {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
  grantedScopes?: string;
  profile: TikTokUserProfile;
  videos: TikTokVideoItem[];
  storeMasterId?: string;
  sessionToken?: string | null;
}

/**
 * Persists authorized TikTok account, tokens, profile, and videos to PostgreSQL database via backend API.
 * Forwards user session authentication as canonical Authorization: Bearer <sessionToken>.
 */
export async function syncTikTokAccountToBackend(params: SyncTikTokAccountParams): Promise<void> {
  const sessionToken = params.sessionToken?.trim() || null;
  const sessionTokenPresent = Boolean(sessionToken);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }

  const mappedVideos = (params.videos || []).map((v) => ({
    id: v.id,
    createTime: v.create_time,
    create_time: v.create_time,
    title: v.title,
    videoDescription: v.video_description,
    video_description: v.video_description,
    coverImageUrl: v.cover_image_url,
    cover_image_url: v.cover_image_url,
    shareUrl: v.share_url,
    share_url: v.share_url,
    duration: v.duration,
    viewCount: v.view_count,
    view_count: v.view_count,
    likeCount: v.like_count,
    like_count: v.like_count,
    commentCount: v.comment_count,
    comment_count: v.comment_count,
    shareCount: v.share_count,
    share_count: v.share_count,
  }));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/tiktok/sync`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        expiresIn: params.expiresIn,
        refreshExpiresIn: params.refreshExpiresIn,
        grantedScopes: params.grantedScopes,
        profile: params.profile,
        videos: mappedVideos,
        storeMasterId: params.storeMasterId,
      }),
    });
  } catch (netErr) {
    console.error("[TikTok Backend Sync Diagnostic]", {
      sessionTokenPresent,
      backendSyncStatus: "network_error",
    });
    throw netErr;
  }

  console.info("[TikTok Backend Sync Diagnostic]", {
    sessionTokenPresent,
    backendSyncStatus: response.status,
  });

  if (!response.ok) {
    throw new Error(`Failed to sync TikTok account to backend database (HTTP ${response.status})`);
  }
}

export interface FetchTikTokAccountOptions {
  sessionToken?: string | null;
}

function mapBackendAccountToStoreData(data: any): TikTokStoreData {
  return {
    id: data.id,
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
    updatedAt: data.lastSyncedAt || data.updatedAt,
    storeMasterId: data.storeMasterId || null,
    storeMaster: data.storeMaster || null,
  };
}

/**
 * Fetches a specific persisted TikTok account overview and video metrics by account ID.
 */
export async function fetchTikTokAccountByIdFromBackend(
  accountId: string,
  options?: FetchTikTokAccountOptions
): Promise<TikTokStoreData | null> {
  try {
    let sessionToken = options?.sessionToken?.trim() || null;

    if (!sessionToken) {
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        sessionToken = cookieStore.get("oppo_session")?.value?.trim() || null;
      } catch {
        // Fallback when executed outside Next.js request context
      }
    }

    if (!sessionToken) {
      return null;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${sessionToken}`,
    };

    const response = await fetch(`${API_BASE_URL}/tiktok/accounts/${encodeURIComponent(accountId)}`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data || !data.openId) {
      return null;
    }

    return mapBackendAccountToStoreData(data);
  } catch {
    return null;
  }
}

/**
 * Fetches the latest persisted TikTok account overview and video metrics from backend PostgreSQL.
 * Reads oppo_session from request context or options and forwards as Authorization: Bearer <sessionToken>.
 */
export async function fetchLatestTikTokAccountFromBackend(
  options?: FetchTikTokAccountOptions
): Promise<TikTokStoreData | null> {
  try {
    let sessionToken = options?.sessionToken?.trim() || null;

    // Auto-resolve oppo_session cookie from Next.js server context if not passed explicitly
    if (!sessionToken) {
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        sessionToken = cookieStore.get("oppo_session")?.value?.trim() || null;
      } catch {
        // Fallback when executed outside Next.js request context
      }
    }

    const sessionTokenPresent = Boolean(sessionToken);

    if (!sessionToken) {
      console.info("[TikTok Backend Read Diagnostic]", {
        sessionTokenPresent: false,
        backendReadStatus: "unauthenticated",
      });
      return null;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${sessionToken}`,
    };

    const response = await fetch(`${API_BASE_URL}/tiktok/latest`, {
      headers,
      cache: "no-store",
    });

    console.info("[TikTok Backend Read Diagnostic]", {
      sessionTokenPresent,
      backendReadStatus: response.status,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data || !data.openId) {
      return null;
    }

    return mapBackendAccountToStoreData(data);
  } catch {
    console.error("[TikTok Backend Read Diagnostic]", {
      backendReadStatus: "exception",
    });
    return null;
  }
}

/**
 * Fetches the list of all persisted TikTok accounts from backend PostgreSQL.
 */
export async function fetchTikTokAccountsListFromBackend(
  options?: FetchTikTokAccountOptions
): Promise<import("./tiktok-types").TikTokAccountListItem[]> {
  try {
    let sessionToken = options?.sessionToken?.trim() || null;

    if (!sessionToken) {
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        sessionToken = cookieStore.get("oppo_session")?.value?.trim() || null;
      } catch {
        // Fallback when executed outside Next.js request context
      }
    }

    if (!sessionToken) {
      return [];
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${sessionToken}`,
    };

    const response = await fetch(`${API_BASE_URL}/tiktok/accounts`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    return (await response.json()) || [];
  } catch {
    return [];
  }
}

/**
 * Fetches historical metrics and calculated growth summary for an account or the latest active account.
 */
export async function fetchTikTokHistoricalMetricsFromBackend(
  accountId?: string,
  days = 30,
  options?: FetchTikTokAccountOptions
): Promise<TikTokHistoricalMetricsData | null> {
  try {
    let sessionToken = options?.sessionToken?.trim() || null;

    if (!sessionToken) {
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        sessionToken = cookieStore.get("oppo_session")?.value?.trim() || null;
      } catch {
        // Fallback when executed outside Next.js request context
      }
    }

    if (!sessionToken) {
      return null;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${sessionToken}`,
    };

    const endpoint = accountId
      ? `${API_BASE_URL}/tiktok/accounts/${encodeURIComponent(accountId)}/metrics?days=${days}`
      : `${API_BASE_URL}/tiktok/latest/metrics?days=${days}`;

    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) || null;
  } catch {
    return null;
  }
}
