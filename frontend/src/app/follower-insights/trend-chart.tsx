"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ByStoreAccountRow, SummaryDailyRow } from "@/types/api";
import { getFollowerInsightsText, type Language } from "./follower-insights-translations";
import { formatDateDisplay } from "./follower-insights-utils";

export const STORE_PALETTE = [
  "#00A651", // OPPO Green
  "#2563eb", // Royal Blue
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#10b981", // Emerald
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#e11d48", // Rose
  "#84cc16", // Lime
];

export interface TrendChartProps {
  data: SummaryDailyRow[];
  metric: "followers" | "targetedReaches" | "blocks";
  language?: Language;
  stores?: ByStoreAccountRow[];
  selectedLineOaIds?: string[];
  storeSeriesMap?: Record<string, SummaryDailyRow[]>;
  isLoadingTrend?: boolean;
  trendError?: string | null;
  comparisonMode?: "comparable" | "available";
  comparableCount?: number;
  onComparisonModeChange?: (mode: "comparable" | "available") => void;
  onMetricChange: (metric: "followers" | "targetedReaches" | "blocks") => void;
  onSelectStores?: (lineOaIds: string[]) => void;
  // Legacy single-select props for backwards compatibility
  selectedLineOaId?: string | null;
  onSelectStore?: (lineOaId: string | null) => void;
}

interface StoreSeries {
  id: string;
  storeName: string;
  accountName: string;
  color: string;
  dailyRows: SummaryDailyRow[];
  hasData: boolean;
  isComparable: boolean;
}

