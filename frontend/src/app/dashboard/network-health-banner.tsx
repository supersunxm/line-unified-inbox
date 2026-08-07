"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";
import { transformNetworkHealthProps } from "./dashboard-transformers";
import { CircularHealthGauge } from "./circular-health-gauge";

interface NetworkHealthBannerProps {
  health: DashboardAnalyticsResponse["operationHealth"];
  efficiency: DashboardAnalyticsResponse["operationEfficiency"];
  analytics?: DashboardAnalyticsResponse;
  language: "th" | "en" | "zh";
}

const labels = {
  th: {
    title: "สถานะการดำเนินงานเครือข่าย",
    reasonsTitle: "เหตุผลหลักที่ต้องติดตาม",
  },
  en: {
    title: "Network Operation Health",
    reasonsTitle: "Operational Explanation",
  },
  zh: {
    title: "网络运营健康状态",
    reasonsTitle: "运营说明",
  },
};

export function NetworkHealthBanner({ health, efficiency, analytics, language }: NetworkHealthBannerProps) {
  const t = labels[language] ?? labels.th;

  const fullAnalytics: DashboardAnalyticsResponse = analytics ?? {
    operationHealth: health,
    operationEfficiency: efficiency,
    period: "today",
    periodStartDate: new Date().toISOString(),
    dataQuality: { status: "Healthy", conversationCount: 100, storeCount: 10, lastUpdated: new Date().toISOString(), warnings: [] },
    dailySummary: { networkStatus: "🟢 Healthy", activeStoresCount: 10, totalMessagesToday: health?.totalMessagesToday ?? 0, slaAchievementRate: 80, storesNeedAttentionCount: 0, lastUpdatedTime: "" },
    actionWorkflowStatus: { open: 0, waitingBm: 0, bmReplied: 0, resolved: 0, completionRate: 100 },
    actionStatus: { resolved: 0, waitingBm: 0, pendingReview: 0, completionRate: 100 },
    summaryCards: { messagesToday: health?.totalMessagesToday ?? 0, messagesYesterday: 0, messagesDiffPct: 0, repliedCount: 0, repliedPercentage: 0, bmNotifiedCount: 0, bmNotifiedPercentage: 0, pendingCount: efficiency?.opened ?? 0, responseRate24h: health?.responseRate24h ?? 0.8, responseRateDiffYesterday: 0, count24hReplied: health?.count24hReplied ?? 0, followerGrowth: { totalFriends: 0, addedToday: 0, blockedToday: 0, netToday: 0 } },
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

  const gaugeProps = transformNetworkHealthProps(fullAnalytics, language);

  return <CircularHealthGauge gauge={gaugeProps} title={t.title} />;
}
