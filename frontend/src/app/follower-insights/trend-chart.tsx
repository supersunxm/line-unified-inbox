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
    metric === "followers" ? "#00A651" : metric === "targetedReaches" ? "#10b981" : "#f43f5e";
  const metricLabel =
    metric === "followers" ? t.followers : metric === "targetedReaches" ? t.targetedReach : t.blocks;

  const pathSegments = useMemo(() => {
    const segments: string[] = [];
    let current = "";
    for (let i = 0; i < data.length; i += 1) {
      const value = data[i][metric];
      if (value === null || value === undefined) {
        if (current) segments.push(current);
        current = "";
        continue;
      }
      const x = paddingX + (i / Math.max(1, data.length - 1)) * chartW;
      const y = height - paddingY - ((value - yMin) / (yMax - yMin)) * chartH;
      current = current ? `${current} L ${x} ${y}` : `M ${x} ${y}`;
    }
    if (current) segments.push(current);
    return segments;
  }, [data, metric, chartW, chartH, yMin, yMax]);

  const selectedStore = useMemo(() => {
    if (!selectedLineOaId) return null;
    return stores.find((store) => store.lineOaId === selectedLineOaId) ?? null;
  }, [selectedLineOaId, stores]);

  const dailyRows = useMemo(
    () => (selectedLineOaId ? [...data].sort((a, b) => b.date.localeCompare(a.date)) : []),
    [data, selectedLineOaId]
  );

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
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

          {onSelectStore && (
            <StoreSelectorCombobox
              stores={stores}
              selectedLineOaId={selectedLineOaId}
              language={language}
              onSelectStore={onSelectStore}
            />
          )}

          <div className="hidden items-center gap-3 text-xs text-[var(--muted)] sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: metricColor }} />
              {t.availableData}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-dashed border-[var(--border)]" />
              {t.noData}
            </span>
          </div>

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
        ) : data.length === 0 || validVals.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
            {selectedLineOaId !== null ? t.noDataForStoreInRange : t.noChartData}
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full overflow-visible text-[var(--muted)]"
            preserveAspectRatio="none"
            onMouseLeave={() => setHoverIdx(null)}
          >
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

            {pathSegments.map((path, index) => (
              <path key={index} d={path} fill="none" stroke={metricColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            ))}

            {data.map((row, index) => {
              const val = row[metric];
              const cx = getX(index);
              const cy = getY(val);
              if (val === null || val === undefined || cy === null) {
                return <circle key={index} cx={cx} cy={height - paddingY} r="3" fill="none" stroke="currentColor" strokeOpacity={0.3} strokeDasharray="2 2" />;
              }
              return (
                <g key={index}>
                  <circle cx={cx} cy={cy} r={hoverIdx === index ? "6" : "4"} fill={metricColor} className="cursor-pointer transition-all duration-150" />
                  <rect
                    x={cx - chartW / Math.max(1, data.length) / 2}
                    y={0}
                    width={chartW / Math.max(1, data.length)}
                    height={height}
                    fill="transparent"
                    onMouseEnter={() => setHoverIdx(index)}
                    className="cursor-pointer"
                  />
                </g>
              );
            })}

            {hoverIdx !== null && (
              <line x1={getX(hoverIdx)} y1={paddingY} x2={getX(hoverIdx)} y2={height - paddingY} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />
            )}
          </svg>
        )}

        {!isLoadingTrend && !trendError && hoverIdx !== null && data[hoverIdx] && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-xs shadow-xl"
            style={{
              left: `${Math.min(85, Math.max(15, (hoverIdx / Math.max(1, data.length - 1)) * 100))}%`,
              top: "10px",
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-bold text-[var(--foreground)]">{formatDateDisplay(data[hoverIdx].date, language)}</p>
            <div className="mt-1 flex items-center justify-between gap-4">
              <span className="text-[var(--muted)]">{metricLabel}:</span>
              <span className="font-semibold text-[var(--foreground)]">{data[hoverIdx][metric]?.toLocaleString() ?? t.noData}</span>
            </div>
            {selectedLineOaId && (
              <div className="mt-1 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-1">
                <span className="text-[var(--muted)]">{language === "th" ? "เพิ่มขึ้นวันนี้" : "Daily change"}:</span>
                <span className={dailyChangeClass(data[hoverIdx].dailyIncrease)}>{formatSigned(data[hoverIdx].dailyIncrease)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between gap-3 border-t border-[var(--border)] pt-1 text-[10px] text-[var(--muted)]">
              <span>{t.accountsReady}:</span>
              <span>{data[hoverIdx].accountsReady} / {data[hoverIdx].accountsExpected}</span>
            </div>
          </div>
        )}
      </div>

      {selectedLineOaId && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-[var(--foreground)]">
                {language === "th" ? "การเปลี่ยนแปลงรายวันของสาขา" : "Store daily changes"}
              </h4>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {selectedStore ? `${selectedStore.storeName} · ${selectedStore.accountName}` : selectedLineOaId}
              </p>
            </div>
            <span className="w-fit rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
              {language === "th" ? `${dailyRows.length} วัน` : `${dailyRows.length} days`}
            </span>
          </div>

          {isLoadingTrend ? (
            <div className="p-8 text-center text-sm text-[var(--muted)]">{t.syncingBtn}</div>
          ) : trendError ? (
            <div className="p-8 text-center text-sm text-amber-600">{t.failedToLoadStoreTrend}</div>
          ) : dailyRows.length === 0 ? (
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
                  {dailyRows.map((row) => {
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
                            <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{language === "th" ? "ครบ" : "Ready"}</span>
                          ) : partial ? (
                            <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700">{language === "th" ? "บางส่วน" : "Partial"}</span>
                          ) : (
                            <span className="inline-flex rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-700">{language === "th" ? "ไม่มีข้อมูล" : "No data"}</span>
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
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const options = useMemo<StoreOption[]>(() => {
    const map = new Map<string, ByStoreAccountRow>();
    for (const store of stores) {
      if (store.lineOaId && !map.has(store.lineOaId)) map.set(store.lineOaId, store);
    }
    const sorted = Array.from(map.values()).sort((a, b) => {
      const byStore = a.storeName.localeCompare(b.storeName);
      return byStore !== 0 ? byStore : a.accountName.localeCompare(b.accountName);
    });
    return [
      { lineOaId: null, label: t.allStores, storeName: t.allStores, accountName: "" },
      ...sorted.map((store) => ({
        lineOaId: store.lineOaId,
        label: `${store.storeName} — ${store.accountName}`,
        storeName: store.storeName,
        accountName: store.accountName,
      })),
    ];
  }, [stores, t.allStores]);

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) =>
      option.lineOaId === null || option.label.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  const selectedOption = useMemo(
    () => options.find((option) => option.lineOaId === selectedLineOaId) ?? options[0],
    [options, selectedLineOaId]
  );

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

  const choose = (lineOaId: string | null) => {
    onSelectStore(lineOaId);
    setIsOpen(false);
    setSearchQuery("");
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setSearchQuery("");
      triggerRef.current?.focus();
      return;
    }
    if (!isOpen) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        setIsOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => (filteredOptions.length ? (index + 1) % filteredOptions.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => (filteredOptions.length ? (index - 1 + filteredOptions.length) % filteredOptions.length : 0));
    } else if (event.key === "Enter" && filteredOptions[highlightedIndex]) {
      event.preventDefault();
      choose(filteredOptions[highlightedIndex].lineOaId);
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
          setHighlightedIndex(0);
          setTimeout(() => searchInputRef.current?.focus(), 0);
        }}
        onKeyDown={handleKeyDown}
        className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          selectedLineOaId
            ? "border-blue-500/50 bg-blue-500/10 text-blue-600 font-semibold"
            : "border-[var(--border)] bg-[var(--input-background)] text-[var(--foreground)] hover:bg-[var(--hover)]"
        }`}
      >
        <svg className="h-3.5 w-3.5 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h5m-5 0V11m0 0h5m-5 0H7" />
        </svg>
        <span className="max-w-[160px] truncate sm:max-w-[220px]">{selectedOption.label}</span>
        {selectedLineOaId && (
          <span
            role="button"
            tabIndex={0}
            aria-label={t.clearStoreFilter}
            onClick={(event) => {
              event.stopPropagation();
              choose(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
                choose(null);
              }
            }}
            className="ml-1 rounded-full p-0.5 text-blue-400 hover:bg-blue-500/20"
          >
            ×
          </span>
        )}
        <svg className={`h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2.5 shadow-2xl sm:left-auto sm:right-0 sm:w-80">
          <div className="relative mb-2">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t.searchStoresOrLineOas}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-background)] px-3 py-1.5 pl-8 text-xs text-[var(--foreground)] focus:outline-none"
            />
            <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div role="listbox" className="max-h-56 space-y-0.5 overflow-y-auto">
            {filteredOptions.map((option, index) => {
              const selected = option.lineOaId === selectedLineOaId;
              const highlighted = index === highlightedIndex;
              return (
                <div
                  key={option.lineOaId ?? "all"}
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(option.lineOaId)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium ${
                    highlighted
                      ? "bg-blue-600 text-white"
                      : selected
                      ? "bg-blue-500/10 text-blue-600 font-semibold"
                      : "text-[var(--foreground)] hover:bg-[var(--hover)]"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {selected && <span>✓</span>}
                </div>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-[var(--muted)]">{t.noStoresFound(searchQuery)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
