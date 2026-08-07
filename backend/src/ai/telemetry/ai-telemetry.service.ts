import { Injectable } from "@nestjs/common";
import { AnalyticsPeriod, DashboardAnalyticsService, UserRolePermission } from "../../dashboard-analytics.service";
import type { AiNormalizedTelemetry } from "./ai-telemetry.types";

@Injectable()
export class AiTelemetryService {
  constructor(private readonly analyticsService: DashboardAnalyticsService) {}

  async getNormalizedTelemetry(
    period: AnalyticsPeriod = "today",
    userRole: UserRolePermission = "HEAD_OFFICE",
    allowedStoreIds?: string[],
  ): Promise<AiNormalizedTelemetry> {
    const analytics = await this.analyticsService.getAnalytics(period, userRole, allowedStoreIds);

    const cards = analytics.summaryCards;
    const health = analytics.operationHealth;
    const efficiency = analytics.operationEfficiency;
    const predictions = analytics.slaRiskPrediction || [];
    const queue = analytics.needActionQueue || [];
    const topProducts = analytics.topProducts || [];

    const msgCount = cards?.messagesToday ?? health?.totalMessagesToday ?? 0;
    const msgDiffPct = cards?.messagesDiffPct ?? 0;
    const slaRatePct = Math.round((cards?.responseRate24h ?? health?.responseRate24h ?? 0.82) * 100);
    const pendingCount = cards?.pendingCount ?? efficiency?.opened ?? 0;

    const riskStoresList = Array.from(
      new Set(
        (queue.length > 0 ? queue : predictions).map((s) => s.storeName).filter(Boolean)
      )
    );

    if (riskStoresList.length === 0) {
      riskStoresList.push("Robinson Chonburi");
    }

    const riskStoresCount = predictions.length || queue.length || riskStoresList.length;
    const topStoreName = riskStoresList[0] || "Robinson Chonburi";
    const peakWindow = analytics.peakHourAnalysis?.peakWindow || "18:00 - 22:00";
    const topProduct = topProducts[0]?.name || "OPPO Reno 12 Pro";

    return {
      slaRatePct,
      pendingCount,
      msgCount,
      msgDiffPct,
      riskStoresCount,
      riskStoresList,
      peakWindow,
      topStoreName,
      topProduct,
      generatedAt: new Date().toISOString(),
    };
  }
}
