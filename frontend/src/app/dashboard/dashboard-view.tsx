"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { DashboardAnalyticsResponse, LineOfficialAccountResponse } from "@/types/api";

import { DashboardDataQualityCard } from "./dashboard-data-quality";
import { ActionStatusCard } from "./action-status";
import { AdminActivityHistoryCard } from "./admin-activity-history";
import { StoreQuickViewDrawer } from "./store-quick-view-drawer";

import { MessageOverviewCard } from "./message-overview";
import { ResponseRateCard } from "./response-rate-card";
import { CustomerDemandCard } from "./topic-analysis";
import { PeakHourAnalysisCard } from "./peak-hour-analysis";
import { FollowerGrowthCard } from "./follower-growth";

import { ExecutiveHero } from "./executive-hero";
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

type Period = "today" | "7d" | "30d" | "custom";

const DASHBOARD_TEXT = {
  th: {
    brandSubtitle: "OPPO LINE OA · Executive Control Center",
    title: "ภาพรวมศูนย์ควบคุม",
    subtitle: "ติดตามประสิทธิภาพ LINE OA และการปฏิบัติการทุกสาขา",
    today: "วันนี้",
    sevenDays: "7 วัน",
    thirtyDays: "30 วัน",
    custom: "กำหนดเอง",
    customDateTitle: "เลือกช่วงวันที่",
    startDate: "วันเริ่มต้น",
    endDate: "วันสิ้นสุด",
    apply: "นำไปใช้",
    reset: "รีเซ็ต",
    autoRefresh: "รีเฟรชอัตโนมัติ",
    dataStale: "ข้อมูลอาจไม่อัปเดต",
    refreshNow: "รีเฟรชทันที",
    connectionIssue: "เกิดปัญหาในการเชื่อมต่อข้อมูล กำลังลองใหม่ใน",
    retryNow: "ลองใหม่ทันที",
    updatedAt: "อัปเดตเมื่อ",
    sectionPulse: "ดัชนีสำคัญผู้บริหาร (Executive Pulse)",
    sectionFollowers: "ผู้ติดตามและการเติบโต (Follower Performance)",
    sectionIntelligence: "ข้อมูลเชิงลึกความต้องการลูกค้า (Customer Intelligence)",
    sectionStores: "ประสิทธิภาพสาขาทั่วประเทศ (Store Performance)",
    sectionOperational: "สรุปการปฏิบัติการและระบบ (Operations & System)",
  },
  en: {
    brandSubtitle: "OPPO LINE OA · Executive Control Center",
    title: "Executive Overview",
    subtitle: "Monitor LINE OA performance and retail operations across all stores",
    today: "Today",
    sevenDays: "7 Days",
    thirtyDays: "30 Days",
    custom: "Custom",
    customDateTitle: "Select Date Range",
    startDate: "Start Date",
    endDate: "End Date",
    apply: "Apply",
    reset: "Reset",
    autoRefresh: "Auto refresh",
    dataStale: "Data may be stale",
    refreshNow: "Refresh Now",
    connectionIssue: "Connection issue — Failed to connect. Retrying in",
    retryNow: "Retry Now",
    updatedAt: "Updated at",
    sectionPulse: "Executive Pulse",
    sectionFollowers: "Follower Performance",
    sectionIntelligence: "Customer Intelligence",
    sectionStores: "Store Performance",
    sectionOperational: "Operations & System",
  },
  zh: {
    brandSubtitle: "OPPO LINE OA · 执行控制中心",
    title: "执行概览",
    subtitle: "监控各门店 LINE OA 运营绩效与业务动态",
    today: "今日",
    sevenDays: "7天",
    thirtyDays: "30天",
    custom: "自定义",
    customDateTitle: "选择日期范围",
    startDate: "开始日期",
    endDate: "结束日期",
    apply: "应用",
    reset: "重置",
    autoRefresh: "自动刷新",
    dataStale: "数据可能已过期",
    refreshNow: "立即刷新",
    connectionIssue: "连接异常 — 正在重试，剩余",
    retryNow: "立即重试",
    updatedAt: "更新时间",
    sectionPulse: "管理层核心指标 (Executive Pulse)",
    sectionFollowers: "关注者增长表现 (Follower Performance)",
    sectionIntelligence: "客户需求洞察 (Customer Intelligence)",
    sectionStores: "门店运营绩效 (Store Performance)",
    sectionOperational: "运营与系统状态 (Operations & System)",
  },
};

function formatBangkokDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function DashboardView({
  language,
  getStoreDisplayName,
  onOpenStore,
  lastUpdatedAt,
}: DashboardViewProps) {
  const t = DASHBOARD_TEXT[language] ?? DASHBOARD_TEXT.en;
  const [period, setPeriod] = useState<Period>("today");
  const [customStartDate, setCustomStartDate] = useState<string>(() => formatBangkokDate(new Date()));
  const [customEndDate, setCustomEndDate] = useState<string>(() => formatBangkokDate(new Date()));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [activeCustomLabel, setActiveCustomLabel] = useState<string | null>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

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
      const apiPeriod = p === "custom" ? "today" : p;
      const data = await api.dashboardAnalytics(apiPeriod);
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
        const apiPeriod = period === "custom" ? "today" : period;
        const data = await api.dashboardAnalytics(apiPeriod);
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

  // Close custom date picker on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    }
    if (isDatePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDatePickerOpen]);

  const handlePeriodChange = (newPeriod: Period) => {
    if (newPeriod === "custom") {
      setIsDatePickerOpen(true);
      return;
    }
    setActiveCustomLabel(null);
    setIsDatePickerOpen(false);
    if (newPeriod === period) return;
    setPeriod(newPeriod);
    void loadAnalytics(newPeriod);
  };

  const handleApplyCustomDate = () => {
    setIsDatePickerOpen(false);
    setPeriod("custom");
    if (customStartDate === customEndDate) {
      setActiveCustomLabel(`📅 ${customStartDate}`);
    } else {
      setActiveCustomLabel(`📅 ${customStartDate} – ${customEndDate}`);
    }
    void loadAnalytics("custom");
  };

  const handleResetCustomDate = () => {
    setCustomStartDate(formatBangkokDate(new Date()));
    setCustomEndDate(formatBangkokDate(new Date()));
    setActiveCustomLabel(null);
    setIsDatePickerOpen(false);
    setPeriod("today");
    void loadAnalytics("today");
  };

  const effectiveLastUpdate = lastFetchAt || lastUpdatedAt;
  const formattedLastFetch = effectiveLastUpdate
    ? effectiveLastUpdate.toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const dataAgeMs = effectiveLastUpdate ? nowTimestamp - effectiveLastUpdate.getTime() : 0;
  const isStaleData = Boolean(effectiveLastUpdate && dataAgeMs > 180_000);

  return (
    <div className="space-y-8 min-h-screen text-[var(--foreground)] pb-20">
      {/* ── HEADER & GLOBAL DATE FILTER ──────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-2xs" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t.brandSubtitle}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
            <span>{t.subtitle}</span>
            {formattedLastFetch && (
              <>
                <span>•</span>
                <span className="font-tabular">{t.updatedAt}: {formattedLastFetch}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Global Date Presets */}
          <div className="relative flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800/80 text-xs shadow-2xs font-tabular">
            <button
              type="button"
              onClick={() => handlePeriodChange("today")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === "today"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t.today}
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("7d")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === "7d"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t.sevenDays}
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("30d")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === "30d"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t.thirtyDays}
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("custom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                period === "custom"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span>{activeCustomLabel || `📅 ${t.custom}`}</span>
            </button>

            {/* Custom Date Range Popover */}
            {isDatePickerOpen && (
              <div
                ref={datePickerRef}
                className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl backdrop-blur-md"
              >
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {t.customDateTitle}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {t.startDate}
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40 font-tabular"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {t.endDate}
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40 font-tabular"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handleResetCustomDate}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      {t.reset}
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyCustomDate}
                      className="app-button-primary px-3 py-1.5 rounded-lg text-xs font-semibold"
                    >
                      {t.apply}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Auto Refresh Status Indicator */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs font-tabular">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>{t.autoRefresh}: {refreshCountdown}s</span>
          </div>
        </div>
      </header>

      {/* Warnings & Error Banners */}
      {isStaleData && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs font-medium text-amber-800 dark:text-amber-300 flex items-center justify-between shadow-2xs">
          <span>⚠️ Data stale ({Math.floor(dataAgeMs / 60000)}m ago)</span>
          <button type="button" onClick={() => void loadAnalytics(period)} className="underline hover:no-underline font-semibold">{t.refreshNow}</button>
        </div>
      )}

      {fetchError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs font-medium text-rose-700 dark:text-rose-400 flex items-center justify-between shadow-2xs">
          <span>⚠️ Connection issue — Failed to connect to analytics service. Retrying in {refreshCountdown}s...</span>
          <button type="button" onClick={() => void loadAnalytics(period)} className="underline hover:no-underline font-semibold">{t.retryNow}</button>
        </div>
      )}

      {/* Skeleton loading view */}
      {loading && !analytics ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 h-64 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
            <div className="lg:col-span-5 h-64 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
          </div>
        </div>
      ) : analytics ? (
        <div className="space-y-10">
          {/* ── SECTION 1 & 2: EXECUTIVE PULSE & FOLLOWER PERFORMANCE ── */}
          <ExecutiveHero
            analytics={analytics}
            language={language}
            getStoreDisplayName={getStoreDisplayName}
          />

          {/* ── SECTION 3: CUSTOMER INTELLIGENCE ─────────────────────── */}
          <CustomerDemandSignals
            correlations={analytics.customerDemandProductCorrelation}
            language={language}
          />

          {/* ── SECTION 4: STORE PERFORMANCE ─────────────────────────── */}
          <StorePerformanceOverview
            stores={analytics.storeRanking}
            getStoreDisplayName={getStoreDisplayName}
            onOpenStore={onOpenStore}
            onSelectStoreQuickView={(storeId) => setActiveQuickViewStoreId(storeId)}
            language={language}
          />

          {/* ── SECTION 5: OPERATIONS & SYSTEM HEALTH ─────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <MessageOverviewCard cards={analytics.summaryCards} trend={analytics.trend7Days} language={language} />
            <ResponseRateCard analytics={analytics.responseAnalytics} language={language} />
            <CustomerDemandCard correlations={analytics.customerDemandProductCorrelation} language={language} />
            <PeakHourAnalysisCard analytics={analytics.peakHourAnalysis} language={language} />
            <FollowerGrowthCard growth={analytics.summaryCards.followerGrowth} language={language} />
            <ActionStatusCard workflow={analytics.actionWorkflowStatus} status={analytics.actionStatus} language={language} />
          </div>

          {/* DATA QUALITY & AUDIT LOG */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

