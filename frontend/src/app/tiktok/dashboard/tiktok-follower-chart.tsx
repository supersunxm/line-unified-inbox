"use client";

import { useMemo, useState } from "react";
import type { TikTokDailyMetricItem, TikTokGrowthSummary } from "../tiktok-types";
import { isTikTokDemoGrowthEnabled } from "./tiktok-demo-growth";

interface TikTokFollowerChartProps {
  history: TikTokDailyMetricItem[];
  summary: TikTokGrowthSummary;
  accountDisplayName?: string;
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "--";
  return new Intl.NumberFormat("en-US").format(num);
}

function formatDelta(delta: number | null | undefined): {
  text: string;
  className: string;
  chipClass: string;
} {
  if (delta === null || delta === undefined) {
    return {
      text: "--",
      className: "text-slate-400 dark:text-slate-500 font-medium",
      chipClass: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    };
  }

  if (delta > 0) {
    return {
      text: `+${new Intl.NumberFormat("en-US").format(delta)}`,
      className: "text-emerald-600 dark:text-emerald-400 font-semibold",
      chipClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60",
    };
  }

  if (delta < 0) {
    return {
      text: new Intl.NumberFormat("en-US").format(delta),
      className: "text-rose-600 dark:text-rose-400 font-semibold",
      chipClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60",
    };
  }

  return {
    text: "0",
    className: "text-slate-500 dark:text-slate-400 font-medium",
    chipClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${monthNames[mIdx] || parts[1]} ${day}`;
}

export function TikTokFollowerGrowthChart({
  history,
  summary,
  accountDisplayName,
}: TikTokFollowerChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const todayDelta = formatDelta(summary.dailyFollowerGrowth);
  const sevenDayDelta = formatDelta(summary.sevenDayFollowerGrowth);
  const thirtyDayDelta = formatDelta(summary.thirtyDayFollowerGrowth);

  // Filter and sort metrics chronologically
  const sortedData = useMemo(() => {
    return [...history].sort((a, b) => a.metricDate.localeCompare(b.metricDate));
  }, [history]);

  const hasEnoughData = sortedData.length >= 2;

  // Chart dimensions & scaling calculations
  const chartWidth = 800;
  const chartHeight = 220;
  const paddingX = 40;
  const paddingY = 24;
  const innerW = chartWidth - paddingX * 2;
  const innerH = chartHeight - paddingY * 2;

  const { points, linePath, areaPath, minFollowers, maxFollowers } = useMemo(() => {
    if (!hasEnoughData) {
      return { points: [], linePath: "", areaPath: "", minFollowers: 0, maxFollowers: 0 };
    }

    const counts = sortedData.map((d) => d.followerCount);
    const minVal = Math.min(...counts);
    const maxVal = Math.max(...counts);
    const range = maxVal - minVal || 10;
    const yMin = Math.max(0, minVal - range * 0.15);
    const yMax = maxVal + range * 0.15;

    const computedPoints = sortedData.map((item, idx) => {
      const x = paddingX + (idx / (sortedData.length - 1)) * innerW;
      const y = chartHeight - paddingY - ((item.followerCount - yMin) / (yMax - yMin)) * innerH;
      return { x, y, item, idx };
    });

    const lPath = computedPoints.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, "");

    const firstP = computedPoints[0];
    const lastP = computedPoints[computedPoints.length - 1];
    const baselineY = chartHeight - paddingY;
    const aPath = `${lPath} L ${lastP.x} ${baselineY} L ${firstP.x} ${baselineY} Z`;

    return {
      points: computedPoints,
      linePath: lPath,
      areaPath: aPath,
      minFollowers: minVal,
      maxFollowers: maxVal,
    };
  }, [sortedData, hasEnoughData, innerW, innerH, chartHeight, paddingX, paddingY]);

  const hoveredPoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm transition-colors sm:p-6">
      {/* Header section with growth summary chips */}
      <div className="flex flex-col gap-4 border-b border-[var(--app-border-subtle)] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--app-success-soft)] text-[var(--app-success)]">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </span>
            <h2 className="text-base font-bold text-[var(--app-text-primary)]">
              Follower Growth History (30 Days)
            </h2>
            {isTikTokDemoGrowthEnabled() && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/60">
                DEMO MODE
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {accountDisplayName ? `${accountDisplayName} · ` : ""}
            Daily snapshots recorded at Asia/Bangkok calendar boundaries
          </p>
        </div>

        {/* 3 Growth KPI Chips: Today, 7D, 30D */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${todayDelta.chipClass}`}>
            <span className="text-[10px] uppercase tracking-wider opacity-75">Today</span>
            <span className="font-bold">{todayDelta.text}</span>
          </div>

          <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${sevenDayDelta.chipClass}`}>
            <span className="text-[10px] uppercase tracking-wider opacity-75">7 Days</span>
            <span className="font-bold">{sevenDayDelta.text}</span>
          </div>

          <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${thirtyDayDelta.chipClass}`}>
            <span className="text-[10px] uppercase tracking-wider opacity-75">30 Days</span>
            <span className="font-bold">{thirtyDayDelta.text}</span>
          </div>
        </div>
      </div>

      {/* Main Chart Body */}
      <div className="mt-5">
        {!hasEnoughData ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Collecting Daily Snapshots
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
              {sortedData.length === 1
                ? "First daily snapshot recorded. Growth trend and comparison chart will become available after tomorrow's automatic daily collection."
                : "At least 2 daily snapshots are required to display the growth trend line."}
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* SVG Trend Line */}
            <div className="w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="h-48 w-full overflow-visible sm:h-56"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="followerAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Subtle Grid Guidelines */}
                <line
                  x1={paddingX}
                  y1={paddingY}
                  x2={chartWidth - paddingX}
                  y2={paddingY}
                  stroke="currentColor"
                  className="text-slate-100 dark:text-slate-800"
                  strokeDasharray="4 4"
                />
                <line
                  x1={paddingX}
                  y1={chartHeight / 2}
                  x2={chartWidth - paddingX}
                  y2={chartHeight / 2}
                  stroke="currentColor"
                  className="text-slate-100 dark:text-slate-800"
                  strokeDasharray="4 4"
                />
                <line
                  x1={paddingX}
                  y1={chartHeight - paddingY}
                  x2={chartWidth - paddingX}
                  y2={chartHeight - paddingY}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                />

                {/* Shaded Area under curve */}
                <path d={areaPath} fill="url(#followerAreaGrad)" />

                {/* Main Curve Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Interactive Data Points */}
                {points.map((p) => {
                  const isHovered = hoveredIndex === p.idx;
                  return (
                    <g key={p.item.id} className="cursor-pointer">
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 6 : 3.5}
                        fill={isHovered ? "#059669" : "#10b981"}
                        stroke="#ffffff"
                        strokeWidth={isHovered ? 2.5 : 1.5}
                        className="transition-all duration-150"
                        onMouseEnter={() => setHoveredIndex(p.idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Hover Tooltip Overlay */}
            {hoveredPoint && (
              <div
                className="pointer-events-none absolute top-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs shadow-lg backdrop-blur-xs transition-all"
                style={{
                  left: `${Math.min(Math.max(10, (hoveredPoint.x / chartWidth) * 100), 85)}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <p className="font-medium text-[var(--app-text-secondary)]">
                  {formatDateLabel(hoveredPoint.item.metricDate)}
                </p>
                <p className="text-sm font-bold text-[var(--app-text-primary)]">
                  {formatNumber(hoveredPoint.item.followerCount)}{" "}
                  <span className="text-[11px] font-normal text-[var(--app-text-tertiary)]">followers</span>
                </p>
                {hoveredPoint.idx > 0 && points[hoveredPoint.idx - 1] && (
                  <p className="mt-0.5 text-[11px]">
                    {(() => {
                      const delta =
                        hoveredPoint.item.followerCount -
                        points[hoveredPoint.idx - 1].item.followerCount;
                      const dInfo = formatDelta(delta);
                      return <span className={dInfo.className}>{dInfo.text} vs prev day</span>;
                    })()}
                  </p>
                )}
              </div>
            )}

            {/* X-axis Date Markers */}
            <div className="mt-2 flex justify-between px-2 text-[10px] font-medium text-slate-400 dark:text-slate-500">
              <span>{formatDateLabel(sortedData[0]?.metricDate)}</span>
              {sortedData.length > 2 && (
                <span>
                  {formatDateLabel(sortedData[Math.floor(sortedData.length / 2)]?.metricDate)}
                </span>
              )}
              <span>{formatDateLabel(sortedData[sortedData.length - 1]?.metricDate)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
