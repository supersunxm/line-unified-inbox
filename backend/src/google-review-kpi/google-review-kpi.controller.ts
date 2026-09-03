import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { GoogleReviewKpiService } from "./google-review-kpi.service";
import {
  CheckGoogleReviewKpiResultDto,
  CompleteStoreAuditDto,
  FailStoreAuditDto,
  QueryGoogleReviewKpiDto,
  StartMonthlyAuditDto,
  UpdateAuditSessionStatusDto,
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

  /**
   * Issues a short-lived (30-min) Bearer token scoped to one audit session.
   * The dashboard calls this on Start / Resume and passes the token to the
   * Chrome Extension via chrome.storage.local so the content script on
   * google.com/maps can authenticate batch-runner API calls without relying
   * on cross-site cookies.
   */
  @Post("audit-session/:sessionId/runner-token")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async issueRunnerToken(
    @Param("sessionId") sessionId: string,
    @Req() req: AuthRequest,
  ) {
    return this.kpiService.issueRunnerToken(sessionId, req.user!);
  }

  /**
   * Revokes the runner token for the current user.
   * Called when the operator cancels or explicitly closes the audit session.
   */
  @Delete("audit-session/:sessionId/runner-token")
  @Roles(UserRole.ADMIN, UserRole.VIEWER)
  async revokeRunnerToken(@Req() req: AuthRequest) {
    await this.kpiService.revokeRunnerToken(req.user!.id);
    return { success: true };
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
