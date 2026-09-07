import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Public, Roles } from "../auth/auth.decorators";
import { TikTokService } from "./tiktok.service";
import { TikTokPublicAnalyticsService } from "./tiktok-public-analytics.service";
import { InternalTikTokSyncGuard } from "./internal-sync.guard";
import {
  ReconcileStoreBindingsResponse,
  SafeTikTokAccountOverviewResponse,
  SyncTikTokAccountDto,
  TikTokBulkMetricsSummaryResponse,
  TikTokHistoricalMetricsResponse,
} from "./dto/tiktok-sync.dto";

@Controller("tiktok")
export class TikTokController {
  constructor(
    private readonly tiktokService: TikTokService,
    private readonly tiktokPublicAnalyticsService?: TikTokPublicAnalyticsService,
  ) {}

  /**
   * Internal server-to-server endpoint for OAuth callback account synchronization.
   * Protected by internal shared secret (X-Internal-TikTok-Secret header).
   * Bypasses user session AuthGuard via @Public() but strictly enforces InternalTikTokSyncGuard.
   */
  @Public()
  @UseGuards(InternalTikTokSyncGuard)
  @Post("internal/sync")
  @HttpCode(HttpStatus.OK)
  async internalSyncAccount(
    @Body() dto: SyncTikTokAccountDto
  ): Promise<SafeTikTokAccountOverviewResponse> {
    return this.tiktokService.upsertTikTokAccount(dto);
  }

  /**
   * User-session authenticated sync endpoint (for admin-triggered syncs).
   */
  @Post("sync")
  @HttpCode(HttpStatus.OK)
  async syncAccount(
    @Body() dto: SyncTikTokAccountDto
  ): Promise<SafeTikTokAccountOverviewResponse> {
    return this.tiktokService.upsertTikTokAccount(dto);
  }

  /**
   * Public-profile analytics dashboard summary. Uses exact persisted statsV2 snapshots only.
   */
  @Get("public/overview")
  async getPublicOverview() {
    return this.tiktokPublicAnalyticsService!.getDashboardOverview();
  }

  /**
   * Lists tracked stores with current public TikTok metrics and follower growth.
   */
  @Get("public/stores")
  async listPublicStores() {
    return this.tiktokPublicAnalyticsService!.listDashboardStores();
  }

  /**
   * Ranking across public TikTok store profiles.
   * metric: followers | likes | videos | growth7d
   */
  @Get("public/ranking")
  async getPublicRanking(
    @Query("metric") metric?: string,
    @Query("limit") limit?: string,
  ) {
    const supported = new Set(["followers", "likes", "videos", "growth7d"]);
    const safeMetric = supported.has(metric ?? "")
      ? (metric as "followers" | "likes" | "videos" | "growth7d")
      : "followers";
    const safeLimit = limit ? parseInt(limit, 10) : 20;
    return this.tiktokPublicAnalyticsService!.getRanking(safeMetric, safeLimit);
  }

  /**
   * Retrieves one store's current public TikTok analytics.
   */
  @Get("public/stores/:storeMasterId")
  async getPublicStore(@Param("storeMasterId") storeMasterId: string) {
    return this.tiktokPublicAnalyticsService!.getStoreDashboard(storeMasterId);
  }

  /**
   * Retrieves daily public TikTok metric history for one store.
   */
  @Get("public/stores/:storeMasterId/history")
  async getPublicStoreHistory(
    @Param("storeMasterId") storeMasterId: string,
    @Query("days") days?: string,
  ) {
    const safeDays = days ? parseInt(days, 10) : 30;
    return this.tiktokPublicAnalyticsService!.getStoreHistory(storeMasterId, safeDays);
  }

  /**
   * Retrieves the most recently connected / updated TikTok account overview.
   */
  @Get("latest")
  async getLatestAccount(): Promise<SafeTikTokAccountOverviewResponse | null> {
    return this.tiktokService.getLatestTikTokAccount();
  }

  /**
   * Retrieves historical follower metrics and growth summary for the latest connected account.
   */
  @Get("latest/metrics")
  async getLatestAccountMetrics(
    @Query("days") days?: string
  ): Promise<TikTokHistoricalMetricsResponse | null> {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.tiktokService.getLatestAccountHistoricalMetrics(daysNum);
  }

  /**
   * Lists all connected TikTok accounts.
   */
  @Get("accounts")
  async listAccounts() {
    return this.tiktokService.listTikTokAccounts();
  }

  /**
   * Retrieves bulk account metrics summary and growth across connected TikTok accounts.
   * Registered before :id to prevent path parameter shadowing.
   */
  @Get("accounts/metrics-summary")
  async getBulkAccountsMetricsSummary(
    @Query("days") days?: string
  ): Promise<TikTokBulkMetricsSummaryResponse> {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.tiktokService.getBulkAccountsMetricsSummary(daysNum);
  }

  /**
   * Retrieves a specific TikTok account overview by ID.
   */
  @Get("accounts/:id")
  async getAccountById(@Param("id") id: string): Promise<SafeTikTokAccountOverviewResponse | null> {
    return this.tiktokService.getTikTokAccountById(id);
  }

  /**
   * Retrieves historical follower metrics and growth summary for a specific TikTok account.
   */
  @Get("accounts/:id/metrics")
  async getAccountMetrics(
    @Param("id") id: string,
    @Query("days") days?: string
  ): Promise<TikTokHistoricalMetricsResponse | null> {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.tiktokService.getAccountHistoricalMetrics(id, daysNum);
  }

  /**
   * Reconciles already-persisted TikTok accounts with StoreMaster by matching TikTok username.
   * Mutates account-store relationships: strictly restricted to ADMIN role.
   */
  @Post("reconcile-stores")
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async reconcileStores(): Promise<ReconcileStoreBindingsResponse> {
    return this.tiktokService.reconcileTikTokStoreBindings();
  }

  /**
   * Triggers daily account metrics collection across connected accounts.
   * Restricted to ADMIN role.
   */
  @Post("sync-daily-metrics")
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async syncDailyMetrics() {
    return this.tiktokService.syncDailyTikTokMetrics();
  }
}
