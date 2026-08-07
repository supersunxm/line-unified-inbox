"use client";

import React from "react";
import type { DashboardAnalyticsResponse, SlaRiskPredictionItem } from "@/types/api";
import { transformStoreRiskMatrixProps } from "./dashboard-transformers";
import { StoreRiskScatterMatrix } from "./store-risk-scatter-matrix";

interface SlaRiskPredictionProps {
  predictions: SlaRiskPredictionItem[];
  analytics?: DashboardAnalyticsResponse;
  getStoreDisplayName: (name: string) => string;
  onOpenStore?: (storeId: string) => void;
  onNotifyBm?: (storeId: string, storeName: string) => void;
  onSelectStoreQuickView?: (storeId: string) => void;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "เมทริกซ์วิเคราะห์ความเสี่ยงสาขาและแผงปฏิบัติการด่วน",
    subtitle: "วิเคราะห์ความสัมพันธ์ระหว่างปริมาณข้อความกับอัตราตอบตาม SLA 24 ชม.",
  },
  en: {
    title: "Store Risk Scatter Matrix & Critical Intervention Panel",
    subtitle: "4-Quadrant SLA & Message Volume Analysis (Bubble size = Pending)",
  },
  zh: {
    title: "门店风险散点图阵与紧急干预面板",
    subtitle: "消息量与 24 小时 SLA 回复率相关性分析",
  },
};

export function SlaRiskPredictionCard({
  predictions,
  analytics,
  getStoreDisplayName,
  onOpenStore,
  onNotifyBm,
  onSelectStoreQuickView,
  language,
}: SlaRiskPredictionProps) {
  const t = LABELS[language] ?? LABELS.en;

  const fullAnalytics: DashboardAnalyticsResponse = analytics ?? {
    slaRiskPrediction: predictions,
    operationHealth: { responseRate24h: 0.8, count24hReplied: 0, totalMessagesToday: 0, responseRateDiffYesterday: 0, breakdown: { compositeScore: 0.8, responseSlaScore: 0.8, pendingControlScore: 0.8, escalationControlScore: 0.8, growthScore: 0.8 } },
    operationEfficiency: { opened: 0, resolved: 0, closureRate: 0.8, averageResolutionTime: "12m" },
    period: "today",
    periodStartDate: new Date().toISOString(),
    dataQuality: { status: "Healthy", conversationCount: 100, storeCount: 10, lastUpdated: new Date().toISOString(), warnings: [] },
    dailySummary: { networkStatus: "🟢 Healthy", activeStoresCount: 10, totalMessagesToday: 0, slaAchievementRate: 80, storesNeedAttentionCount: 0, lastUpdatedTime: "" },
    actionWorkflowStatus: { open: 0, waitingBm: 0, bmReplied: 0, resolved: 0, completionRate: 100 },
    actionStatus: { resolved: 0, waitingBm: 0, pendingReview: 0, completionRate: 100 },
    summaryCards: { messagesToday: 0, messagesYesterday: 0, messagesDiffPct: 0, repliedCount: 0, repliedPercentage: 0, bmNotifiedCount: 0, bmNotifiedPercentage: 0, pendingCount: 0, responseRate24h: 0.8, responseRateDiffYesterday: 0, count24hReplied: 0, followerGrowth: { totalFriends: 0, addedToday: 0, blockedToday: 0, netToday: 0 } },
    responseAnalytics: { avgResponseMinutes: 10, medianResponseMinutes: 5, buckets: { under4h: 10, between4and12h: 0, between12and24h: 0, over24h: 0 } },
    trend7Days: [],
    topTopics: [],
    topProducts: [],
    customerDemandProductCorrelation: [],
    peakHourAnalysis: { peakWindow: "18:00 - 20:00", peakTrafficCount: 40, hourlyDistribution: Array(24).fill(0), topStores: [], recommendation: "" },
    needActionQueue: [],
    adminActivity: [],
    storeQuickViews: {},
    storeRanking: (predictions || []).map((p) => ({
      rank: 1,
      storeId: p.storeId,
      storeName: p.storeName,
      messages: Math.max(10, Math.round((p.currentWaitingHours || 1) * 5)),
      replied: 2,
      bmNotified: 1,
      pending: 3,
      responseRate24h: p.riskLevel === "HIGH" ? 0.3 : 0.7,
      networkAvgResponseRate24h: 0.8,
      gapVsNetworkAvg: -0.2,
      avgResponseMinutes: Math.round((p.currentWaitingHours || 1) * 60),
      followerGrowth: 0,
      performanceScore: 50,
      status: "Need Attention" as const,
    })),
    bestPracticeStore: null,
    needImprovementStore: null,
    operationalInsights: [],
  };

  const points = transformStoreRiskMatrixProps(fullAnalytics);

  return (
    <StoreRiskScatterMatrix
      points={points}
      getStoreDisplayName={getStoreDisplayName}
      onOpenStore={(id) => onOpenStore?.(id)}
      onSelectStoreQuickView={(id) => onSelectStoreQuickView?.(id)}
      onNotifyBm={onNotifyBm}
      title={t.title}
      subtitle={t.subtitle}
    />
  );
}
