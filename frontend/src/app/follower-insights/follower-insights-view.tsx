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
} from "./follower-insights-utils";

export function FollowerInsightsView() {
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

  const loadData = useCallback(async (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (e < s) {
      setValidationError("End date cannot be earlier than start date.");
      return;
    }
    const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 90) {
      setValidationError("Date range cannot exceed 90 days.");
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
      setSummaryError(err instanceof Error ? err.message : "Error loading summary data");
    }

    try {
      const stores = await api.followerInsightsByStore(start, end);
      setStoreData(stores);
      storeSucceeded = true;
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : "Error loading store data");
    }

    if (sumSucceeded || storeSucceeded) {
      setInitialLoadDone(true);
      setLastRefreshedAt(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(dateFrom, dateTo), 0);
    return () => window.clearTimeout(timer);
  }, [dateFrom, dateTo, loadData]);

  const handleSync = async () => {
    if (!window.confirm(`Sync LINE OA insights for ${dateTo}?`)) return;
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

  const { totalCalendarDays, usableDays, coveragePct, hasMissingDates } = useMemo(
    () => calculateCoverage(summaryData, dateFrom, dateTo),
    [summaryData, dateFrom, dateTo]
  );

  // Requirement 5: KPI values must use dateTo row ONLY when dateTo has valid data (followers !== null)
  const targetDateSummary = useMemo(() => {
    return summaryData.find((d) => d.date === dateTo) || null;
  }, [summaryData, dateTo]);

  return (
    <section className="app-content-section col-span-2 overflow-y-auto bg-slate-950 text-slate-100 min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 pb-20 p-4 md:p-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-white">Follower Insights</h2>
              {hasMissingDates && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/30">
                  <svg className="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Partial data available
                </span>
              )}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span className="font-medium text-slate-300">
                {formatDateDisplay(dateFrom)} – {formatDateDisplay(dateTo)}
              </span>
              <span>•</span>
              <span>
                Data coverage: {usableDays} of {totalCalendarDays} days ({coveragePct}%)
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                Last refreshed: {lastRefreshedAt ? formatBkkDateTime(lastRefreshedAt) : "—"}
                <button
                  type="button"
                  onClick={() => void loadData(dateFrom, dateTo)}
                  disabled={loading}
                  className="rounded-md p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                  title="Refresh data"
                  aria-label="Refresh data"
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
            <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1">
              <button
                type="button"
                onClick={() => applyQuickRange(7)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  totalCalendarDays === 7 ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                7D
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange(14)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  totalCalendarDays === 14 ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                14D
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange(30)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  totalCalendarDays === 30 ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                30D
              </button>
            </div>

            {/* Custom Date Range Picker Component */}
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onApply={(start, end) => {
                setDateFrom(start);
                setDateTo(end);
              }}
              onQuickRange={applyQuickRange}
            />

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
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Sync Selected Date</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {validationError}
          </div>
        )}

        {/* Sync Error Banner */}
        {syncError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            Sync Error: {syncError}
          </div>
        )}

        {/* Sync Result Toast */}
        {syncResult && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            <p className="font-semibold text-white">Sync complete for {syncResult.date}</p>
            <p className="mt-1 text-slate-300">
              Requested: {syncResult.requested} | Succeeded: {syncResult.succeeded} | Unready: {syncResult.unready} | Failed: {syncResult.failed} | Skipped: {syncResult.skipped}
            </p>
            {syncResult.errors && syncResult.errors.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-red-400">
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
                <div key={i} className="h-28 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse"></div>
              ))}
            </div>
            <div className="h-80 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse"></div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="h-80 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse lg:col-span-1"></div>
              <div className="h-80 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse lg:col-span-2"></div>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards & Trend Chart Section */}
            {summaryError ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300 flex items-center justify-between">
                <p>Summary Error: {summaryError}</p>
                <button
                  type="button"
                  onClick={() => void loadData(dateFrom, dateTo)}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30"
                >
                  Retry Summary
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  {/* Card 1: Total Followers */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
                    <p className="text-xs font-medium text-slate-400">Total Followers</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-white">
                      {targetDateSummary?.followers?.toLocaleString() ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {targetDateSummary ? `Snapshot for ${dateTo}` : `No data for ${dateTo}`}
                    </p>
                  </div>

                  {/* Card 2: Daily Increase */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
                    <p className="text-xs font-medium text-slate-400">Daily Increase</p>
                    <p
                      className={`mt-2 text-2xl font-bold tracking-tight ${
                        targetDateSummary && targetDateSummary.dailyIncrease !== null && targetDateSummary.dailyIncrease > 0
                          ? "text-emerald-400"
                          : targetDateSummary && targetDateSummary.dailyIncrease !== null && targetDateSummary.dailyIncrease < 0
                          ? "text-rose-400"
                          : "text-white"
                      }`}
                    >
                      {targetDateSummary?.dailyIncrease !== null && targetDateSummary?.dailyIncrease !== undefined
                        ? (targetDateSummary.dailyIncrease > 0 ? "+" : "") + targetDateSummary.dailyIncrease.toLocaleString()
                        : "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {targetDateSummary?.dailyIncrease !== null ? "1-day comparison" : "Missing previous date"}
                    </p>
                  </div>

                  {/* Card 3: Targeted Reach */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
                    <p className="text-xs font-medium text-slate-400">Targeted Reach</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-white">
                      {targetDateSummary?.targetedReaches?.toLocaleString() ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {targetDateSummary ? `Snapshot for ${dateTo}` : `No data for ${dateTo}`}
                    </p>
                  </div>

                  {/* Card 4: Blocks */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
                    <p className="text-xs font-medium text-slate-400">Blocks</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-white">
                      {targetDateSummary?.blocks?.toLocaleString() ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {targetDateSummary ? `Snapshot for ${dateTo}` : `No data for ${dateTo}`}
                    </p>
                  </div>

                  {/* Card 5: Accounts Ready */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm col-span-2 md:col-span-1">
                    <p className="text-xs font-medium text-slate-400">Accounts Ready</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-white">
                      {targetDateSummary?.accountsReady ?? 0}
                      <span className="text-sm font-normal text-slate-500">
                        {" "}
                        / {targetDateSummary?.accountsExpected ?? 0}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {targetDateSummary?.accountsMissing && targetDateSummary.accountsMissing > 0
                        ? `${targetDateSummary.accountsMissing} missing`
                        : targetDateSummary
                        ? "All accounts ready"
                        : "No snapshot"}
                    </p>
                  </div>
                </div>

                {/* Trend Chart Component */}
                <TrendChart
                  data={summaryData}
                  metric={chartMetric}
                  onMetricChange={setChartMetric}
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
              />

              <StoreBreakdownTable
                storeData={storeData}
                storeError={storeError}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onRetry={() => void loadData(dateFrom, dateTo)}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
