"use client";

import React from "react";

export interface SlaSlice {
  label: string;
  count: number;
  color: string;       // Tailwind bg color for legend
  strokeColor: string; // SVG stroke color
}

interface SlaDonutProps {
  slices: SlaSlice[];
  total: number;
  criticalCount: number; // stores with >2h wait
  criticalLabel: string;
  isLoading?: boolean;
}

const STROKE_WIDTH = 18;
const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP_DEG = 2; // degrees gap between segments

export function SlaDonut({ slices, total, criticalCount, criticalLabel, isLoading = false }: SlaDonutProps) {
  if (isLoading) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-3 animate-pulse">
        <div className="h-32 w-32 rounded-full border-4 border-dashed border-[var(--border)]" />
        <div className="h-3 w-24 rounded bg-[var(--hover)]" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-[var(--muted)]">
        No waiting customers right now
      </div>
    );
  }

  const nonZero = slices.filter((s) => s.count > 0);
  const GAP_FRAC = GAP_DEG / 360;
  const totalGap = GAP_FRAC * nonZero.length;
  const usableFrac = 1 - totalGap;

  type Segment = (typeof nonZero)[0] & { dash: number; gap: number; rotate: number };
  const segments = nonZero.reduce<Segment[]>((acc, slice) => {
    const prevOffset = acc.length === 0 ? 0 : acc.reduce((sum, s) => sum + s.dash / CIRCUMFERENCE + GAP_FRAC, 0);
    const frac = (slice.count / total) * usableFrac;
    const dash = frac * CIRCUMFERENCE;
    const gap = CIRCUMFERENCE - dash;
    const rotate = prevOffset * 360 - 90;
    return [...acc, { ...slice, dash, gap, rotate }];
  }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Donut */}
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 140 140" className="overflow-visible">
          {/* Background ring */}
          <circle
            cx="70" cy="70" r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={STROKE_WIDTH}
          />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="70"
              cy="70"
              r={RADIUS}
              fill="none"
              stroke={seg.strokeColor}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeLinecap="round"
              style={{ transform: `rotate(${seg.rotate}deg)`, transformOrigin: "70px 70px", transition: "stroke-dasharray 0.6s ease" }}
            />
          ))}
          {/* Center label */}
          <text x="70" y="62" textAnchor="middle" className="fill-[var(--foreground)]" fontSize="22" fontWeight="700">
            {total}
          </text>
          <text x="70" y="78" textAnchor="middle" className="fill-[var(--muted)]" fontSize="8" fontWeight="600" letterSpacing="0.05em">
            WAITING STORES
          </text>
        </svg>

        {/* Critical pulse ring if any critical stores */}
        {criticalCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-50" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-red-500" />
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="w-full space-y-2">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${slice.color}`} />
              <span className="text-[var(--foreground)] font-medium">{slice.label}</span>
            </div>
            <span className="font-semibold tabular-nums text-[var(--foreground)]">{slice.count}</span>
          </div>
        ))}
      </div>

      {/* Critical callout */}
      {criticalCount > 0 && (
        <div className="w-full rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-red-400">
            🔥 {criticalCount} {criticalLabel}
          </p>
        </div>
      )}
    </div>
  );
}

