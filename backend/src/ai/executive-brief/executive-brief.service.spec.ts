import test from "node:test";
import assert from "node:assert/strict";
import { ExecutiveBriefService } from "./executive-brief.service";
import { AiTelemetryService } from "../telemetry/ai-telemetry.service";

test("ExecutiveBriefService: should generate deterministic Executive Daily Brief", async () => {
  const mockDashboardAnalyticsService: any = {
    getAnalytics: async () => ({
      period: "today",
      summaryCards: {
        messagesToday: 18420,
        messagesDiffPct: 28,
        pendingCount: 9,
        responseRate24h: 0.82,
      },
      operationHealth: {
        responseRate24h: 0.82,
        totalMessagesToday: 18420,
      },
      peakHourAnalysis: { peakWindow: "18:00 - 22:00" },
      slaRiskPrediction: [
        { storeId: "s1", storeName: "Robinson Chonburi", currentWaitingHours: 2.5, expectedBreachHours: 0.5, riskLevel: "HIGH" },
      ],
      needActionQueue: [
        { storeId: "s1", storeName: "Robinson Chonburi", pending: 9, problem: "9 unanswered conversations", impact: "High customer waiting risk", severity: "HIGH" },
      ],
      topProducts: [{ name: "OPPO Reno 12 Pro" }],
      storeRanking: [],
    }),
  };

  const mockRootCauseService: any = {
    generateRootCauseInsights: async () => ({
      summary: "SLA degradation detected mainly from evening peak workload concentration.",
      confidence: 94,
      totalAffectedStores: 1,
      insights: [],
    }),
  };

  const telemetryService = new AiTelemetryService(mockDashboardAnalyticsService);
  const service = new ExecutiveBriefService(
    mockDashboardAnalyticsService,
    mockRootCauseService,
    telemetryService,
  );

  const brief = await service.generateExecutiveBrief("today", "HEAD_OFFICE");

  assert.ok(brief);
  assert.equal(brief.overallStatus, "ATTENTION");
  assert.ok(brief.headline.includes("SLA degradation detected"));
  assert.ok(brief.keyHighlights.length > 0);
  assert.ok(brief.criticalIssues.length > 0);
  assert.equal(brief.criticalIssues[0].storeName, "Robinson Chonburi");
  assert.ok(brief.recommendedDecisions.length > 0);
  assert.equal(brief.recommendedDecisions[0].owner, "Area Manager");
  assert.equal(brief.metrics.totalMessages, 18420);
  assert.equal(brief.metrics.slaRate, 82);
});
