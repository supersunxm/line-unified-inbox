"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { DashboardAnalyticsResponse, LineOfficialAccountResponse, AIRootCauseSummary, ExecutiveDailyBrief, OperationalActionTask, ImpactSummary, OperationalMemorySummary } from "@/types/api";

import { DashboardDataQualityCard } from "./dashboard-data-quality";
import { ActionStatusCard } from "./action-status";
import { AdminActivityHistoryCard } from "./admin-activity-history";
import { StoreQuickViewDrawer } from "./store-quick-view-drawer";

import { ExecutiveKpiCards } from "./executive-kpi";
import { MessageOverviewCard } from "./message-overview";
import { ResponseRateCard } from "./response-rate-card";
import { CustomerDemandCard } from "./topic-analysis";
import { PeakHourAnalysisCard } from "./peak-hour-analysis";
import { FollowerGrowthCard } from "./follower-growth";
import { OperationalInsightCard } from "./ai-insight-card";

import { ExecutiveSummaryBanner } from "./executive-summary-banner";
import { OperationalPulse } from "./operational-pulse";
import { AiRootCauseAnalysisPanel } from "./ai-root-cause-analysis";
import { AiExecutiveDailyBrief } from "./ai-executive-daily-brief";
import { AiBiAssistantPanel } from "./ai-bi-assistant";
import { AiActionCenterPanel } from "./ai-action-center";
import { AiImpactDashboardPanel } from "./ai-impact-dashboard";
import { AiOperationalMemoryPanel } from "./ai-operational-memory";
import {
  transformExecutiveDecisionHeaderProps,
  transformOperationalPulseProps,
  transformAiRootCauseProps,
  transformExecutiveDailyBriefProps,
  transformBiAssistantProps,
  transformActionAgentProps,
  transformImpactEngineProps,
  transformOperationalMemoryProps,
} from "./dashboard-transformers";
import { NetworkHealthBanner } from "./network-health-banner";
import { SlaRiskPredictionCard } from "./sla-risk-prediction";
import { TodayActionCenter } from "./today-action-center";
import { CustomerDemandSignals } from "./customer-demand-signals";
import { StorePerformanceOverview } from "./store-performance-overview";

type Language = "th" | "en" | "zh";

// Target workspace route: /stores
interface DashboardViewProps {
  language: Language;
  lineOas?: LineOfficialAccountResponse[];
  dashboardSummary?: unknown;
  bmSummaryData?: unknown;
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  lastUpdatedAt: Date | null;
}

type Period = "today" | "7d" | "30d";
const PERIOD_LABELS: Record<Period, string> = { today: "Today", "7d": "7 Days", "30d": "30 Days" };

