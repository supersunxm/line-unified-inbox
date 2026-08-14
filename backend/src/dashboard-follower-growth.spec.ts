import test from "node:test";
import assert from "node:assert/strict";
import { DashboardAnalyticsService } from "./dashboard-analytics.service";
import { FollowerInsightsService } from "./follower-insights/follower-insights.service";
import {
  getTodayBangkokDateString,
  getPreviousBangkokDateString,
  getOffsetBangkokDateString,
  toUtcDateForDb,
  formatDbDateToIso,
} from "./follower-insights/date-utils";
import {
  calculateFollowerGrowthMetrics,
  calculateStoreFollowerRanking,
  getPeriodDates,
} from "./follower-insights/follower-aggregation.helper";

test("CRITICAL TEST 1: Data Source Consistency between FollowerInsightsService and DashboardAnalyticsService", async () => {
  const todayIso = getTodayBangkokDateString();
  const yesterdayIso = getPreviousBangkokDateString(todayIso);
  const todayUtc = toUtcDateForDb(todayIso);
  const yesterdayUtc = toUtcDateForDb(yesterdayIso);

  // Dataset:
  // OA A: yesterday followers=100, blocks=10; today followers=108, blocks=12
  // OA B: yesterday followers=200, blocks=5;  today followers=205, blocks=6
  const mockAccounts = [
    {
      id: "oa_1",
      name: "OA A",
      isActive: true,
      archivedAt: null,
      storeId: "store_1",
      store: {
        id: "store_1",
        name: "Store 1",
        archivedAt: null,
        storeMaster: { externalStoreId: "EXT001" },
      },
    },
    {
      id: "oa_2",
      name: "OA B",
      isActive: true,
      archivedAt: null,
      storeId: "store_2",
      store: {
        id: "store_2",
        name: "Store 2",
        archivedAt: null,
        storeMaster: { externalStoreId: "EXT002" },
      },
    },
  ];

  const mockSnapshots = [
    {
      id: "snap_1",
      lineOaId: "oa_1",
      snapshotDate: yesterdayUtc,
      status: "ready",
      followers: 100,
      targetedReaches: 90,
      blocks: 10,
    },
    {
      id: "snap_2",
      lineOaId: "oa_1",
      snapshotDate: todayUtc,
      status: "ready",
      followers: 108,
      targetedReaches: 98,
      blocks: 12,
    },
    {
      id: "snap_3",
      lineOaId: "oa_2",
      snapshotDate: yesterdayUtc,
      status: "ready",
      followers: 200,
      targetedReaches: 180,
      blocks: 5,
    },
    {
      id: "snap_4",
      lineOaId: "oa_2",
      snapshotDate: todayUtc,
      status: "ready",
      followers: 205,
      targetedReaches: 185,
      blocks: 6,
    },
  ];

  const fakePrisma: any = {
    lineOfficialAccount: {
      findMany: async (args: any) => {
        return mockAccounts.map((a) => ({
          ...a,
          followerSnapshots: mockSnapshots.filter((s) => s.lineOaId === a.id),
        }));
      },
      findFirst: async () => null,
    },
    lineOaFollowerSnapshot: {
      findMany: async (args: any) => {
        if (args?.where?.snapshotDate?.in) {
          const inDates = args.where.snapshotDate.in;
          return mockSnapshots.filter((s) => inDates.some((d: Date) => d.getTime() === s.snapshotDate.getTime()));
        }
        if (args?.where?.snapshotDate?.gte) {
          const gte = args.where.snapshotDate.gte.getTime();
          const lte = args.where.snapshotDate.lte.getTime();
          return mockSnapshots.filter((s) => s.snapshotDate.getTime() >= gte && s.snapshotDate.getTime() <= lte);
        }
        if (args?.orderBy?.snapshotDate === "desc") {
          return [...mockSnapshots].sort((a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime());
        }
        return mockSnapshots;
      },
    },
    store: {
      findMany: async () => [mockAccounts[0].store, mockAccounts[1].store],
    },
    conversation: { findMany: async () => [] },
    topic: { findMany: async () => [] },
    productModel: { findMany: async () => [] },
    conversationActivity: { findMany: async () => [] },
  };

  const followerInsightsService = new FollowerInsightsService(fakePrisma, {} as any);
  const dashboardAnalyticsService = new DashboardAnalyticsService(fakePrisma);

  // 1. Compute via FollowerInsightsService
  const followerSummary = await followerInsightsService.getSummary({
    dateFrom: todayIso,
    dateTo: todayIso,
  });

  const followerByStore = await followerInsightsService.getByStore({
    date: todayIso,
  });

  // 2. Compute via DashboardAnalyticsService
  const dashboardAnalytics = await dashboardAnalyticsService.getAnalytics("today", "HEAD_OFFICE");

  // Verify FollowerInsightsService results for Today
  assert.equal(followerSummary.length, 1);
  const summaryRow = followerSummary[0];
  assert.equal(summaryRow.followers, 313); // 108 + 205
  assert.equal(summaryRow.dailyIncrease, 13); // (108 - 100) + (205 - 200) = 8 + 5 = 13

  // Verify ByStore results
  const totalByStoreIncrease = followerByStore.reduce((s, r) => s + (r.dailyIncrease ?? 0), 0);
  assert.equal(totalByStoreIncrease, 13);

  // Verify DashboardAnalyticsService results
  const growth = dashboardAnalytics.summaryCards.followerGrowth;
  assert.equal(growth.totalFriends, 313);
  assert.equal(growth.addedToday, 13);
  assert.equal(growth.blockedToday, 3); // (12 - 10) + (6 - 5) = 2 + 1 = 3
  assert.equal(growth.netToday, 10); // 13 - 3 = 10

  // Verify consistency between both services
  assert.equal(growth.addedToday, summaryRow.dailyIncrease);
  assert.equal(growth.totalFriends, summaryRow.followers);
});

test("CRITICAL TEST 2: Missing Baseline Account Excluded from Growth Delta, Included in Total Stock", async () => {
  const todayIso = getTodayBangkokDateString();
  const yesterdayIso = getPreviousBangkokDateString(todayIso);
  const todayUtc = toUtcDateForDb(todayIso);
  const yesterdayUtc = toUtcDateForDb(yesterdayIso);

  // OA A: yesterday=100, today=108 (+8)
  // OA B: yesterday=MISSING, today=500 (newly added / backfilled)
  const mockAccounts = [
    {
      id: "oa_1",
      name: "OA A",
      isActive: true,
      archivedAt: null,
      storeId: "store_1",
      store: { id: "store_1", name: "Store 1", archivedAt: null },
    },
    {
      id: "oa_2",
      name: "OA B",
      isActive: true,
      archivedAt: null,
      storeId: "store_2",
      store: { id: "store_2", name: "Store 2", archivedAt: null },
    },
  ];

  const mockSnapshots = [
    {
      id: "snap_1",
      lineOaId: "oa_1",
      snapshotDate: yesterdayUtc,
      status: "ready",
      followers: 100,
      blocks: 10,
    },
    {
      id: "snap_2",
      lineOaId: "oa_1",
      snapshotDate: todayUtc,
      status: "ready",
      followers: 108,
      blocks: 12,
    },
    {
      id: "snap_3",
      lineOaId: "oa_2",
      snapshotDate: todayUtc,
      status: "ready",
      followers: 500,
      blocks: 20,
    },
  ];

  const fakePrisma: any = {
    lineOfficialAccount: { findMany: async () => mockAccounts },
    lineOaFollowerSnapshot: {
      findMany: async (args: any) => {
        if (args?.where?.snapshotDate?.in) {
          const inDates = args.where.snapshotDate.in;
          return mockSnapshots.filter((s) => inDates.some((d: Date) => d.getTime() === s.snapshotDate.getTime()));
        }
        if (args?.orderBy?.snapshotDate === "desc") {
          return [...mockSnapshots].sort((a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime());
        }
        return mockSnapshots;
      },
    },
    store: { findMany: async () => [mockAccounts[0].store, mockAccounts[1].store] },
    conversation: { findMany: async () => [] },
    topic: { findMany: async () => [] },
    productModel: { findMany: async () => [] },
    conversationActivity: { findMany: async () => [] },
  };

  const dashboardAnalyticsService = new DashboardAnalyticsService(fakePrisma);
  const res = await dashboardAnalyticsService.getAnalytics("today", "HEAD_OFFICE");

  const growth = res.summaryCards.followerGrowth;

  // New followers should ONLY be 8 (from OA A), NOT 508!
  assert.equal(growth.addedToday, 8);
  // Block delta should ONLY be 2 (from OA A)
  assert.equal(growth.blockedToday, 2);
  assert.equal(growth.netToday, 6);

  // Total friends stock should include BOTH OA A (108) and OA B (500) = 608
  assert.equal(growth.totalFriends, 608);
  assert.equal((growth as any).growthAccountsCompared, 1);
  assert.equal((growth as any).growthAccountsMissingBaseline, 1);
});

test("CRITICAL TEST 3: Negative Follower & Block Deltas Preserved Honestly", async () => {
  const todayIso = getTodayBangkokDateString();
  const yesterdayIso = getPreviousBangkokDateString(todayIso);
  const todayUtc = toUtcDateForDb(todayIso);
  const yesterdayUtc = toUtcDateForDb(yesterdayIso);

  // OA A: yesterday followers=200, blocks=10; today followers=190, blocks=15 (followers -10, blocks +5)
  const mockAccounts = [
    {
      id: "oa_1",
      name: "OA A",
      isActive: true,
      archivedAt: null,
      storeId: "store_1",
      store: { id: "store_1", name: "Store 1", archivedAt: null },
    },
  ];

  const mockSnapshots = [
    {
      id: "snap_1",
      lineOaId: "oa_1",
      snapshotDate: yesterdayUtc,
      status: "ready",
      followers: 200,
      blocks: 10,
    },
    {
      id: "snap_2",
      lineOaId: "oa_1",
      snapshotDate: todayUtc,
      status: "ready",
      followers: 190,
      blocks: 15,
    },
  ];

  const fakePrisma: any = {
    lineOfficialAccount: { findMany: async () => mockAccounts },
    lineOaFollowerSnapshot: {
      findMany: async (args: any) => {
        if (args?.where?.snapshotDate?.in) {
          const inDates = args.where.snapshotDate.in;
          return mockSnapshots.filter((s) => inDates.some((d: Date) => d.getTime() === s.snapshotDate.getTime()));
        }
        if (args?.orderBy?.snapshotDate === "desc") {
          return [...mockSnapshots].sort((a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime());
        }
        return mockSnapshots;
      },
    },
    store: { findMany: async () => [mockAccounts[0].store] },
    conversation: { findMany: async () => [] },
    topic: { findMany: async () => [] },
    productModel: { findMany: async () => [] },
    conversationActivity: { findMany: async () => [] },
  };

  const dashboardAnalyticsService = new DashboardAnalyticsService(fakePrisma);
  const res = await dashboardAnalyticsService.getAnalytics("today", "HEAD_OFFICE");

  const growth = res.summaryCards.followerGrowth;
  assert.equal(growth.addedToday, -10);
  assert.equal(growth.blockedToday, 5);
  assert.equal(growth.netToday, -15); // -10 - 5 = -15
  assert.equal(growth.totalFriends, 190);
});

test("CRITICAL TEST 4: 7-Day and 30-Day Period Deltas", async () => {
  const todayIso = getTodayBangkokDateString();
  const sevenDaysAgoIso = getOffsetBangkokDateString(todayIso, -7);
  const thirtyDaysAgoIso = getOffsetBangkokDateString(todayIso, -30);

  const todayUtc = toUtcDateForDb(todayIso);
  const sevenDaysUtc = toUtcDateForDb(sevenDaysAgoIso);
  const thirtyDaysUtc = toUtcDateForDb(thirtyDaysAgoIso);

  const mockAccounts = [
    {
      id: "oa_1",
      name: "OA A",
      isActive: true,
      archivedAt: null,
      storeId: "store_1",
      store: { id: "store_1", name: "Store 1", archivedAt: null },
    },
  ];

  const mockSnapshots = [
    {
      id: "snap_30d",
      lineOaId: "oa_1",
      snapshotDate: thirtyDaysUtc,
      status: "ready",
      followers: 100,
      blocks: 10,
    },
    {
      id: "snap_7d",
      lineOaId: "oa_1",
      snapshotDate: sevenDaysUtc,
      status: "ready",
      followers: 130,
      blocks: 15,
    },
    {
      id: "snap_today",
      lineOaId: "oa_1",
      snapshotDate: todayUtc,
      status: "ready",
      followers: 150,
      blocks: 18,
    },
  ];

  const fakePrisma: any = {
    lineOfficialAccount: { findMany: async () => mockAccounts },
    lineOaFollowerSnapshot: {
      findMany: async (args: any) => {
        if (args?.where?.snapshotDate?.in) {
          const inDates = args.where.snapshotDate.in;
          return mockSnapshots.filter((s) => inDates.some((d: Date) => d.getTime() === s.snapshotDate.getTime()));
        }
        if (args?.orderBy?.snapshotDate === "desc") {
          return [...mockSnapshots].sort((a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime());
        }
        return mockSnapshots;
      },
    },
    store: { findMany: async () => [mockAccounts[0].store] },
    conversation: { findMany: async () => [] },
    topic: { findMany: async () => [] },
    productModel: { findMany: async () => [] },
    conversationActivity: { findMany: async () => [] },
  };

  const dashboardAnalyticsService = new DashboardAnalyticsService(fakePrisma);

  // 7d test: baseline is 7 days ago (130 -> 150 = +20, blocks 15 -> 18 = +3, net = +17)
  const res7d = await dashboardAnalyticsService.getAnalytics("7d", "HEAD_OFFICE");
  assert.equal(res7d.summaryCards.followerGrowth.addedToday, 20);
  assert.equal(res7d.summaryCards.followerGrowth.blockedToday, 3);
  assert.equal(res7d.summaryCards.followerGrowth.netToday, 17);
  assert.equal(res7d.summaryCards.followerGrowth.totalFriends, 150);

  // 30d test: baseline is 30 days ago (100 -> 150 = +50, blocks 10 -> 18 = +8, net = +42)
  const res30d = await dashboardAnalyticsService.getAnalytics("30d", "HEAD_OFFICE");
  assert.equal(res30d.summaryCards.followerGrowth.addedToday, 50);
  assert.equal(res30d.summaryCards.followerGrowth.blockedToday, 8);
  assert.equal(res30d.summaryCards.followerGrowth.netToday, 42);
  assert.equal(res30d.summaryCards.followerGrowth.totalFriends, 150);
});

test("CRITICAL TEST 5: Unready Status or Null Followers Excluded from Growth", () => {
  const todayIso = "2026-08-14";
  const yesterdayIso = "2026-08-13";

  const accounts = [
    { id: "oa_1", name: "OA 1" },
    { id: "oa_2", name: "OA 2" },
  ];

  const snapshots = [
    // OA 1 has ready status
    { lineOaId: "oa_1", snapshotDate: toUtcDateForDb(yesterdayIso), status: "ready", followers: 100, blocks: 10 },
    { lineOaId: "oa_1", snapshotDate: toUtcDateForDb(todayIso), status: "ready", followers: 110, blocks: 12 },
    // OA 2 has pending/unready status
    { lineOaId: "oa_2", snapshotDate: toUtcDateForDb(yesterdayIso), status: "ready", followers: 200, blocks: 20 },
    { lineOaId: "oa_2", snapshotDate: toUtcDateForDb(todayIso), status: "pending", followers: 300, blocks: 25 },
  ];

  const latestMap = new Map([["oa_1", 110], ["oa_2", 200]]);

  const metrics = calculateFollowerGrowthMetrics({
    accounts,
    targetIsoDate: todayIso,
    baselineIsoDate: yesterdayIso,
    period: "today",
    snapshots,
    latestFollowersPerOa: latestMap,
  });

  assert.equal(metrics.addedToday, 10); // Only OA 1 (+10)
  assert.equal(metrics.blockedToday, 2); // Only OA 1 (+2)
  assert.equal(metrics.netToday, 8);
  assert.equal(metrics.growthAccountsCompared, 1);
  assert.equal(metrics.growthAccountsMissingBaseline, 1);
  assert.equal(metrics.totalFriends, 310);
});
