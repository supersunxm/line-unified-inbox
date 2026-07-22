"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { api } from "@/lib/api";
import type { ByStoreAccountRow, SummaryDailyRow, SyncBatchResult } from "@/types/api";

function getBkkDateStr(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function formatBkkDateTime(d: string | Date | null) {
  if (!d) return "—";
  const dateObj = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(dateObj).replace(",", "");
}

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
  
  const [storeSearch, setStoreSearch] = useState("");
  const [storeSort, setStoreSort] = useState<"periodIncrease" | "followers" | "accountName">("periodIncrease");
  const [storeSortDir, setStoreSortDir] = useState<"asc" | "desc">("desc");

  const [chartMetric, setChartMetric] = useState<"followers" | "targetedReaches" | "blocks">("followers");

  const loadData = useCallback(async (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (e < s) {
      setValidationError("End date cannot be earlier than start date.");
      return;
    }
    const diffDays = (e - s) / (1000 * 60 * 60 * 24);
    if (diffDays > 89) {
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
    setDateFrom(getBkkDateStr(start));
    setDateTo(getBkkDateStr(end));
  };

  const latestSummary = summaryData.length > 0 ? summaryData[summaryData.length - 1] : null;

  const filteredStores = useMemo(() => {
    let res = storeData;
    if (storeSearch) {
      const q = storeSearch.toLowerCase();
      res = res.filter(s => s.accountName.toLowerCase().includes(q) || s.storeName.toLowerCase().includes(q));
    }
    res = [...res].sort((a, b) => {
      let aVal = a[storeSort] ?? 0;
      let bVal = b[storeSort] ?? 0;
      if (storeSort === "accountName") {
         aVal = a.accountName; bVal = b.accountName;
      }
      if (aVal < bVal) return storeSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return storeSortDir === "asc" ? 1 : -1;
      return 0;
    });
    return res;
  }, [storeData, storeSearch, storeSort, storeSortDir]);

  const handleSort = (field: "periodIncrease" | "followers" | "accountName") => {
    setStoreSortDir(d => storeSort === field && d === "desc" ? "asc" : "desc");
    setStoreSort(field);
  };

  return (
    <section className="app-content-section col-span-2 overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 pb-20 p-4">
        
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Follower Insights</h2>
            <p className="text-sm text-slate-500">
              {dateFrom} to {dateTo} 
              {latestSummary && ` • Coverage: ${latestSummary.accountsReady}/${latestSummary.accountsExpected} Ready`}
              {` • Last refreshed: ${lastRefreshedAt ? formatBkkDateTime(lastRefreshedAt) : "—"}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1">
              <button onClick={() => applyQuickRange(7)} className="rounded-md px-3 py-1 text-sm font-medium hover:bg-slate-100">7 Days</button>
              <button onClick={() => applyQuickRange(14)} className="rounded-md px-3 py-1 text-sm font-medium hover:bg-slate-100">14 Days</button>
              <button onClick={() => applyQuickRange(30)} className="rounded-md px-3 py-1 text-sm font-medium hover:bg-slate-100">30 Days</button>
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo} className="app-input rounded-lg border px-3 py-1.5 text-sm" />
              <span className="text-slate-400">-</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} max={getBkkDateStr(new Date())} className="app-input rounded-lg border px-3 py-1.5 text-sm" />
            </div>
            <button onClick={handleSync} disabled={syncing || loading} className="app-button-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">
              {syncing ? "Syncing..." : "Sync Selected Date"}
            </button>
          </div>
        </div>

        {validationError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {validationError}
          </div>
        )}

        {syncError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Sync Error: {syncError}
          </div>
        )}

        {syncResult && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <p className="font-semibold mb-1">Sync complete for {syncResult.date}</p>
            <p>Requested: {syncResult.requested} | Succeeded: {syncResult.succeeded} | Unready: {syncResult.unready} | Failed: {syncResult.failed} | Skipped: {syncResult.skipped}</p>
            {syncResult.errors && syncResult.errors.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-red-600 opacity-90">
                {syncResult.errors.map((e, i) => <li key={i}>{e.accountName}: {e.code}</li>)}
              </ul>
            )}
          </div>
        )}

        {latestSummary && latestSummary.accountsMissing !== undefined && latestSummary.accountsMissing > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            ⚠️ Partial data: {latestSummary.accountsMissing} accounts are missing data for the latest date in the range. Try running a sync.
          </div>
        )}

        {loading && !initialLoadDone ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {[1,2,3,4,5].map(i => <div key={i} className="app-card h-24 animate-pulse bg-slate-200/50"></div>)}
            </div>
            <div className="app-card h-80 animate-pulse bg-slate-200/50"></div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
               <div className="app-card lg:col-span-1 h-64 animate-pulse bg-slate-200/50"></div>
               <div className="app-card lg:col-span-2 h-64 animate-pulse bg-slate-200/50"></div>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards and Chart Section (Summary Data) */}
            {summaryError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center justify-between">
                <p>Summary Data Error: {summaryError}</p>
                <button onClick={() => void loadData(dateFrom, dateTo)} className="app-button-secondary rounded-lg px-3 py-1.5 border border-amber-300 bg-white">Retry Summary</button>
              </div>
            ) : summaryData.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 flex-col gap-2">
                <p>No summary data found for the selected range.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <div className="app-card p-5">
                    <p className="text-xs font-medium text-slate-500">Total Followers</p>
                    <p className="mt-2 text-2xl font-semibold">{latestSummary?.followers?.toLocaleString() ?? "—"}</p>
                  </div>
                  <div className="app-card p-5">
                    <p className="text-xs font-medium text-slate-500">Daily Increase</p>
                    <p className={`mt-2 text-2xl font-semibold ${latestSummary && latestSummary.dailyIncrease !== null && latestSummary.dailyIncrease > 0 ? "text-green-600" : ""}`}>
                      {latestSummary?.dailyIncrease !== null && latestSummary?.dailyIncrease !== undefined ? (latestSummary.dailyIncrease > 0 ? "+" : "") + latestSummary.dailyIncrease.toLocaleString() : "—"}
                    </p>
                  </div>
                  <div className="app-card p-5">
                    <p className="text-xs font-medium text-slate-500">Targeted Reach</p>
                    <p className="mt-2 text-2xl font-semibold">{latestSummary?.targetedReaches?.toLocaleString() ?? "—"}</p>
                  </div>
                  <div className="app-card p-5">
                    <p className="text-xs font-medium text-slate-500">Blocks</p>
                    <p className="mt-2 text-2xl font-semibold">{latestSummary?.blocks?.toLocaleString() ?? "—"}</p>
                  </div>
                  <div className="app-card p-5">
                    <p className="text-xs font-medium text-slate-500">Accounts Ready</p>
                    <p className="mt-2 text-2xl font-semibold">{latestSummary?.accountsReady ?? 0} <span className="text-sm font-normal text-slate-400">/ {latestSummary?.accountsExpected ?? 0}</span></p>
                  </div>
                </div>

                {/* SVG Chart */}
                <div className="app-card p-5">
                  <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="font-semibold">Trend Analysis</h3>
                    <div className="flex items-center gap-2 text-sm bg-slate-100 p-1 rounded-lg">
                      <button onClick={() => setChartMetric("followers")} className={`px-3 py-1 rounded-md ${chartMetric === "followers" ? "bg-white shadow-sm font-medium" : "text-slate-500 hover:bg-slate-200"}`}>Followers</button>
                      <button onClick={() => setChartMetric("targetedReaches")} className={`px-3 py-1 rounded-md ${chartMetric === "targetedReaches" ? "bg-white shadow-sm font-medium" : "text-slate-500 hover:bg-slate-200"}`}>Targeted Reach</button>
                      <button onClick={() => setChartMetric("blocks")} className={`px-3 py-1 rounded-md ${chartMetric === "blocks" ? "bg-white shadow-sm font-medium" : "text-slate-500 hover:bg-slate-200"}`}>Blocks</button>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <TrendChart data={summaryData} metric={chartMetric} />
                  </div>
                </div>
              </div>
            )}

            {/* Tables */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Daily Summary Table */}
              <div className="app-card lg:col-span-1 overflow-hidden flex flex-col max-h-[600px]">
                <div className="border-b border-slate-200 p-4">
                  <h3 className="font-semibold">Daily Summary</h3>
                </div>
                {summaryError ? (
                  <div className="p-8 text-center text-sm text-amber-800">Error loading daily summary</div>
                ) : summaryData.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">No daily summary data</div>
                ) : (
                  <div className="overflow-x-auto overflow-y-auto">
                    <table className="w-full text-left text-sm min-w-max">
                      <thead className="bg-slate-50 text-xs text-slate-500 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium text-right">Followers</th>
                          <th className="px-4 py-3 font-medium text-right">Increase</th>
                          <th className="px-4 py-3 font-medium text-center">Ready</th>
                          <th className="px-4 py-3 font-medium text-center">Missing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...summaryData].reverse().map(row => (
                          <tr key={row.date}>
                            <td className="px-4 py-3 font-medium">{row.date}</td>
                            <td className="px-4 py-3 text-right">{row.followers?.toLocaleString() ?? "—"}</td>
                            <td className={`px-4 py-3 text-right font-medium ${row.dailyIncrease && row.dailyIncrease > 0 ? "text-green-600" : row.dailyIncrease && row.dailyIncrease < 0 ? "text-red-600" : ""}`}>
                              {row.dailyIncrease !== null ? (row.dailyIncrease > 0 ? "+" : "") + row.dailyIncrease.toLocaleString() : "—"}
                            </td>
                            <td className="px-4 py-3 text-center">{row.accountsReady ?? "—"}</td>
                            <td className={`px-4 py-3 text-center ${row.accountsMissing && row.accountsMissing > 0 ? "text-amber-600 font-medium" : ""}`}>{row.accountsMissing ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Store Breakdown Table */}
              <div className="app-card lg:col-span-2 overflow-hidden flex flex-col max-h-[600px]">
                <div className="border-b border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="font-semibold">Store Breakdown ({dateTo})</h3>
                  {!storeError && storeData.length > 0 && (
                    <input type="text" placeholder="Search stores..." value={storeSearch} onChange={e => setStoreSearch(e.target.value)} className="app-input rounded-md border px-3 py-1.5 text-sm w-full sm:w-64" />
                  )}
                </div>
                {storeError ? (
                  <div className="p-8 text-sm text-amber-800 flex flex-col items-center justify-center gap-2">
                    <p>Error: {storeError}</p>
                    <button onClick={() => void loadData(dateFrom, dateTo)} className="app-button-secondary rounded-lg px-3 py-1.5 border border-amber-300 bg-white">Retry Store Data</button>
                  </div>
                ) : storeData.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">No store breakdown data</div>
                ) : (
                  <div className="overflow-x-auto overflow-y-auto">
                    <table className="w-full text-left text-sm min-w-max">
                      <thead className="bg-slate-50 text-xs text-slate-500 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 font-medium">Store</th>
                          <th className="font-medium p-0" aria-sort={storeSort === "accountName" ? (storeSortDir === "asc" ? "ascending" : "descending") : "none"}>
                            <button className="flex items-center gap-1 w-full h-full px-4 py-3 hover:bg-slate-100" onClick={() => handleSort("accountName")}>
                              LINE OA {storeSort==="accountName" && (storeSortDir==="asc"?"↑":"↓")}
                            </button>
                          </th>
                          <th className="font-medium text-right p-0" aria-sort={storeSort === "followers" ? (storeSortDir === "asc" ? "ascending" : "descending") : "none"}>
                            <button className="flex items-center justify-end gap-1 w-full h-full px-4 py-3 hover:bg-slate-100" onClick={() => handleSort("followers")}>
                              Followers {storeSort==="followers" && (storeSortDir==="asc"?"↑":"↓")}
                            </button>
                          </th>
                          <th className="px-4 py-3 font-medium text-right text-slate-400">Start Followers</th>
                          <th className="font-medium text-right p-0" aria-sort={storeSort === "periodIncrease" ? (storeSortDir === "asc" ? "ascending" : "descending") : "none"}>
                            <button className="flex items-center justify-end gap-1 w-full h-full px-4 py-3 hover:bg-slate-100" onClick={() => handleSort("periodIncrease")}>
                              Period Increase {storeSort==="periodIncrease" && (storeSortDir==="asc"?"↑":"↓")}
                            </button>
                          </th>
                          <th className="px-4 py-3 font-medium text-right">Targeted Reach</th>
                          <th className="px-4 py-3 font-medium text-right">Blocks</th>
                          <th className="px-4 py-3 font-medium text-center">Status</th>
                          <th className="px-4 py-3 font-medium">Last Fetched</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStores.map(row => (
                          <tr key={row.lineOaId}>
                            <td className="px-4 py-3 text-slate-500">{row.storeName}</td>
                            <td className="px-4 py-3 font-medium">{row.accountName}</td>
                            <td className="px-4 py-3 text-right">{row.followers?.toLocaleString() ?? "—"}</td>
                            <td className="px-4 py-3 text-right text-slate-400">{row.startFollowers?.toLocaleString() ?? "—"}</td>
                            <td className={`px-4 py-3 text-right font-medium ${row.periodIncrease && row.periodIncrease > 0 ? "text-green-600" : row.periodIncrease && row.periodIncrease < 0 ? "text-red-600" : ""}`}>
                              {row.periodIncrease !== null ? (row.periodIncrease > 0 ? "+" : "") + row.periodIncrease.toLocaleString() : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">{row.targetedReaches?.toLocaleString() ?? "—"}</td>
                            <td className="px-4 py-3 text-right">{row.blocks?.toLocaleString() ?? "—"}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${row.status === "ready" ? "bg-green-100 text-green-800" : row.status === "missing" ? "bg-slate-100 text-slate-800" : "bg-amber-100 text-amber-800"}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">{formatBkkDateTime(row.fetchedAt)}</td>
                          </tr>
                        ))}
                        {filteredStores.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No stores found</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </section>
  );
}

function TrendChart({ data, metric }: { data: SummaryDailyRow[]; metric: "followers" | "targetedReaches" | "blocks" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) return <div className="flex h-full items-center justify-center text-sm text-slate-400">No chart data available</div>;

  const validVals = data.map(d => d[metric]).filter((v): v is number => v !== null);
  const minVal = validVals.length ? Math.min(...validVals) : 0;
  const maxVal = validVals.length ? Math.max(...validVals) : 100;
  
  const rangeVal = maxVal - minVal || 100;
  const yMin = Math.max(0, minVal - rangeVal * 0.1);
  const yMax = maxVal + rangeVal * 0.1;

  const width = 800;
  const height = 250;
  const paddingX = 40;
  const paddingY = 20;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const getX = (idx: number) => paddingX + (idx / Math.max(1, data.length - 1)) * chartW;
  const getY = (val: number | null) => {
    if (val === null) return null;
    return height - paddingY - ((val - yMin) / (yMax - yMin)) * chartH;
  };

  const metricColor = metric === "followers" ? "#3b82f6" : metric === "targetedReaches" ? "#22c55e" : "#ef4444";
  const metricLabel = metric === "followers" ? "Followers" : metric === "targetedReaches" ? "Targeted Reach" : "Blocks";

  const buildSegments = () => {
    const segments: string[] = [];
    let cur = "";
    for (let i = 0; i < data.length; i++) {
      const v = data[i][metric];
      if (v === null || v === undefined) {
        if (cur) segments.push(cur);
        cur = "";
      } else {
        const cx = getX(i);
        const cy = getY(v);
        if (!cur) cur = `M ${cx} ${cy}`;
        else cur += ` L ${cx} ${cy}`;
      }
    }
    if (cur) segments.push(cur);
    return segments;
  };
  const pathSegments = buildSegments();

  return (
    <div className="relative h-full w-full" ref={containerRef}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none" onMouseLeave={() => setHoverIdx(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = paddingY + pct * chartH;
          const val = Math.round(yMax - pct * (yMax - yMin));
          return (
            <g key={pct}>
              <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={paddingX - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{val > 1000 ? (val/1000).toFixed(1)+'k' : val}</text>
            </g>
          );
        })}

        {pathSegments.map((dStr, i) => (
          <path key={i} d={dStr} fill="none" stroke={metricColor} strokeWidth="2" strokeLinejoin="round" />
        ))}

        {data.map((d, i) => {
          const x = getX(i);
          return (
            <rect
              key={i}
              x={x - chartW / data.length / 2}
              y={paddingY}
              width={chartW / data.length}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          );
        })}

        {hoverIdx !== null && (
          <g>
            <line x1={getX(hoverIdx)} y1={paddingY} x2={getX(hoverIdx)} y2={height - paddingY} stroke="#94a3b8" strokeDasharray="4 4" />
            {data[hoverIdx][metric] !== null && <circle cx={getX(hoverIdx)} cy={getY(data[hoverIdx][metric] as number)!} r="4" fill={metricColor} stroke="white" strokeWidth="2" />}
          </g>
        )}
      </svg>

      {hoverIdx !== null && (
        <div 
          className="absolute pointer-events-none rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-xl"
          style={{
            left: `${((getX(hoverIdx) - paddingX + 20) / chartW) * 100}%`,
            top: '10px',
            transform: getX(hoverIdx) > width / 2 ? 'translateX(-100%) translateX(-40px)' : 'none',
            zIndex: 10
          }}
        >
          <p className="mb-2 font-bold text-slate-900">{data[hoverIdx].date}</p>
          <div className="space-y-1">
            <p className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{backgroundColor: metricColor}}></span> {metricLabel}</span> 
              <span className="font-semibold">{data[hoverIdx][metric]?.toLocaleString() ?? "—"}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