export function DashboardView({
  language,
  getStoreDisplayName,
  onOpenStore,
  lastUpdatedAt,
}: DashboardViewProps) {
  const [period, setPeriod] = useState<Period>("today");
  const [analytics, setAnalytics] = useState<DashboardAnalyticsResponse | null>(null);
  const [rcaSummary, setRcaSummary] = useState<AIRootCauseSummary | null>(null);
  const [executiveBrief, setExecutiveBrief] = useState<ExecutiveDailyBrief | null>(null);
  const [actionTasks, setActionTasks] = useState<OperationalActionTask[] | null>(null);
  const [impactData, setImpactData] = useState<ImpactSummary | null>(null);
  const [memoryData, setMemoryData] = useState<OperationalMemorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const [fetchError, setFetchError] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);

  const [activeQuickViewStoreId, setActiveQuickViewStoreId] = useState<string | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  const loadAnalytics = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const [data, rcaData, briefData, actionsData, impactRes, memoryRes] = await Promise.all([
        api.dashboardAnalytics(p),
        api.getRootCauseInsights(p).catch(() => null),
        api.getExecutiveDailyBrief(p).catch(() => null),
        api.getOperationalActions(p).catch(() => null),
        api.getActionImpact(p).catch(() => null),
        api.getOperationalMemory(p).catch(() => null),
      ]);
      setAnalytics(data);
      if (rcaData) setRcaSummary(rcaData);
      if (briefData) setExecutiveBrief(briefData);
      if (actionsData) setActionTasks(actionsData);
      if (impactRes) setImpactData(impactRes);
      if (memoryRes) setMemoryData(memoryRes);
      setLastFetchAt(new Date());
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
      setRefreshCountdown(60);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowTimestamp(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchLatest() {
      try {
        const [data, rcaData, briefData, actionsData, impactRes, memoryRes] = await Promise.all([
          api.dashboardAnalytics(period),
          api.getRootCauseInsights(period).catch(() => null),
          api.getExecutiveDailyBrief(period).catch(() => null),
          api.getOperationalActions(period).catch(() => null),
          api.getActionImpact(period).catch(() => null),
          api.getOperationalMemory(period).catch(() => null),
        ]);
        if (!cancelled) {
          setAnalytics(data);
          if (rcaData) setRcaSummary(rcaData);
          if (briefData) setExecutiveBrief(briefData);
          if (actionsData) setActionTasks(actionsData);
          if (impactRes) setImpactData(impactRes);
          if (memoryRes) setMemoryData(memoryRes);
          setLastFetchAt(new Date());
          setFetchError(false);
          setLoading(false);
          setRefreshCountdown(60);
        }
      } catch {
        if (!cancelled) {
          setFetchError(true);
          setLoading(false);
        }
      }
    }

    void fetchLatest();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchLatest();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          void fetchLatest();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [period]);

  const handlePeriodChange = (newPeriod: Period) => {
    if (newPeriod === period) return;
    setPeriod(newPeriod);
    void loadAnalytics(newPeriod);
  };

  const effectiveLastUpdate = lastFetchAt || lastUpdatedAt;
  const formattedLastFetch = effectiveLastUpdate
    ? effectiveLastUpdate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const dataAgeMs = effectiveLastUpdate ? nowTimestamp - effectiveLastUpdate.getTime() : 0;
  const isStaleData = Boolean(effectiveLastUpdate && dataAgeMs > 180_000);

  const decisionHeaderProps = analytics
    ? transformExecutiveDecisionHeaderProps(analytics, language)
    : null;

  const operationalPulseProps = analytics
    ? transformOperationalPulseProps(analytics)
    : null;

  const rcaProps = transformAiRootCauseProps(rcaSummary, analytics, language);
  const briefProps = transformExecutiveDailyBriefProps(executiveBrief, analytics, language);
  const biInitialAnswer = transformBiAssistantProps(analytics, language);
  const preparedActionTasks = transformActionAgentProps(actionTasks, analytics, language);
  const preparedImpactSummary = transformImpactEngineProps(impactData, analytics, language);
  const preparedMemorySummary = transformOperationalMemoryProps(memoryData, analytics, language);

  return (
    <div className="space-y-8 min-h-screen text-[var(--foreground)] pb-16">
      {/* Dynamic Header & Period Controls */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
            OPPO LINE OA Executive Control Center
          </h1>
          <p className="text-xs md:text-sm text-[var(--muted-foreground)] mt-1 flex items-center gap-2">
            <span>Enterprise SLA & Operational Intelligence</span>
            {formattedLastFetch && (
              <>
                <span>•</span>
                <span>Updated: {formattedLastFetch}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)] text-xs shadow-xs">
            {(["today", "7d", "30d"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  period === p
                    ? "bg-[var(--primary)] text-white shadow-xs"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)] bg-[var(--surface)] px-3 py-1.5 rounded-xl border border-[var(--border)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Sync: {refreshCountdown}s</span>
          </div>
        </div>
      </header>

      {/* Warnings & Error Banners */}
      {isStaleData && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <span>⚠️ Data stale ({Math.floor(dataAgeMs / 60000)}m ago)</span>
          <button type="button" onClick={() => void loadAnalytics(period)} className="underline hover:no-underline">Refresh Now</button>
        </div>
      )}

      {fetchError && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center justify-between">
          <span>⚠️ Connection issue — Failed to connect to analytics service. Retrying in {refreshCountdown}s...</span>
          <button type="button" onClick={() => void loadAnalytics(period)} className="underline hover:no-underline">Retry Now</button>
        </div>
      )}

      {/* Skeleton view */}
      {loading && !analytics ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-32 rounded-2xl bg-[var(--accent)]" />
          <div className="h-16 rounded-xl bg-[var(--accent)]" />
          <div className="h-48 rounded-xl bg-[var(--accent)]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-[var(--accent)]" />
            ))}
          </div>
        </div>
      ) : analytics && decisionHeaderProps && operationalPulseProps ? (
        <div className="space-y-10">
          {/* LEVEL 1: EXECUTIVE DECISION HEADER (Situation, Priority, Timestamp, AI Focus) */}
          <ExecutiveSummaryBanner header={decisionHeaderProps} />

          {/* LEVEL 2: OPERATIONAL PULSE STRIP (Live Network Operating Rhythm) */}
          <OperationalPulse pulse={operationalPulseProps} />

          {/* LEVEL 3: RISK CONTROL CENTER & NETWORK GAUGE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <NetworkHealthBanner
                analytics={analytics}
                health={analytics.operationHealth}
                efficiency={analytics.operationEfficiency}
                language={language}
              />
            </div>
            <div className="lg:col-span-7">
              <SlaRiskPredictionCard
                analytics={analytics}
                predictions={analytics.slaRiskPrediction}
                getStoreDisplayName={getStoreDisplayName}
                onOpenStore={onOpenStore}
                onSelectStoreQuickView={(storeId) => setActiveQuickViewStoreId(storeId)}
                language={language}
              />
            </div>
          </div>

          {/* LEVEL 4: AI ROOT CAUSE ANALYSIS ENGINE */}
          <AiRootCauseAnalysisPanel data={rcaProps} language={language} />

          {/* LEVEL 5: AI EXECUTIVE DAILY BRIEF */}
          <AiExecutiveDailyBrief data={briefProps} language={language} />

          {/* LEVEL 6: NATURAL LANGUAGE AI BI ASSISTANT */}
          <AiBiAssistantPanel initialAnswer={biInitialAnswer} period={period} language={language} />

          {/* LEVEL 7: AI ACTION CENTER & WORKFLOW AUTOMATION */}
          <AiActionCenterPanel initialTasks={preparedActionTasks} onOpenStore={onOpenStore} language={language} />

          {/* LEVEL 8: AI IMPACT MEASUREMENT & LEARNING ENGINE */}
          <AiImpactDashboardPanel summary={preparedImpactSummary} language={language} />

          {/* LEVEL 9: ⭐ AI OPERATIONAL MEMORY LAYER */}
          <AiOperationalMemoryPanel summary={preparedMemorySummary} language={language} />

          {/* LEVEL 10: 5-STEP AI EXECUTIVE ACTION WORKFLOW */}
          <OperationalInsightCard
            analytics={analytics}
            insights={analytics.operationalInsights}
            language={language}
            onExecuteWorkflow={() => {
              void loadAnalytics(period);
            }}
          />

          {/* LEVEL 11: EXECUTIVE KPI SNAPSHOT STRIP */}
          <ExecutiveKpiCards
            analytics={analytics}
            data={analytics.summaryCards}
            language={language}
          />

          {/* LEVEL 12: TODAY ACTION CENTER (Full-width workflow intervention area) */}
          <TodayActionCenter
            queue={analytics.needActionQueue}
            predictions={analytics.slaRiskPrediction}
            getStoreDisplayName={getStoreDisplayName}
            onOpenStore={onOpenStore}
            onQuickViewStore={(storeId) => setActiveQuickViewStoreId(storeId)}
            language={language}
          />

          {/* LEVEL 13: CUSTOMER DEMAND SIGNALS */}
          <CustomerDemandSignals
            correlations={analytics.customerDemandProductCorrelation}
            language={language}
          />

          {/* LEVEL 14: STORE PERFORMANCE OVERVIEW (Top 5 Best vs Top 5 Need Improvement) */}
          <StorePerformanceOverview
            stores={analytics.storeRanking}
            getStoreDisplayName={getStoreDisplayName}
            onOpenStore={onOpenStore}
            onSelectStoreQuickView={(storeId) => setActiveQuickViewStoreId(storeId)}
            language={language}
          />

          {/* LEVEL 15: ANALYTICS DETAIL (Message volume, SLA breakdown, Peak hour, Topics) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MessageOverviewCard cards={analytics.summaryCards} trend={analytics.trend7Days} language={language} />
            <ResponseRateCard analytics={analytics.responseAnalytics} language={language} />
            <CustomerDemandCard correlations={analytics.customerDemandProductCorrelation} language={language} />
            <PeakHourAnalysisCard analytics={analytics.peakHourAnalysis} language={language} />
            <FollowerGrowthCard growth={analytics.summaryCards.followerGrowth} language={language} />
            <ActionStatusCard workflow={analytics.actionWorkflowStatus} status={analytics.actionStatus} language={language} />
          </div>

          {/* LEVEL 16: DATA QUALITY & AUDIT LOG */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DashboardDataQualityCard quality={analytics.dataQuality} language={language} />
            <AdminActivityHistoryCard logs={analytics.adminActivity} getStoreDisplayName={getStoreDisplayName} language={language} />
          </div>
        </div>
      ) : null}

      {/* Store Quick View Drawer Modal */}
      {activeQuickViewStoreId && analytics?.storeQuickViews?.[activeQuickViewStoreId] && (
        <StoreQuickViewDrawer
          storeData={analytics.storeQuickViews[activeQuickViewStoreId]}
          getStoreDisplayName={getStoreDisplayName}
          onClose={() => setActiveQuickViewStoreId(null)}
          onOpenInbox={(storeId) => {
            setActiveQuickViewStoreId(null);
            onOpenStore(storeId);
          }}
          language={language}
        />
      )}
    </div>
  );
}
