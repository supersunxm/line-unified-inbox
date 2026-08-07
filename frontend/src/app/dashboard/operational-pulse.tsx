"use client";

import React from "react";
import type { OperationalPulseProps } from "./dashboard-transformers";

interface OperationalPulseComponentProps {
  pulse: OperationalPulseProps;
}

export function OperationalPulse({ pulse }: OperationalPulseComponentProps) {
  const {
    messagesToday,
    messagesDiffPct,
    activeStores,
    totalStores,
    slaAchievementRate,
    avgResponseMinutes,
    aiAlertCount,
  } = pulse;

  const diffSymbol = messagesDiffPct >= 0 ? "↑ +" : "↓ ";

  return (
    <section
      data-kpi-monitoring-strip
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--foreground)] shadow-xs"
    >
      {/* Enterprise Monitoring Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
        {/* Label Header */}
        <div className="flex items-center gap-2 pr-4 border-r border-[var(--border)]">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-extrabold uppercase tracking-wider text-[var(--foreground)] text-[11px]">
            KPI TELEMETRY MONITOR
          </span>
        </div>

        {/* Telemetry Metric 1: Messages Today */}
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted-foreground)]">Messages Today:</span>
          <strong className="text-[var(--foreground)]">{messagesToday.toLocaleString()}</strong>
          <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {diffSymbol}{Math.abs(messagesDiffPct)}% vs yesterday
          </span>
        </div>

        <span className="text-[var(--border)] font-normal">|</span>

        {/* Telemetry Metric 2: Active Stores */}
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted-foreground)]">Active Stores:</span>
          <strong className="text-[var(--foreground)]">{activeStores}/{totalStores}</strong>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            (100% Online)
          </span>
        </div>

        <span className="text-[var(--border)] font-normal">|</span>

        {/* Telemetry Metric 3: SLA Achievement */}
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted-foreground)]">SLA Rate:</span>
          <strong className={slaAchievementRate >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
            {slaAchievementRate}%
          </strong>
          <span className="text-[10px] text-[var(--muted-foreground)]">(Target &gt;95%)</span>
        </div>

        <span className="text-[var(--border)] font-normal">|</span>

        {/* Telemetry Metric 4: Avg Speed */}
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted-foreground)]">Avg Speed:</span>
          <strong className="text-blue-600 dark:text-blue-400">{avgResponseMinutes}m</strong>
        </div>

        <span className="text-[var(--border)] font-normal">|</span>

        {/* Telemetry Metric 5: AI Alert Count */}
        <div className="flex items-center gap-2">
          <span className="text-rose-600 dark:text-rose-400 font-extrabold">AI Alerts:</span>
          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 font-black text-[11px] border border-rose-500/30">
            {aiAlertCount} Priority
          </span>
        </div>
      </div>
    </section>
  );
}
