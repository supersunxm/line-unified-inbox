"use client";

import React, { useState } from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";
import { transformExecutiveDecisionProps } from "./dashboard-transformers";

interface DailyOperationBriefProps {
  insights?: string[];
  analytics?: DashboardAnalyticsResponse;
  language: "th" | "en" | "zh";
  onExecuteWorkflow?: () => void;
}

const LABELS = {
  th: {
    title: "ผังการตัดสินใจและอนุมัติคำสั่งของผู้จัดการ (Manager Decision Workflow)",
    subtitle: "กระบวนการตัดสินใจ 5 ขั้นตอน: ข้อสังเกต ➔ การวินิจฉัย ➔ ข้อแนะนำ ➔ การตัดสินใจผู้จัดการ ➔ ผลลัพธ์ทางธุรกิจ",
    observation: "1. ข้อสังเกต (Observation)",
    diagnosis: "2. การวินิจฉัย (Diagnosis)",
    recommendation: "3. ข้อแนะนำ (Recommendation)",
    decision: "4. การตัดสินใจของผู้จัดการ (Manager Decision)",
    impact: "5. ผลลัพธ์ทางธุรกิจ (Expected Impact)",
  },
  en: {
    title: "Manager Decision Workflow & Executive Chain",
    subtitle: "5-step action chain: Observation ➔ Diagnosis ➔ Recommendation ➔ Manager Decision ➔ Expected Impact",
    observation: "1. Observation",
    diagnosis: "2. Diagnosis",
    recommendation: "3. Recommendation",
    decision: "4. Manager Decision",
    impact: "5. Expected Impact",
  },
  zh: {
    title: "经理决策工作流与高管执行链 (Manager Decision Workflow)",
    subtitle: "五步决策执行链: 现象观察 ➔ 根因诊断 ➔ 行动建议 ➔ 经理决策 ➔ 预期 ROI",
    observation: "1. 现象观察",
    diagnosis: "2. 根因诊断",
    recommendation: "3. 行动建议",
    decision: "4. 经理决策",
    impact: "5. 预期 ROI 效果",
  },
};

export function OperationalInsightCard({ analytics, insights = [], language, onExecuteWorkflow }: DailyOperationBriefProps) {
  const t = LABELS[language] ?? LABELS.en;
  const [decisionState, setDecisionState] = useState<"Pending Approval" | "Approved" | "Rejected" | "Completed">("Pending Approval");

  const fullAnalytics: DashboardAnalyticsResponse = analytics ?? {
    operationalInsights: insights,
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
    slaRiskPrediction: [],
    adminActivity: [],
    storeQuickViews: {},
    storeRanking: [],
    bestPracticeStore: null,
    needImprovementStore: null,
  };

  const decision = transformExecutiveDecisionProps(fullAnalytics, language);

  const handleApprove = () => {
    setDecisionState("Approved");
    if (onExecuteWorkflow) {
      onExecuteWorkflow();
    }
  };

  return (
    <section
      data-ai-executive-action-workflow
      className="rounded-2xl border-2 border-teal-500/40 bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-md space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs font-black rounded-lg bg-teal-600 text-white uppercase tracking-wider">
            DECISION CHAIN
          </span>
          <h2 className="text-base font-black tracking-tight text-[var(--foreground)]">
            🤖 {t.title}
          </h2>
        </div>

        {/* Manager Decision Status Badge */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--muted-foreground)] font-semibold">Decision Status:</span>
          <span
            className={`px-3 py-1 rounded-full font-black text-[11px] border uppercase ${
              decisionState === "Approved"
                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                : decisionState === "Completed"
                ? "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40"
                : "bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40"
            }`}
          >
            {decisionState === "Approved" ? "● Approved" : decisionState === "Completed" ? "✓ Completed" : "○ Pending Approval"}
          </span>
        </div>
      </div>

      <p className="text-xs text-[var(--muted-foreground)] font-medium">
        {t.subtitle}
      </p>

      {/* 5-Step Manager Decision Chain */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative text-xs">
        {/* Step 1: Observation */}
        <div className="bg-[var(--background)] p-4 rounded-xl border border-[var(--border)] space-y-2">
          <div className="font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5 text-xs">
            <span>📊</span>
            <span>{t.observation}</span>
          </div>
          <p className="font-semibold text-[var(--foreground)] leading-relaxed">
            {decision.situation}
          </p>
        </div>

        {/* Step 2: Diagnosis */}
        <div className="bg-[var(--background)] p-4 rounded-xl border border-[var(--border)] space-y-2">
          <div className="font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-xs">
            <span>🔍</span>
            <span>{t.diagnosis}</span>
          </div>
          <p className="font-semibold text-[var(--foreground)] leading-relaxed">
            {decision.rootCause}
          </p>
        </div>

        {/* Step 3: Recommendation & Operational Accountability Layer */}
        <div className="bg-[var(--background)] p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/5 space-y-2.5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
              <span>💡</span>
              <span>{t.recommendation}</span>
            </div>
            <p className="font-bold text-[var(--foreground)] leading-relaxed">
              {decision.recommendedAction}
            </p>
          </div>

          {/* Operational Accountability Layer */}
          <div className="pt-2 border-t border-emerald-500/20 text-[10px] space-y-0.5 text-[var(--muted-foreground)]">
            <div>Owner: <strong className="text-[var(--foreground)]">{decision.accountability.owner}</strong></div>
            <div>Deadline: <strong className="text-[var(--foreground)]">{decision.accountability.deadline}</strong></div>
          </div>
        </div>

        {/* Step 4: Manager Decision Status */}
        <div className="bg-[var(--background)] p-4 rounded-xl border border-teal-500/50 bg-teal-500/10 space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-300 flex items-center gap-1.5 text-xs">
              <span>⚡</span>
              <span>{t.decision}</span>
            </div>
            <p className="text-[11px] font-bold text-[var(--foreground)]">
              {decisionState === "Approved" ? "✅ Decision Approved & Dispatched" : decision.executeActionLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={handleApprove}
            disabled={decisionState === "Approved" || decisionState === "Completed"}
            className={`w-full py-2 px-3 rounded-lg font-black text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 ${
              decisionState === "Approved" || decisionState === "Completed"
                ? "bg-emerald-600 text-white cursor-default"
                : "bg-teal-600 hover:bg-teal-700 text-white active:scale-95"
            }`}
          >
            <span>{decisionState === "Approved" ? "✓ Approved" : "⚡ Approve Decision"}</span>
          </button>
        </div>

        {/* Step 5: Expected Impact */}
        <div className="bg-[var(--background)] p-4 rounded-xl border border-purple-500/40 bg-purple-500/5 space-y-2">
          <div className="font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5 text-xs">
            <span>🎯</span>
            <span>{t.impact}</span>
          </div>
          <p className="font-bold text-[var(--foreground)] leading-relaxed">
            {decision.expectedImpact}
          </p>
        </div>
      </div>
    </section>
  );
}
