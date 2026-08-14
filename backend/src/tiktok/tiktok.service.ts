import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import {
  SafeTikTokAccountOverviewResponse,
  SafeTikTokVideoResponse,
  SyncTikTokAccountDto,
} from "./dto/tiktok-sync.dto";

@Injectable()
export class TikTokService {
  private readonly logger = new Logger(TikTokService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
  ) {}

  /**
   * Upserts authorized TikTok account and its video analytics.
   * Encrypts access and refresh tokens at rest with AES-256-GCM before database write.
   */
  async upsertTikTokAccount(dto: SyncTikTokAccountDto): Promise<SafeTikTokAccountOverviewResponse> {
    const { profile, videos = [] } = dto;
    const now = new Date();

    let encryptedAccessToken: string | undefined = undefined;
    if (dto.accessToken) {
      try {
        encryptedAccessToken = this.encryption.encrypt(dto.accessToken.trim());
      } catch (err) {
        this.logger.error("Failed to encrypt TikTok access token", err);
      }
    }

    let encryptedRefreshToken: string | undefined = undefined;
    if (dto.refreshToken) {
      try {
        encryptedRefreshToken = this.encryption.encrypt(dto.refreshToken.trim());
      } catch (err) {
        this.logger.error("Failed to encrypt TikTok refresh token", err);
      }
    }

    const accessTokenExpiresAt = dto.expiresIn
      ? new Date(now.getTime() + dto.expiresIn * 1000)
      : undefined;

    const refreshTokenExpiresAt = dto.refreshExpiresIn
      ? new Date(now.getTime() + dto.refreshExpiresIn * 1000)
      : undefined;

    // 1. Upsert TikTok Account record by unique openId
    const account = await this.prisma.tikTokAccount.upsert({
      where: { openId: profile.open_id },
      create: {
        openId: profile.open_id,
        unionId: profile.union_id,
        username: profile.username,
        displayName: profile.display_name || "TikTok Store Account",
        avatarUrl: profile.avatar_url,
        avatarUrl100: profile.avatar_url_100,
        avatarLargeUrl: profile.avatar_large_url,
        bioDescription: profile.bio_description,
        profileDeepLink: profile.profile_deep_link,
        profileWebLink: profile.profile_web_link,
        isVerified: Boolean(profile.is_verified),
        followerCount: profile.follower_count ?? 0,
        followingCount: profile.following_count ?? 0,
        likesCount: profile.likes_count ?? 0,
        videoCount: profile.video_count ?? 0,
        grantedScopes: dto.grantedScopes,
        encryptedAccessToken,
        encryptedRefreshToken,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        connectionStatus: "CONNECTED",
        connectedAt: now,
        lastSyncedAt: now,
        storeMasterId: dto.storeMasterId,
      },
      update: {
        unionId: profile.union_id,
        username: profile.username,
        displayName: profile.display_name || undefined,
        avatarUrl: profile.avatar_url,
        avatarUrl100: profile.avatar_url_100,
        avatarLargeUrl: profile.avatar_large_url,
        bioDescription: profile.bio_description,
        profileDeepLink: profile.profile_deep_link,
        profileWebLink: profile.profile_web_link,
        isVerified: profile.is_verified !== undefined ? Boolean(profile.is_verified) : undefined,
        followerCount: profile.follower_count ?? undefined,
        followingCount: profile.following_count ?? undefined,
        likesCount: profile.likes_count ?? undefined,
        videoCount: profile.video_count ?? undefined,
        grantedScopes: dto.grantedScopes ?? undefined,
        encryptedAccessToken: encryptedAccessToken ?? undefined,
        encryptedRefreshToken: encryptedRefreshToken ?? undefined,
        accessTokenExpiresAt: accessTokenExpiresAt ?? undefined,
        refreshTokenExpiresAt: refreshTokenExpiresAt ?? undefined,
        connectionStatus: "CONNECTED",
        lastSyncedAt: now,
        storeMasterId: dto.storeMasterId ?? undefined,
      },
    });

    // 2. Upsert Video records for this account
    for (const v of videos) {
      if (!v.id) continue;
      const createTime = v.createTime ? new Date(v.createTime * 1000) : null;

      await this.prisma.tikTokVideo.upsert({
        where: {
          tikTokAccountId_tikTokVideoId: {
            tikTokAccountId: account.id,
            tikTokVideoId: String(v.id),
          },
        },
        create: {
          tikTokAccountId: account.id,
          tikTokVideoId: String(v.id),
          title: v.title,
          videoDescription: v.videoDescription,
          createTime,
          coverImageUrl: v.coverImageUrl,
          shareUrl: v.shareUrl,
          duration: v.duration,
          viewCount: v.viewCount ?? 0,
          likeCount: v.likeCount ?? 0,
          commentCount: v.commentCount ?? 0,
          shareCount: v.shareCount ?? 0,
          lastSyncedAt: now,
        },
        update: {
          title: v.title,
          videoDescription: v.videoDescription,
          createTime: createTime ?? undefined,
          coverImageUrl: v.coverImageUrl,
          shareUrl: v.shareUrl,
          duration: v.duration,
          viewCount: v.viewCount ?? 0,
          likeCount: v.likeCount ?? 0,
          commentCount: v.commentCount ?? 0,
          shareCount: v.shareCount ?? 0,
          lastSyncedAt: now,
        },
      });
    }

    // 3. Return sanitized account overview
    const latest = await this.getLatestTikTokAccount();
    if (!latest) {
      throw new Error("Failed to retrieve upserted TikTok account overview");
    }
    return latest;
  }

