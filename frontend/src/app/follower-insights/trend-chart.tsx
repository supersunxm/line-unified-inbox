"use client";

import { useRef, useState } from "react";
import type { SummaryDailyRow } from "@/types/api";
import { getFollowerInsightsText, type Language } from "./follower-insights-translations";
import { formatDateDisplay } from "./follower-insights-utils";

interface TrendChartProps {
  data: SummaryDailyRow[];
  metric: "followers" | "targetedReaches" | "blocks";
  language?: Language;
  onMetricChange: (metric: "followers" | "targetedReaches" | "blocks") => void;
}

export function TrendChart({ data, metric, language = "en", onMetricChange }: TrendChartProps) {
  const t = getFollowerInsightsText(language);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-[var(--muted)]">
        {t.noChartData}
      </div>
    );
  }

  const validVals = data.map((d) => d[metric]).filter((v): v is number => v !== null && v !== undefined);
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{t.trendAnalysis}</h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {t.trendSubheader}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Chart Legend */}
          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
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

      {/* SVG Canvas Container */}
      <div className="relative h-72 w-full" ref={containerRef}>
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
                  className="transition-all duration-150 cursor-pointer"
                />
                {/* Hover Trigger Zone */}
                <rect
                  x={cx - (chartW / data.length) / 2}
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

        {/* Floating Tooltip Overlay */}
        {hoverIdx !== null && data[hoverIdx] && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-3 shadow-xl text-xs transition-all duration-75"
            style={{
              left: `${Math.min(85, Math.max(15, (hoverIdx / Math.max(1, data.length - 1)) * 100))}%`,
              top: "10px",
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-bold text-[var(--foreground)]">{formatDateDisplay(data[hoverIdx].date, language)}</p>
            <div className="mt-1 flex items-center justify-between gap-4">
              <span className="text-[var(--muted)]">{metricLabel}:</span>
              <span className="font-semibold text-[var(--foreground)]">
                {data[hoverIdx][metric]?.toLocaleString() ?? t.noData}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-[var(--muted)] border-t border-[var(--border)] pt-1 flex justify-between gap-3">
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
