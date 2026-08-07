import test from "node:test";
import assert from "node:assert/strict";
import { transformOperationalMemoryProps } from "../src/app/dashboard/dashboard-transformers.ts";
import type { OperationalMemorySummary, DashboardAnalyticsResponse } from "../src/types/api.ts";

test("AI Operational Memory - transforms API memory summary payload correctly", () => {
  const mockMemory: OperationalMemorySummary = {
    totalStoredCases: 10,
    avgConfidencePct: 95,
    topSlaLiftCase: "Top SLA pattern verified",
    cases: [
      {
        id: "mem-1",
        storeId: "s-1",
        storeName: "Robinson Chonburi",
        problemPattern: "Evening peak traffic overload",
        rootCauseCategory: "WORKLOAD_SURGE",
        successfulAction: "Reallocate float support responder",
        confidence: 95,
        timesApplied: 18,
        avgSlaLiftPct: 75,
        lastAppliedAt: "2026-08-07T12:00:00.000Z",
      },
    ],
  };

  const summary = transformOperationalMemoryProps(mockMemory, null, "en");

  assert.equal(summary.totalStoredCases, 10);
  assert.equal(summary.avgConfidencePct, 95);
  assert.equal(summary.cases.length, 1);
  assert.equal(summary.cases[0].storeName, "Robinson Chonburi");
});

test("AI Operational Memory - fallback transformer generates default summary when API payload is null", () => {
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

  const summary = transformOperationalMemoryProps(null, mockAnalytics, "en");

  assert.equal(summary.totalStoredCases, 18);
  assert.equal(summary.avgConfidencePct, 94);
  assert.equal(summary.cases.length, 2);
});
