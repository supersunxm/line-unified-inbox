import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { TikTokController } from "./tiktok.controller";

test("TikTokController requires authentication and rejects unauthenticated sync and read requests", async () => {
  const adminUser = {
    id: "u-admin",
    email: "admin@oppo.th",
    displayName: "Admin User",
    role: UserRole.ADMIN,
    isActive: true,
  };

  const viewerUser = {
    id: "u-viewer",
    email: "viewer@oppo.th",
    displayName: "Viewer User",
    role: UserRole.VIEWER,
    isActive: true,
  };

  const fakeAuthService: any = {
    authenticate: async (token?: string) => {
      if (token === "valid-admin-session") return adminUser;
      if (token === "valid-viewer-session") return viewerUser;
      return null;
    },
  };

  const fakeReflector: any = {
    getAllAndOverride: (key: string) => {
      if (key === "isPublic") return false;
      return undefined;
    },
  };

  const guard = new AuthGuard(fakeReflector, fakeAuthService);

  const fakeTikTokService: any = {
    upsertTikTokAccount: async (dto: any) => ({
      id: "acc-1",
      openId: dto.profile.open_id,
      displayName: dto.profile.display_name,
      followerCount: dto.profile.follower_count,
      followingCount: dto.profile.following_count,
      likesCount: dto.profile.likes_count,
      videoCount: dto.profile.video_count,
      isVerified: dto.profile.is_verified,
      updatedAt: new Date().toISOString(),
      videos: dto.videos,
      storeMaster: null,
    }),
    getLatestTikTokAccount: async () => ({
      id: "acc-1",
      openId: "_000sample_open_id",
      displayName: "OPPO Central World",
      followerCount: 52000,
      followingCount: 120,
      likesCount: 1420000,
      videoCount: 85,
      isVerified: true,
      updatedAt: new Date().toISOString(),
      videos: [],
      storeMaster: null,
    }),
    listTikTokAccounts: async () => [
      {
        id: "acc-1",
        openId: "_000sample_open_id",
        displayName: "OPPO Central World",
        videoCountRecorded: 0,
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  const controller = new TikTokController(fakeTikTokService);

  // 1. Authenticated POST /tiktok/sync with cookie succeeds
  const requestSyncCookie: any = {
    headers: { cookie: "oppo_session=valid-admin-session" },
    method: "POST",
    path: "/tiktok/sync",
  };
  const contextSyncCookie: any = {
    switchToHttp: () => ({ getRequest: () => requestSyncCookie }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
  const canSyncCookie = await guard.canActivate(contextSyncCookie);
  assert.equal(canSyncCookie, true);
  assert.deepEqual(requestSyncCookie.user, adminUser);

  const syncResult = await controller.syncAccount({
    accessToken: "act.token_123",
    profile: {
      open_id: "_000sample_open_id",
      display_name: "OPPO Central World",
      follower_count: 52000,
      following_count: 120,
      likes_count: 1420000,
      video_count: 85,
      is_verified: true,
    },
    videos: [],
  });
  assert.equal(syncResult.openId, "_000sample_open_id");

  // 2. Authenticated POST /tiktok/sync with Bearer header succeeds
  const requestSyncBearer: any = {
    headers: { authorization: "Bearer valid-admin-session" },
    method: "POST",
    path: "/tiktok/sync",
  };
  const contextSyncBearer: any = {
    switchToHttp: () => ({ getRequest: () => requestSyncBearer }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
  const canSyncBearer = await guard.canActivate(contextSyncBearer);
  assert.equal(canSyncBearer, true);

  // 3. Unauthenticated POST /tiktok/sync is rejected with 401 Unauthorized
  const requestSyncUnauth: any = {
    headers: {},
    method: "POST",
    path: "/tiktok/sync",
  };
  const contextSyncUnauth: any = {
    switchToHttp: () => ({ getRequest: () => requestSyncUnauth }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
  await assert.rejects(
    async () => guard.canActivate(contextSyncUnauth),
    { name: "UnauthorizedException", message: "Authentication required" }
  );

  // 4. Read-only VIEWER role cannot perform POST /tiktok/sync (403 Forbidden)
  const requestSyncViewer: any = {
    headers: { cookie: "oppo_session=valid-viewer-session" },
    method: "POST",
    path: "/tiktok/sync",
  };
  const contextSyncViewer: any = {
    switchToHttp: () => ({ getRequest: () => requestSyncViewer }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
  await assert.rejects(
    async () => guard.canActivate(contextSyncViewer),
    { name: "ForbiddenException", message: "Viewer access is read-only" }
  );

  // 5. Authenticated GET /tiktok/latest succeeds
  const requestGetCookie: any = {
    headers: { cookie: "oppo_session=valid-admin-session" },
    method: "GET",
    path: "/tiktok/latest",
  };
  const contextGetCookie: any = {
    switchToHttp: () => ({ getRequest: () => requestGetCookie }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
  const canGetCookie = await guard.canActivate(contextGetCookie);
  assert.equal(canGetCookie, true);

  const getResult = await controller.getLatestAccount();
  assert.ok(getResult);
  assert.equal(getResult.displayName, "OPPO Central World");

  // 6. Unauthenticated GET /tiktok/latest is rejected with 401 Unauthorized
  const requestGetUnauth: any = {
    headers: {},
    method: "GET",
    path: "/tiktok/latest",
  };
  const contextGetUnauth: any = {
    switchToHttp: () => ({ getRequest: () => requestGetUnauth }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
  await assert.rejects(
    async () => guard.canActivate(contextGetUnauth),
    { name: "UnauthorizedException", message: "Authentication required" }
  );

  // 7. Authenticated POST /tiktok/reconcile-stores by VIEWER is rejected with 403 Forbidden
  const requestReconcileViewer: any = {
    headers: { cookie: "oppo_session=valid-viewer-session" },
    method: "POST",
    path: "/tiktok/reconcile-stores",
  };
  const contextReconcileViewer: any = {
    switchToHttp: () => ({ getRequest: () => requestReconcileViewer }),
    getHandler: () => controller.reconcileStores,
    getClass: () => TikTokController,
  };
  await assert.rejects(
    async () => guard.canActivate(contextReconcileViewer),
    { name: "ForbiddenException" }
  );

  // 8. Authenticated POST /tiktok/reconcile-stores by ADMIN succeeds
  const requestReconcileAdmin: any = {
    headers: { cookie: "oppo_session=valid-admin-session" },
    method: "POST",
    path: "/tiktok/reconcile-stores",
  };
  const contextReconcileAdmin: any = {
    switchToHttp: () => ({ getRequest: () => requestReconcileAdmin }),
    getHandler: () => controller.reconcileStores,
    getClass: () => TikTokController,
  };
  const canReconcileAdmin = await guard.canActivate(contextReconcileAdmin);
  assert.equal(canReconcileAdmin, true);

  fakeTikTokService.reconcileTikTokStoreBindings = async () => ({
    totalChecked: 1,
    matchedCount: 1,
    unmatchedCount: 0,
    ambiguousCount: 0,
    alreadyBoundCount: 0,
    results: [
      {
        openId: "_000sample_open_id",
        username: "oppo_centralworld",
        storeMasterId: "store-cw-1",
        status: "MATCHED",
      },
    ],
  });

  const reconcileResult = await controller.reconcileStores();
  assert.equal(reconcileResult.matchedCount, 1);
  assert.equal(reconcileResult.results[0].status, "MATCHED");

  // 9. Authenticated GET /tiktok/latest/metrics succeeds
  fakeTikTokService.getLatestAccountHistoricalMetrics = async (days: number) => ({
    accountId: "acc-1",
    openId: "_000sample_open_id",
    displayName: "OPPO Central World",
    username: "oppo_centralworld",
    summary: {
      currentFollowerCount: 52000,
      previousDayFollowerCount: 51900,
      dailyFollowerGrowth: 100,
      sevenDayFollowerCount: 51500,
      sevenDayFollowerGrowth: 500,
      thirtyDayFollowerCount: 50000,
      thirtyDayFollowerGrowth: 2000,
    },
    history: [
      {
        id: "m-1",
        metricDate: "2026-08-14",
        followerCount: 52000,
        followingCount: 120,
        likesCount: 1420000,
        videoCount: 85,
        createdAt: "2026-08-14T00:00:00.000Z",
        updatedAt: "2026-08-14T00:00:00.000Z",
      },
    ],
  });

  const latestMetrics = await controller.getLatestAccountMetrics("30");
  assert.ok(latestMetrics);
  assert.equal(latestMetrics.summary.currentFollowerCount, 52000);
  assert.equal(latestMetrics.summary.dailyFollowerGrowth, 100);
  assert.equal(latestMetrics.history.length, 1);

  // 10. Authenticated GET /tiktok/accounts/:id/metrics succeeds
  fakeTikTokService.getAccountHistoricalMetrics = async (id: string, days: number) => ({
    accountId: id,
    openId: "_000sample_open_id",
    displayName: "OPPO Central World",
    username: "oppo_centralworld",
    summary: {
      currentFollowerCount: 52000,
      previousDayFollowerCount: null,
      dailyFollowerGrowth: null,
      sevenDayFollowerCount: null,
      sevenDayFollowerGrowth: null,
      thirtyDayFollowerCount: null,
      thirtyDayFollowerGrowth: null,
    },
    history: [],
  });

  const accountMetrics = await controller.getAccountMetrics("acc-1", "7");
  assert.ok(accountMetrics);
  assert.equal(accountMetrics.accountId, "acc-1");
  assert.equal(accountMetrics.summary.dailyFollowerGrowth, null);

  // 11. Authenticated POST /tiktok/sync-daily-metrics by VIEWER is rejected with 403 Forbidden
  const requestSyncDailyViewer: any = {
    headers: { cookie: "oppo_session=valid-viewer-session" },
    method: "POST",
    path: "/tiktok/sync-daily-metrics",
  };
  const contextSyncDailyViewer: any = {
    switchToHttp: () => ({ getRequest: () => requestSyncDailyViewer }),
    getHandler: () => controller.syncDailyMetrics,
    getClass: () => TikTokController,
  };
  await assert.rejects(
    async () => guard.canActivate(contextSyncDailyViewer),
    { name: "ForbiddenException" }
  );

  // 12. Authenticated POST /tiktok/sync-daily-metrics by ADMIN succeeds
  const requestSyncDailyAdmin: any = {
    headers: { cookie: "oppo_session=valid-admin-session" },
    method: "POST",
    path: "/tiktok/sync-daily-metrics",
  };
  const contextSyncDailyAdmin: any = {
    switchToHttp: () => ({ getRequest: () => requestSyncDailyAdmin }),
    getHandler: () => controller.syncDailyMetrics,
    getClass: () => TikTokController,
  };
  const canSyncDailyAdmin = await guard.canActivate(contextSyncDailyAdmin);
  assert.equal(canSyncDailyAdmin, true);

  fakeTikTokService.syncDailyTikTokMetrics = async () => ({
    totalAccounts: 1,
    succeeded: 1,
    failed: 0,
    skipped: 0,
    tokenRefreshFailures: 0,
    bangkokDate: "2026-08-14",
    durationMs: 42,
    accountResults: [],
  });

  const dailySyncRes = await controller.syncDailyMetrics();
  assert.equal(dailySyncRes.totalAccounts, 1);
  assert.equal(dailySyncRes.succeeded, 1);

  // 13. Authenticated GET /tiktok/accounts/:id returns specific account
  fakeTikTokService.getTikTokAccountById = async (id: string) => {
    if (id === "acc-paragon") {
      return {
        id: "acc-paragon",
        openId: "open-paragon",
        displayName: "OPPO Siam Paragon",
        followerCount: 8000,
        followingCount: 300,
        likesCount: 12000,
        videoCount: 15,
        connectionStatus: "CONNECTED",
        connectedAt: "2026-08-14T00:00:00.000Z",
        lastSyncedAt: "2026-08-14T00:00:00.000Z",
        storeMasterId: "sm-paragon",
        storeMaster: {
          id: "sm-paragon",
          storeName: "OPPO Brand Shop Siam Paragon",
          province: "Bangkok",
          region: "Central",
        },
        videos: [],
      };
    }
    return null;
  };

  const specificAccount = await controller.getAccountById("acc-paragon");
  assert.ok(specificAccount);
  assert.equal(specificAccount.id, "acc-paragon");
  assert.equal(specificAccount.storeMaster?.storeName, "OPPO Brand Shop Siam Paragon");

  const unknownAccount = await controller.getAccountById("acc-unknown");
  assert.equal(unknownAccount, null);

  // 14. Authenticated GET /tiktok/accounts/metrics-summary returns bulk metrics
  fakeTikTokService.getBulkAccountsMetricsSummary = async (days: number) => ({
    accounts: [
      {
        accountId: "acc-1",
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
  });

  const bulkMetricsRes = await controller.getBulkAccountsMetricsSummary("30");
  assert.equal(bulkMetricsRes.accounts.length, 1);
  assert.equal(bulkMetricsRes.accounts[0].accountId, "acc-1");
  assert.equal(bulkMetricsRes.accounts[0].growth.sevenDays.followers, 286);

  // 15. POST /tiktok/internal/sync invokes upsertTikTokAccount when guarded
  const internalSyncResult = await controller.internalSyncAccount({
    accessToken: "act.token_internal_123",
    profile: {
      open_id: "_000sample_open_id",
      display_name: "OPPO Central World",
      follower_count: 52000,
      following_count: 120,
      likes_count: 1420000,
      video_count: 85,
      is_verified: true,
    },
    videos: [],
  });
  assert.equal(internalSyncResult.openId, "_000sample_open_id");
});
