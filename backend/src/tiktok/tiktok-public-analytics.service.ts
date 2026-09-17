import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import {
  probeTikTokPublicProfile,
  TikTokPublicProfile,
  TikTokPublicProbeResult,
} from "./tiktok-public-profile";

export interface TikTokPublicStoreTarget {
  id: string;
  tiktokUsername: string | null;
  tiktokProfileUrl: string | null;
}

export interface TikTokPublicPersistResult {
  storeMasterId: string;
  username: string;
  metricDate: string;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
  fetchedAt: string;
}

export interface TikTokPublicGrowthValue {
  absolute: number | null;
  percent: number | null;
}

export interface TikTokPublicDashboardStore {
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
}

export interface TikTokPublicDashboardOverview {
  trackedStores: number;
  totalFollowers: number;
  totalLikes: number;
  totalVideos: number;
  lastUpdatedAt: string | null;
  latestMetricDate: string | null;
}

export interface TikTokPublicHistoryPoint {
  metricDate: string;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
  fetchedAt: string;
}

interface RawPublicProfileRow {
  storeMasterId: string;
  externalStoreId?: string;
  storeName: string;
  accountName: string;
  province: string | null;
  region: string | null;
  tiktokPublicAccountId?: string | null;
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
  lastFetchedAt: Date | string;
}

interface RawPublicMetricRow {
  tiktokPublicAccountId?: string;
  storeMasterId?: string;
  metricDate: Date | string;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
  fetchedAt: Date | string;
}

export function getBangkokMetricDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) throw new Error("Invalid fetchedAt timestamp");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function assertExactTikTokPublicProfile(profile: TikTokPublicProfile): void {
  if (profile.metricPrecision !== "EXACT" || profile.metricSource !== "statsV2") {
    throw new Error("TikTok public metrics are not exact; refusing to persist rounded display metrics");
  }

  const metrics = [
    profile.followerCount,
    profile.followingCount,
    profile.likesCount,
    profile.videoCount,
  ];
  if (metrics.some((value) => value === null || !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("TikTok public exact metrics are incomplete or invalid");
  }
}

function isoDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function isoTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function dateMinusDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - days);
  return parsed.toISOString().slice(0, 10);
}

export function calculateTikTokGrowth(
  current: number,
  baseline: number | null,
): TikTokPublicGrowthValue {
  if (baseline === null) return { absolute: null, percent: null };
  const absolute = current - baseline;
  const percent = baseline > 0 ? (absolute / baseline) * 100 : null;
  return {
    absolute,
    percent: percent === null ? null : Math.round(percent * 100) / 100,
  };
}

export function baselineAtOrBefore(
  metrics: readonly RawPublicMetricRow[],
  targetDate: string,
): RawPublicMetricRow | null {
  let candidate: RawPublicMetricRow | null = null;
  for (const metric of metrics) {
    const date = isoDate(metric.metricDate);
    if (date > targetDate) continue;
    if (!candidate || isoDate(candidate.metricDate) < date) candidate = metric;
  }
  return candidate;
}

@Injectable()
export class TikTokPublicAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async syncStoreByStoreMasterId(storeMasterId: string): Promise<TikTokPublicPersistResult> {
    const store = await this.prisma.storeMaster.findUnique({
      where: { id: storeMasterId },
      select: {
        id: true,
        tiktokUsername: true,
        tiktokProfileUrl: true,
      },
    });

    if (!store) throw new Error("StoreMaster not found");
    const usernameInput = store.tiktokUsername ?? store.tiktokProfileUrl;
    if (!usernameInput) throw new Error("StoreMaster has no TikTok username or profile URL");

