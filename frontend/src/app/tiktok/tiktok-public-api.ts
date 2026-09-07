import { API_BASE_URL } from "../../lib/runtime-config";

export type TikTokPublicGrowthValue = {
  absolute: number | null;
  percent: number | null;
};

export type TikTokPublicDashboardStore = {
  storeMasterId: string;
  storeName: string;
  accountName: string;
  province: string | null;
  region: string | null;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bioDescription: string | null;
  isVerified: boolean | null;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
  profileUrl: string;
  lastFetchedAt: string;
  growth: {
    daily: TikTokPublicGrowthValue;
    sevenDay: TikTokPublicGrowthValue;
    thirtyDay: TikTokPublicGrowthValue;
  };
};

export type TikTokPublicDashboardOverview = {
  trackedStores: number;
  totalFollowers: number;
  totalLikes: number;
  totalVideos: number;
  lastUpdatedAt: string | null;
};

export type TikTokPublicHistoryPoint = {
  metricDate: string;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
  fetchedAt: string;
};

type FetchOptions = { sessionToken: string };

async function fetchBackend<T>(path: string, options: FetchOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Cookie: `oppo_session=${encodeURIComponent(options.sessionToken)}`,
    },
    cache: "no-store",
  });

  if (response.status === 401) throw new Error("UNAUTHORIZED");
  if (response.status === 404) throw new Error("NOT_FOUND");
  if (!response.ok) {
    throw new Error(`TikTok public analytics request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function fetchTikTokPublicOverview(options: FetchOptions) {
  return fetchBackend<TikTokPublicDashboardOverview>("/tiktok/public/overview", options);
}

export function fetchTikTokPublicStores(options: FetchOptions) {
  return fetchBackend<TikTokPublicDashboardStore[]>("/tiktok/public/stores", options);
}

export function fetchTikTokPublicStore(storeMasterId: string, options: FetchOptions) {
  return fetchBackend<TikTokPublicDashboardStore | null>(
    `/tiktok/public/stores/${encodeURIComponent(storeMasterId)}`,
    options,
  );
}

export function fetchTikTokPublicHistory(storeMasterId: string, days: number, options: FetchOptions) {
  return fetchBackend<TikTokPublicHistoryPoint[]>(
    `/tiktok/public/stores/${encodeURIComponent(storeMasterId)}/history?days=${days}`,
    options,
  );
}