  /**
   * Retrieves the most recently synced active TikTok account with its latest 20 videos.
   * Strictly excludes encryptedAccessToken and encryptedRefreshToken from the return DTO.
   */
  async getLatestTikTokAccount(): Promise<SafeTikTokAccountOverviewResponse | null> {
    const raw = await this.prisma.tikTokAccount.findFirst({
      orderBy: { lastSyncedAt: "desc" },
      include: {
        videos: {
          orderBy: { createTime: "desc" },
          take: 20,
        },
        storeMaster: true,
      },
    });

    if (!raw) return null;

    const rawVideos: any[] = raw.videos || [];
    const safeVideos: SafeTikTokVideoResponse[] = rawVideos.map((v) => ({
      id: v.id,
      tikTokVideoId: v.tikTokVideoId,
      title: v.title,
      videoDescription: v.videoDescription,
      createTime: v.createTime ? v.createTime.toISOString() : null,
      coverImageUrl: v.coverImageUrl,
      shareUrl: v.shareUrl,
      duration: v.duration,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      commentCount: v.commentCount,
      shareCount: v.shareCount,
      lastSyncedAt: v.lastSyncedAt.toISOString(),
    }));

    return {
      id: raw.id,
      openId: raw.openId,
      unionId: raw.unionId,
      username: raw.username,
      displayName: raw.displayName,
      avatarUrl: raw.avatarUrl,
      avatarUrl100: raw.avatarUrl100,
      avatarLargeUrl: raw.avatarLargeUrl,
      bioDescription: raw.bioDescription,
      profileDeepLink: raw.profileDeepLink,
      profileWebLink: raw.profileWebLink,
      isVerified: raw.isVerified,
      followerCount: raw.followerCount,
      followingCount: raw.followingCount,
      likesCount: raw.likesCount,
      videoCount: raw.videoCount,
      connectionStatus: raw.connectionStatus,
      connectedAt: raw.connectedAt.toISOString(),
      lastSyncedAt: raw.lastSyncedAt.toISOString(),
      storeMasterId: raw.storeMasterId,
      storeMaster: raw.storeMaster
        ? {
            id: raw.storeMaster.id,
            storeName: raw.storeMaster.storeName,
            accountName: raw.storeMaster.accountName,
            province: raw.storeMaster.province,
            region: raw.storeMaster.region,
          }
        : null,
      videos: safeVideos,
    };
  }

  /**
   * Lists all connected TikTok accounts for store management.
   */
  async listTikTokAccounts(): Promise<Array<Omit<SafeTikTokAccountOverviewResponse, "videos"> & { videoCountRecorded: number }>> {
    const rawList = await this.prisma.tikTokAccount.findMany({
      orderBy: { lastSyncedAt: "desc" },
      include: {
        storeMaster: true,
        _count: {
          select: { videos: true },
        },
      },
    });

    return rawList.map((raw: any) => ({
      id: raw.id,
      openId: raw.openId,
      unionId: raw.unionId,
      username: raw.username,
      displayName: raw.displayName,
      avatarUrl: raw.avatarUrl,
      avatarUrl100: raw.avatarUrl100,
      avatarLargeUrl: raw.avatarLargeUrl,
      bioDescription: raw.bioDescription,
      profileDeepLink: raw.profileDeepLink,
      profileWebLink: raw.profileWebLink,
      isVerified: raw.isVerified,
      followerCount: raw.followerCount,
      followingCount: raw.followingCount,
      likesCount: raw.likesCount,
      videoCount: raw.videoCount,
      connectionStatus: raw.connectionStatus,
      connectedAt: raw.connectedAt.toISOString(),
      lastSyncedAt: raw.lastSyncedAt.toISOString(),
      storeMasterId: raw.storeMasterId,
      storeMaster: raw.storeMaster
        ? {
            id: raw.storeMaster.id,
            storeName: raw.storeMaster.storeName,
            accountName: raw.storeMaster.accountName,
            province: raw.storeMaster.province,
            region: raw.storeMaster.region,
          }
        : null,
      videoCountRecorded: raw._count.videos,
    }));
  }
}
