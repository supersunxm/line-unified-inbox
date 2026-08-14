import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/auth.decorators";
import { TikTokService } from "./tiktok.service";
import {
  ReconcileStoreBindingsResponse,
  SafeTikTokAccountOverviewResponse,
  SyncTikTokAccountDto,
  TikTokHistoricalMetricsResponse,
} from "./dto/tiktok-sync.dto";

@Controller("tiktok")
export class TikTokController {
  constructor(private readonly tiktokService: TikTokService) {}

  /**
   * Syncs authorized TikTok account and video metrics into PostgreSQL.
   */
  @Post("sync")
  @HttpCode(HttpStatus.OK)
  async syncAccount(
    @Body() dto: SyncTikTokAccountDto
  ): Promise<SafeTikTokAccountOverviewResponse> {
    return this.tiktokService.upsertTikTokAccount(dto);
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
}
