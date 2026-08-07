"use client";

import React from "react";
import type { NetworkHealthGaugeProps } from "./dashboard-transformers";

interface CircularHealthGaugeProps {
  gauge: NetworkHealthGaugeProps;
  title?: string;
}

export function CircularHealthGauge({
  gauge,
  title = "Network Operations Health Score",
}: CircularHealthGaugeProps) {
  const {
    compositeScore,
    statusLabel,
    statusBadgeClass,
    pendingCount,
    slaRatePct,
    storesAtRiskCount,
    avgResponseMinutes,
    totalMessagesToday,
    messagesDiffPct,
    responseRateDiffYesterday,
  } = gauge;

  // Hero Gauge SVG calculations
  const size = 160;
  const strokeWidth = 14;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (240 / 360) * circumference;
  const strokeDashoffset = arcLength - (compositeScore / 100) * arcLength;

  const gaugeColor =
    compositeScore < 60 ? "#f43f5e" : compositeScore < 80 ? "#f59e0b" : "#10b981";

  const responseDiffSymbol = responseRateDiffYesterday >= 0 ? "↑ +" : "↓ ";
  const responseDiffColor =
    responseRateDiffYesterday >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";

  return (
    <div
      data-network-health-hero-banner
      className="rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-[var(--surface)] to-[var(--surface)] p-6 text-[var(--foreground)] shadow-md space-y-6"
    >
      {/* Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-xs font-black rounded-lg bg-blue-600 text-white uppercase tracking-wider">
              EXECUTIVE HERO GAUGE
            </span>
            <h2 className="text-lg font-black tracking-tight text-[var(--foreground)]">
              🛡️ {title}
            </h2>
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)] font-medium">
            Weighted Network Index: 50% Response SLA + 30% Pending Risk + 15% Escalation Control + 5% Growth
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-black uppercase tracking-wider ${statusBadgeClass}`}
          >
            <span>{compositeScore >= 80 ? "🟢" : compositeScore >= 60 ? "🟡" : "🔴"}</span>
            <span>{statusLabel}</span>
          </span>
        </div>
      </div>

      {/* Hero Layout: Dominant Gauge Left + Executive Benchmarks Right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Dominant Hero Gauge */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--background)] border border-[var(--border)] relative shadow-inner">
          <svg width={size} height={size} className="transform -rotate-120 overflow-visible">
            {/* Track Arc */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="var(--border)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />
            {/* Value Arc */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke={gaugeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-4xl font-black tracking-tighter text-[var(--foreground)]">
              {compositeScore}
            </span>
            <span className="text-xs font-extrabold text-[var(--muted-foreground)] uppercase tracking-widest mt-0.5">
              / 100 Health
            </span>
          </div>

          <div className="mt-2 text-[11px] font-bold text-[var(--muted-foreground)] flex items-center gap-1">
            <span>vs Yesterday:</span>
            <span className={responseDiffColor}>
              {responseDiffSymbol}{Math.abs(Math.round(responseRateDiffYesterday * 100))}%
            </span>
          </div>
        </div>

        {/* Executive Benchmarks Snapshot */}
        <div className="md:col-span-7 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* 1. Today Volume & Trend */}
            <div className="bg-[var(--background)] p-3 rounded-xl border border-[var(--border)] space-y-1">
              <div className="text-[10px] text-[var(--muted-foreground)] font-extrabold uppercase tracking-wider">
                Messages Today
              </div>
              <div className="text-xl font-black text-[var(--foreground)]">
                {totalMessagesToday.toLocaleString()}
              </div>
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {messagesDiffPct >= 0 ? "↑ +" : "↓ "}{Math.abs(messagesDiffPct)}% vs yesterday
              </div>
            </div>

            {/* 2. SLA Achievement & Target Benchmark */}
            <div className="bg-[var(--background)] p-3 rounded-xl border border-[var(--border)] space-y-1">
              <div className="text-[10px] text-[var(--muted-foreground)] font-extrabold uppercase tracking-wider">
                SLA Achievement
              </div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {slaRatePct}%
              </div>
              <div className="text-[11px] font-semibold text-[var(--muted-foreground)]">
                Target Benchmark: &gt;95%
              </div>
            </div>

            {/* 3. Pending Queue Risk */}
            <div className="bg-[var(--background)] p-3 rounded-xl border border-[var(--border)] space-y-1">
              <div className="text-[10px] text-[var(--muted-foreground)] font-extrabold uppercase tracking-wider">
                Pending Queue
              </div>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                {pendingCount} msgs
              </div>
              <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                {pendingCount > 15 ? "🔴 Action Needed" : "🟢 Controlled"}
              </div>
            </div>

            {/* 4. Store Risk Indicator */}
            <div className="bg-[var(--background)] p-3 rounded-xl border border-[var(--border)] space-y-1">
              <div className="text-[10px] text-[var(--muted-foreground)] font-extrabold uppercase tracking-wider">
                Stores At Risk
              </div>
              <div className="text-xl font-black text-rose-600 dark:text-rose-400">
                {storesAtRiskCount} Stores
              </div>
              <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                Avg Speed: {avgResponseMinutes}m
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
