"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ByStoreAccountRow, SummaryDailyRow } from "@/types/api";
import { getFollowerInsightsText, type Language } from "./follower-insights-translations";
import { formatDateDisplay } from "./follower-insights-utils";

interface TrendChartProps {
  data: SummaryDailyRow[];
  metric: "followers" | "targetedReaches" | "blocks";
  language?: Language;
  stores?: ByStoreAccountRow[];
  selectedLineOaId?: string | null;
  isLoadingTrend?: boolean;
  trendError?: string | null;
  comparisonMode?: "comparable" | "available";
  comparableCount?: number;
  onComparisonModeChange?: (mode: "comparable" | "available") => void;
  onMetricChange: (metric: "followers" | "targetedReaches" | "blocks") => void;
  onSelectStore?: (lineOaId: string | null) => void;
}

export function TrendChart({
  data,
  metric,
  language = "en",
  stores = [],
  selectedLineOaId = null,
  isLoadingTrend = false,
  trendError = null,
  comparisonMode = "comparable",
  comparableCount,
  onComparisonModeChange,
  onMetricChange,
  onSelectStore,
}: TrendChartProps) {
  const t = getFollowerInsightsText(language);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const validVals = data
    .map((d) => d[metric])
    .filter((v): v is number => v !== null && v !== undefined);
  const minVal = validVals.length ? Math.min(...validVals) : 0;
  const maxVal = validVals.length ? Math.max(...validVals) : 100;

  const rangeVal = maxVal - minVal || 100;
  const yMin = Math.max(0, minVal - rangeVal * 0.1);
  const yMax = maxVal + rangeVal * 0.1;

  const width = 800;
  const height = 250;
  const paddingX = 45;
  const paddingY = 25;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const getX = (idx: number) => paddingX + (idx / Math.max(1, data.length - 1)) * chartW;
  const getY = (val: number | null) => {
    if (val === null || val === undefined) return null;
    return height - paddingY - ((val - yMin) / (yMax - yMin)) * chartH;
  };

  const metricColor =
    metric === "followers" ? "#3b82f6" : metric === "targetedReaches" ? "#10b981" : "#f43f5e";
  const metricLabel =
    metric === "followers" ? t.followers : metric === "targetedReaches" ? t.targetedReach : t.blocks;

  // Build SVG path segments (gapped lines: splits on null values so missing dates do NOT connect)
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
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      {/* Header Controls */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{t.trendAnalysis}</h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {selectedLineOaId === null && comparisonMode === "available"
              ? t.availableCoverageNote
              : t.trendSubheader}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Comparison Mode Selector (Aggregate view only) */}
          {selectedLineOaId === null && onComparisonModeChange && (
            <div className="flex items-center gap-2">
              <select
                aria-label={t.comparableAccounts}
                value={comparisonMode}
                onChange={(e) => onComparisonModeChange(e.target.value as "comparable" | "available")}
                className="rounded-xl border border-[var(--border)] bg-[var(--input-background)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="comparable">{t.comparableAccounts}</option>
                <option value="available">{t.availableAccounts}</option>
              </select>
              {comparisonMode === "comparable" && comparableCount !== undefined && (
                <span className="rounded-lg bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {t.comparableCountLabel(comparableCount)}
                </span>
              )}
            </div>
          )}

          {/* Store Selector Combobox */}
          {onSelectStore && (
            <StoreSelectorCombobox
              stores={stores}
              selectedLineOaId={selectedLineOaId}
              language={language}
              onSelectStore={onSelectStore}
            />
          )}

          {/* Chart Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: metricColor }}></span>
              {t.availableData}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-dashed border-[var(--border)]"></span>
              {t.noData}
            </span>
          </div>

          {/* Metric Selector */}
          <div className="flex items-center rounded-xl bg-[var(--input-background)] border border-[var(--border)] p-1">
            <button
              type="button"
              onClick={() => onMetricChange("followers")}
              aria-label={t.metricViewFollowers}
              aria-pressed={metric === "followers"}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                metric === "followers"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
              }`}
            >
              {t.followers}
            </button>
            <button
              type="button"
              onClick={() => onMetricChange("targetedReaches")}
              aria-label={t.metricViewTargetedReach}
              aria-pressed={metric === "targetedReaches"}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                metric === "targetedReaches"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
              }`}
            >
              {t.targetedReach}
            </button>
            <button
              type="button"
              onClick={() => onMetricChange("blocks")}
              aria-label={t.metricViewBlocks}
              aria-pressed={metric === "blocks"}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                metric === "blocks"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
              }`}
            >
              {t.blocks}
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative h-72 w-full" ref={containerRef}>
        {isLoadingTrend ? (
          /* Lightweight Loading Spinner */
          <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--muted)]">
            <svg
              className="h-5 w-5 animate-spin text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{t.syncingBtn}</span>
          </div>
        ) : trendError ? (
          /* Store Trend Load Error */
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-amber-600 dark:text-amber-400">
            {t.failedToLoadStoreTrend}: {trendError}
          </div>
        ) : data.length === 0 || validVals.length === 0 ? (
          /* Empty State */
          <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
            {selectedLineOaId !== null ? t.noDataForStoreInRange : t.noChartData}
          </div>
        ) : (
          /* SVG Line Chart */
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full overflow-visible text-[var(--muted)]"
            preserveAspectRatio="none"
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Y-axis Gridlines & Labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const val = Math.round(yMin + pct * (yMax - yMin));
              const y = height - paddingY - pct * chartH;
              return (
                <g key={pct}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={width - paddingX}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingX - 10}
                    y={y + 4}
                    fontSize="10"
                    textAnchor="end"
                    fill="currentColor"
                  >
                    {val.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {/* Polyline Path Segments */}
            {pathSegments.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={metricColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* Data Point Circles */}
            {data.map((d, i) => {
              const val = d[metric];
              const cx = getX(i);
              const cy = getY(val);

              if (val === null || val === undefined || cy === null) {
                return (
                  <circle
                    key={i}
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

              const isHovered = hoverIdx === i;
              return (
                <g key={i}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? "6" : "4"}
                    fill={metricColor}
                    className="cursor-pointer transition-all duration-150"
                  />
                  {/* Hover Trigger Zone */}
                  <rect
                    x={cx - chartW / data.length / 2}
                    y={0}
                    width={chartW / data.length}
                    height={height}
                    fill="transparent"
                    onMouseEnter={() => setHoverIdx(i)}
                    className="cursor-pointer"
                  />
                </g>
              );
            })}

            {/* Hover Guideline */}
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

        {/* Floating Tooltip Overlay */}
        {!isLoadingTrend && !trendError && hoverIdx !== null && data[hoverIdx] && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-xs shadow-xl transition-all duration-75"
            style={{
              left: `${Math.min(85, Math.max(15, (hoverIdx / Math.max(1, data.length - 1)) * 100))}%`,
              top: "10px",
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-bold text-[var(--foreground)]">
              {formatDateDisplay(data[hoverIdx].date, language)}
            </p>
            <div className="mt-1 flex items-center justify-between gap-4">
              <span className="text-[var(--muted)]">{metricLabel}:</span>
              <span className="font-semibold text-[var(--foreground)]">
                {data[hoverIdx][metric]?.toLocaleString() ?? t.noData}
              </span>
            </div>
            <div className="mt-1 flex justify-between gap-3 border-t border-[var(--border)] pt-1 text-[10px] text-[var(--muted)]">
              <span>{t.accountsReady}:</span>
              <span>
                {data[hoverIdx].accountsReady} / {data[hoverIdx].accountsExpected}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StoreOption {
  lineOaId: string | null;
  label: string;
  storeName: string;
  accountName: string;
}

function StoreSelectorCombobox({
  stores,
  selectedLineOaId,
  language = "en",
  onSelectStore,
}: {
  stores: ByStoreAccountRow[];
  selectedLineOaId: string | null;
  language?: Language;
  onSelectStore: (lineOaId: string | null) => void;
}) {
  const t = getFollowerInsightsText(language);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Deduplicate by lineOaId and sort alphabetically by storeName, then accountName
  const options = useMemo<StoreOption[]>(() => {
    const map = new Map<string, ByStoreAccountRow>();
    for (const s of stores) {
      if (s.lineOaId && !map.has(s.lineOaId)) {
        map.set(s.lineOaId, s);
      }
    }

    const sortedStores = Array.from(map.values()).sort((a, b) => {
      const sComp = a.storeName.localeCompare(b.storeName);
      if (sComp !== 0) return sComp;
      return a.accountName.localeCompare(b.accountName);
    });

    const allOpt: StoreOption = {
      lineOaId: null,
      label: t.allStores,
      storeName: t.allStores,
      accountName: "",
    };

    const storeOpts: StoreOption[] = sortedStores.map((s) => ({
      lineOaId: s.lineOaId,
      label: `${s.storeName} — ${s.accountName}`,
      storeName: s.storeName,
      accountName: s.accountName,
    }));

    return [allOpt, ...storeOpts];
  }, [stores, t.allStores]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      if (opt.lineOaId === null) return true; // Keep All stores option visible
      return (
        opt.storeName.toLowerCase().includes(q) ||
        opt.accountName.toLowerCase().includes(q) ||
        opt.label.toLowerCase().includes(q)
      );
    });
  }, [options, searchQuery]);

  const selectedOption = useMemo(() => {
    if (!selectedLineOaId) return options[0];
    return options.find((opt) => opt.lineOaId === selectedLineOaId) || options[0];
  }, [options, selectedLineOaId]);

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen((open) => {
      const next = !open;
      if (next) {
        setHighlightedIndex(0);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery("");
      triggerRef.current?.focus();
      return;
    }

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (filteredOptions.length > 0 ? (i + 1) % filteredOptions.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) =>
        filteredOptions.length > 0 ? (i - 1 + filteredOptions.length) % filteredOptions.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        onSelectStore(filteredOptions[highlightedIndex].lineOaId);
        setIsOpen(false);
        setSearchQuery("");
        triggerRef.current?.focus();
      }
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Combobox Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="store-selector-listbox"
        aria-label={t.selectedStore}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 ? `store-opt-${highlightedIndex}` : undefined
        }
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          selectedLineOaId
            ? "border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
            : "border-[var(--border)] bg-[var(--input-background)] text-[var(--foreground)] hover:bg-[var(--hover)]"
        }`}
      >
        <svg
          className="h-3.5 w-3.5 shrink-0 text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h5m-5 0V11m0 0h5m-5 0H7"
          />
        </svg>
        <span className="max-w-[160px] sm:max-w-[220px] truncate">{selectedOption.label}</span>

        {selectedLineOaId && (
          <span
            role="button"
            tabIndex={0}
            aria-label={t.clearStoreFilter}
            title={t.clearStoreFilter}
            onClick={(e) => {
              e.stopPropagation();
              onSelectStore(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onSelectStore(null);
              }
            }}
            className="ml-1 rounded-full p-0.5 text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}

        <svg
          className={`h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Combobox Dropdown Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={t.selectedStore}
          className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 z-50 w-72 sm:w-80 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Search Input inside Popover */}
          <div className="relative mb-2">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t.searchStoresOrLineOas}
              aria-label={t.searchStoresOrLineOas}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-background)] px-3 py-1.5 pl-8 text-xs text-[var(--foreground)] placeholder-[var(--muted)] focus:border-blue-500 focus:outline-none transition-colors"
            />
            <svg
              className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[var(--muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Listbox Container */}
          <div
            id="store-selector-listbox"
            role="listbox"
            aria-label={t.selectedStore}
            className="max-h-56 overflow-y-auto space-y-0.5"
          >
            {filteredOptions.map((opt, idx) => {
              const isSelected = opt.lineOaId === selectedLineOaId;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={opt.lineOaId ?? "all"}
                  id={`store-opt-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelectStore(opt.lineOaId);
                    setIsOpen(false);
                    setSearchQuery("");
                    triggerRef.current?.focus();
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                    isHighlighted
                      ? "bg-blue-600 text-white"
                      : isSelected
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                      : "text-[var(--foreground)] hover:bg-[var(--hover)]"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <svg
                      className="h-3.5 w-3.5 shrink-0 text-current"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-[var(--muted)]">
                {t.noStoresFound(searchQuery)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
