"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { ByStoreAccountRow, SummaryDailyRow, SyncBatchResult } from "@/types/api";
import { DateRangePicker } from "./date-range-picker";
import { DailySummaryTable } from "./daily-summary-table";
import { StoreBreakdownTable } from "./store-breakdown-table";
import { TrendChart } from "./trend-chart";
import {
  calculateCoverage,
  formatBkkDateTime,
  formatDateDisplay,
  getBkkDateStr,
  getInclusiveCalendarDays,
  validateDateRange,
} from "./follower-insights-utils";
import { getFollowerInsightsText, type Language } from "./follower-insights-translations";

export function FollowerInsightsView({ language = "en" }: { language?: Language }) {
  const t = getFollowerInsightsText(language);
  const today = new Date();
  const defaultDateTo = getBkkDateStr(today);
  const dateFromInit = new Date(today);
  dateFromInit.setDate(dateFromInit.getDate() - 6);
  const defaultDateFrom = getBkkDateStr(dateFromInit);

  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);

  const [summaryData, setSummaryData] = useState<SummaryDailyRow[]>([]);
  const [storeData, setStoreData] = useState<ByStoreAccountRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncBatchResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [chartMetric, setChartMetric] = useState<"followers" | "targetedReaches" | "blocks">(
    "followers"
  );
  const [showSyncMissingModal, setShowSyncMissingModal] = useState(false);

  // Multi-Store Trend Filter State (empty array [] = all stores)
  const [selectedLineOaIds, setSelectedLineOaIds] = useState<string[]>([]);
  const [storeSeriesMap, setStoreSeriesMap] = useState<Record<string, SummaryDailyRow[]>>({});
  const [storeTrendLoading, setStoreTrendLoading] = useState(false);
  const [storeTrendError, setStoreTrendError] = useState<string | null>(null);

  // Comparison Mode State ("available" | "comparable")
  const [comparisonMode, setComparisonMode] = useState<"comparable" | "available">("available");

  // Derive comparable accounts & summary data
  const { comparableLineOaIds, comparableSummaryData } = useMemo(() => {
    if (!summaryData.length || !storeData.length) {
      return { comparableLineOaIds: new Set<string>(), comparableSummaryData: summaryData };
    }

    const allDates = summaryData.map((d) => d.date);

    // Group storeData by lineOaId -> Set of ready dates
    const accountReadyDates = new Map<string, Set<string>>();
    for (const row of storeData) {
      if (row.lineOaId && row.status === "ready" && row.followers !== null) {
        if (!accountReadyDates.has(row.lineOaId)) {
          accountReadyDates.set(row.lineOaId, new Set());
        }
        accountReadyDates.get(row.lineOaId)!.add(row.date);
      }
    }

    const comparableIds = new Set<string>();
    accountReadyDates.forEach((readyDates, lineOaId) => {
      const isReadyAllDates = allDates.every((d) => readyDates.has(d));
      if (isReadyAllDates) {
        comparableIds.add(lineOaId);
      }
    });

    const comparableCount = comparableIds.size;

    // Group storeData by date -> rows
    const dateStoreMap = new Map<string, ByStoreAccountRow[]>();
    for (const row of storeData) {
      if (row.lineOaId && comparableIds.has(row.lineOaId)) {
        if (!dateStoreMap.has(row.date)) {
          dateStoreMap.set(row.date, []);
        }
        dateStoreMap.get(row.date)!.push(row);
      }
    }

    const compSummary: SummaryDailyRow[] = summaryData.map((originalRow) => {
      const rowsForDate = dateStoreMap.get(originalRow.date) || [];
      const followersSum = rowsForDate.reduce((acc, r) => acc + (r.followers ?? 0), 0);
      const reachSum = rowsForDate.reduce((acc, r) => acc + (r.targetedReaches ?? 0), 0);
      const blocksSum = rowsForDate.reduce((acc, r) => acc + (r.blocks ?? 0), 0);

      return {
        ...originalRow,
        followers: rowsForDate.length > 0 ? followersSum : null,
        targetedReaches: rowsForDate.length > 0 ? reachSum : null,
        blocks: rowsForDate.length > 0 ? blocksSum : null,
        accountsExpected: comparableCount,
        accountsReady: comparableCount,
        accountsWithData: comparableCount,
      };
    });

    return { comparableLineOaIds: comparableIds, comparableSummaryData: compSummary };
  }, [summaryData, storeData]);

  const loadData = useCallback(
    async (start: string, end: string) => {
      const validation = validateDateRange(start, end, language);
      if (!validation.valid) {
        setValidationError(validation.error);
        return;
      }
      setValidationError(null);
      setLoading(true);
      setSummaryError(null);
      setStoreError(null);

      let sumSucceeded = false;
      let storeSucceeded = false;

      try {
        const sum = await api.followerInsightsSummary({ dateFrom: start, dateTo: end });
        setSummaryData(sum);
        sumSucceeded = true;
      } catch (err) {
        setSummaryError(err instanceof Error ? err.message : t.errorLoadingSummary);
      }

      try {
        const stores = await api.followerInsightsByStore(start, end);
        setStoreData(stores);
        storeSucceeded = true;
      } catch (err) {
        setStoreError(err instanceof Error ? err.message : t.errorLoadingStore);
      }

      if (sumSucceeded || storeSucceeded) {
        setInitialLoadDone(true);
        setLastRefreshedAt(new Date());
      }
      setLoading(false);
    },
    [language, t]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(dateFrom, dateTo), 0);
    return () => window.clearTimeout(timer);
  }, [dateFrom, dateTo, loadData]);

  // Derive effective selected store IDs (filters out any stores no longer present in storeData)
  const effectiveSelectedLineOaIds = useMemo(() => {
    if (selectedLineOaIds.length === 0) return [];
    if (storeData.length === 0) return selectedLineOaIds;
    const availableSet = new Set(storeData.map((s) => s.lineOaId));
    return selectedLineOaIds.filter((id) => availableSet.has(id));
  }, [selectedLineOaIds, storeData]);

  // Fetch daily time series for each selected store in parallel
  useEffect(() => {
    if (effectiveSelectedLineOaIds.length === 0) {
      setStoreSeriesMap({});
      setStoreTrendError(null);
      setStoreTrendLoading(false);
      return;
    }

    let isCancelled = false;
    setStoreTrendLoading(true);
    setStoreTrendError(null);

    Promise.all(
      effectiveSelectedLineOaIds.map(async (lineOaId) => {
        try {
          const res = await api.followerInsightsSummary({ dateFrom, dateTo, lineOaId });
          return { lineOaId, data: res, error: null };
        } catch (err) {
          return {
            lineOaId,
            data: [],
            error: err instanceof Error ? err.message : t.failedToLoadStoreTrend,
          };
        }
      })
    )
      .then((results) => {
        if (isCancelled) return;
        const newMap: Record<string, SummaryDailyRow[]> = {};
        const errors: string[] = [];

        for (const res of results) {
          newMap[res.lineOaId] = res.data;
          if (res.error) errors.push(res.error);
        }

        setStoreSeriesMap(newMap);
        if (errors.length > 0 && errors.length === results.length) {
          setStoreTrendError(errors[0]);
        } else {
          setStoreTrendError(null);
        }
        setStoreTrendLoading(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        setStoreTrendError(err instanceof Error ? err.message : t.failedToLoadStoreTrend);
        setStoreTrendLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [effectiveSelectedLineOaIds, dateFrom, dateTo, t]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await api.followerInsightsSync(dateTo);
      setSyncResult(res);
      void loadData(dateFrom, dateTo);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const applyQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const sStr = getBkkDateStr(start);
    const eStr = getBkkDateStr(end);
    setDateFrom(sStr);
    setDateTo(eStr);
  };

  const { readyDates, partialDates, missingDates } = useMemo(() => {
    const ready = new Set<string>();
    const partial = new Set<string>();
    const missing = new Set<string>();

    for (const r of summaryData) {
      const followersValid = r.followers !== null && r.followers !== undefined;
      const readyCount = r.accountsReady ?? 0;
      const expectedCount = r.accountsExpected ?? 0;

      if (followersValid && readyCount === expectedCount && expectedCount > 0) {
        ready.add(r.date);
      } else if (followersValid && readyCount > 0 && readyCount < expectedCount) {
        partial.add(r.date);
      } else {
        missing.add(r.date);
      }
    }
    return { readyDates: ready, partialDates: partial, missingDates: missing };
  }, [summaryData]);

  const missingDateRanges = useMemo(() => {
    if (missingDates.size === 0) return [];
    const inRange = Array.from(missingDates).filter((d) => d >= dateFrom && d <= dateTo).sort();
    if (inRange.length === 0) return [];

    const ranges: { start: string; end: string }[] = [];
    let currentStart = inRange[0];
    let currentEnd = inRange[0];

    for (let i = 1; i < inRange.length; i++) {
      const prevDate = new Date(currentEnd);
      prevDate.setDate(prevDate.getDate() + 1);
      const nextStr = getBkkDateStr(prevDate);

      if (inRange[i] === nextStr) {
        currentEnd = inRange[i];
      } else {
        ranges.push({ start: currentStart, end: currentEnd });
        currentStart = inRange[i];
        currentEnd = inRange[i];
      }
    }
    ranges.push({ start: currentStart, end: currentEnd });
    return ranges;
  }, [missingDates, dateFrom, dateTo]);

  const endpointsUsable = readyDates.has(dateFrom) && readyDates.has(dateTo);

  const totalMissingDays = useMemo(
    () => missingDateRanges.reduce((acc, r) => acc + getInclusiveCalendarDays(r.start, r.end), 0),
    [missingDateRanges]
  );

  const expectedAccounts = storeData.length || summaryData[0]?.accountsExpected || 35;

  const handleSyncMissing = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    let totalRequested = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalUnready = 0;
    const errors: { lineOaId: string; accountName: string; date: string; code: string }[] = [];

    try {
      for (const range of missingDateRanges) {
        try {
          const res = await api.followerInsightsBackfill({ dateFrom: range.start, dateTo: range.end });
          if (res.results) {
            for (const r of res.results) {
              totalRequested += r.requested ?? 0;
              totalSucceeded += r.succeeded ?? 0;
              totalFailed += r.failed ?? 0;
              totalSkipped += r.skipped ?? 0;
              totalUnready += r.unready ?? 0;
              if (r.errors) errors.push(...r.errors);
            }
          }
        } catch (rangeErr) {
          totalFailed += 1;
          errors.push({
            lineOaId: "ALL",
            accountName: "System",
            date: `${range.start} - ${range.end}`,
            code: rangeErr instanceof Error ? rangeErr.message : "Range backfill failed",
          });
        }
      }
      setSyncResult({
        dateFrom: missingDateRanges[0]?.start,
        dateTo: missingDateRanges[missingDateRanges.length - 1]?.end,
        totalDays: totalMissingDays,
        requested: totalRequested,
        succeeded: totalSucceeded,
        failed: totalFailed,
        skipped: totalSkipped,
        unready: totalUnready,
        errors,
      });
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Backfill failed");
    } finally {
      setSyncing(false);
      setShowSyncMissingModal(false);
      void loadData(dateFrom, dateTo);
    }
  };

  const { totalCalendarDays, usableDays, coveragePct, hasMissingDates } = useMemo(
    () => calculateCoverage(summaryData, dateFrom, dateTo),
    [summaryData, dateFrom, dateTo]
  );

  const targetDateSummary = useMemo(() => {
    return summaryData.find((d) => d.date === dateTo) || null;
  }, [summaryData, dateTo]);

  return (
    <section className="app-content-section col-span-2 overflow-y-auto bg-[var(--background)] text-[var(--foreground)] min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 pb-20 p-4 md:p-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-[var(--border)] pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{t.followerInsightsTitle}</h2>
              {hasMissingDates && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/30">
                  <svg className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {t.partialDataAvailable}
                </span>
              )}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">
                {formatDateDisplay(dateFrom, language)} – {formatDateDisplay(dateTo, language)}
              </span>
              <span>•</span>
              <span>
                {t.dataCoverageText(usableDays, totalCalendarDays, coveragePct)}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
                {t.lastRefreshed}: {lastRefreshedAt ? formatBkkDateTime(lastRefreshedAt, language) : "—"}
                <button
                  type="button"
                  onClick={() => void loadData(dateFrom, dateTo)}
                  disabled={loading}
                  className="rounded-md p-1 hover:bg-[var(--hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
                  title={t.lastRefreshed}
                  aria-label={t.lastRefreshed}
                >
                  <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </span>
            </p>
          </div>

          {/* Date Controls & Sync Button */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Range Pills */}
            <div className="flex items-center rounded-xl bg-[var(--input-background)] border border-[var(--border)] p-1">
              <button
                type="button"
                onClick={() => applyQuickRange(7)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  totalCalendarDays === 7 ? "bg-blue-600 text-white shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
                }`}
              >
                7D
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange(14)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  totalCalendarDays === 14 ? "bg-blue-600 text-white shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
                }`}
              >
                14D
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange(30)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  totalCalendarDays === 30 ? "bg-blue-600 text-white shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
                }`}
              >
                30D
              </button>
            </div>

            {/* Custom Date Range Picker Component */}
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              readyDates={readyDates}
              partialDates={partialDates}
              missingDates={missingDates}
              language={language}
              onApply={(start, end) => {
                setDateFrom(start);
                setDateTo(end);
              }}
              onQuickRange={applyQuickRange}
            />

            {hasMissingDates ? (
              <button
                type="button"
                onClick={() => setShowSyncMissingModal(true)}
                disabled={syncing || loading}
                className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-600/20 hover:bg-amber-500 disabled:opacity-50 transition-all"
              >
                {syncing ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{t.syncingBtn}</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                    <span>{t.syncMissingBtnWithCount(totalMissingDays)}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing || loading}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-50 transition-all"
              >
                {syncing ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{t.syncingBtn}</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{language === "th" ? "ดึงข้อมูลวันที่เลือก" : "Sync Selected Date"}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {validationError}
          </div>
        )}

        {/* Sync Error Banner */}
        {syncError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
            Sync Error: {syncError}
          </div>
        )}

        {/* Sync Result Toast */}
        {syncResult && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
            <p className="font-semibold text-[var(--foreground)]">{t.syncComplete}</p>
            <p className="mt-1 text-[var(--muted)]">
              {t.syncSummaryResult(
                syncResult.requested ?? 0,
                syncResult.succeeded ?? 0,
                syncResult.unready ?? 0,
                syncResult.failed ?? 0,
                syncResult.skipped ?? 0
              )}
            </p>
            {syncResult.errors && syncResult.errors.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-red-600 dark:text-red-400">
                {syncResult.errors.map((e, i) => (
                  <li key={i}>
                    {e.accountName}: {e.code}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && !initialLoadDone ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse"></div>
              ))}
            </div>
            <div className="h-80 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse"></div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="h-80 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse lg:col-span-1"></div>
              <div className="h-80 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse lg:col-span-2"></div>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards & Trend Chart Section */}
            {summaryError ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400 flex items-center justify-between">
                <p>{t.errorLoadingSummary}: {summaryError}</p>
                <button
                  type="button"
                  onClick={() => setShowSyncMissingModal(true)}
                  className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 shadow-sm transition-colors"
                >
                  {t.syncMissingBtnWithCount(totalMissingDays)}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  {/* Card 1: Total Followers */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
                    <p className="text-xs font-medium text-[var(--muted)]">{t.totalFollowers}</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)]">
                      {targetDateSummary?.followers?.toLocaleString() ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {targetDateSummary
                        ? t.snapshotForDate(formatDateDisplay(dateTo, language))
                        : t.noDataForDate(formatDateDisplay(dateTo, language))}
                    </p>
                  </div>

                  {/* Card 2: Daily Increase */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
                    <p className="text-xs font-medium text-[var(--muted)]">{t.dailyIncrease}</p>
                    <p
                      className={`mt-2 text-2xl font-bold tracking-tight ${
                        targetDateSummary && targetDateSummary.dailyIncrease !== null && targetDateSummary.dailyIncrease > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : targetDateSummary && targetDateSummary.dailyIncrease !== null && targetDateSummary.dailyIncrease < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {targetDateSummary?.dailyIncrease !== null && targetDateSummary?.dailyIncrease !== undefined
                        ? (targetDateSummary.dailyIncrease > 0 ? "+" : "") + targetDateSummary.dailyIncrease.toLocaleString()
                        : "—"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {targetDateSummary?.dailyIncrease !== null ? t.oneDayComparison : t.missingPreviousDate}
                    </p>
                  </div>

                  {/* Card 3: Targeted Reach */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
                    <p className="text-xs font-medium text-[var(--muted)]">{t.targetedReach}</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)]">
                      {targetDateSummary?.targetedReaches?.toLocaleString() ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {targetDateSummary
                        ? t.snapshotForDate(formatDateDisplay(dateTo, language))
                        : t.noDataForDate(formatDateDisplay(dateTo, language))}
                    </p>
                  </div>

                  {/* Card 4: Blocks */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
                    <p className="text-xs font-medium text-[var(--muted)]">{t.blocks}</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)]">
                      {targetDateSummary?.blocks?.toLocaleString() ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {targetDateSummary
                        ? t.snapshotForDate(formatDateDisplay(dateTo, language))
                        : t.noDataForDate(formatDateDisplay(dateTo, language))}
                    </p>
                  </div>

                  {/* Card 5: Accounts Ready */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm col-span-2 md:col-span-1">
                    <p className="text-xs font-medium text-[var(--muted)]">{t.accountsReady}</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)]">
                      {targetDateSummary?.accountsReady ?? 0}
                      <span className="text-sm font-normal text-[var(--muted)]">
                        {" "}
                        / {targetDateSummary?.accountsExpected ?? 0}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {targetDateSummary?.accountsMissing && targetDateSummary.accountsMissing > 0
                        ? t.accountsMissingText(targetDateSummary.accountsMissing)
                        : targetDateSummary
                        ? t.allAccountsReady
                        : t.noSnapshot}
                    </p>
                  </div>
                </div>

                {/* Trend Chart Component with Multi-Store Filter & Comparison Mode */}
                <TrendChart
                  data={
                    comparisonMode === "comparable" && effectiveSelectedLineOaIds.length === 0
                      ? comparableSummaryData
                      : summaryData
                  }
                  metric={chartMetric}
                  language={language}
                  stores={storeData}
                  selectedLineOaIds={effectiveSelectedLineOaIds}
                  storeSeriesMap={storeSeriesMap}
                  isLoadingTrend={effectiveSelectedLineOaIds.length > 0 ? storeTrendLoading : false}
                  trendError={effectiveSelectedLineOaIds.length > 0 ? storeTrendError : null}
                  comparisonMode={comparisonMode}
                  comparableCount={comparableLineOaIds.size}
                  onComparisonModeChange={setComparisonMode}
                  onMetricChange={setChartMetric}
                  onSelectStores={setSelectedLineOaIds}
                  selectedLineOaId={effectiveSelectedLineOaIds.length === 1 ? effectiveSelectedLineOaIds[0] : null}
                  onSelectStore={(id) => setSelectedLineOaIds(id ? [id] : [])}
                />
              </div>
            )}

            {/* Tables Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <DailySummaryTable
                summaryData={summaryData}
                summaryError={summaryError}
                dateFrom={dateFrom}
                dateTo={dateTo}
                language={language}
              />

              <div className="lg:col-span-2">
                {!endpointsUsable && (
                  <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                    <strong>{language === "th" ? "คำเตือน:" : "Warning:"}</strong> {t.endpointWarning}
                  </div>
                )}
                <StoreBreakdownTable
                  storeData={storeData}
                  storeError={storeError}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  endpointsUsable={endpointsUsable}
                  language={language}
                  onRetry={() => void loadData(dateFrom, dateTo)}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sync Missing Dates Modal */}
      {showSyncMissingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.syncMissingDates}
            className="w-full max-w-md bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95"
          >
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2">{t.syncMissingDates}</h2>
              <p className="text-sm text-[var(--muted)] mb-4">
                {t.syncMissingModalDesc}
              </p>

              <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl p-4 mb-4 space-y-3 text-xs">
                <div className="flex justify-between border-b border-[var(--border)] pb-2">
                  <span className="text-[var(--muted)]">{t.selectedRange}:</span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {formatDateDisplay(dateFrom, language)} – {formatDateDisplay(dateTo, language)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-2">
                  <span className="text-[var(--muted)]">{t.exactMissingDays}:</span>
                  <span className="font-semibold text-[var(--foreground)]">{t.dayUnit(totalMissingDays)}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-2">
                  <span className="text-[var(--muted)]">{t.targetAccounts}:</span>
                  <span className="font-semibold text-[var(--foreground)]">{t.accountUnit(expectedAccounts)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">{t.estimatedMaxCalls}:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {t.estimatedCallsDetail(totalMissingDays, expectedAccounts)}
                  </span>
                </div>
              </div>

              <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl p-4 mb-6">
                <div className="mb-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{t.contiguousMissingRanges}</div>
                <ul className="space-y-1 text-sm font-medium">
                  {missingDateRanges.map((r, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      {r.start === r.end
                        ? formatDateDisplay(r.start, language)
                        : `${formatDateDisplay(r.start, language)} – ${formatDateDisplay(r.end, language)}`}{" "}
                      ({t.dayUnit(getInclusiveCalendarDays(r.start, r.end))})
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowSyncMissingModal(false)}
                  disabled={syncing}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--border)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSyncMissing}
                  disabled={syncing || missingDateRanges.length === 0}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {syncing ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      {t.syncingBtn}
                    </>
                  ) : (
                    t.confirmSync
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
