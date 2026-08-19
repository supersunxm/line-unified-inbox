import { Controller, Get, Query, Req, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { OperationsService } from "./operations/operations.service";
import { AnalyticsPeriod, DashboardAnalyticsService, UserRolePermission } from "./dashboard-analytics.service";
import { DashboardExecutiveService } from "./dashboard-executive.service";
import { OperationReportService } from "./operation-report.service";
import { RootCauseService } from "./ai/root-cause.service";
import type { AuthRequest } from "./auth/auth.guard";
import { StoreAccessService } from "./auth/store-access.service";

@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operations: OperationsService,
    private readonly analytics: DashboardAnalyticsService,
    private readonly executive: DashboardExecutiveService,
    private readonly reportService: OperationReportService,
    private readonly rootCauseService: RootCauseService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  private parseRequestedStoreIds(raw?: string) {
    if (!raw) return undefined;
    const ids = [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))];
    return ids.length > 0 ? ids : undefined;
  }

  private async resolveScope(req: AuthRequest | undefined, allowedStoreIdsRaw?: string, targetStoreId?: string) {
    const user = req?.user;
    if (!user) throw new ForbiddenException("Authentication required");

    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    if (accessibleStoreIds !== null) {
      return {
        userRole: user.role as UserRolePermission,
        allowedStoreIds: accessibleStoreIds,
      };
    }

    const requestedStoreIds = this.parseRequestedStoreIds(allowedStoreIdsRaw);
    const selectedStoreIds = requestedStoreIds ?? (targetStoreId ? [targetStoreId] : undefined);
    if (!selectedStoreIds) {
      return { userRole: user.role as UserRolePermission, allowedStoreIds: undefined };
    }
    if (requestedStoreIds && targetStoreId && !requestedStoreIds.includes(targetStoreId)) {
      throw new ForbiddenException("Requested target store is not selected");
    }

    const activeStores = await this.prisma.store.findMany({
      where: { id: { in: selectedStoreIds }, isActive: true, archivedAt: null },
      select: { id: true },
    });
    const activeStoreIdSet = new Set(activeStores.map((store) => store.id));
    if (selectedStoreIds.some((storeId) => !activeStoreIdSet.has(storeId))) {
      throw new ForbiddenException("Requested store is not available");
    }

    return { userRole: user.role as UserRolePermission, allowedStoreIds: selectedStoreIds };
  }

  @Get("analytics")
  async getAnalytics(
    @Query("period") period?: AnalyticsPeriod,
    @Query("allowedStoreIds") allowedStoreIdsRaw?: string,
    @Query("targetStoreId") targetStoreId?: string,
    @Req() req?: AuthRequest,
  ) {
    const safePeriod: AnalyticsPeriod = period === "7d" || period === "30d" ? period : "today";
    const scope = await this.resolveScope(req, allowedStoreIdsRaw, targetStoreId);
    const userRole = scope.userRole;
    const allowedStoreIds = scope.allowedStoreIds;
    return this.analytics.getAnalytics(safePeriod, userRole, allowedStoreIds);
  }

  @Get("executive-store-health")
  async getExecutiveStoreHealth(
    @Query("period") period?: AnalyticsPeriod,
    @Query("allowedStoreIds") allowedStoreIdsRaw?: string,
    @Req() req?: AuthRequest,
  ) {
    const safePeriod: AnalyticsPeriod = period === "7d" || period === "30d" ? period : "today";
    const scope = await this.resolveScope(req, allowedStoreIdsRaw);
    return this.executive.getStoreHealth(safePeriod, scope.allowedStoreIds);
  }

  @Get("root-cause-insights")
  async getRootCauseInsights(
    @Query("period") period?: AnalyticsPeriod,
    @Query("allowedStoreIds") allowedStoreIdsRaw?: string,
    @Req() req?: AuthRequest,
  ) {
    const safePeriod: AnalyticsPeriod = period === "7d" || period === "30d" ? period : "today";
    const scope = await this.resolveScope(req, allowedStoreIdsRaw);
    const userRole = scope.userRole;
    const allowedStoreIds = scope.allowedStoreIds;
    return this.rootCauseService.generateRootCauseInsights(safePeriod, userRole, allowedStoreIds);
  }

  @Get("report/daily")
  async getDailyReport(
    @Query("period") period?: AnalyticsPeriod,
    @Query("allowedStoreIds") allowedStoreIdsRaw?: string,
    @Req() req?: AuthRequest,
  ) {
    const safePeriod: AnalyticsPeriod = period === "7d" || period === "30d" ? period : "today";
    const scope = await this.resolveScope(req, allowedStoreIdsRaw);
    const userRole = scope.userRole;
    const allowedStoreIds = scope.allowedStoreIds;
    return this.reportService.generateDailyReport(safePeriod, userRole, allowedStoreIds);
  }
}
