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
  lastFetchedAt: Date | string;
}

interface RawPublicMetricRow {
  storeMasterId: string;
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

function baselineAtOrBefore(
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
      await tx.$executeRawUnsafe(
        `INSERT INTO "TikTokPublicProfile" (
          "id", "storeMasterId", "username", "displayName", "avatarUrl", "bioDescription", "isVerified",
          "followerCount", "followingCount", "likesCount", "videoCount", "profileUrl", "metricSource",
          "metricPrecision", "lastFetchedAt", "createdAt", "updatedAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT ("storeMasterId") DO UPDATE SET
          "username" = EXCLUDED."username",
          "displayName" = EXCLUDED."displayName",
          "avatarUrl" = EXCLUDED."avatarUrl",
          "bioDescription" = EXCLUDED."bioDescription",
          "isVerified" = EXCLUDED."isVerified",
          "followerCount" = EXCLUDED."followerCount",
          "followingCount" = EXCLUDED."followingCount",
          "likesCount" = EXCLUDED."likesCount",
          "videoCount" = EXCLUDED."videoCount",
          "profileUrl" = EXCLUDED."profileUrl",
          "metricSource" = EXCLUDED."metricSource",
          "metricPrecision" = EXCLUDED."metricPrecision",
          "lastFetchedAt" = EXCLUDED."lastFetchedAt",
          "updatedAt" = CURRENT_TIMESTAMP`,
        randomUUID(),
        store.id,
        profile.username,
        profile.displayName,
        profile.avatarUrl,
        profile.bioDescription,
        profile.isVerified,
        followerCount,
        followingCount,
        likesCount,
        videoCount,
        profile.profileUrl,
        profile.metricSource,
        profile.metricPrecision,
        fetchedAt,
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO "TikTokPublicDailyMetric" (
          "id", "storeMasterId", "metricDate", "followerCount", "followingCount", "likesCount", "videoCount",
          "metricSource", "metricPrecision", "fetchedAt", "createdAt", "updatedAt"
        ) VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT ("storeMasterId", "metricDate") DO UPDATE SET
          "followerCount" = EXCLUDED."followerCount",
          "followingCount" = EXCLUDED."followingCount",
          "likesCount" = EXCLUDED."likesCount",
          "videoCount" = EXCLUDED."videoCount",
          "metricSource" = EXCLUDED."metricSource",
          "metricPrecision" = EXCLUDED."metricPrecision",
          "fetchedAt" = EXCLUDED."fetchedAt",
          "updatedAt" = CURRENT_TIMESTAMP`,
        randomUUID(),
        store.id,
        metricDate,
        followerCount,
        followingCount,
        likesCount,
        videoCount,
        profile.metricSource,
        profile.metricPrecision,
        fetchedAt,
      );
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
        p."storeMasterId", s."storeName", s."accountName", s."province", s."region",
        p."username", p."displayName", p."avatarUrl", p."bioDescription", p."isVerified",
        p."followerCount", p."followingCount", p."likesCount", p."videoCount", p."profileUrl", p."lastFetchedAt"
      FROM "TikTokPublicProfile" p
      INNER JOIN "StoreMaster" s ON s."id" = p."storeMasterId"
      WHERE s."isActive" = true
      ORDER BY p."followerCount" DESC, s."storeName" ASC`,
    );

    if (profiles.length === 0) return [];
    const storeIds = profiles.map((row) => row.storeMasterId);
    const metrics = await this.prisma.$queryRawUnsafe<RawPublicMetricRow[]>(
      `SELECT "storeMasterId", "metricDate", "followerCount", "followingCount", "likesCount", "videoCount", "fetchedAt"
       FROM "TikTokPublicDailyMetric"
       WHERE "storeMasterId" = ANY($1::text[])
         AND "metricDate" >= (CURRENT_DATE - INTERVAL '35 days')
       ORDER BY "storeMasterId", "metricDate" ASC`,
      storeIds,
    );

    const byStore = new Map<string, RawPublicMetricRow[]>();
    for (const metric of metrics) {
      const current = byStore.get(metric.storeMasterId) ?? [];
      current.push(metric);
      byStore.set(metric.storeMasterId, current);
    }

    return profiles.map((profile) => {
      const storeMetrics = byStore.get(profile.storeMasterId) ?? [];
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
    return {
      trackedStores: stores.length,
      totalFollowers: stores.reduce((sum, store) => sum + store.followerCount, 0),
      totalLikes: stores.reduce((sum, store) => sum + store.likesCount, 0),
      totalVideos: stores.reduce((sum, store) => sum + store.videoCount, 0),
      lastUpdatedAt: stores.reduce<string | null>((latest, store) => {
        if (!latest || store.lastFetchedAt > latest) return store.lastFetchedAt;
        return latest;
      }, null),
    };
  }

  async getStoreDashboard(storeMasterId: string): Promise<TikTokPublicDashboardStore | null> {
    const stores = await this.listDashboardStores();
    return stores.find((store) => store.storeMasterId === storeMasterId) ?? null;
  }

  async getStoreHistory(storeMasterId: string, days = 30): Promise<TikTokPublicHistoryPoint[]> {
    const safeDays = Math.min(Math.max(Math.trunc(days) || 30, 1), 365);
    const rows = await this.prisma.$queryRawUnsafe<RawPublicMetricRow[]>(
      `SELECT "storeMasterId", "metricDate", "followerCount", "followingCount", "likesCount", "videoCount", "fetchedAt"
       FROM "TikTokPublicDailyMetric"
       WHERE "storeMasterId" = $1
         AND "metricDate" >= (CURRENT_DATE - ($2::int * INTERVAL '1 day'))
       ORDER BY "metricDate" ASC`,
      storeMasterId,
      safeDays,
    );

    return rows.map((row) => ({
      metricDate: isoDate(row.metricDate),
      followerCount: row.followerCount,
      followingCount: row.followingCount,
      likesCount: row.likesCount,
      videoCount: row.videoCount,
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
