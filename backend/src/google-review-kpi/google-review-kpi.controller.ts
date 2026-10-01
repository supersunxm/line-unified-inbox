import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { GoogleReviewKpiService } from "./google-review-kpi.service";
import {
  AggregateWeeklyKpiDto,
  CheckGoogleReviewKpiResultDto,
  CompleteStoreAuditDto,
  ExportWeeklyLeaderboardDto,
  FailStoreAuditDto,
  LOCKED_WEEKLY_KPI_STORE_CODES,
  QueryGoogleReviewKpiDto,
  QueryWeeklyLeaderboardDto,
  RecordDailyKpiDto,
  StartMonthlyAuditDto,
  UpdateAuditSessionStatusDto,
  ImportPreviewDto,
  ImportConfirmDto,
} from "./google-review-kpi.dto";
import { AuthGuard, type AuthRequest } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { UserRole } from "@prisma/client";

@Controller("google-review-kpi")
@UseGuards(AuthGuard)
export class GoogleReviewKpiController {
  constructor(private readonly kpiService: GoogleReviewKpiService) {}

  @Get()
  async list(@Query() query: QueryGoogleReviewKpiDto, @Req() req: AuthRequest) {
    return this.kpiService.listMonthlyKpis(query, req.user);
  }

  // ==========================================
  // Weekly Google Review KPI Endpoints
  // (Defined before :storeId to prevent routing collision)
  // ==========================================

  @Get("weekly/stores")
  async getWeeklyStores() {
    return this.kpiService.getWeeklyStores();
  }

  @Get("weekly/periods")
  async getWeeklyPeriods() {
    return this.kpiService.getWeeklyPeriods();
  }

  @Get("weekly/leaderboard")
  async getWeeklyLeaderboard(@Query() query: QueryWeeklyLeaderboardDto) {
    return this.kpiService.getWeeklyLeaderboard(query);
  }

  @Get("weekly/collector-status")
  async getWeeklyCollectorStatus() {
    return this.kpiService.getWeeklyCollectorStatus();
  }

  @Get("weekly/export")
  async exportWeeklyLeaderboard(
    @Query() query: ExportWeeklyLeaderboardDto,
    @Res() res: Response,
  ) {
    // A download is a read operation. Verify the already-synchronized weekly
    // memberships by their business Store ID without mutating Store/StoreMaster
    // relationships on the GET request. This keeps Store ID fail-closed while
    // avoiding sync-side database writes from breaking file generation.
    const weeklyStores = await this.kpiService.getWeeklyStores();
    const expected = new Set(LOCKED_WEEKLY_KPI_STORE_CODES);
    const seen = new Set<string>();
    const duplicateStoreCodes = new Set<string>();

    for (const store of weeklyStores) {
      const code = store.storeCode?.trim();
      if (!code) continue;
      if (seen.has(code)) duplicateStoreCodes.add(code);
      seen.add(code);
    }

    const missingStoreCodes = LOCKED_WEEKLY_KPI_STORE_CODES.filter((code) => !seen.has(code));
    const unexpectedStoreCodes = [...seen].filter((code) => !expected.has(code));

    if (
      missingStoreCodes.length > 0 ||
      unexpectedStoreCodes.length > 0 ||
      duplicateStoreCodes.size > 0
    ) {
      throw new InternalServerErrorException(
        `Canonical Store ID verification failed before Google Review export: missing=${missingStoreCodes.join(",") || "none"}; unexpected=${unexpectedStoreCodes.join(",") || "none"}; duplicates=${[...duplicateStoreCodes].join(",") || "none"}`,
      );
    }

    const { buffer, filename, contentType } = await this.kpiService.exportWeeklyLeaderboard(query);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
  }

  @Post("weekly/sync-stores")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async syncWeeklyStores() {
    return this.kpiService.syncWeeklyStoreMemberships();
  }

