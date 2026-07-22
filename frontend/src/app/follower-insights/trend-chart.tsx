"use client";

import { useRef, useState } from "react";
import type { SummaryDailyRow } from "@/types/api";

interface TrendChartProps {
  data: SummaryDailyRow[];
  metric: "followers" | "targetedReaches" | "blocks";
  onMetricChange: (metric: "followers" | "targetedReaches" | "blocks") => void;
}

export function TrendChart({ data, metric, onMetricChange }: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-[var(--muted)]">
        No chart data available for the selected period
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
    metric === "followers" ? "Followers" : metric === "targetedReaches" ? "Targeted Reach" : "Blocks";

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
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Trend Analysis</h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Historical metrics preserving all calendar dates (gaps indicate unpopulated dates)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Chart Legend */}
          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: metricColor }}></span>
              Available data
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-dashed border-[var(--border)]"></span>
              No data
            </span>
          </div>

          {/* Metric Selector */}
          <div className="flex items-center rounded-xl bg-[var(--input-background)] border border-[var(--border)] p-1">
            <button
              type="button"
              onClick={() => onMetricChange("followers")}
              aria-label="View Followers metric"
              aria-pressed={metric === "followers"}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                metric === "followers"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
              }`}
            >
              Followers
            </button>
            <button
              type="button"
              onClick={() => onMetricChange("targetedReaches")}
              aria-label="View Targeted Reach metric"
              aria-pressed={metric === "targetedReaches"}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                metric === "targetedReaches"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
              }`}
            >
              Targeted Reach
            </button>
            <button
              type="button"
              onClick={() => onMetricChange("blocks")}
              aria-label="View Blocks metric"
              aria-pressed={metric === "blocks"}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                metric === "blocks"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
              }`}
            >
              Blocks
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
            const y = paddingY + pct * chartH;
            const val = Math.round(yMax - pct * (yMax - yMin));
            return (
              <g key={pct} className="opacity-40">
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="currentColor" strokeDasharray="4 4" />
                <text x={paddingX - 10} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor">
                  {val >= 1000 ? (val / 1000).toFixed(1) + "k" : val}
                </text>
              </g>
            );
          })}

          {/* X-axis Date Labels */}
          {data.map((d, i) => {
            if (data.length > 14 && i % Math.ceil(data.length / 7) !== 0 && i !== data.length - 1) return null;
            const x = getX(i);
            return (
              <text key={i} x={x} y={height - 5} textAnchor="middle" fontSize="10" fill="currentColor">
                {d.date.slice(5)}
              </text>
            );
          })}

          {/* Solid line path segments for valid data */}
          {pathSegments.map((dStr, i) => (
            <path
              key={i}
              d={dStr}
              fill="none"
              stroke={metricColor}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Data point markers for valid values */}
          {data.map((d, i) => {
            const val = d[metric];
            if (val === null || val === undefined) return null;
            const x = getX(i);
            const y = getY(val)!;
            return <circle key={i} cx={x} cy={y} r="3.5" fill={metricColor} stroke="var(--surface)" strokeWidth="2" />;
          })}

          {/* Invisible interactive hover hit areas */}
          {data.map((d, i) => {
            const x = getX(i);
            return (
              <rect
                key={i}
                x={x - chartW / Math.max(1, data.length) / 2}
                y={paddingY}
                width={chartW / Math.max(1, data.length)}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            );
          })}

          {/* Hover guideline indicator */}
          {hoverIdx !== null && (
            <g>
              <line
                x1={getX(hoverIdx)}
                y1={paddingY}
                x2={getX(hoverIdx)}
                y2={height - paddingY}
                stroke="currentColor"
                className="opacity-60"
                strokeDasharray="4 4"
              />
              {data[hoverIdx][metric] !== null && data[hoverIdx][metric] !== undefined && (
                <circle
                  cx={getX(hoverIdx)}
                  cy={getY(data[hoverIdx][metric] as number)!}
                  r="5"
                  fill={metricColor}
                  stroke="white"
                  strokeWidth="2.5"
                />
              )}
            </g>
          )}
        </svg>

        {/* Hover Tooltip */}
        {hoverIdx !== null && (
          <div
            className="absolute pointer-events-none rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-xs shadow-xl backdrop-blur-sm text-[var(--foreground)]"
            style={{
              left: `${((getX(hoverIdx) - paddingX + 20) / chartW) * 100}%`,
              top: "10px",
              transform: getX(hoverIdx) > width / 2 ? "translateX(-100%) translateX(-40px)" : "none",
              zIndex: 10,
            }}
          >
            <p className="mb-2 font-bold text-[var(--foreground)] border-b border-[var(--border)] pb-1">{data[hoverIdx].date}</p>
            <div className="space-y-1">
              <p className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: metricColor }}></span> {metricLabel}
                </span>
                <span className="font-bold text-[var(--foreground)]">
                  {data[hoverIdx][metric]?.toLocaleString() ?? "No data"}
                </span>
              </p>
              <p className="text-[10px] text-[var(--muted)]">
                Accounts Ready: {data[hoverIdx].accountsReady} / {data[hoverIdx].accountsExpected}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
