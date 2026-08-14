import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import {
  ReconcileStoreBindingsResponse,
  SafeTikTokAccountOverviewResponse,
  SafeTikTokVideoResponse,
  SyncTikTokAccountDto,
  TikTokDailyMetricDto,
  TikTokGrowthSummaryDto,
  TikTokHistoricalMetricsResponse,
} from "./dto/tiktok-sync.dto";

/**
 * Normalizes TikTok username for StoreMaster account mapping.
 * Rules:
 * - lowercase
 * - trim whitespace
 * - remove leading "@"
 * - return null if empty, "#REF!", or "none"
 */
export function normalizeTikTokUsernameForMatching(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/^@+/u, "").toLowerCase();
  if (!cleaned || cleaned === "#ref!" || cleaned === "none") return null;
  return cleaned;
}

/**
 * Returns UTC Date object representing the 00:00:00.000 boundary of the Asia/Bangkok calendar day.
 */
export function getBangkokCalendarDate(now: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [yearStr, monthStr, dayStr] = formatter.format(now).split("-");
  return new Date(Date.UTC(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10), 0, 0, 0, 0));
}

/**
 * Formats a Date to ISO date string (YYYY-MM-DD) based on UTC components.
 */
export function formatBangkokDateToIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type StoreBindingDiagnostic =
  | "MATCHED"
  | "STORE_NOT_FOUND"
  | "AMBIGUOUS_STORE_MATCH"
  | "PRESERVED_EXISTING"
  | "NO_USERNAME";

export interface ResolveStoreResult {
  storeMasterId: string | null;
  status: StoreBindingDiagnostic;
  matchedCount: number;
}

@Injectable()
export class TikTokService {
  private readonly logger = new Logger(TikTokService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
  ) {}

  /**
   * Resolves StoreMaster ID by matching normalized TikTok username.
   * Matches TikTokAccount.username -> StoreMaster.tiktokUsername.
   * Returns:
   * - MATCHED (1 store found) -> storeMasterId
   * - STORE_NOT_FOUND (0 stores found) -> null
   * - AMBIGUOUS_STORE_MATCH (>1 stores found) -> null
   */
  async resolveStoreMasterIdByTikTokUsername(rawUsername?: string | null): Promise<ResolveStoreResult> {
    const normalized = normalizeTikTokUsernameForMatching(rawUsername);
    if (!normalized) {
      return { storeMasterId: null, status: "NO_USERNAME", matchedCount: 0 };
    }

    const candidates = await this.prisma.storeMaster.findMany({
      where: {
        OR: [
          { tiktokUsername: { equals: normalized, mode: "insensitive" } },
          { tiktokUsername: { equals: `@${normalized}`, mode: "insensitive" } },
        ],
      },
    });

    const exactMatches = candidates.filter((store) => {
      const storeNormalized = normalizeTikTokUsernameForMatching(store.tiktokUsername);
      return storeNormalized === normalized;
    });

    if (exactMatches.length === 1) {
      return {
        storeMasterId: exactMatches[0].id,
        status: "MATCHED",
        matchedCount: 1,
      };
    }

    if (exactMatches.length > 1) {
      this.logger.warn(
        `Ambiguous StoreMaster match for TikTok username '${rawUsername}': ${exactMatches.length} stores found`
      );
      return {
        storeMasterId: null,
        status: "AMBIGUOUS_STORE_MATCH",
        matchedCount: exactMatches.length,
      };
    }

    return {
      storeMasterId: null,
      status: "STORE_NOT_FOUND",
      matchedCount: 0,
    };
  }

  /**
   * Reconciles already-persisted TikTokAccount records with StoreMaster.
   * Finds unlinked accounts (storeMasterId == null) and resolves storeMasterId via normalized username.
   */
  async reconcileTikTokStoreBindings(): Promise<ReconcileStoreBindingsResponse> {
    const unboundAccounts = await this.prisma.tikTokAccount.findMany({
      where: {
        storeMasterId: null,
      },
    });

    let matchedCount = 0;
    let unmatchedCount = 0;
    let ambiguousCount = 0;
    const results: ReconcileStoreBindingsResponse["results"] = [];

    for (const acc of unboundAccounts) {
      const resolution = await this.resolveStoreMasterIdByTikTokUsername(acc.username);

      if (resolution.status === "MATCHED" && resolution.storeMasterId) {
        await this.prisma.tikTokAccount.update({
          where: { id: acc.id },
          data: {
            storeMasterId: resolution.storeMasterId,
            lastSyncedAt: new Date(),
          },
        });
        matchedCount++;
      } else if (resolution.status === "AMBIGUOUS_STORE_MATCH") {
        ambiguousCount++;
      } else {
        unmatchedCount++;
      }

      results.push({
        openId: acc.openId,
        username: acc.username,
        storeMasterId: resolution.storeMasterId,
        status: resolution.status,
      });
    }

    this.logger.log(
      `TikTok StoreMaster reconciliation completed: ${matchedCount} matched, ${unmatchedCount} unmatched, ${ambiguousCount} ambiguous out of ${unboundAccounts.length} unbound accounts.`
    );

    return {
      totalChecked: unboundAccounts.length,
      matchedCount,
      unmatchedCount,
      ambiguousCount,
      alreadyBoundCount: 0,
      results,
    };
  }

