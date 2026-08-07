"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";
import { transformExecutiveKpiProps } from "./dashboard-transformers";
import { ExecutiveKpiGrid } from "./executive-kpi-grid";

interface ExecutiveKpiProps {
  data: DashboardAnalyticsResponse["summaryCards"];
  analytics?: DashboardAnalyticsResponse;
  language: "th" | "en" | "zh";
}

export function ExecutiveKpiCards({ analytics, data, language }: ExecutiveKpiProps) {
  const fullAnalytics: DashboardAnalyticsResponse = analytics ?? {
    summaryCards: data,
    operationHealth: {
      responseRate24h: data?.responseRate24h ?? 0.8,
      count24hReplied: data?.count24hReplied ?? 0,
      totalMessagesToday: data?.messagesToday ?? 0,
      responseRateDiffYesterday: data?.responseRateDiffYesterday ?? 0,
      breakdown: { compositeScore: 0.8, responseSlaScore: 0.8, pendingControlScore: 0.8, escalationControlScore: 0.8, growthScore: 0.8 },
    },
    operationEfficiency: { opened: data?.pendingCount ?? 0, resolved: data?.repliedCount ?? 0, closureRate: 0.8, averageResolutionTime: "12m" },
    period: "today",
    periodStartDate: new Date().toISOString(),
    dataQuality: { status: "Healthy", conversationCount: 100, storeCount: 10, lastUpdated: new Date().toISOString(), warnings: [] },
    dailySummary: { networkStatus: "🟢 Healthy", activeStoresCount: 10, totalMessagesToday: data?.messagesToday ?? 0, slaAchievementRate: 80, storesNeedAttentionCount: 0, lastUpdatedTime: "" },
    actionWorkflowStatus: { open: 0, waitingBm: 0, bmReplied: 0, resolved: 0, completionRate: 100 },
    actionStatus: { resolved: 0, waitingBm: 0, pendingReview: 0, completionRate: 100 },
    responseAnalytics: { avgResponseMinutes: 10, medianResponseMinutes: 5, buckets: { under4h: 10, between4and12h: 0, between12and24h: 0, over24h: 0 } },
    trend7Days: [],
    topTopics: [],
    topProducts: [],
    customerDemandProductCorrelation: [],
    peakHourAnalysis: { peakWindow: "18:00 - 20:00", peakTrafficCount: 40, hourlyDistribution: Array(24).fill(0), topStores: [], recommendation: "" },
    needActionQueue: [],
    slaRiskPrediction: [],
    adminActivity: [],
    storeQuickViews: {},
    storeRanking: [],
    bestPracticeStore: null,
    needImprovementStore: null,
    operationalInsights: [],
  };

  const cards = transformExecutiveKpiProps(fullAnalytics, language);

  return <ExecutiveKpiGrid cards={cards} />;
}
