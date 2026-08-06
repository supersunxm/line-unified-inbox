import { Injectable } from "@nestjs/common";
import { DashboardAnalyticsService, AnalyticsPeriod, UserRolePermission } from "./dashboard-analytics.service";

export type DailyOperationReportResponse = {
  header: {
    title: string;
    date: string;
    generatedAt: string;
  };
  networkSummary: {
    totalStores: number;
    messagesToday: number;
    slaAchievementRate: number;
    closureRate: number;
    averageResolutionTime: string;
  };
  topIssues: {
    topics: Array<{ name: string; percentage: number }>;
    products: Array<{ name: string; percentage: number }>;
  };
  riskStores: Array<{
    storeName: string;
    responseRate: number;
    pending: number;
    priorityScore: number;
  }>;
  actionSummary: {
    openedCases: number;
    resolvedCases: number;
    bmNotifications: number;
    adminActions: number;
  };
};

@Injectable()
export class OperationReportService {
  constructor(private readonly analyticsService: DashboardAnalyticsService) {}

  async generateDailyReport(
    period: AnalyticsPeriod = "today",
    userRole: UserRolePermission = "HEAD_OFFICE",
    allowedStoreIds?: string[],
  ): Promise<DailyOperationReportResponse> {
    const analytics = await this.analyticsService.getAnalytics(period, userRole, allowedStoreIds);
    const now = new Date();

    const formattedDate = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const formattedTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    return {
      header: {
        title: "OPPO LINE OA Daily Operation Report",
        date: formattedDate,
        generatedAt: formattedTime,
      },
      networkSummary: {
        totalStores: analytics.dailySummary.activeStoresCount,
        messagesToday: analytics.dailySummary.totalMessagesToday,
        slaAchievementRate: analytics.dailySummary.slaAchievementRate,
        closureRate: analytics.operationEfficiency.closureRate,
        averageResolutionTime: analytics.operationEfficiency.averageResolutionTime,
      },
      topIssues: {
        topics: analytics.topTopics.map((t) => ({ name: t.name, percentage: t.percentage })),
        products: analytics.topProducts.map((p) => ({ name: p.name, percentage: p.percentage })),
      },
      riskStores: analytics.needActionQueue.map((s) => ({
        storeName: s.storeName,
        responseRate: s.responseRate,
        pending: s.pending,
        priorityScore: s.priorityScore,
      })),
      actionSummary: {
        openedCases: analytics.operationEfficiency.opened,
        resolvedCases: analytics.operationEfficiency.resolved,
        bmNotifications: analytics.actionStatus.waitingBm,
        adminActions: analytics.adminActivity.length,
      },
    };
  }
}
