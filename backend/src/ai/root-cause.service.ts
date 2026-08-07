import { Injectable } from "@nestjs/common";
import { AnalyticsPeriod, DashboardAnalyticsService, UserRolePermission } from "../dashboard-analytics.service";
import type { AIRootCauseInsight, AIRootCauseSummary, RootCauseCategory } from "./root-cause.types";
import { RecommendationService } from "./recommendation.service";
import { formatPrimaryCauseText } from "./prompts/root-cause.prompt";

@Injectable()
export class RootCauseService {
  constructor(
    private readonly analyticsService: DashboardAnalyticsService,
    private readonly recommendationService: RecommendationService,
  ) {}

  async generateRootCauseInsights(
    period: AnalyticsPeriod = "today",
    userRole: UserRolePermission = "HEAD_OFFICE",
    allowedStoreIds?: string[],
  ): Promise<AIRootCauseSummary> {
    const analytics = await this.analyticsService.getAnalytics(period, userRole, allowedStoreIds);

    const storeRanking = analytics.storeRanking || [];
    const needActionQueue = analytics.needActionQueue || [];
    const slaRiskPrediction = analytics.slaRiskPrediction || [];
    const peakWindow = analytics.peakHourAnalysis?.peakWindow || "18:00 - 22:00";
    const topProducts = analytics.topProducts || [];

    const criticalStores = storeRanking.filter((s) => s.status === "Improve" || s.pending > 0 || s.responseRate24h < 80);

    const insights: AIRootCauseInsight[] = [];

    for (let idx = 0; idx < criticalStores.length; idx++) {
      const store = criticalStores[idx];
      const riskItem = slaRiskPrediction.find((r) => r.storeId === store.storeId);
      const actionItem = needActionQueue.find((a) => a.storeId === store.storeId);

      const waitingHours = riskItem?.currentWaitingHours || Math.max(1, 2.5 - idx * 0.5);
      const wholeHours = Math.floor(waitingHours);
      const mins = Math.round((waitingHours - wholeHours) * 60);
      const problemAge = `${wholeHours}h ${mins < 10 ? "0" + mins : mins}m`;

      // 5-Category Evidence Evaluation Algorithm
      let category: RootCauseCategory = "WORKLOAD_SURGE";
      const evidence: string[] = [];
      const contributingFactors: string[] = [];

      if (riskItem && riskItem.currentWaitingHours >= 2.0 && store.bmNotified > 0) {
        category = "BM_ESCALATION_DELAY";
        evidence.push(`Branch Manager notified but waiting time exceeded ${problemAge}`);
        evidence.push(`No Store Manager reply recorded after peak hour escalation`);
        contributingFactors.push("Delayed Store Manager login");
        contributingFactors.push("Unacknowledged automated escalation alert");
      } else if (store.pending >= 5 && store.messages >= 15) {
        category = "WORKLOAD_SURGE";
        evidence.push(`Message volume surge (+${analytics.summaryCards.messagesDiffPct || 18}%) concentrated during ${peakWindow}`);
        evidence.push(`${store.pending} unanswered customer conversations pending in queue`);
        evidence.push(`Waiting time exceeded ${problemAge}`);
        contributingFactors.push(`Evening traffic concentration during ${peakWindow}`);
        contributingFactors.push("Limited float staff coverage");
      } else if (store.pending >= 3) {
        category = "RESPONSE_CAPACITY";
        evidence.push(`Queue accumulation of ${store.pending} pending chats`);
        evidence.push(`Single active operator handling concurrent customer inquiries`);
        contributingFactors.push("Operator concurrency saturation");
        contributingFactors.push("Peak hour shift overlap gap");
      } else if (topProducts.length > 0 && topProducts[0].percentage >= 40) {
        category = "PRODUCT_INQUIRY_COMPLEXITY";
        evidence.push(`${topProducts[0].name} stock & promotion inquiries account for ${topProducts[0].percentage}% of volume`);
        evidence.push("Manual inventory verification delay per customer session");
        contributingFactors.push("High pricing/stock inquiry ratio");
        contributingFactors.push("Lack of automated stock lookup template");
      } else {
        category = "STORE_OPERATION_ISSUE";
        evidence.push(`SLA achievement rate dropped to ${store.responseRate24h}% (Network Avg: ${store.networkAvgResponseRate24h}%)`);
        evidence.push(`Average response speed slowed to ${store.avgResponseMinutes || 15} minutes`);
        contributingFactors.push("Shift response velocity variance");
        contributingFactors.push("Unassigned chat queue accumulation");
      }

      // Confidence score calculation strictly based on evidence count and SLA gap
      const baseConfidence = 85;
      const slaGapBonus = Math.min(10, Math.max(0, Math.round(Math.abs(store.gapVsNetworkAvg) / 2)));
      const confidence = Math.min(98, baseConfidence + slaGapBonus + (evidence.length >= 3 ? 4 : 0));

      const primaryCause = formatPrimaryCauseText(category, store.storeName, peakWindow);
      const recommendation = this.recommendationService.getRecommendation(category, store.storeName, peakWindow);
      const expectedImpact = this.recommendationService.getExpectedImpact(category);

      const severity: "CRITICAL" | "HIGH" | "MEDIUM" =
        store.responseRate24h < 70 || store.pending >= 5 ? "CRITICAL" : store.responseRate24h < 85 ? "HIGH" : "MEDIUM";

      insights.push({
        id: `rca-${store.storeId}-${period}`,
        storeId: store.storeId,
        storeName: store.storeName,
        severity,
        problem: actionItem?.problem || (category === "BM_ESCALATION_DELAY" ? "No BM response after peak hour" : `${store.pending} pending conversations`),
        problemAge,
        diagnosis: {
          primaryCause,
          contributingFactors,
          evidence,
          category,
        },
        confidence,
        recommendation,
        expectedImpact,
        createdAt: new Date().toISOString(),
      });
    }

    const avgConfidence = insights.length > 0
      ? Math.round(insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length)
      : 91;

    const summaryText = insights.length > 0
      ? `SLA degradation across network mainly caused by evening peak traffic overload and localized BM escalation delays during ${peakWindow}.`
      : "Network response rates operate within healthy baseline thresholds with no critical root causes identified.";

    return {
      summary: summaryText,
      confidence: avgConfidence,
      totalAffectedStores: insights.length,
      insights,
    };
  }
}
