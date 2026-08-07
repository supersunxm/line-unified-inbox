import { Controller, Get, Query, Req, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { OperationsService } from "./operations/operations.service";
import { AnalyticsPeriod, DashboardAnalyticsService, UserRolePermission } from "./dashboard-analytics.service";
import { OperationReportService } from "./operation-report.service";
import { RootCauseService } from "./ai/root-cause.service";

@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operations: OperationsService,
    private readonly analytics: DashboardAnalyticsService,
    private readonly reportService: OperationReportService,
    private readonly rootCauseService: RootCauseService,
  ) {}

  @Get("analytics")
  async getAnalytics(
    @Query("period") period?: AnalyticsPeriod,
    @Query("role") role?: UserRolePermission,
    @Query("allowedStoreIds") allowedStoreIdsRaw?: string,
    @Query("targetStoreId") targetStoreId?: string,
    @Req() req?: any,
  ) {
    const safePeriod: AnalyticsPeriod = period === "7d" || period === "30d" ? period : "today";
    const userRole: UserRolePermission = role || req?.user?.role || "HEAD_OFFICE";

    const allowedStoreIds = allowedStoreIdsRaw
      ? allowedStoreIdsRaw.split(",").map((s) => s.trim())
      : req?.user?.allowedStoreIds ?? undefined;

    // RBAC Security Enforcement (Phase 4): 403 Forbidden if accessing unauthorized store
    if (userRole === "STORE_MANAGER" && targetStoreId && allowedStoreIds && !allowedStoreIds.includes(targetStoreId)) {
      throw new ForbiddenException("Unauthorized: STORE_MANAGER cannot access other stores");
    }

    if (userRole === "AREA_MANAGER" && targetStoreId && allowedStoreIds && !allowedStoreIds.includes(targetStoreId)) {
      throw new ForbiddenException("Unauthorized: AREA_MANAGER cannot access stores outside assigned region");
    }

    return this.analytics.getAnalytics(safePeriod, userRole, allowedStoreIds);
  }

  @Get("root-cause-insights")
  async getRootCauseInsights(
    @Query("period") period?: AnalyticsPeriod,
    @Query("role") role?: UserRolePermission,
    @Query("allowedStoreIds") allowedStoreIdsRaw?: string,
    @Req() req?: any,
  ) {
    const safePeriod: AnalyticsPeriod = period === "7d" || period === "30d" ? period : "today";
    const userRole: UserRolePermission = role || req?.user?.role || "HEAD_OFFICE";

    const allowedStoreIds = allowedStoreIdsRaw
      ? allowedStoreIdsRaw.split(",").map((s) => s.trim())
      : req?.user?.allowedStoreIds ?? undefined;

    return this.rootCauseService.generateRootCauseInsights(safePeriod, userRole, allowedStoreIds);
  }

  @Get("report/daily")
  async getDailyReport(
    @Query("period") period?: AnalyticsPeriod,
    @Query("role") role?: UserRolePermission,
    @Query("allowedStoreIds") allowedStoreIdsRaw?: string,
    @Req() req?: any,
  ) {
    const safePeriod: AnalyticsPeriod = period === "7d" || period === "30d" ? period : "today";
    const userRole: UserRolePermission = role || req?.user?.role || "HEAD_OFFICE";

    const allowedStoreIds = allowedStoreIdsRaw
      ? allowedStoreIdsRaw.split(",").map((s) => s.trim())
      : req?.user?.allowedStoreIds ?? undefined;

    return this.reportService.generateDailyReport(safePeriod, userRole, allowedStoreIds);
  }
}
