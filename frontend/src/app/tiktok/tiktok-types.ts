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

export interface TikTokStoreData {
  profile: TikTokUserProfile;
  videos: TikTokVideoItem[];
  updatedAt: string;
}

export interface TikTokTokenDiagnosticInfo {
  tokenExchangeSucceeded: boolean;
  accessTokenPresent: boolean;
  refreshTokenPresent: boolean;
  openIdPresent: boolean;
  grantedScopeCount: number;
  expiresIn?: number;
}
