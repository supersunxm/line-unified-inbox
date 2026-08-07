import test from "node:test";
import assert from "node:assert/strict";
import { transformAiRootCauseProps } from "../src/app/dashboard/dashboard-transformers.ts";
import type { AIRootCauseSummary, DashboardAnalyticsResponse } from "../src/types/api.ts";

test("AI Root Cause Analysis - transforms backend AIRootCauseSummary correctly", () => {
  const summaryData: AIRootCauseSummary = {
    summary: "SLA degradation mainly caused by evening peak overload at Robinson Chonburi",
    confidence: 94,
    totalAffectedStores: 1,
    insights: [
      {
        id: "rca-store-1",
        storeId: "store-1",
        storeName: "Robinson Chonburi",
        severity: "CRITICAL",
        problem: "9 pending conversations",
        problemAge: "2h 35m",
        diagnosis: {
          primaryCause: "Evening workload overload combined with peak traffic concentration during 18:00 - 22:00 at Robinson Chonburi.",
          contributingFactors: ["Evening traffic surge", "Single active operator"],
          evidence: ["Message volume +68%", "9 unanswered conversations", "Waiting time > 2h"],
          category: "WORKLOAD_SURGE",
        },
        confidence: 94,
        recommendation: "Assign backup responder during peak period.",
        expectedImpact: "Reduce SLA breach by 35%.",
        createdAt: "2026-08-07T11:55:00.000Z",
      },
    ],
  };

  const props = transformAiRootCauseProps(summaryData, null, "en");

  assert.equal(props.confidence, 94);
  assert.equal(props.totalAffectedStores, 1);
  assert.equal(props.insights.length, 1);
  assert.equal(props.insights[0].storeName, "Robinson Chonburi");
  assert.equal(props.insights[0].diagnosis.category, "WORKLOAD_SURGE");
  assert.equal(props.insights[0].diagnosis.evidence.length, 3);
});

test("AI Root Cause Analysis - fallback transformer works when async RCA payload is pending", () => {
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
    topProducts: [{ productModelId: "p1", name: "OPPO Reno 12 Pro", count: 40, percentage: 40 }],
    customerDemandProductCorrelation: [],
    peakHourAnalysis: { peakWindow: "18:00 - 22:00", peakTrafficCount: 45, hourlyDistribution: Array(24).fill(0), topStores: [], recommendation: "Increase peak manpower" },
    needActionQueue: [],
    slaRiskPrediction: [],
    adminActivity: [],
    storeQuickViews: {},
    storeRanking: [
      {
        rank: 1,
        storeId: "s1",
        storeName: "Robinson Chonburi",
        messages: 45,
        replied: 36,
        bmNotified: 1,
        pending: 9,
        responseRate24h: 68,
        networkAvgResponseRate24h: 85,
        gapVsNetworkAvg: -17,
        avgResponseMinutes: 25,
        followerGrowth: 10,
        performanceScore: 65,
        status: "Improve",
      },
    ],
    bestPracticeStore: null,
    needImprovementStore: null,
    operationalInsights: [],
  };

  const props = transformAiRootCauseProps(null, mockAnalytics, "en");

  assert.equal(props.confidence, 91);
  assert.equal(props.totalAffectedStores, 1);
  assert.equal(props.insights.length, 1);
  assert.equal(props.insights[0].storeName, "Robinson Chonburi");
  assert.equal(props.insights[0].severity, "CRITICAL");
});
