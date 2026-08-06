"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { DashboardAnalyticsResponse, LineOfficialAccountResponse } from "@/types/api";

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

import { NetworkHealthBanner } from "./network-health-banner";
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
  const [loading, setLoading] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const [fetchError, setFetchError] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);

  const [activeQuickViewStoreId, setActiveQuickViewStoreId] = useState<string | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  const loadAnalytics = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const data = await api.dashboardAnalytics(p);
      setAnalytics(data);
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
        const data = await api.dashboardAnalytics(period);
        if (!cancelled) {
          setAnalytics(data);
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

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    void loadAnalytics(p);
  };

  const activeStoreQuickViewData = activeQuickViewStoreId && analytics?.storeQuickViews
    ? analytics.storeQuickViews[activeQuickViewStoreId] ?? null
    : null;

  const effectiveLastUpdate = lastFetchAt || lastUpdatedAt;
  const dataAgeMs = effectiveLastUpdate ? nowTimestamp - effectiveLastUpdate.getTime() : 0;
  const isStaleData = Boolean(effectiveLastUpdate && dataAgeMs > 180_000);
  const formattedUpdatedAt = (lastFetchAt || lastUpdatedAt)?.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div data-dashboard-view className="space-y-8 p-4 sm:p-6 max-w-[1600px] mx-auto">
      {/* HEADER CONTROLS */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--foreground)] flex items-center gap-2">
            <span>🛡️</span>
            <span>OPPO Operations Command Center</span>
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] font-medium mt-0.5">
            Real-time Store Operations, Workload Intervention & Customer Demand Intelligence
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center gap-1 p-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs">
            {(["today", "7d", "30d"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  period === p
                    ? "bg-[var(--background)] text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Auto Refresh Countdown Controls */}
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] border-l border-[var(--border)] pl-3">
            <span>Refreshes in {refreshCountdown}s</span>
            {formattedUpdatedAt && <span>({formattedUpdatedAt})</span>}
            <button
              type="button"
              onClick={() => void loadAnalytics(period)}
              disabled={loading}
              className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] text-[var(--foreground)] transition-colors disabled:opacity-50"
              title="Manual Refresh"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
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
          <div className="h-48 rounded-xl bg-[var(--accent)]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-[var(--accent)]" />
            ))}
          </div>
        </div>
      ) : analytics ? (
        <div className="space-y-8">
          {/* LEVEL 1: NETWORK HEALTH OVERVIEW */}
          <NetworkHealthBanner
            health={analytics.operationHealth}
            efficiency={analytics.operationEfficiency}
            language={language}
          />

          {/* LEVEL 2: TODAY ACTION CENTER (Full-width workflow area) */}
          <TodayActionCenter
            queue={analytics.needActionQueue}
            predictions={analytics.slaRiskPrediction}
            getStoreDisplayName={getStoreDisplayName}
            onOpenStore={onOpenStore}
            onQuickViewStore={(storeId) => setActiveQuickViewStoreId(storeId)}
            language={language}
          />

          {/* LEVEL 3: CUSTOMER SIGNALS & DEMAND */}
          <CustomerDemandSignals
            correlations={analytics.customerDemandProductCorrelation}
            language={language}
          />

          {/* LEVEL 4: STORE PERFORMANCE OVERVIEW (Need Attention vs Best Practice) */}
          <StorePerformanceOverview
            stores={analytics.storeRanking}
            getStoreDisplayName={getStoreDisplayName}
            onOpenStore={onOpenStore}
            onSelectStoreQuickView={(storeId) => setActiveQuickViewStoreId(storeId)}
            language={language}
          />

          {/* LEVEL 5: ANALYTICS & TRENDS (Pushed Lower) */}
          <section aria-label="Analytical Trends & Workload Performance" className="space-y-6 pt-4 border-t border-[var(--border)]">
            <div className="flex items-center gap-2 pb-2">
              <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-blue-600 text-white uppercase tracking-wider">
                LEVEL 5 · ANALYTICS
              </span>
              <h2 className="text-base font-extrabold text-[var(--foreground)] tracking-tight">
                📊 Analytical Trends & Peak Traffic Analysis
              </h2>
            </div>

            <div className="space-y-4">
              <ExecutiveKpiCards data={analytics.summaryCards} language={language} />
              <MessageOverviewCard cards={analytics.summaryCards} trend={analytics.trend7Days} language={language} />
              <ResponseRateCard analytics={analytics.responseAnalytics} language={language} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <CustomerDemandCard correlations={analytics.customerDemandProductCorrelation} language={language} />
              </div>
              <div className="lg:col-span-5">
                <PeakHourAnalysisCard analytics={analytics.peakHourAnalysis} language={language} />
              </div>
            </div>
          </section>

          {/* LEVEL 6: SYSTEM HEALTH & MAINTENANCE (Bottom Section) */}
          <section aria-label="System Health & Operational Audit" className="space-y-6 pt-4 border-t border-[var(--border)]">
            <div className="flex items-center gap-2 pb-2">
              <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-slate-700 text-white uppercase tracking-wider">
                LEVEL 6 · SYSTEM HEALTH
              </span>
              <h2 className="text-base font-extrabold text-[var(--foreground)] tracking-tight">
                ⚙️ Master Data Quality, Workflow Status & Audit Trail
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4">
                <ActionStatusCard workflow={analytics.actionWorkflowStatus} status={analytics.actionStatus} language={language} />
              </div>
              <div className="lg:col-span-4">
                <DashboardDataQualityCard quality={analytics.dataQuality} language={language} />
              </div>
              <div className="lg:col-span-4">
                <AdminActivityHistoryCard logs={analytics.adminActivity} getStoreDisplayName={getStoreDisplayName} language={language} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6">
                <FollowerGrowthCard growth={analytics.summaryCards.followerGrowth} language={language} />
              </div>
              <div className="lg:col-span-6">
                <OperationalInsightCard insights={analytics.operationalInsights} language={language} />
              </div>
            </div>
          </section>

          {/* STORE QUICK VIEW DRAWER MODAL */}
          <StoreQuickViewDrawer
            storeData={activeStoreQuickViewData}
            getStoreDisplayName={getStoreDisplayName}
            onClose={() => setActiveQuickViewStoreId(null)}
            onOpenInbox={(id) => {
              setActiveQuickViewStoreId(null);
              onOpenStore(id);
            }}
            language={language}
          />
        </div>
      ) : null}
    </div>
  );
}