export function TrendChart({
  data,
  metric,
  language = "en",
  stores = [],
  selectedLineOaIds,
  storeSeriesMap = {},
  selectedLineOaId = null,
  isLoadingTrend = false,
  trendError = null,
  comparisonMode = "available",
  comparableCount,
  onComparisonModeChange,
  onMetricChange,
  onSelectStores,
  onSelectStore,
}: TrendChartProps) {
  const t = getFollowerInsightsText(language);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Normalize active selection from either selectedLineOaIds or legacy selectedLineOaId
  const activeSelectedIds = useMemo<string[]>(() => {
    if (selectedLineOaIds !== undefined) return selectedLineOaIds;
    if (selectedLineOaId) return [selectedLineOaId];
    return [];
  }, [selectedLineOaIds, selectedLineOaId]);

  const handleSelectionChange = (newIds: string[]) => {
    if (onSelectStores) {
      onSelectStores(newIds);
    } else if (onSelectStore) {
      onSelectStore(newIds.length === 1 ? newIds[0] : null);
    }
  };

  // Base list of unique dates from aggregate data
  const dateList = useMemo(() => data.map((d) => d.date), [data]);

  // Metric color for aggregate/single metric view
  const defaultMetricColor =
    metric === "followers" ? "#00A651" : metric === "targetedReaches" ? "#10b981" : "#f43f5e";
  const metricLabel =
    metric === "followers" ? t.followers : metric === "targetedReaches" ? t.targetedReach : t.blocks;

  // Build StoreSeries for all selected stores (or single aggregate series if none selected)
  const allSeries = useMemo<StoreSeries[]>(() => {
    if (activeSelectedIds.length === 0) {
      // Aggregate mode
      const hasData = data.some((d) => d[metric] !== null && d[metric] !== undefined);
      return [
        {
          id: "all",
          storeName: t.allStores,
          accountName: "",
          color: defaultMetricColor,
          dailyRows: data,
          hasData,
          isComparable: true,
        },
      ];
    }

    return activeSelectedIds.map((id, index) => {
      const storeMeta = stores.find((s) => s.lineOaId === id);
      const storeRows = storeSeriesMap[id] ?? (selectedLineOaId === id ? data : []);
      const hasData = storeRows.some((r) => r[metric] !== null && r[metric] !== undefined);
      const isComparable =
        dateList.length > 0 &&
        dateList.every((date) => {
          const row = storeRows.find((r) => r.date === date);
          return row && row.followers !== null && row.accountsReady > 0;
        });

      return {
        id,
        storeName: storeMeta?.storeName ?? id,
        accountName: storeMeta?.accountName ?? "",
        color: activeSelectedIds.length === 1 ? defaultMetricColor : STORE_PALETTE[index % STORE_PALETTE.length],
        dailyRows: storeRows,
        hasData,
        isComparable,
      };
    });
  }, [activeSelectedIds, stores, storeSeriesMap, selectedLineOaId, data, metric, defaultMetricColor, t.allStores, dateList]);

  // Filter series based on comparisonMode when in multi-store mode
  const displayedSeries = useMemo<StoreSeries[]>(() => {
    if (activeSelectedIds.length === 0) {
      return allSeries;
    }
    if (comparisonMode === "comparable") {
      return allSeries.filter((s) => s.isComparable);
    }
    return allSeries;
  }, [allSeries, activeSelectedIds.length, comparisonMode]);

  // Total counts for coverage / partial indicators
  const totalSelectedCount = activeSelectedIds.length;
  const storesWithDataCount = useMemo(
    () => allSeries.filter((s) => s.hasData).length,
    [allSeries]
  );
  const comparableStoreCount = useMemo(
    () => allSeries.filter((s) => s.isComparable).length,
    [allSeries]
  );

  // Collect all valid values across displayed series for unified Y-axis scale
  const allValidValues = useMemo(() => {
    const vals: number[] = [];
    for (const s of displayedSeries) {
      for (const r of s.dailyRows) {
        const val = r[metric];
        if (val !== null && val !== undefined) {
          vals.push(val);
        }
      }
    }
    return vals;
  }, [displayedSeries, metric]);

  const hasAnyChartData = allValidValues.length > 0;

  const minVal = hasAnyChartData ? Math.min(...allValidValues) : 0;
  const maxVal = hasAnyChartData ? Math.max(...allValidValues) : 100;
  const rangeVal = maxVal - minVal || Math.max(1, maxVal * 0.1) || 100;
  const yMin = Math.max(0, minVal - rangeVal * 0.1);
  const yMax = maxVal + rangeVal * 0.1;

  const width = 800;
  const height = 250;
  const paddingX = 45;
  const paddingY = 25;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const totalDates = Math.max(1, dateList.length);
  const getX = (idx: number) => paddingX + (idx / Math.max(1, totalDates - 1)) * chartW;
  const getY = (val: number | null | undefined) => {
    if (val === null || val === undefined) return null;
    return height - paddingY - ((val - yMin) / (yMax - yMin)) * chartH;
  };

  // Generate SVG path segments for each series
  const seriesPaths = useMemo(() => {
    return displayedSeries.map((series) => {
      const segments: string[] = [];
      let current = "";
      const rowByDate = new Map<string, SummaryDailyRow>();
      for (const r of series.dailyRows) rowByDate.set(r.date, r);

      for (let i = 0; i < dateList.length; i += 1) {
        const date = dateList[i];
        const row = rowByDate.get(date);
        const value = row ? row[metric] : null;

        if (value === null || value === undefined) {
          if (current) segments.push(current);
          current = "";
          continue;
        }

        const x = paddingX + (i / Math.max(1, dateList.length - 1)) * chartW;
        const y = height - paddingY - ((value - yMin) / (yMax - yMin)) * chartH;
        current = current ? `${current} L ${x} ${y}` : `M ${x} ${y}`;
      }

      if (current) segments.push(current);
      return { series, segments, rowByDate };
    });
  }, [displayedSeries, dateList, metric, chartW, chartH, yMin, yMax]);

  // Single store daily rows for table below chart
  const singleSelectedStore = useMemo(() => {
    if (activeSelectedIds.length !== 1) return null;
    return stores.find((s) => s.lineOaId === activeSelectedIds[0]) ?? null;
  }, [activeSelectedIds, stores]);

  const singleStoreDailyRows = useMemo(() => {
    if (activeSelectedIds.length !== 1) return [];
    const id = activeSelectedIds[0];
    const rows = storeSeriesMap[id] ?? (selectedLineOaId === id ? data : []);
    return [...rows].sort((a, b) => b.date.localeCompare(a.date));
  }, [activeSelectedIds, storeSeriesMap, selectedLineOaId, data]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{t.trendAnalysis}</h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {activeSelectedIds.length === 0 && comparisonMode === "available"
              ? t.availableCoverageNote
              : t.trendSubheader}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Comparison Mode Selector */}
          {onComparisonModeChange && (
            <div className="flex items-center gap-2">
              <select
                aria-label={t.comparableAccounts}
                value={comparisonMode}
                onChange={(e) => onComparisonModeChange(e.target.value as "comparable" | "available")}
                className="rounded-xl border border-[var(--border)] bg-[var(--input-background)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="available">{t.availableAccounts}</option>
                <option value="comparable">{t.comparableAccounts}</option>
              </select>

              {/* Comparison Count / Partial Coverage Badge */}
              {comparisonMode === "comparable" && (
                <span className="rounded-lg bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {totalSelectedCount > 0
                    ? t.comparableStoresCount(comparableStoreCount, totalSelectedCount)
                    : comparableCount !== undefined
                    ? t.comparableCountLabel(comparableCount)
                    : ""}
                </span>
              )}

              {comparisonMode === "available" && totalSelectedCount > 1 && storesWithDataCount < totalSelectedCount && (
                <span className="rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {t.storesWithDataCount(storesWithDataCount, totalSelectedCount)}
                </span>
              )}
            </div>
          )}

          {/* Multi-Store Combobox */}
          <StoreMultiSelectCombobox
            stores={stores}
            selectedLineOaIds={activeSelectedIds}
            language={language}
            onSelectStores={handleSelectionChange}
          />

          {/* Legend for Aggregate Mode */}
          {activeSelectedIds.length <= 1 && (
            <div className="hidden items-center gap-3 text-xs text-[var(--muted)] sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: defaultMetricColor }} />
                {t.availableData}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full border border-dashed border-[var(--border)]" />
                {t.noData}
              </span>
            </div>
          )}

          {/* Metric Selector Buttons */}
          <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--input-background)] p-1">
            {([
              ["followers", t.followers],
              ["targetedReaches", t.targetedReach],
              ["blocks", t.blocks],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onMetricChange(value)}
                aria-pressed={metric === value}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  metric === value
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Store Legend when comparing 2+ stores */}
      {activeSelectedIds.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] pb-3 text-xs">
          {displayedSeries.map((series) => (
            <div key={series.id} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: series.color }} />
              <span className="font-medium text-[var(--foreground)] truncate max-w-[180px]" title={`${series.storeName} (${series.accountName})`}>
                {series.storeName}
              </span>
              {!series.hasData && (
                <span className="text-[10px] text-[var(--muted)]">({t.noData})</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Chart Canvas */}
      <div className="relative h-72 w-full" ref={containerRef}>
        {isLoadingTrend ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--muted)]">
            <svg className="h-5 w-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{t.syncingBtn}</span>
          </div>
        ) : trendError ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-amber-600 dark:text-amber-400">
            {t.failedToLoadStoreTrend}: {trendError}
          </div>
        ) : dateList.length === 0 || !hasAnyChartData ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
            {activeSelectedIds.length === 1 ? t.noDataForStoreInRange : t.noChartData}
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full overflow-visible text-[var(--muted)]"
            preserveAspectRatio="none"
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Grid lines and Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const val = Math.round(yMin + pct * (yMax - yMin));
              const y = height - paddingY - pct * chartH;
              return (
                <g key={pct}>
                  <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="currentColor" strokeOpacity={0.1} strokeDasharray="4 4" />
                  <text x={paddingX - 10} y={y + 4} fontSize="10" textAnchor="end" fill="currentColor">
                    {val.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {/* Path lines for each series */}
            {seriesPaths.map(({ series, segments }) =>
              segments.map((path, idx) => (
                <path
                  key={`${series.id}-seg-${idx}`}
                  d={path}
                  fill="none"
                  stroke={series.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))
            )}

            {/* Data points for each series */}
            {seriesPaths.map(({ series, rowByDate }) =>
              dateList.map((date, index) => {
                const row = rowByDate.get(date);
                const val = row ? row[metric] : null;
                const cx = getX(index);
                const cy = getY(val);

                if (val === null || val === undefined || cy === null) {
                  // Only draw missing ring if single series to avoid SVG clutter
                  if (displayedSeries.length === 1) {
                    return (
                      <circle
                        key={`${series.id}-dot-${index}`}
                        cx={cx}
                        cy={height - paddingY}
                        r="3"
                        fill="none"
                        stroke="currentColor"
                        strokeOpacity={0.3}
                        strokeDasharray="2 2"
                      />
                    );
                  }
                  return null;
                }

                return (
                  <circle
                    key={`${series.id}-dot-${index}`}
                    cx={cx}
                    cy={cy}
                    r={hoverIdx === index ? "5.5" : "3.5"}
                    fill={series.color}
                    className="transition-all duration-150"
                  />
                );
              })
            )}

            {/* Invisible hover overlay rects for whole-column hovering */}
            {dateList.map((_, index) => {
              const cx = getX(index);
              const colWidth = chartW / Math.max(1, dateList.length);
              return (
                <rect
                  key={`col-${index}`}
                  x={cx - colWidth / 2}
                  y={0}
                  width={colWidth}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(index)}
                  className="cursor-pointer"
                />
              );
            })}

            {/* Hover guideline */}
            {hoverIdx !== null && (
              <line
                x1={getX(hoverIdx)}
                y1={paddingY}
                x2={getX(hoverIdx)}
                y2={height - paddingY}
                stroke="currentColor"
                strokeOpacity={0.3}
                strokeDasharray="3 3"
              />
            )}
          </svg>
        )}

        {/* Hover Tooltip */}
        {!isLoadingTrend && !trendError && hoverIdx !== null && dateList[hoverIdx] && (
          <div
            className="pointer-events-none absolute z-20 max-w-xs rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-xs shadow-xl"
            style={{
              left: `${Math.min(85, Math.max(15, (hoverIdx / Math.max(1, dateList.length - 1)) * 100))}%`,
              top: "10px",
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-bold text-[var(--foreground)]">{formatDateDisplay(dateList[hoverIdx], language)}</p>

            {/* Single Series Tooltip */}
            {displayedSeries.length === 1 && (
              <>
                {(() => {
                  const targetDate = dateList[hoverIdx];
                  const row = displayedSeries[0].dailyRows.find((r) => r.date === targetDate);
                  const val = row ? row[metric] : null;
                  return (
                    <>
                      <div className="mt-1 flex items-center justify-between gap-4">
                        <span className="text-[var(--muted)]">{metricLabel}:</span>
                        <span className="font-semibold text-[var(--foreground)]">
                          {val !== null && val !== undefined ? val.toLocaleString() : t.noData}
                        </span>
                      </div>
                      {activeSelectedIds.length === 1 && row && (
                        <div className="mt-1 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-1">
                          <span className="text-[var(--muted)]">{language === "th" ? "เพิ่มขึ้นวันนี้" : "Daily change"}:</span>
                          <span className={dailyChangeClass(row.dailyIncrease)}>{formatSigned(row.dailyIncrease)}</span>
                        </div>
                      )}
                      {row && row.accountsExpected > 0 && (
                        <div className="mt-1 flex justify-between gap-3 border-t border-[var(--border)] pt-1 text-[10px] text-[var(--muted)]">
                          <span>{t.accountsReady}:</span>
                          <span>{row.accountsReady} / {row.accountsExpected}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            {/* Multi-Series Tooltip */}
            {displayedSeries.length > 1 && (
              <div className="mt-2 space-y-1 divide-y divide-[var(--border)]">
                {displayedSeries.map((series) => {
                  const targetDate = dateList[hoverIdx];
                  const row = series.dailyRows.find((r) => r.date === targetDate);
                  const val = row ? row[metric] : null;
                  return (
                    <div key={series.id} className="flex items-center justify-between gap-3 pt-1 text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: series.color }} />
                        <span className="truncate text-[var(--foreground)]">{series.storeName}</span>
                      </div>
                      <span className="shrink-0 font-semibold text-[var(--foreground)] tabular-nums">
                        {val !== null && val !== undefined ? val.toLocaleString() : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Single Store Daily Breakdown Table */}
      {activeSelectedIds.length === 1 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-[var(--foreground)]">
                {language === "th" ? "การเปลี่ยนแปลงรายวันของสาขา" : "Store daily changes"}
              </h4>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {singleSelectedStore ? `${singleSelectedStore.storeName} · ${singleSelectedStore.accountName}` : activeSelectedIds[0]}
              </p>
            </div>
            <span className="w-fit rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {language === "th" ? `${singleStoreDailyRows.length} วัน` : `${singleStoreDailyRows.length} days`}
            </span>
          </div>

          {isLoadingTrend ? (
            <div className="p-8 text-center text-sm text-[var(--muted)]">{t.syncingBtn}</div>
          ) : trendError ? (
            <div className="p-8 text-center text-sm text-amber-600">{t.failedToLoadStoreTrend}</div>
          ) : singleStoreDailyRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--muted)]">{t.noDataForStoreInRange}</div>
          ) : (
            <div className="max-h-[430px] overflow-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-elevated)] text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">{language === "th" ? "วันที่" : "Date"}</th>
                    <th className="px-4 py-3 text-right font-medium">{t.followers}</th>
                    <th className="px-4 py-3 text-right font-medium">{language === "th" ? "เพิ่ม/ลดวันนี้" : "Daily change"}</th>
                    <th className="px-4 py-3 text-right font-medium">{t.targetedReach}</th>
                    <th className="px-4 py-3 text-right font-medium">{t.blocks}</th>
                    <th className="px-4 py-3 text-center font-medium">{language === "th" ? "ข้อมูล" : "Data"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {singleStoreDailyRows.map((row) => {
                    const ready = row.followers !== null && row.accountsReady === row.accountsExpected && row.accountsExpected > 0;
                    const partial = row.followers !== null && !ready;
                    return (
                      <tr key={row.date} className="hover:bg-[var(--hover)]">
                        <td className="px-4 py-3 font-medium text-[var(--foreground)]">{formatDateDisplay(row.date, language)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.followers?.toLocaleString() ?? "—"}</td>
                        <td className={`px-4 py-3 text-right tabular-nums ${dailyChangeClass(row.dailyIncrease)}`}>{formatSigned(row.dailyIncrease)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.targetedReaches?.toLocaleString() ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.blocks?.toLocaleString() ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          {ready ? (
                            <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">{language === "th" ? "ครบ" : "Ready"}</span>
                          ) : partial ? (
                            <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">{language === "th" ? "บางส่วน" : "Partial"}</span>
                          ) : (
                            <span className="inline-flex rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-400">{language === "th" ? "ไม่มีข้อมูล" : "No data"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">
            {language === "th"
              ? "ค่าเพิ่ม/ลดใช้ข้อมูลรายวันจาก LINE OA โดยตรง หากวันใดไม่มีข้อมูล ระบบจะแสดง — และไม่คำนวณข้ามวัน"
              : "Daily change uses LINE OA daily data directly. Missing dates show — and are not bridged across gaps."}
          </div>
        </div>
      )}
    </div>
  );
}

function formatSigned(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString()}`;
}

function dailyChangeClass(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "font-medium text-[var(--muted)]";
  return value > 0
    ? "font-semibold text-emerald-600 dark:text-emerald-400"
    : "font-semibold text-rose-600 dark:text-rose-400";
}

interface StoreOptionItem {
  lineOaId: string;
  storeName: string;
  accountName: string;
  label: string;
}

export function StoreMultiSelectCombobox({
  stores,
  selectedLineOaIds,
  language = "en",
  onSelectStores,
}: {
  stores: ByStoreAccountRow[];
  selectedLineOaIds: string[];
  language?: Language;
  onSelectStores: (lineOaIds: string[]) => void;
}) {
  const t = getFollowerInsightsText(language);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Deduplicate and alphabetically sort stores
  const storeOptions = useMemo<StoreOptionItem[]>(() => {
    const map = new Map<string, ByStoreAccountRow>();
    for (const s of stores) {
      if (s.lineOaId && !map.has(s.lineOaId)) map.set(s.lineOaId, s);
    }
    const sorted = Array.from(map.values()).sort((a, b) => {
      const byStore = a.storeName.localeCompare(b.storeName);
      return byStore !== 0 ? byStore : a.accountName.localeCompare(b.accountName);
    });
    return sorted.map((s) => ({
      lineOaId: s.lineOaId,
      storeName: s.storeName,
      accountName: s.accountName,
      label: `${s.storeName} — ${s.accountName}`,
    }));
  }, [stores]);

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return storeOptions;
    return storeOptions.filter(
      (opt) =>
        opt.storeName.toLowerCase().includes(query) ||
        opt.accountName.toLowerCase().includes(query) ||
        opt.label.toLowerCase().includes(query)
    );
  }, [storeOptions, searchQuery]);

  // Button Trigger Label
  const triggerLabel = useMemo(() => {
    if (selectedLineOaIds.length === 0) {
      return t.allStores;
    }
    if (selectedLineOaIds.length === 1) {
      const found = storeOptions.find((o) => o.lineOaId === selectedLineOaIds[0]);
      return found ? found.storeName : selectedLineOaIds[0];
    }
    const firstFound = storeOptions.find((o) => o.lineOaId === selectedLineOaIds[0]);
    const firstName = firstFound ? firstFound.storeName : selectedLineOaIds[0];
    return `${firstName} +${selectedLineOaIds.length - 1}`;
  }, [selectedLineOaIds, storeOptions, t.allStores]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  const toggleStore = (lineOaId: string) => {
    const isSelected = selectedLineOaIds.includes(lineOaId);
    let next: string[];
    if (isSelected) {
      next = selectedLineOaIds.filter((id) => id !== lineOaId);
    } else {
      next = [...selectedLineOaIds, lineOaId];
    }
    onSelectStores(next);
  };

  const selectAll = () => {
    const allFilteredIds = filteredOptions.map((o) => o.lineOaId);
    const merged = Array.from(new Set([...selectedLineOaIds, ...allFilteredIds]));
    onSelectStores(merged);
  };

  const clearAll = () => {
    onSelectStores([]);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setSearchQuery("");
      triggerRef.current?.focus();
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t.selectedStore}
        onClick={() => {
          setIsOpen((open) => !open);
          setTimeout(() => searchInputRef.current?.focus(), 0);
        }}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key) && !isOpen) {
            e.preventDefault();
            setIsOpen(true);
            setTimeout(() => searchInputRef.current?.focus(), 0);
          }
        }}
        className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          selectedLineOaIds.length > 0
            ? "border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
            : "border-[var(--border)] bg-[var(--input-background)] text-[var(--foreground)] hover:bg-[var(--hover)]"
        }`}
      >
        <svg className="h-3.5 w-3.5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h5m-5 0V11m0 0h5m-5 0H7" />
        </svg>
        <span className="max-w-[160px] truncate sm:max-w-[220px]">{triggerLabel}</span>

        {selectedLineOaIds.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            aria-label={t.clearStoreFilter}
            onClick={(event) => {
              event.stopPropagation();
              clearAll();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
                clearAll();
              }
            }}
            className="ml-0.5 rounded-full p-0.5 text-blue-500 hover:bg-blue-500/20"
          >
            ×
          </span>
        )}

        <svg
          className={`h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2.5 shadow-2xl sm:left-auto sm:right-0 sm:w-80"
          onKeyDown={handleKeyDown}
        >
          {/* Search Box */}
          <div className="relative mb-2">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t.searchStoresOrLineOas}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-background)] px-3 py-1.5 pl-8 text-xs text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Action Bar (Select All / Clear All) */}
          <div className="mb-2 flex items-center justify-between border-b border-[var(--border)] px-1 pb-2 text-xs">
            <button
              type="button"
              onClick={selectAll}
              className="rounded px-1.5 py-0.5 font-medium text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
            >
              {t.selectAll}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded px-1.5 py-0.5 font-medium text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
            >
              {t.clearSelection}
            </button>
          </div>

          {/* Checkbox List */}
          <div role="listbox" aria-multiselectable="true" className="max-h-56 space-y-0.5 overflow-y-auto">
            {/* "All stores" option */}
            <div
              role="option"
              aria-selected={selectedLineOaIds.length === 0}
              onClick={clearAll}
              className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium ${
                selectedLineOaIds.length === 0
                  ? "bg-blue-500/10 text-blue-600 font-semibold dark:text-blue-400"
                  : "text-[var(--foreground)] hover:bg-[var(--hover)]"
              }`}
            >
              <span>{t.allStores}</span>
              {selectedLineOaIds.length === 0 && <span>✓</span>}
            </div>

            {/* Individual Store Options with Checkboxes */}
            {filteredOptions.map((option) => {
              const isSelected = selectedLineOaIds.includes(option.lineOaId);
              return (
                <div
                  key={option.lineOaId}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggleStore(option.lineOaId)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-colors ${
                    isSelected
                      ? "bg-blue-500/10 text-blue-600 font-medium dark:text-blue-400"
                      : "text-[var(--foreground)] hover:bg-[var(--hover)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // Handled by div click
                    className="h-3.5 w-3.5 rounded border-[var(--border)] text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex flex-col truncate">
                    <span className="truncate font-medium">{option.storeName}</span>
                    <span className="truncate text-[10px] text-[var(--muted)]">{option.accountName}</span>
                  </div>
                </div>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-[var(--muted)]">
                {t.noStoresFound(searchQuery)}
              </div>
            )}
          </div>

          {/* Footer Selection Counter */}
          {selectedLineOaIds.length > 0 && (
            <div className="mt-2 border-t border-[var(--border)] px-1 pt-2 text-[10px] text-[var(--muted)]">
              {t.selectedStoresCount(selectedLineOaIds.length)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