    const result = await probeTikTokPublicProfile(usernameInput);
    return this.persistExactSnapshot(store, result);
  }

  async persistExactSnapshot(
    store: TikTokPublicStoreTarget,
    result: TikTokPublicProbeResult,
  ): Promise<TikTokPublicPersistResult> {
    if (result.status !== "OK" || !result.profile) {
      throw new Error(result.diagnostics.message ?? "TikTok public profile could not be collected");
    }

    const profile = result.profile;
    assertExactTikTokPublicProfile(profile);
    const metricDate = getBangkokMetricDate(result.fetchedAt);
    const fetchedAt = new Date(result.fetchedAt);

    const followerCount = profile.followerCount as number;
    const followingCount = profile.followingCount as number;
    const likesCount = profile.likesCount as number;
    const videoCount = profile.videoCount as number;

    await this.prisma.$transaction(async (tx) => {
      const publicAccount = await tx.tikTokPublicAccount.upsert({
        where: { username: profile.username },
        create: {
          username: profile.username,
          displayName: profile.displayName || null,
          profileUrl: profile.profileUrl,
          source: profile.metricSource ?? "TOKCOUNTER",
          firstSeenAt: fetchedAt,
          lastCollectedAt: fetchedAt,
        },
        update: {
          displayName: profile.displayName || undefined,
          profileUrl: profile.profileUrl,
          lastCollectedAt: fetchedAt,
        },
      });

      await tx.storeMaster.update({
        where: { id: store.id },
        data: {
          tiktokPublicAccountId: publicAccount.id,
          tiktokUsername: profile.username,
          tiktokProfileUrl: profile.profileUrl,
        },
      });

      const metricDateObj = new Date(`${metricDate}T00:00:00.000Z`);
      await tx.tikTokPublicDailyMetric.upsert({
        where: {
          tiktokPublicAccountId_metricDate: {
            tiktokPublicAccountId: publicAccount.id,
            metricDate: metricDateObj,
          },
        },
        create: {
          tiktokPublicAccountId: publicAccount.id,
          metricDate: metricDateObj,
          followerCount,
          followingCount,
          likesCount,
          videoCount,
          precision: profile.metricPrecision ?? "EXACT",
          source: profile.metricSource ?? "TOKCOUNTER",
          collectedAt: fetchedAt,
        },
        update: {
          followerCount,
          followingCount,
          likesCount,
          videoCount,
          precision: profile.metricPrecision ?? "EXACT",
          source: profile.metricSource ?? "TOKCOUNTER",
          collectedAt: fetchedAt,
        },
      });
    });

    return {
      storeMasterId: store.id,
      username: profile.username,
      metricDate,
      followerCount,
      followingCount,
      likesCount,
      videoCount,
      fetchedAt: result.fetchedAt,
    };
  }

  async listDashboardStores(): Promise<TikTokPublicDashboardStore[]> {
    const profiles = await this.prisma.$queryRawUnsafe<RawPublicProfileRow[]>(
      `SELECT
        s."id" AS "storeMasterId",
        s."externalStoreId",
        s."storeName",
        s."accountName",
        s."province",
        s."region",
        a."id" AS "tiktokPublicAccountId",
        COALESCE(a."username", p."username", s."tiktokUsername") AS "username",
        COALESCE(a."displayName", p."displayName") AS "displayName",
        p."avatarUrl",
        p."bioDescription",
        p."isVerified",
        COALESCE(m."followerCount", p."followerCount", 0)::int AS "followerCount",
        COALESCE(m."followingCount", p."followingCount", 0)::int AS "followingCount",
        COALESCE(m."likesCount", p."likesCount", 0)::int AS "likesCount",
        COALESCE(m."videoCount", p."videoCount", 0)::int AS "videoCount",
        COALESCE(a."profileUrl", p."profileUrl", s."tiktokProfileUrl") AS "profileUrl",
        COALESCE(m."collectedAt", a."lastCollectedAt", p."lastFetchedAt", CURRENT_TIMESTAMP) AS "lastFetchedAt"
      FROM "StoreMaster" s
      LEFT JOIN "TikTokPublicAccount" a ON s."tiktokPublicAccountId" = a."id"
      LEFT JOIN "TikTokPublicProfile" p ON p."storeMasterId" = s."id"
      LEFT JOIN LATERAL (
        SELECT m1."followerCount", m1."followingCount", m1."likesCount", m1."videoCount", m1."collectedAt"
        FROM "TikTokPublicDailyMetric" m1
        WHERE m1."tiktokPublicAccountId" = a."id"
        ORDER BY m1."metricDate" DESC
        LIMIT 1
      ) m ON true
      WHERE s."isActive" = true
        AND (a."id" IS NOT NULL OR p."id" IS NOT NULL)
      ORDER BY COALESCE(m."followerCount", p."followerCount", 0) DESC NULLS LAST, s."storeName" ASC`,
    );

    if (profiles.length === 0) return [];
    const accountIds = profiles
      .map((row) => row.tiktokPublicAccountId)
      .filter((id): id is string => Boolean(id));

    let metrics: RawPublicMetricRow[] = [];
    if (accountIds.length > 0) {
      metrics = await this.prisma.$queryRawUnsafe<RawPublicMetricRow[]>(
        `SELECT "tiktokPublicAccountId", "metricDate", "followerCount", "followingCount", "likesCount", "videoCount", "collectedAt" AS "fetchedAt"
         FROM "TikTokPublicDailyMetric"
         WHERE "tiktokPublicAccountId" = ANY($1::text[])
           AND "metricDate" >= (CURRENT_DATE - INTERVAL '35 days')
         ORDER BY "tiktokPublicAccountId", "metricDate" ASC`,
        accountIds,
      );
    }

    const byAccount = new Map<string, RawPublicMetricRow[]>();
    for (const metric of metrics) {
      if (!metric.tiktokPublicAccountId) continue;
      const current = byAccount.get(metric.tiktokPublicAccountId) ?? [];
      current.push(metric);
      byAccount.set(metric.tiktokPublicAccountId, current);
    }

    return profiles.map((profile) => {
      const storeMetrics = (profile.tiktokPublicAccountId ? byAccount.get(profile.tiktokPublicAccountId) : null) ?? [];
      const latestDate = getBangkokMetricDate(profile.lastFetchedAt);
      const oneDay = baselineAtOrBefore(storeMetrics, dateMinusDays(latestDate, 1));
      const sevenDay = baselineAtOrBefore(storeMetrics, dateMinusDays(latestDate, 7));
      const thirtyDay = baselineAtOrBefore(storeMetrics, dateMinusDays(latestDate, 30));

      return {
        storeMasterId: profile.storeMasterId,
        storeName: profile.storeName,
        accountName: profile.accountName,
        province: profile.province,
        region: profile.region,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        bioDescription: profile.bioDescription,
        isVerified: profile.isVerified,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        likesCount: profile.likesCount,
        videoCount: profile.videoCount,
        profileUrl: profile.profileUrl,
        lastFetchedAt: isoTimestamp(profile.lastFetchedAt),
        growth: {
          daily: calculateTikTokGrowth(profile.followerCount, oneDay?.followerCount ?? null),
          sevenDay: calculateTikTokGrowth(profile.followerCount, sevenDay?.followerCount ?? null),
          thirtyDay: calculateTikTokGrowth(profile.followerCount, thirtyDay?.followerCount ?? null),
        },
      };
    });
  }

  async getDashboardOverview(): Promise<TikTokPublicDashboardOverview> {
    const stores = await this.listDashboardStores();
    const latestMetricRow = await this.prisma.tikTokPublicDailyMetric.findFirst({
      orderBy: { metricDate: "desc" },
      select: { metricDate: true },
    });
    return {
      trackedStores: stores.length,
      totalFollowers: stores.reduce((sum, store) => sum + store.followerCount, 0),
      totalLikes: stores.reduce((sum, store) => sum + store.likesCount, 0),
      totalVideos: stores.reduce((sum, store) => sum + store.videoCount, 0),
      lastUpdatedAt: stores.reduce<string | null>((latest, store) => {
        if (!latest || store.lastFetchedAt > latest) return store.lastFetchedAt;
        return latest;
      }, null),
      latestMetricDate: latestMetricRow ? isoDate(latestMetricRow.metricDate) : null,
    };
  }

  async getStoreDashboard(storeMasterId: string): Promise<TikTokPublicDashboardStore | null> {
    const stores = await this.listDashboardStores();
    return stores.find((store) => store.storeMasterId === storeMasterId) ?? null;
  }

  async getStoreHistory(storeMasterId: string, days = 30): Promise<TikTokPublicHistoryPoint[]> {
    const safeDays = Math.min(Math.max(Math.trunc(days) || 30, 1), 365);
    const rows = await this.prisma.$queryRawUnsafe<RawPublicMetricRow[]>(
      `SELECT m."metricDate", m."followerCount", m."followingCount", m."likesCount", m."videoCount", m."collectedAt" AS "fetchedAt"
       FROM "TikTokPublicDailyMetric" m
       INNER JOIN "StoreMaster" s ON s."tiktokPublicAccountId" = m."tiktokPublicAccountId"
       WHERE (s."id" = $1 OR s."externalStoreId" = $1)
         AND m."metricDate" >= (CURRENT_DATE - ($2::int * INTERVAL '1 day'))
       ORDER BY m."metricDate" ASC`,
      storeMasterId,
      safeDays,
    );

    return rows.map((row) => ({
      metricDate: isoDate(row.metricDate),
      followerCount: row.followerCount,
      followingCount: row.followingCount ?? 0,
      likesCount: row.likesCount ?? 0,
      videoCount: row.videoCount ?? 0,
      fetchedAt: isoTimestamp(row.fetchedAt),
    }));
  }

  async getRanking(
    metric: "followers" | "likes" | "videos" | "growth7d" = "followers",
    limit = 20,
  ): Promise<TikTokPublicDashboardStore[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 20, 1), 200);
    const stores = await this.listDashboardStores();
    const sorted = [...stores].sort((a, b) => {
      if (metric === "likes") return b.likesCount - a.likesCount;
      if (metric === "videos") return b.videoCount - a.videoCount;
      if (metric === "growth7d") {
        return (b.growth.sevenDay.percent ?? Number.NEGATIVE_INFINITY) -
          (a.growth.sevenDay.percent ?? Number.NEGATIVE_INFINITY);
      }
      return b.followerCount - a.followerCount;
    });
    return sorted.slice(0, safeLimit);
  }
}
