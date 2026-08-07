import test from "node:test";
import assert from "node:assert/strict";
import { transformExecutiveDailyBriefProps } from "../src/app/dashboard/dashboard-transformers.ts";
import type { ExecutiveDailyBrief, DashboardAnalyticsResponse } from "../src/types/api.ts";

test("AI Executive Daily Brief - transforms backend ExecutiveDailyBrief payload correctly", () => {
  const briefPayload: ExecutiveDailyBrief = {
    date: "2026-08-07",
    overallStatus: "ATTENTION",
    headline: "SLA degradation detected mainly from evening peak workload concentration.",
    keyHighlights: [
      "Message volume +28% vs yesterday",
      "Network SLA rate at 82%",
      "5 stores affected",
    ],
    criticalIssues: [
      {
        storeName: "Robinson Chonburi",
        issue: "9 unanswered conversations",
        impact: "High customer waiting risk",
        severity: "HIGH",
      },
    ],
    rootCauseSummary: "Evening peak workload surge at Robinson Chonburi.",
    recommendedDecisions: [
      {
        action: "Assign float backup responder 18:00-22:00",
        owner: "Area Manager",
        deadline: "Today 18:00",
        expectedImpact: "Reduce SLA breach by 35%",
      },
    ],
    metrics: {
      totalMessages: 18420,
      slaRate: 82,
      pending: 9,
      riskStores: 5,
    },
    generatedAt: "2026-08-07T12:00:00.000Z",
  };

  const props = transformExecutiveDailyBriefProps(briefPayload, null, "en");

  assert.equal(props.overallStatus, "ATTENTION");
  assert.equal(props.headline, "SLA degradation detected mainly from evening peak workload concentration.");
  assert.equal(props.keyHighlights.length, 3);
  assert.equal(props.criticalIssues.length, 1);
  assert.equal(props.criticalIssues[0].storeName, "Robinson Chonburi");
  assert.equal(props.recommendedDecisions[0].owner, "Area Manager");
  assert.equal(props.metrics.totalMessages, 18420);
});

test("AI Executive Daily Brief - fallback transformer works when brief payload is pending", () => {
  const mockAnalytics: DashboardAnalyticsResponse = {
    period: "today",
    periodStartDate: "2026-08-07T00:00:00.000Z",
    operationHealth: { responseRate24h: 0.82, count24hReplied: 82, totalMessagesToday: 100, responseRateDiffYesterday: 0, breakdown: { compositeScore: 0.82, responseSlaScore: 0.82, pendingControlScore: 0.8, escalationControlScore: 0.8, growthScore: 0.8 } },
    operationEfficiency: { opened: 9, resolved: 80, closureRate: 0.8, averageResolutionTime: "12m" },
    dailySummary: { networkStatus: "⚠️ Attention Required", activeStoresCount: 10, totalMessagesToday: 100, slaAchievementRate: 82, storesNeedAttentionCount: 1, lastUpdatedTime: "11:55" },
    actionWorkflowStatus: { open: 9, waitingBm: 1, bmReplied: 0, resolved: 80, completionRate: 80 },
    actionStatus: { resolved: 80, waitingBm: 1, pendingReview: 9, completionRate: 80 },
    summaryCards: { messagesToday: 100, messagesYesterday: 90, messagesDiffPct: 11, repliedCount: 80, repliedPercentage: 80, bmNotifiedCount: 1, bmNotifiedPercentage: 1, pendingCount: 9, responseRate24h: 0.82, responseRateDiffYesterday: 0, count24hReplied: 82, followerGrowth: { totalFriends: 1000, addedToday: 10, blockedToday: 1, netToday: 9 } },
    responseAnalytics: { avgResponseMinutes: 12, medianResponseMinutes: 6, buckets: { under4h: 80, between4and12h: 0, between12and24h: 0, over24h: 0 } },
    trend7Days: [],
    topTopics: [],
    topProducts: [],
    customerDemandProductCorrelation: [],
    peakHourAnalysis: { peakWindow: "18:00 - 22:00", peakTrafficCount: 45, hourlyDistribution: Array(24).fill(0), topStores: [], recommendation: "Increase peak manpower" },
    needActionQueue: [],
    slaRiskPrediction: [
      { storeId: "s1", storeName: "Robinson Chonburi", currentWaitingHours: 2.5, expectedBreachHours: 0.5, riskLevel: "HIGH", recommendation: "Dispatch alert" },
    ],
    adminActivity: [],
    storeQuickViews: {},
    storeRanking: [],
    bestPracticeStore: null,
    needImprovementStore: null,
    operationalInsights: [],
  };

  const props = transformExecutiveDailyBriefProps(null, mockAnalytics, "en");

  assert.equal(props.overallStatus, "ATTENTION");
  assert.equal(props.metrics.slaRate, 82);
  assert.equal(props.criticalIssues.length, 1);
  assert.equal(props.criticalIssues[0].storeName, "Robinson Chonburi");
});
