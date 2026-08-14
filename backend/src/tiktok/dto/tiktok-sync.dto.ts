export interface TikTokVideoDto {
  id: string;
  createTime?: number;
  create_time?: number;
  title?: string;
  videoDescription?: string;
  video_description?: string;
  coverImageUrl?: string;
  cover_image_url?: string;
  shareUrl?: string;
  share_url?: string;
  duration?: number;
  viewCount?: number;
  view_count?: number;
  likeCount?: number;
  like_count?: number;
  commentCount?: number;
  comment_count?: number;
  shareCount?: number;
  share_count?: number;
}

export interface TikTokProfileDto {
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

export interface SyncTikTokAccountDto {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
  grantedScopes?: string;
  profile: TikTokProfileDto;
  videos?: TikTokVideoDto[];
}

export interface SafeTikTokVideoResponse {
  id: string;
  tikTokVideoId: string;
  title?: string | null;
  videoDescription?: string | null;
  createTime?: string | null;
  coverImageUrl?: string | null;
  shareUrl?: string | null;
  duration?: number | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  lastSyncedAt: string;
}

export interface SafeTikTokAccountOverviewResponse {
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
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
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
  videos: SafeTikTokVideoResponse[];
}

export interface ReconcileStoreBindingsResponse {
  totalChecked: number;
  matchedCount: number;
  unmatchedCount: number;
  ambiguousCount: number;
  alreadyBoundCount: number;
  results: Array<{
    openId: string;
    username?: string | null;
    storeMasterId?: string | null;
    status: "MATCHED" | "STORE_NOT_FOUND" | "AMBIGUOUS_STORE_MATCH" | "PRESERVED_EXISTING" | "NO_USERNAME";
  }>;
}

export interface TikTokDailyMetricDto {
  id: string;
  metricDate: string; // ISO YYYY-MM-DD
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TikTokGrowthSummaryDto {
  currentFollowerCount: number;
  previousDayFollowerCount: number | null;
  dailyFollowerGrowth: number | null;
  sevenDayFollowerCount: number | null;
  sevenDayFollowerGrowth: number | null;
  thirtyDayFollowerCount: number | null;
  thirtyDayFollowerGrowth: number | null;
}

export interface TikTokHistoricalMetricsResponse {
  accountId: string;
  openId: string;
  displayName: string;
  username?: string | null;
  summary: TikTokGrowthSummaryDto;
  history: TikTokDailyMetricDto[];
}
