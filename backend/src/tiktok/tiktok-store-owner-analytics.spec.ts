import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import type {
  SafeTikTokAccountOverviewResponse,
  TikTokHistoricalMetricsResponse,
} from "./dto/tiktok-sync.dto";
import { TikTokService } from "./tiktok.service";
import { TikTokStoreBindingService } from "./tiktok-store-binding.service";

test("store-owner analytics returns official account metrics without video records", async () => {
  const store = {
    id: "store-1",
    externalStoreId: "29039",
    storeName: "OBS Central World",
    accountName: "Internal account name",
    province: "Bangkok",
    region: "Central",
    tiktokUsername: "oppo_centralworld",
  };
  const overview: SafeTikTokAccountOverviewResponse = {
    id: "account-1",
    openId: "open-1",
    username: "oppo_centralworld",
    displayName: "OPPO Central World",
    avatarUrl: "https://example.com/avatar.jpg",
    avatarUrl100: null,
    avatarLargeUrl: null,
    bioDescription: null,
    profileDeepLink: null,
    profileWebLink: null,
    isVerified: true,
    followerCount: 1250,
    followingCount: 12,
    likesCount: 9800,
    videoCount: 34,
    connectionStatus: "CONNECTED",
    connectedAt: "2026-09-10T00:00:00.000Z",
    lastSyncedAt: "2026-09-10T01:00:00.000Z",
    storeMasterId: "store-1",
    storeMaster: {
      id: "store-1",
      storeName: "OBS Central World",
      accountName: "Internal account name",
      province: "Bangkok",
      region: "Central",
    },
    videos: [{
      id: "video-1",
      tikTokVideoId: "tiktok-video-1",
      title: "Internal video record",
      videoDescription: "Internal video record",
      createTime: "2026-09-09T00:00:00.000Z",
      coverImageUrl: "https://example.com/cover.jpg",
      shareUrl: "https://www.tiktok.com/@oppo/video/1",
      duration: 15,
      viewCount: 100,
      likeCount: 20,
      commentCount: 3,
      shareCount: 4,
      lastSyncedAt: "2026-09-10T01:00:00.000Z",
    }],
  };
  const historicalMetrics: TikTokHistoricalMetricsResponse = {
    accountId: "account-1",
    openId: "open-1",
    displayName: "OPPO Central World",
    username: "oppo_centralworld",
    summary: {
      currentFollowerCount: 1250,
      previousDayFollowerCount: 1242,
      dailyFollowerGrowth: 8,
      sevenDayFollowerCount: 1200,
      sevenDayFollowerGrowth: 50,
      thirtyDayFollowerCount: 1100,
      thirtyDayFollowerGrowth: 150,
    },
    history: [{
      id: "metric-1",
      metricDate: "2026-09-10",
      followerCount: 1250,
      followingCount: 12,
      likesCount: 9800,
      videoCount: 34,
      createdAt: "2026-09-10T01:00:00.000Z",
      updatedAt: "2026-09-10T01:00:00.000Z",
    }],
  };
  const prisma = {
    tikTokAccount: {
      findUnique: async () => ({
        id: "account-1",
        storeMasterId: "store-1",
        connectionStatus: "CONNECTED",
        storeMaster: store,
      }),
    },
    auditLog: {
      findMany: async () => [{ metadata: { accountId: "account-1", storeMasterId: "store-1" } }],
    },
    storeMaster: {
      findUnique: async () => store,
    },
  } as unknown as PrismaService;
  const tiktokService = {
    getTikTokAccountById: async () => overview,
    getAccountHistoricalMetrics: async () => historicalMetrics,
  } as unknown as TikTokService;

  const service = new TikTokStoreBindingService(prisma, tiktokService);
  const result = await service.getStoreOwnerAnalytics("account-1", "store-1");

  assert.equal(result.status, "CONNECTED");
  if (result.status !== "CONNECTED" || !result.account || !result.metrics) {
    throw new Error("Expected connected store-owner analytics");
  }
  assert.equal(result.account.followerCount, 1250);
  assert.equal(result.account.followingCount, 12);
  assert.equal(result.account.likesCount, 9800);
  assert.equal(result.metrics.summary.dailyFollowerGrowth, 8);
  assert.equal(result.metrics.summary.sevenDayFollowerGrowth, 50);
  assert.equal(result.metrics.summary.thirtyDayFollowerGrowth, 150);
  assert.equal("videos" in result.account, false);
});