  @Post("weekly/daily-record")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async recordDailyKpi(@Body() dto: RecordDailyKpiDto) {
    return this.kpiService.recordDailyKpi(dto);
  }

  @Post("weekly/aggregate")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async aggregateWeeklyKpi(@Body() dto: AggregateWeeklyKpiDto) {
    await this.kpiService.aggregateWeeklyKpi(dto.weekNumber);
    return { success: true, weekNumber: dto.weekNumber };
  }

  // ==========================================
  // Monthly Batch Audit Session Endpoints
  // (Defined before :storeId to prevent routing collision)
  // ==========================================

  @Post("audit-session/start")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async startBatchAudit(
    @Body() dto: StartMonthlyAuditDto,
    @Req() req: AuthRequest,
  ) {
    return this.kpiService.startMonthlyAudit(dto, req.user);
  }

  @Get("audit-session/active")
  async getActiveBatchAudit(@Query("month") month?: string) {
    return this.kpiService.getActiveAuditSession(month);
  }

  @Post("audit-session/:sessionId/action")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async updateBatchAuditStatus(
    @Param("sessionId") sessionId: string,
    @Body() dto: UpdateAuditSessionStatusDto,
  ) {
    return this.kpiService.updateAuditSessionStatus(sessionId, dto);
  }

  @Get("audit-session/:sessionId/next-store")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async getNextPendingStore(@Param("sessionId") sessionId: string) {
    return this.kpiService.getNextPendingStore(sessionId);
  }

  @Post("audit-session/:sessionId/stores/:storeId/complete")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async completeStoreAudit(
    @Param("sessionId") sessionId: string,
    @Param("storeId") storeId: string,
    @Body() dto: CompleteStoreAuditDto,
    @Req() req: AuthRequest,
  ) {
    return this.kpiService.completeStoreAudit(sessionId, storeId, dto, req.user);
  }

  @Post(["audit-session/:sessionId/stores/:storeId/needs-attention", "audit-session/:sessionId/stores/:storeId/flag-attention"])
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async flagStoreNeedsAttention(
    @Param("sessionId") sessionId: string,
    @Param("storeId") storeId: string,
    @Body() dto: FailStoreAuditDto,
  ) {
    return this.kpiService.flagStoreNeedsAttention(sessionId, storeId, dto);
  }

  @Post("audit-session/:sessionId/stores/:storeId/skip")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async skipStore(
    @Param("sessionId") sessionId: string,
    @Param("storeId") storeId: string,
  ) {
    return this.kpiService.skipStore(sessionId, storeId);
  }

  @Post("audit-session/:sessionId/stores/:storeId/rerun")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async reRunStore(
    @Param("sessionId") sessionId: string,
    @Param("storeId") storeId: string,
  ) {
    return this.kpiService.reRunStore(sessionId, storeId);
  }

  // ==========================================
  // Import History & Processing Endpoints
  // (Defined before :storeId to prevent routing collision)
  // ==========================================

  @Get("import-history")
  async getImportHistory(@Query("month") month?: string) {
    return this.kpiService.getImportHistory(month);
  }

  @Post("import-preview")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async previewImport(@Body() dto: ImportPreviewDto) {
    return this.kpiService.previewImport(dto);
  }

  @Post("import-confirm")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async confirmImport(
    @Body() dto: ImportConfirmDto,
    @Req() req: AuthRequest,
  ) {
    return this.kpiService.confirmImport(dto, req.user);
  }

  // ==========================================
  // Single Store KPI Endpoints
  // ==========================================

  @Get(":storeId")
  async getStoreKpi(
    @Param("storeId") storeId: string,
    @Query("month") month?: string,
  ) {
    return this.kpiService.getStoreKpi(storeId, month);
  }

  @Post("check-result")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async recordResult(
    @Body() dto: CheckGoogleReviewKpiResultDto,
    @Req() req: AuthRequest,
  ) {
    return this.kpiService.recordCheckResult(dto, req.user);
  }
}