  /**
   * Upserts authorized TikTok account and its video analytics.
   * Encrypts access and refresh tokens at rest with AES-256-GCM before database write.
   * Automatically binds TikTok account to matching StoreMaster via normalized TikTok username if unlinked.
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

    // Check existing account record to preserve existing storeMasterId
    const existingAccount = await this.prisma.tikTokAccount.findUnique({
      where: { openId: profile.open_id },
      select: { id: true, storeMasterId: true },
    });

    let effectiveStoreMasterId: string | null = null;
    if (existingAccount?.storeMasterId) {
      // 1. Immutable store binding: preserve existing binding unconditionally during OAuth sync
      effectiveStoreMasterId = existingAccount.storeMasterId;
    } else {
      // 2. Auto-resolve store binding by normalized TikTok username only when currently unlinked
      const matchResult = await this.resolveStoreMasterIdByTikTokUsername(profile.username);
      if (matchResult.status === "MATCHED" && matchResult.storeMasterId) {
        effectiveStoreMasterId = matchResult.storeMasterId;
      }
    }

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
        storeMasterId: effectiveStoreMasterId,
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
        storeMasterId: effectiveStoreMasterId ?? undefined,
      },
    });

    // 2. Upsert Video records for this account
    for (const v of videos) {
      if (!v.id) continue;
      const createTimeNum = v.createTime ?? v.create_time;
      const createTime = typeof createTimeNum === "number" ? new Date(createTimeNum * 1000) : null;
      const title = v.title ?? null;
      const videoDescription = v.videoDescription ?? v.video_description ?? null;
      const coverImageUrl = v.coverImageUrl ?? v.cover_image_url ?? null;
      const shareUrl = v.shareUrl ?? v.share_url ?? null;
      const duration = typeof v.duration === "number" ? v.duration : null;
      const viewCount = v.viewCount ?? v.view_count ?? 0;
      const likeCount = v.likeCount ?? v.like_count ?? 0;
      const commentCount = v.commentCount ?? v.comment_count ?? 0;
      const shareCount = v.shareCount ?? v.share_count ?? 0;

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
          title,
          videoDescription,
          createTime,
          coverImageUrl,
          shareUrl,
          duration,
          viewCount,
          likeCount,
          commentCount,
          shareCount,
          lastSyncedAt: now,
        },
        update: {
          title,
          videoDescription,
          createTime: createTime ?? undefined,
          coverImageUrl,
          shareUrl,
          duration: duration ?? undefined,
          viewCount,
          likeCount,
          commentCount,
          shareCount,
          lastSyncedAt: now,
        },
      });
    }

    // 3. Upsert today's daily snapshot (Asia/Bangkok calendar boundary)
    const metricDate = getBangkokCalendarDate(now);
    await this.prisma.tikTokAccountDailyMetric.upsert({
      where: {
        tikTokAccountId_metricDate: {
          tikTokAccountId: account.id,
          metricDate,
        },
      },
      create: {
        tikTokAccountId: account.id,
        metricDate,
        followerCount: account.followerCount,
        followingCount: account.followingCount,
        likesCount: account.likesCount,
        videoCount: account.videoCount,
      },
      update: {
        followerCount: account.followerCount,
        followingCount: account.followingCount,
        likesCount: account.likesCount,
        videoCount: account.videoCount,
      },
    });

    // 4. Return sanitized account overview
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

  /**
   * Retrieves historical metrics and calculated follower growth for an account.
   * Compares against actual daily snapshots on Asia/Bangkok date boundaries.
   * Returns growth as null if comparison date has no prior snapshot (never fabricates 0).
   */
  async getAccountHistoricalMetrics(
    identifier: string,
    days = 30,
    referenceNow: Date = new Date()
  ): Promise<TikTokHistoricalMetricsResponse | null> {
    const account = await this.prisma.tikTokAccount.findFirst({
      where: {
        OR: [{ id: identifier }, { openId: identifier }],
      },
      select: {
        id: true,
        openId: true,
        displayName: true,
        username: true,
        followerCount: true,
      },
    });

    if (!account) return null;

    const validatedDays = Math.min(Math.max(1, days || 30), 365);
    const todayBangkok = getBangkokCalendarDate(referenceNow);
    const cutoffDate = new Date(todayBangkok.getTime() - validatedDays * 86400000);

    const metrics = await this.prisma.tikTokAccountDailyMetric.findMany({
      where: {
        tikTokAccountId: account.id,
        metricDate: { gte: cutoffDate },
      },
      orderBy: { metricDate: "asc" },
    });

    const metricByDate = new Map<string, typeof metrics[0]>();
    for (const m of metrics) {
      metricByDate.set(formatBangkokDateToIso(m.metricDate), m);
    }

    const todayIso = formatBangkokDateToIso(todayBangkok);
    const yesterdayIso = formatBangkokDateToIso(new Date(todayBangkok.getTime() - 86400000));
    const sevenDaysAgoIso = formatBangkokDateToIso(new Date(todayBangkok.getTime() - 7 * 86400000));
    const thirtyDaysAgoIso = formatBangkokDateToIso(new Date(todayBangkok.getTime() - 30 * 86400000));

    const todayMetric = metricByDate.get(todayIso);
    const yesterdayMetric = metricByDate.get(yesterdayIso);
    const sevenDayMetric = metricByDate.get(sevenDaysAgoIso);
    const thirtyDayMetric = metricByDate.get(thirtyDaysAgoIso);

    const currentFollowerCount = todayMetric ? todayMetric.followerCount : account.followerCount;

    const previousDayFollowerCount = yesterdayMetric ? yesterdayMetric.followerCount : null;
    const dailyFollowerGrowth = yesterdayMetric ? currentFollowerCount - yesterdayMetric.followerCount : null;

    const sevenDayFollowerCount = sevenDayMetric ? sevenDayMetric.followerCount : null;
    const sevenDayFollowerGrowth = sevenDayMetric ? currentFollowerCount - sevenDayMetric.followerCount : null;

    const thirtyDayFollowerCount = thirtyDayMetric ? thirtyDayMetric.followerCount : null;
    const thirtyDayFollowerGrowth = thirtyDayMetric ? currentFollowerCount - thirtyDayMetric.followerCount : null;

    return {
      accountId: account.id,
      openId: account.openId,
      displayName: account.displayName,
      username: account.username,
      summary: {
        currentFollowerCount,
        previousDayFollowerCount,
        dailyFollowerGrowth,
        sevenDayFollowerCount,
        sevenDayFollowerGrowth,
        thirtyDayFollowerCount,
        thirtyDayFollowerGrowth,
      },
      history: metrics.map((m) => ({
        id: m.id,
        metricDate: formatBangkokDateToIso(m.metricDate),
        followerCount: m.followerCount,
        followingCount: m.followingCount,
        likesCount: m.likesCount,
        videoCount: m.videoCount,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Retrieves historical metrics and growth for the latest connected TikTok account.
   */
  async getLatestAccountHistoricalMetrics(
    days = 30,
    referenceNow: Date = new Date()
  ): Promise<TikTokHistoricalMetricsResponse | null> {
    const latest = await this.getLatestTikTokAccount();
    if (!latest) return null;
    return this.getAccountHistoricalMetrics(latest.id, days, referenceNow);
  }

  /**
   * Service method designed for future daily scheduled synchronization across ~150 connected accounts.
   * Returns safe summary without exposing sensitive credentials.
   */
  async planDailyAccountsSync(): Promise<{ totalConnectedAccounts: number; accountIds: string[] }> {
    const connectedAccounts = await this.prisma.tikTokAccount.findMany({
      where: {
        connectionStatus: "CONNECTED",
        encryptedAccessToken: { not: null },
      },
      select: { id: true },
      orderBy: { lastSyncedAt: "asc" },
    });

    return {
      totalConnectedAccounts: connectedAccounts.length,
      accountIds: connectedAccounts.map((a) => a.id),
    };
  }
}
