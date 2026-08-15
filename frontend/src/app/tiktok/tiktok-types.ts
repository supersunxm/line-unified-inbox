export interface TikTokTokenResponse {
  accessToken: string;
  refreshToken?: string;
  openId: string;
  scope?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
  tokenType?: string;
}

export interface TikTokUserProfile {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  avatar_url_100?: string;
  avatar_large_url?: string;
  display_name?: string;
  username?: string;
  bio_description?: string;
  profile_deep_link?: string;
  profile_web_link?: string;
  is_verified?: boolean;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
}

export interface TikTokVideoItem {
  id: string;
  create_time?: number;
  title?: string;
  video_description?: string;
  cover_image_url?: string;
  share_url?: string;
  duration?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
}

export interface TikTokAccountListItem {
  id: string;
  openId: string;
  unionId?: string | null;
  username?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  avatarUrl100?: string | null;
  avatarLargeUrl?: string | null;
  bioDescription?: string | null;
  profileDeepLink?: string | null;
  profileWebLink?: string | null;
  isVerified?: boolean;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
  videoCountRecorded: number;
  connectionStatus: string;
  connectedAt: string;
  lastSyncedAt: string;
  storeMasterId?: string | null;
  storeMaster?: {
    id: string;
    storeName: string;
    accountName: string;
    province?: string | null;
    region?: string | null;
  } | null;
}

export interface TikTokStoreData {
  id?: string;
  profile: TikTokUserProfile;
  videos: TikTokVideoItem[];
  updatedAt: string;
  storeMasterId?: string | null;
  storeMaster?: {
    id: string;
    storeName: string;
    accountName: string;
    province?: string | null;
    region?: string | null;
  } | null;
}

export interface TikTokTokenDiagnosticInfo {
  tokenExchangeSucceeded: boolean;
  accessTokenPresent: boolean;
  refreshTokenPresent: boolean;
  openIdPresent: boolean;
  grantedScopeCount: number;
  expiresIn?: number;
}

export interface TikTokVideoDiagnosticInfo {
  videoListCount: number;
  videoQueryCount: number;
  videosWithViewCount: number;
  videosWithCoverImage: number;
  apiStatusCode?: number | string;
  errorCode?: string | null;
}

export interface TikTokDailyMetricItem {
  id: string;
  metricDate: string; // ISO YYYY-MM-DD
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TikTokGrowthSummary {
  currentFollowerCount: number;
  previousDayFollowerCount: number | null;
  dailyFollowerGrowth: number | null;
  sevenDayFollowerCount: number | null;
  sevenDayFollowerGrowth: number | null;
  thirtyDayFollowerCount: number | null;
  thirtyDayFollowerGrowth: number | null;
}

export interface TikTokHistoricalMetricsData {
  accountId: string;
  openId: string;
  displayName: string;
  username?: string | null;
  summary: TikTokGrowthSummary;
  history: TikTokDailyMetricItem[];
}

export type TikTokGrowthPeriod = "today" | "sevenDays" | "thirtyDays";

export interface TikTokAccountMetricsGrowthSummary {
  followers: number | null;
  following: number | null;
  likes: number | null;
  videos: number | null;
}

export interface TikTokAccountBulkMetricSummaryItem {
  accountId: string;
  current: {
    followerCount: number;
    followingCount: number;
    likesCount: number;
    videoCount: number;
  };
  growth: {
    today: TikTokAccountMetricsGrowthSummary;
    sevenDays: TikTokAccountMetricsGrowthSummary;
    thirtyDays: TikTokAccountMetricsGrowthSummary;
  };
}

export interface TikTokBulkMetricsSummaryResponse {
  accounts: TikTokAccountBulkMetricSummaryItem[];
}

