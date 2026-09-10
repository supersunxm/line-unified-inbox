import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { UserRole } from "@prisma/client";
import { Public, Roles } from "../auth/auth.decorators";
import { TikTokService } from "./tiktok.service";
import { TikTokPublicAnalyticsService } from "./tiktok-public-analytics.service";
import { InternalTikTokSyncGuard } from "./internal-sync.guard";
import { TikTokStoreBindingService, TikTokStoreBindingRequestState } from "./tiktok-store-binding.service";
import { verifyTikTokStoreOwnerSession } from "./tiktok-store-owner-session";
import {
  ReconcileStoreBindingsResponse,
  SafeTikTokAccountOverviewResponse,
  SyncTikTokAccountDto,
  TikTokBulkMetricsSummaryResponse,
  TikTokHistoricalMetricsResponse,
} from "./dto/tiktok-sync.dto";

type AuthenticatedRequest = Request & { user?: { id?: string | null } };

@Controller("tiktok")
export class TikTokController {
  constructor(
    private readonly tiktokService: TikTokService,
    private readonly tiktokPublicAnalyticsService?: TikTokPublicAnalyticsService,
    private readonly tiktokStoreBindingService?: TikTokStoreBindingService,
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
   * Public store-owner analytics endpoint. The account and store are derived
   * from the signed HttpOnly session cookie; no browser-supplied identifier is
   * accepted. The internal secret only permits the frontend server to call it.
   */
  @Public()
  @UseGuards(InternalTikTokSyncGuard)
  @Get("internal/store-owner/me")
  async getStoreOwnerAnalytics(@Req() request: Request) {
    const session = verifyTikTokStoreOwnerSession(request.headers.cookie);
    if (!session) {
      throw new UnauthorizedException("TikTok store-owner session is invalid or expired");
    }
    return this.tiktokStoreBindingService!.getStoreOwnerAnalytics(
      session.accountId,
      session.storeMasterId,
    );
  }

  /**
   * Internal store-binding context endpoint for the public OAuth completion flow.
   * The frontend verifies its short-lived signed binding session and then calls this endpoint
   * with the same internal shared secret used by the OAuth sync path.
   */
  @Public()
  @UseGuards(InternalTikTokSyncGuard)
  @Get("internal/store-binding/:accountId")
  async getInternalStoreBindingContext(
    @Param("accountId") accountId: string,
    @Query("query") query?: string,
  ) {
    return this.tiktokStoreBindingService!.getBindingContext(accountId, query);
  }

  /**
   * Confirms a suggested store. This is allowed only when the TikTok username matches
   * StoreMaster.tiktokUsername exactly (or the account is already bound to that store).
   */
  @Public()
  @UseGuards(InternalTikTokSyncGuard)
  @Post("internal/store-binding/:accountId/confirm")
  @HttpCode(HttpStatus.OK)
  async confirmInternalStoreBinding(
    @Param("accountId") accountId: string,
    @Body() body: { storeMasterId?: string },
  ) {
    const storeMasterId = body?.storeMasterId?.trim();
    if (!storeMasterId) {
      return { status: "INVALID_REQUEST", message: "storeMasterId is required" };
    }
    return this.tiktokStoreBindingService!.confirmSuggestedBinding(accountId, storeMasterId);
  }

  /**
   * Creates a pending HQ review request when a user selects a different store.
   * This endpoint never changes TikTokAccount.storeMasterId directly.
   */
  @Public()
  @UseGuards(InternalTikTokSyncGuard)
  @Post("internal/store-binding/:accountId/request")
  @HttpCode(HttpStatus.OK)
  async requestInternalStoreBinding(
    @Param("accountId") accountId: string,
    @Body() body: { storeMasterId?: string },
  ) {
    const storeMasterId = body?.storeMasterId?.trim();
    if (!storeMasterId) {
      return { status: "INVALID_REQUEST", message: "storeMasterId is required" };
    }
    return this.tiktokStoreBindingService!.requestStoreBinding(accountId, storeMasterId);
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
   * HQ review queue for manually selected store associations.
   */
  @Get("binding-requests")
  @Roles(UserRole.ADMIN)
  async listBindingRequests(@Query("status") status?: string) {
    const allowed = new Set<TikTokStoreBindingRequestState>([
      "PENDING",
      "APPROVED",
      "REJECTED",
      "CANCELLED",
    ]);
    const normalized = (status || "PENDING").toUpperCase() as TikTokStoreBindingRequestState;
    return this.tiktokStoreBindingService!.listBindingRequests(
      allowed.has(normalized) ? normalized : "PENDING",
    );
  }

  @Post("binding-requests/:id/approve")
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async approveBindingRequest(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.tiktokStoreBindingService!.reviewBindingRequest(
      id,
      "APPROVED",
      request?.user?.id || null,
    );
  }

  @Post("binding-requests/:id/reject")
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async rejectBindingRequest(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.tiktokStoreBindingService!.reviewBindingRequest(
      id,
      "REJECTED",
      request?.user?.id || null,
    );
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
