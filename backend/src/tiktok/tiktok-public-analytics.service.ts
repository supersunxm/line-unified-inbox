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
}
