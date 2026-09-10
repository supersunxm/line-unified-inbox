import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import type {
  TikTokHistoricalMetricsResponse,
} from "./dto/tiktok-sync.dto";
import { TikTokService } from "./tiktok.service";
import type { TikTokStoreOwnerAccountSnapshot } from "./tiktok.service";
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
  const accountSnapshot: TikTokStoreOwnerAccountSnapshot = {
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
    connectedAt: "2026-09-10T00:00:00.000Z",
    lastSyncedAt: "2026-09-10T01:00:00.000Z",
    storeMasterId: "store-1",
    storeMaster: {
      id: "store-1",
      externalStoreId: "29039",
      storeName: "OBS Central World",
      accountName: "Internal account name",
      province: "Bangkok",
      region: "Central",
      tiktokUsername: "oppo_centralworld",
    },
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
  let accountQuery: unknown;
  const prisma = {
    tikTokAccount: {
      findUnique: async (args: unknown) => {
        accountQuery = args;
        return {
          id: "account-1",
          storeMasterId: "store-1",
          connectionStatus: "CONNECTED",
          storeMaster: store,
        };
      },
    },
    auditLog: {
      findMany: async () => [{ metadata: { accountId: "account-1", storeMasterId: "store-1" } }],
    },
    storeMaster: {
      findUnique: async () => store,
    },
  } as unknown as PrismaService;
  const tiktokService = {
    getTikTokAccountForStoreOwner: async () => accountSnapshot,
    getTikTokAccountById: async () => {
      throw new Error("Public store-owner analytics must not call video-including account lookup");
    },
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

  assert.ok(accountQuery && typeof accountQuery === "object");
  const query = accountQuery as { include?: unknown; select?: Record<string, unknown> };
  assert.equal(query.include, undefined);
  assert.ok(query.select);
  assert.equal(query.select.videos, undefined);
});

test("TikTokService store-owner account snapshot selects account and store fields without TikTokVideo", async () => {
  let query: unknown;
  const prisma = {
    tikTokAccount: {
      findUnique: async (args: unknown) => {
        query = args;
        return {
          displayName: "OPPO Central World",
          username: "oppo_centralworld",
          avatarUrl: "https://example.com/avatar.jpg",
          avatarUrl100: null,
          avatarLargeUrl: null,
          bioDescription: null,
          isVerified: true,
          followerCount: 1250,
          followingCount: 12,
          likesCount: 9800,
          videoCount: 34,
          connectedAt: new Date("2026-09-10T00:00:00.000Z"),
          lastSyncedAt: new Date("2026-09-10T01:00:00.000Z"),
          storeMasterId: "store-1",
          storeMaster: {
            id: "store-1",
            externalStoreId: "29039",
            storeName: "OBS Central World",
            accountName: "Internal account name",
            province: "Bangkok",
            region: "Central",
            tiktokUsername: "oppo_centralworld",
          },
        };
      },
    },
  } as unknown as PrismaService;
  const service = new TikTokService(prisma, undefined as never);

  const result = await service.getTikTokAccountForStoreOwner("account-1");

  assert.equal(result?.followerCount, 1250);
  assert.equal(result?.storeMasterId, "store-1");
  assert.equal(result?.storeMaster?.storeName, "OBS Central World");
  assert.ok(query && typeof query === "object");
  const accountQuery = query as { include?: unknown; select?: Record<string, unknown> };
  assert.equal(accountQuery.include, undefined);
  assert.ok(accountQuery.select);
  assert.equal(accountQuery.select.videos, undefined);
  assert.equal((accountQuery.select.storeMaster as { select?: Record<string, unknown> }).select?.videos, undefined);
});
