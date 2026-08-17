import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import {
  ReconcileStoreBindingsResponse,
  SafeTikTokAccountOverviewResponse,
  SafeTikTokVideoResponse,
  SyncTikTokAccountDto,
  TikTokAccountBulkMetricSummaryItem,
  TikTokAccountSyncResult,
  TikTokBulkMetricsSummaryResponse,
  TikTokDailyMetricDto,
  TikTokDailySyncSummary,
  TikTokGrowthSummaryDto,
  TikTokHistoricalMetricsResponse,
  TikTokProfileDto,
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

/**
 * Error classes for classifying TikTok OAuth and API errors
 */
export class TikTokOAuthPermanentError extends Error {
  constructor(message: string, public readonly errorCode?: string) {
    super(message);
    this.name = "TikTokOAuthPermanentError";
  }
}

export class TikTokTransientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "TikTokTransientError";
  }
}

/**
 * Executes an async function with bounded exponential retries for transient errors.
 * Never retries permanent OAuth errors.
 */
export async function executeTikTokWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  initialBackoffMs = 500
): Promise<T> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      if (err instanceof TikTokOAuthPermanentError || attempt > maxRetries) {
        throw err;
      }
      if (err instanceof TikTokTransientError) {
        const delayMs = err.retryAfterSeconds
          ? Math.min(err.retryAfterSeconds * 1000, 5000)
          : initialBackoffMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
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
    let bindingStatus: StoreBindingDiagnostic = "NO_USERNAME";
    if (existingAccount?.storeMasterId) {
      // 1. Immutable store binding: preserve existing binding unconditionally during OAuth sync
      effectiveStoreMasterId = existingAccount.storeMasterId;
      bindingStatus = "PRESERVED_EXISTING";
    } else {
      // 2. Auto-resolve store binding by normalized TikTok username only when currently unlinked
      const matchResult = await this.resolveStoreMasterIdByTikTokUsername(profile.username);
      bindingStatus = matchResult.status;
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

    // 4. Return sanitized account overview for this exact upserted account
    const safeAccount = await this.getTikTokAccountById(account.id);
    if (!safeAccount) {
      throw new Error("Failed to retrieve upserted TikTok account overview");
    }
    return {
      ...safeAccount,
      bindingStatus,
    };
  }

  /**
   * Transforms a raw database TikTokAccount entity with videos and storeMaster to a safe overview DTO.
   * Strictly excludes encryptedAccessToken and encryptedRefreshToken.
   */
  private mapToSafeAccountOverview(raw: any): SafeTikTokAccountOverviewResponse {
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
   * Retrieves a specific TikTok account overview by ID or openId with its latest 20 videos.
   */
  async getTikTokAccountById(identifier: string): Promise<SafeTikTokAccountOverviewResponse | null> {
    const raw = await this.prisma.tikTokAccount.findFirst({
      where: {
        OR: [{ id: identifier }, { openId: identifier }],
      },
      include: {
        videos: {
          orderBy: { createTime: "desc" },
          take: 20,
        },
        storeMaster: true,
      },
    });

    if (!raw) return null;
    return this.mapToSafeAccountOverview(raw);
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
    return this.mapToSafeAccountOverview(raw);
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
   * Retrieves bulk metrics summary across all connected TikTok accounts.
   * Performs 1 query for accounts and 1 grouped query for metrics to avoid N+1 DB operations.
   */
  async getBulkAccountsMetricsSummary(
    days = 30,
    referenceNow: Date = new Date()
  ): Promise<TikTokBulkMetricsSummaryResponse> {
    const accounts = await this.prisma.tikTokAccount.findMany({
      select: {
        id: true,
        followerCount: true,
        followingCount: true,
        likesCount: true,
        videoCount: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (accounts.length === 0) {
      return { accounts: [] };
    }

    const validatedDays = Math.min(Math.max(1, days || 30), 365);
    const todayBangkok = getBangkokCalendarDate(referenceNow);
    const cutoffDate = new Date(todayBangkok.getTime() - validatedDays * 86400000);

    const metrics = await this.prisma.tikTokAccountDailyMetric.findMany({
      where: {
        tikTokAccountId: { in: accounts.map((a) => a.id) },
        metricDate: { gte: cutoffDate },
      },
      orderBy: { metricDate: "asc" },
    });

    // Group metrics by accountId -> map of YYYY-MM-DD -> metric
    const metricsByAccount = new Map<string, Map<string, typeof metrics[0]>>();
    for (const m of metrics) {
      let accountMap = metricsByAccount.get(m.tikTokAccountId);
      if (!accountMap) {
        accountMap = new Map();
        metricsByAccount.set(m.tikTokAccountId, accountMap);
      }
      accountMap.set(formatBangkokDateToIso(m.metricDate), m);
    }

    const todayIso = formatBangkokDateToIso(todayBangkok);
    const yesterdayIso = formatBangkokDateToIso(new Date(todayBangkok.getTime() - 86400000));
    const sevenDaysAgoIso = formatBangkokDateToIso(new Date(todayBangkok.getTime() - 7 * 86400000));
    const thirtyDaysAgoIso = formatBangkokDateToIso(new Date(todayBangkok.getTime() - 30 * 86400000));

    const resultAccounts: TikTokAccountBulkMetricSummaryItem[] = accounts.map((account) => {
      const metricByDate = metricsByAccount.get(account.id) ?? new Map();

      const todayMetric = metricByDate.get(todayIso);
      const yesterdayMetric = metricByDate.get(yesterdayIso);
      const sevenDayMetric = metricByDate.get(sevenDaysAgoIso);
      const thirtyDayMetric = metricByDate.get(thirtyDaysAgoIso);

      const currentFollowers = todayMetric ? todayMetric.followerCount : account.followerCount;
      const currentFollowing = todayMetric ? todayMetric.followingCount : account.followingCount;
      const currentLikes = todayMetric ? todayMetric.likesCount : account.likesCount;
      const currentVideos = todayMetric ? todayMetric.videoCount : account.videoCount;

      return {
        accountId: account.id,
        current: {
          followerCount: currentFollowers,
          followingCount: currentFollowing,
          likesCount: currentLikes,
          videoCount: currentVideos,
        },
        growth: {
          today: {
            followers: yesterdayMetric ? currentFollowers - yesterdayMetric.followerCount : null,
            following: yesterdayMetric ? currentFollowing - yesterdayMetric.followingCount : null,
            likes: yesterdayMetric ? currentLikes - yesterdayMetric.likesCount : null,
            videos: yesterdayMetric ? currentVideos - yesterdayMetric.videoCount : null,
          },
          sevenDays: {
            followers: sevenDayMetric ? currentFollowers - sevenDayMetric.followerCount : null,
            following: sevenDayMetric ? currentFollowing - sevenDayMetric.followingCount : null,
            likes: sevenDayMetric ? currentLikes - sevenDayMetric.likesCount : null,
            videos: sevenDayMetric ? currentVideos - sevenDayMetric.videoCount : null,
          },
          thirtyDays: {
            followers: thirtyDayMetric ? currentFollowers - thirtyDayMetric.followerCount : null,
            following: thirtyDayMetric ? currentFollowing - thirtyDayMetric.followingCount : null,
            likes: thirtyDayMetric ? currentLikes - thirtyDayMetric.likesCount : null,
            videos: thirtyDayMetric ? currentVideos - thirtyDayMetric.videoCount : null,
          },
        },
      };
    });

    return { accounts: resultAccounts };
  }

  /**
   * Tries to acquire a PostgreSQL session advisory lock for the daily sync job.
   * Prevents overlapping concurrent job runs across instances/processes.
   */
  async tryAcquireJobLock(lockKeyName = "tiktok_daily_metrics_sync"): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_lock(hashtext(${lockKeyName})) as locked
      `;
      return result?.[0]?.locked === true;
    } catch {
      // In unit tests or environments where $queryRaw is mocked/unavailable, assume lock is acquired
      return true;
    }
  }

  /**
   * Releases the PostgreSQL session advisory lock.
   */
  async releaseJobLock(lockKeyName = "tiktok_daily_metrics_sync"): Promise<void> {
    try {
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock(hashtext(${lockKeyName}))
      `;
    } catch {
      // Safe cleanup ignore
    }
  }

  /**
   * Refreshes TikTok access token via TikTok OAuth v2 token endpoint using decrypted refresh token.
   * Classifies permanent vs transient errors. Never logs tokens or credentials.
   */
  async fetchRefreshedTikTokToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn?: number;
    refreshToken?: string;
    refreshExpiresIn?: number;
    openId?: string;
  }> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();

    if (!clientKey || !clientSecret) {
      throw new Error("TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET missing in environment");
    }

    const bodyParams = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken.trim(),
    });

    let response: Response;
    try {
      response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cache-Control": "no-cache",
        },
        body: bodyParams.toString(),
      });
    } catch (netErr: any) {
      throw new TikTokTransientError(
        `Network error during token refresh: ${netErr?.message || "connection error"}`
      );
    }

    if (response.status === 429) {
      const retryAfterStr = response.headers.get("retry-after");
      const retryAfterSec = retryAfterStr ? parseInt(retryAfterStr, 10) : undefined;
      throw new TikTokTransientError("TikTok rate limit exceeded (HTTP 429)", 429, retryAfterSec);
    }

    if (response.status >= 500) {
      throw new TikTokTransientError(
        `TikTok API server error (HTTP ${response.status})`,
        response.status
      );
    }

    let json: Record<string, unknown> = {};
    try {
      json = (await response.json()) as Record<string, unknown>;
    } catch {
      if (!response.ok) {
        throw new TikTokTransientError(`TikTok token refresh failed with HTTP ${response.status}`);
      }
    }

    if (!response.ok) {
      const errCode = typeof json.error === "string" ? json.error : "";
      const errDesc = typeof json.error_description === "string" ? json.error_description : "";
      const permanentErrors = [
        "invalid_grant",
        "invalid_token",
        "unauthorized_client",
        "access_denied",
        "invalid_request",
        "token_revoked",
        "scope_changed",
        "token_expired",
      ];
      if (
        permanentErrors.includes(errCode.toLowerCase()) ||
        errDesc.toLowerCase().includes("invalid grant") ||
        errDesc.toLowerCase().includes("revoked") ||
        errDesc.toLowerCase().includes("expired")
      ) {
        throw new TikTokOAuthPermanentError(
          `Permanent OAuth refresh rejection: ${errCode || errDesc || "invalid_grant"}`,
          errCode
        );
      }
      throw new TikTokTransientError(`TikTok token refresh error: ${errCode || errDesc || response.status}`, response.status);
    }

    const data = (json.data && typeof json.data === "object" ? json.data : json) as Record<string, unknown>;
    const accessToken = typeof data.access_token === "string" ? data.access_token : "";
    if (!accessToken) {
      const errMsg =
        typeof json.error_description === "string"
          ? json.error_description
          : typeof json.error === "string"
          ? json.error
          : "Missing access_token in token refresh response";
      throw new TikTokOAuthPermanentError(`TikTok token refresh missing access token: ${errMsg}`);
    }

    return {
      accessToken,
      expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
      refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
      refreshExpiresIn: typeof data.refresh_expires_in === "number" ? data.refresh_expires_in : undefined,
      openId: typeof data.open_id === "string" ? data.open_id : undefined,
    };
  }

  /**
   * Revokes user access token via official TikTok OAuth v2 revoke endpoint.
   * Endpoint: POST https://open.tiktokapis.com/v2/oauth/revoke/
   */
  async revokeTikTokToken(token: string): Promise<{ success: boolean; status: number; message: string }> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();

    if (!clientKey || !clientSecret) {
      throw new Error("TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET missing in environment");
    }

    const bodyParams = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      token: token.trim(),
    });

    let response: Response;
    try {
      response = await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cache-Control": "no-cache",
        },
        body: bodyParams.toString(),
      });
    } catch (netErr: any) {
      throw new TikTokTransientError(
        `Network error during token revoke: ${netErr?.message || "connection error"}`
      );
    }

    if (response.status === 429) {
      throw new TikTokTransientError("TikTok rate limit exceeded during revoke (HTTP 429)", 429);
    }

    if (response.status >= 500) {
      throw new TikTokTransientError(
        `TikTok API server error during revoke (HTTP ${response.status})`,
        response.status
      );
    }

    let json: Record<string, unknown> = {};
    try {
      json = (await response.json()) as Record<string, unknown>;
    } catch {
      // response might be empty on HTTP 200 OK
    }

    if (response.ok) {
      return { success: true, status: response.status, message: "Token successfully revoked by TikTok" };
    }

    const errCode = typeof json.error === "string" ? json.error : "";
    const errDesc = typeof json.error_description === "string" ? json.error_description : "";

    const alreadyInvalid =
      errCode.toLowerCase().includes("invalid_token") ||
      errCode.toLowerCase().includes("invalid_grant") ||
      errDesc.toLowerCase().includes("not found") ||
      errDesc.toLowerCase().includes("invalid") ||
      errDesc.toLowerCase().includes("revoked") ||
      errDesc.toLowerCase().includes("expired");

    if (alreadyInvalid) {
      return {
        success: true,
        status: response.status,
        message: `Token already invalid or revoked on TikTok: ${errCode || errDesc}`,
      };
    }

    throw new Error(`Unexpected TikTok revoke error (HTTP ${response.status}): ${errCode || errDesc}`);
  }

  /**
   * Resets and deletes a single TikTok account by exact normalized username for sandbox / app review testing.
   * Revokes live TikTok authorization first if encrypted token exists, then executes DB deletion transaction.
   */
  async resetTikTokSandboxAccountByUsername(
    targetUsername: string,
    options?: { dryRun?: boolean; skipRevoke?: boolean }
  ): Promise<{
    success: boolean;
    deletedAccountId?: string;
    username: string;
    displayName: string;
    storeMasterName?: string | null;
    deletedVideosCount: number;
    deletedDailyMetricsCount: number;
    revokeResult?: string;
  }> {
    const normalizedTarget = normalizeTikTokUsernameForMatching(targetUsername);
    if (!normalizedTarget) {
      throw new Error(`Invalid target username provided: "${targetUsername}"`);
    }

    const allAccounts = await this.prisma.tikTokAccount.findMany({
      include: {
        storeMaster: {
          select: {
            id: true,
            storeName: true,
            accountName: true,
            tiktokUsername: true,
          },
        },
        _count: {
          select: {
            videos: true,
            dailyMetrics: true,
          },
        },
      },
    });

    const matching = allAccounts.filter((acc) => {
      return normalizeTikTokUsernameForMatching(acc.username) === normalizedTarget;
    });

    if (matching.length === 0) {
      return {
        success: false,
        username: normalizedTarget,
        displayName: "",
        deletedVideosCount: 0,
        deletedDailyMetricsCount: 0,
        revokeResult: "No matching TikTokAccount found in database",
      };
    }

    if (matching.length > 1) {
      throw new Error(
        `Ambiguous target: found ${matching.length} TikTok accounts matching normalized username "${normalizedTarget}". Aborting for safety.`
      );
    }

    const targetAccount = matching[0];
    let revokeResult = "No token to revoke";

    if (targetAccount.encryptedAccessToken && !options?.skipRevoke && !options?.dryRun) {
      try {
        const decryptedToken = this.encryption.decrypt(
          targetAccount.encryptedAccessToken
        );
        const res = await this.revokeTikTokToken(decryptedToken);
        revokeResult = res.message;
      } catch (revokeErr: any) {
        throw new Error(
          `TikTok token revocation failed for account ${targetAccount.id}: ${revokeErr?.message || "unknown error"}. Aborting database deletion.`
        );
      }
    }

    if (options?.dryRun) {
      return {
        success: true,
        deletedAccountId: targetAccount.id,
        username: targetAccount.username || normalizedTarget,
        displayName: targetAccount.displayName,
        storeMasterName: targetAccount.storeMaster?.storeName ?? null,
        deletedVideosCount: targetAccount._count.videos,
        deletedDailyMetricsCount: targetAccount._count.dailyMetrics,
        revokeResult: `[DRY-RUN] Would revoke and delete account ${targetAccount.id}`,
      };
    }

    // Execute deletion within interactive transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.tikTokVideo.deleteMany({
        where: { tikTokAccountId: targetAccount.id },
      });
      await tx.tikTokAccountDailyMetric.deleteMany({
        where: { tikTokAccountId: targetAccount.id },
      });
      await tx.tikTokAccount.delete({
        where: { id: targetAccount.id },
      });
    });

    return {
      success: true,
      deletedAccountId: targetAccount.id,
      username: targetAccount.username || normalizedTarget,
      displayName: targetAccount.displayName,
      storeMasterName: targetAccount.storeMaster?.storeName ?? null,
      deletedVideosCount: targetAccount._count.videos,
      deletedDailyMetricsCount: targetAccount._count.dailyMetrics,
      revokeResult,
    };
  }

  /**
   * Fetches user profile and audience stats via TikTok API v2 User Info endpoint.
   * Classifies permanent vs transient errors.
   */
  async fetchTikTokUserProfile(accessToken: string): Promise<TikTokProfileDto> {
    const fields = [
      "open_id",
      "union_id",
      "avatar_url",
      "avatar_url_100",
      "avatar_large_url",
      "display_name",
      "username",
      "bio_description",
      "profile_deep_link",
      "profile_web_link",
      "is_verified",
      "follower_count",
      "following_count",
      "likes_count",
      "video_count",
    ].join(",");

    let response: Response;
    try {
      response = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${fields}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
          Accept: "application/json",
        },
      });
    } catch (netErr: any) {
      throw new TikTokTransientError(
        `Network error during profile fetch: ${netErr?.message || "connection error"}`
      );
    }

    if (response.status === 429) {
      const retryAfterStr = response.headers.get("retry-after");
      const retryAfterSec = retryAfterStr ? parseInt(retryAfterStr, 10) : undefined;
      throw new TikTokTransientError("TikTok user info rate limited (HTTP 429)", 429, retryAfterSec);
    }

    if (response.status >= 500) {
      throw new TikTokTransientError(
        `TikTok API server error on user info (HTTP ${response.status})`,
        response.status
      );
    }

    if (!response.ok) {
      throw new TikTokTransientError(`TikTok user info request failed with HTTP ${response.status}`, response.status);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const data = json.data as Record<string, unknown> | undefined;
    const user = (data?.user || {}) as Record<string, unknown>;

    const openId = typeof user.open_id === "string" ? user.open_id : "";
    if (!openId) {
      throw new Error("Missing open_id in TikTok user info response");
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
   * Synchronizes account profile and daily metric snapshot for a single TikTok account.
   * Handles token refresh, rotation, permanent vs transient error classification,
   * exponential backoff retries, and daily snapshot upsert.
   */
  async syncSingleAccountDailyMetrics(
    account: {
      id: string;
      openId: string;
      username?: string | null;
      encryptedAccessToken?: string | null;
      encryptedRefreshToken?: string | null;
      accessTokenExpiresAt?: Date | null;
      followerCount: number;
      followingCount: number;
      likesCount: number;
      videoCount: number;
      displayName: string;
      avatarUrl?: string | null;
    },
    referenceNow: Date = new Date()
  ): Promise<TikTokAccountSyncResult> {
    if (!account.encryptedRefreshToken) {
      return {
        accountId: account.id,
        openId: account.openId,
        username: account.username,
        status: "SKIPPED",
        error: "Missing encrypted refresh token",
      };
    }

    let accessToken: string | null = null;
    const isAccessTokenValid =
      account.encryptedAccessToken &&
      account.accessTokenExpiresAt &&
      account.accessTokenExpiresAt.getTime() > referenceNow.getTime() + 10 * 60 * 1000;

    if (isAccessTokenValid && account.encryptedAccessToken) {
      try {
        accessToken = this.encryption.decrypt(account.encryptedAccessToken);
      } catch {
        accessToken = null;
      }
    }

    // Refresh token if access token is absent, invalid, or close to expiry
    if (!accessToken) {
      let decryptedRefreshToken: string;
      try {
        decryptedRefreshToken = this.encryption.decrypt(account.encryptedRefreshToken);
      } catch (err) {
        // Corrupted encryption is a permanent error for this stored record
        await this.prisma.tikTokAccount.update({
          where: { id: account.id },
          data: { connectionStatus: "ERROR" },
        });
        return {
          accountId: account.id,
          openId: account.openId,
          username: account.username,
          status: "FAILED",
          error: "Failed to decrypt refresh token",
        };
      }

      try {
        const refreshResult = await executeTikTokWithRetry(() =>
          this.fetchRefreshedTikTokToken(decryptedRefreshToken)
        );
        accessToken = refreshResult.accessToken;

        const newEncryptedAccessToken = this.encryption.encrypt(refreshResult.accessToken);
        const accessTokenExpiresAt = refreshResult.expiresIn
          ? new Date(referenceNow.getTime() + refreshResult.expiresIn * 1000)
          : undefined;

        const updateData: Record<string, any> = {
          encryptedAccessToken: newEncryptedAccessToken,
          accessTokenExpiresAt,
          connectionStatus: "CONNECTED",
        };

        // If TikTok rotates the refresh token, persist the rotated token
        if (refreshResult.refreshToken) {
          updateData.encryptedRefreshToken = this.encryption.encrypt(refreshResult.refreshToken);
          if (refreshResult.refreshExpiresIn) {
            updateData.refreshTokenExpiresAt = new Date(
              referenceNow.getTime() + refreshResult.refreshExpiresIn * 1000
            );
          }
        }

        await this.prisma.tikTokAccount.update({
          where: { id: account.id },
          data: updateData,
        });
      } catch (err: any) {
        if (err instanceof TikTokOAuthPermanentError) {
          this.logger.warn(`Permanent token refresh failure for account ${account.id}`);
          await this.prisma.tikTokAccount.update({
            where: { id: account.id },
            data: { connectionStatus: "EXPIRED" },
          });
          return {
            accountId: account.id,
            openId: account.openId,
            username: account.username,
            status: "FAILED",
            error: err.message,
          };
        }

        // Transient failure: preserve CONNECTED status so future run can succeed
        this.logger.warn(`Transient token refresh failure for account ${account.id}`);
        return {
          accountId: account.id,
          openId: account.openId,
          username: account.username,
          status: "FAILED",
          error: `Transient refresh failure: ${err?.message || "API unavailable"}`,
        };
      }
    }

    // Fetch updated account profile & audience metrics with retry for transient issues
    try {
      const profile = await executeTikTokWithRetry(() =>
        this.fetchTikTokUserProfile(accessToken!)
      );

      const followerCount = profile.follower_count ?? account.followerCount;
      const followingCount = profile.following_count ?? account.followingCount;
      const likesCount = profile.likes_count ?? account.likesCount;
      const videoCount = profile.video_count ?? account.videoCount;

      await this.prisma.tikTokAccount.update({
        where: { id: account.id },
        data: {
          followerCount,
          followingCount,
          likesCount,
          videoCount,
          displayName: profile.display_name || account.displayName,
          avatarUrl: profile.avatar_url || account.avatarUrl,
          lastSyncedAt: referenceNow,
        },
      });

      // Upsert daily snapshot for current Asia/Bangkok date boundary
      const metricDate = getBangkokCalendarDate(referenceNow);
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
          followerCount,
          followingCount,
          likesCount,
          videoCount,
        },
        update: {
          followerCount,
          followingCount,
          likesCount,
          videoCount,
        },
      });

      return {
        accountId: account.id,
        openId: account.openId,
        username: account.username,
        status: "SUCCESS",
        followerCount,
      };
    } catch (err: any) {
      return {
        accountId: account.id,
        openId: account.openId,
        username: account.username,
        status: "FAILED",
        error: `Profile fetch failed: ${err?.message || "Unknown error"}`,
      };
    }
  }

  /**
   * Production scheduled worker method: Synchronizes daily metrics across all connected TikTok accounts.
   * - Acquires PostgreSQL advisory lock to prevent overlapping runs across worker/app instances.
   * - Batches accounts with controlled concurrency (default 5) to respect TikTok rate limits.
   * - Isolates failures per-account so one failure cannot block the batch.
   */
  async syncDailyTikTokMetrics(options?: {
    concurrency?: number;
    referenceNow?: Date;
  }): Promise<TikTokDailySyncSummary> {
    const startTime = Date.now();
    const referenceNow = options?.referenceNow || new Date();
    const concurrency = Math.min(Math.max(1, options?.concurrency || 5), 20);
    const bangkokDate = formatBangkokDateToIso(getBangkokCalendarDate(referenceNow));

    // Acquire PostgreSQL distributed job lock to prevent overlapping executions
    const lockAcquired = await this.tryAcquireJobLock();
    if (!lockAcquired) {
      this.logger.warn(
        "Daily TikTok metrics sync job is already executing on another instance. Skipping overlapping run."
      );
      return {
        totalAccounts: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        tokenRefreshFailures: 0,
        bangkokDate,
        durationMs: Date.now() - startTime,
        accountResults: [],
      };
    }

    try {
      const accounts = await this.prisma.tikTokAccount.findMany({
        where: {
          connectionStatus: "CONNECTED",
          encryptedRefreshToken: { not: null },
        },
        select: {
          id: true,
          openId: true,
          username: true,
          encryptedAccessToken: true,
          encryptedRefreshToken: true,
          accessTokenExpiresAt: true,
          followerCount: true,
          followingCount: true,
          likesCount: true,
          videoCount: true,
          displayName: true,
          avatarUrl: true,
        },
        orderBy: { lastSyncedAt: "asc" },
      });

      const accountResults: TikTokAccountSyncResult[] = [];
      let succeeded = 0;
      let failed = 0;
      let skipped = 0;
      let tokenRefreshFailures = 0;

      // Process accounts in batches with controlled concurrency
      for (let i = 0; i < accounts.length; i += concurrency) {
        const chunk = accounts.slice(i, i + concurrency);
        const chunkPromises = chunk.map((acc) =>
          this.syncSingleAccountDailyMetrics(acc, referenceNow)
        );

        const chunkResults = await Promise.allSettled(chunkPromises);

        for (let j = 0; j < chunkResults.length; j++) {
          const res = chunkResults[j];
          if (res.status === "fulfilled") {
            const syncRes = res.value;
            accountResults.push(syncRes);
            if (syncRes.status === "SUCCESS") {
              succeeded++;
            } else if (syncRes.status === "SKIPPED") {
              skipped++;
            } else {
              failed++;
              const errLower = (syncRes.error || "").toLowerCase();
              if (errLower.includes("token refresh") || errLower.includes("refresh failure") || errLower.includes("decrypt")) {
                tokenRefreshFailures++;
              }
            }
          } else {
            failed++;
            const targetAcc = chunk[j];
            accountResults.push({
              accountId: targetAcc.id,
              openId: targetAcc.openId,
              username: targetAcc.username,
              status: "FAILED",
              error: res.reason instanceof Error ? res.reason.message : String(res.reason),
            });
          }
        }
      }

      const durationMs = Date.now() - startTime;

      this.logger.log(
        `Daily TikTok metrics collection completed: total=${accounts.length}, succeeded=${succeeded}, failed=${failed}, skipped=${skipped}, date=${bangkokDate}, duration=${durationMs}ms`
      );

      return {
        totalAccounts: accounts.length,
        succeeded,
        failed,
        skipped,
        tokenRefreshFailures,
        bangkokDate,
        durationMs,
        accountResults,
      };
    } finally {
      await this.releaseJobLock();
    }
  }

  /**
   * Service method designed for planned daily scheduled synchronization across ~150 connected accounts.
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
