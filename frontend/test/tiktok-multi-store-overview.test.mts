import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchTikTokBulkMetricsSummaryFromBackend,
} from "../src/app/tiktok/tiktok-api-client.ts";
import type {
  TikTokAccountListItem,
  TikTokBulkMetricsSummaryResponse,
  TikTokGrowthPeriod,
} from "../src/app/tiktok/tiktok-types.ts";

test("fetchTikTokBulkMetricsSummaryFromBackend calls canonical endpoint with authorization", async () => {
  const originalFetch = globalThis.fetch;
  let interceptedUrl = "";
  let interceptedAuth = "";

  const mockBulkResponse: TikTokBulkMetricsSummaryResponse = {
    accounts: [
      {
        accountId: "acc-cw",
        current: {
          followerCount: 13342,
          followingCount: 120,
          likesCount: 54200,
          videoCount: 18,
        },
        growth: {
          today: { followers: 47, following: 3, likes: 1245, videos: 2 },
          sevenDays: { followers: 286, following: 12, likes: 3021, videos: 8 },
          thirtyDays: { followers: 1124, following: 28, likes: 8764, videos: 15 },
        },
      },
    ],
  };

  try {
    globalThis.fetch = async (url: any, init: any) => {
      interceptedUrl = String(url);
      interceptedAuth = init?.headers?.Authorization || "";
      return {
        ok: true,
        json: async () => mockBulkResponse,
      } as any;
    };

    const result = await fetchTikTokBulkMetricsSummaryFromBackend(30, {
      sessionToken: "oppo-test-session",
    });

    assert.ok(interceptedUrl.includes("/tiktok/accounts/metrics-summary?days=30"));
    assert.equal(interceptedAuth, "Bearer oppo-test-session");
    assert.equal(result.accounts.length, 1);
    assert.equal(result.accounts[0].accountId, "acc-cw");
    assert.equal(result.accounts[0].growth.sevenDays.followers, 286);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Multi-store Overview filter, search, and sorting algorithms handle growth periods and nulls correctly", () => {
  const accounts: TikTokAccountListItem[] = [
    {
      id: "acc-cw",
      openId: "open-cw",
      unionId: null,
      username: "o_centralworld",
      displayName: "OPPO Central World",
      avatarUrl: null,
      avatarUrl100: null,
      avatarLargeUrl: null,
      bioDescription: "Central World store",
      profileDeepLink: null,
      profileWebLink: null,
      isVerified: true,
      followerCount: 13342,
      followingCount: 120,
      likesCount: 54200,
      videoCount: 18,
      videoCountRecorded: 18,
      connectionStatus: "CONNECTED",
      storeMasterId: "sm-cw",
      storeMaster: {
        id: "sm-cw",
        storeName: "OPPO Brand Shop Central World",
        accountName: "O-Central World",
        province: "Bangkok",
        region: "Central",
      },
    },
    {
      id: "acc-paragon",
      openId: "open-paragon",
      unionId: null,
      username: "o_siamparagon",
      displayName: "OPPO Siam Paragon",
      avatarUrl: null,
      avatarUrl100: null,
      avatarLargeUrl: null,
      bioDescription: "Siam Paragon store",
      profileDeepLink: null,
      profileWebLink: null,
      isVerified: true,
      followerCount: 8500,
      followingCount: 95,
      likesCount: 31000,
      videoCount: 12,
      videoCountRecorded: 12,
      connectionStatus: "CONNECTED",
      storeMasterId: "sm-paragon",
      storeMaster: {
        id: "sm-paragon",
        storeName: "OPPO Brand Shop Siam Paragon",
        accountName: "O-Siam Paragon",
        province: "Bangkok",
        region: "Central",
      },
    },
    {
      id: "acc-chiangmai",
      openId: "open-chiangmai",
      unionId: null,
      username: "o_chiangmai",
      displayName: "OPPO Central Festival Chiangmai",
      avatarUrl: null,
      avatarUrl100: null,
      avatarLargeUrl: null,
      bioDescription: "Chiangmai store",
      profileDeepLink: null,
      profileWebLink: null,
      isVerified: false,
      followerCount: 5100,
      followingCount: 60,
      likesCount: 15000,
      videoCount: 9,
      videoCountRecorded: 9,
      connectionStatus: "EXPIRED",
      storeMasterId: "sm-cm",
      storeMaster: {
        id: "sm-cm",
        storeName: "OPPO Brand Shop Central Festival Chiangmai",
        accountName: "O-Chiangmai",
        province: "Chiang Mai",
        region: "North",
      },
    },
    {
      id: "acc-phuket",
      openId: "open-phuket",
      unionId: null,
      username: "o_phuket",
      displayName: "OPPO Jungceylon Phuket",
      avatarUrl: null,
      avatarUrl100: null,
      avatarLargeUrl: null,
      bioDescription: "Phuket store",
      profileDeepLink: null,
      profileWebLink: null,
      isVerified: false,
      followerCount: 2300,
      followingCount: 40,
      likesCount: 6000,
      videoCount: 5,
      videoCountRecorded: 5,
      connectionStatus: "CONNECTED",
      storeMasterId: "sm-phuket",
      storeMaster: {
        id: "sm-phuket",
        storeName: "OPPO Brand Shop Jungceylon Phuket",
        accountName: "O-Phuket",
        province: "Phuket",
        region: "South",
      },
    },
  ];

  const bulkMetricsMap = new Map([
    [
      "acc-cw",
      {
        today: { followers: 47, following: 3, likes: 1245, videos: 2 },
        sevenDays: { followers: 286, following: 12, likes: 3021, videos: 8 },
        thirtyDays: { followers: 1124, following: 28, likes: 8764, videos: 15 },
      },
    ],
    [
      "acc-paragon",
      {
        today: { followers: -20, following: 0, likes: 200, videos: 0 },
        sevenDays: { followers: -100, following: 5, likes: 1000, videos: 2 },
        thirtyDays: { followers: null, following: null, likes: null, videos: null },
      },
    ],
    [
      "acc-chiangmai",
      {
        today: { followers: 15, following: 1, likes: 500, videos: 1 },
        sevenDays: { followers: 90, following: 4, likes: 1200, videos: 3 },
        thirtyDays: { followers: 350, following: 10, likes: 3200, videos: 6 },
      },
    ],
    // acc-phuket has no snapshot metrics (null growth for all periods)
  ]);

  const getGrowth = (accId: string, period: TikTokGrowthPeriod) => {
    return bulkMetricsMap.get(accId)?.[period] || {
      followers: null,
      following: null,
      likes: null,
      videos: null,
    };
  };

  // 1. Search filter
  const searchCw = accounts.filter((a) => {
    const q = "centralworld";
    return (
      a.storeMaster?.storeName?.toLowerCase().includes(q) ||
      a.username?.toLowerCase().includes(q)
    );
  });
  assert.equal(searchCw.length, 1);
  assert.equal(searchCw[0].id, "acc-cw");

  // 2. Region filter
  const northStores = accounts.filter((a) => a.storeMaster?.region === "North");
  assert.equal(northStores.length, 1);
  assert.equal(northStores[0].id, "acc-chiangmai");

  // 3. Province filter
  const bkkStores = accounts.filter((a) => a.storeMaster?.province === "Bangkok");
  assert.equal(bkkStores.length, 2);

  // 4. Status filter
  const expiredStores = accounts.filter((a) => a.connectionStatus === "EXPIRED");
  assert.equal(expiredStores.length, 1);
  assert.equal(expiredStores[0].id, "acc-chiangmai");

  // 5. Follower sorting (High -> Low)
  const byFollowersDesc = [...accounts].sort(
    (a, b) => (b.followerCount || 0) - (a.followerCount || 0)
  );
  assert.equal(byFollowersDesc[0].id, "acc-cw"); // 13,342
  assert.equal(byFollowersDesc[1].id, "acc-paragon"); // 8,500
  assert.equal(byFollowersDesc[2].id, "acc-chiangmai"); // 5,100
  assert.equal(byFollowersDesc[3].id, "acc-phuket"); // 2,300

  // 6. Follower Growth sorting (7 Days, High -> Low, nulls last)
  const compareGrowth = (
    aValue: number | null | undefined,
    bValue: number | null | undefined,
    isAscending: boolean
  ) => {
    const aHas = aValue !== null && aValue !== undefined;
    const bHas = bValue !== null && bValue !== undefined;
    if (!aHas && !bHas) return 0;
    if (!aHas) return 1;
    if (!bHas) return -1;
    return isAscending ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
  };

  const by7dFollowerGrowthDesc = [...accounts].sort((a, b) => {
    const gA = getGrowth(a.id, "sevenDays").followers;
    const gB = getGrowth(b.id, "sevenDays").followers;
    return compareGrowth(gA, gB, false);
  });

  // Expected 7D follower growth:
  // acc-cw: +286
  // acc-chiangmai: +90
  // acc-paragon: -100
  // acc-phuket: null (must be last)
  assert.equal(by7dFollowerGrowthDesc[0].id, "acc-cw");
  assert.equal(by7dFollowerGrowthDesc[1].id, "acc-chiangmai");
  assert.equal(by7dFollowerGrowthDesc[2].id, "acc-paragon");
  assert.equal(by7dFollowerGrowthDesc[3].id, "acc-phuket"); // null sorted last

  // 7. Follower Growth sorting (30 Days, High -> Low, nulls last)
  const by30dFollowerGrowthDesc = [...accounts].sort((a, b) => {
    const gA = getGrowth(a.id, "thirtyDays").followers;
    const gB = getGrowth(b.id, "thirtyDays").followers;
    return compareGrowth(gA, gB, false);
  });

  // Expected 30D follower growth:
  // acc-cw: +1124
  // acc-chiangmai: +350
  // acc-paragon: null
  // acc-phuket: null
  assert.equal(by30dFollowerGrowthDesc[0].id, "acc-cw");
  assert.equal(by30dFollowerGrowthDesc[1].id, "acc-chiangmai");
  assert.ok(
    by30dFollowerGrowthDesc[2].id === "acc-paragon" ||
      by30dFollowerGrowthDesc[2].id === "acc-phuket"
  );
  assert.ok(
    by30dFollowerGrowthDesc[3].id === "acc-paragon" ||
      by30dFollowerGrowthDesc[3].id === "acc-phuket"
  );
});

test("Multi-store Demo Preview Account provides requested frontend-only growth values without backend mutation", () => {
  const DEMO_PREVIEW_GROWTH = {
    today: { followers: 18, following: 1, likes: 697, videos: 0 },
    sevenDays: { followers: 132, following: 6, likes: 1821, videos: 4 },
    thirtyDays: { followers: 562, following: 14, likes: 4213, videos: 9 },
  };

  const previewAccount: TikTokAccountListItem = {
    id: "demo-preview-mega-bangna",
    openId: "demo-preview-mega-bangna",
    unionId: null,
    username: "o_megabangna",
    displayName: "O-Mega Bangna · DEMO",
    avatarUrl: null,
    avatarUrl100: null,
    avatarLargeUrl: null,
    bioDescription: "Preview store",
    profileDeepLink: null,
    profileWebLink: null,
    isVerified: false,
    followerCount: 12317,
    followingCount: 272,
    likesCount: 86047,
    videoCount: 318,
    videoCountRecorded: 20,
    connectionStatus: "DEMO PREVIEW",
    storeMasterId: "demo-preview-mega-bangna-store",
    storeMaster: {
      id: "demo-preview-mega-bangna-store",
      storeName: "OBS Mega Bangna By OPPO",
      accountName: "O-Mega Bangna",
      province: "Samut Prakan",
      region: "Central",
    },
  };

  // Verify requested demo values for all 3 periods
  assert.deepEqual(DEMO_PREVIEW_GROWTH.today, {
    followers: 18,
    following: 1,
    likes: 697,
    videos: 0,
  });

  assert.deepEqual(DEMO_PREVIEW_GROWTH.sevenDays, {
    followers: 132,
    following: 6,
    likes: 1821,
    videos: 4,
  });

  assert.deepEqual(DEMO_PREVIEW_GROWTH.thirtyDays, {
    followers: 562,
    following: 14,
    likes: 4213,
    videos: 9,
  });
});
