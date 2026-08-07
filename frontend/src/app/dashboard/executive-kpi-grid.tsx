"use client";

import React from "react";
import type { KpiCardProp } from "./dashboard-transformers";

interface ExecutiveKpiGridProps {
  cards: KpiCardProp[];
}

export function ExecutiveKpiGrid({ cards }: ExecutiveKpiGridProps) {
  if (!cards || cards.length === 0) return null;

  return (
    <section aria-label="Executive KPI Overview" className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {cards.map((card) => {
          const isCritical = card.statusBadge?.variant === "critical";
          const isWarning = card.statusBadge?.variant === "warning";
          const isPurple = card.statusBadge?.variant === "purple";
          const isSuccess = card.statusBadge?.variant === "success";
          const isMessagesCard = card.id === "messages-today";

          const badgeClasses = isCritical
            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
            : isWarning
            ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
            : isPurple
            ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
            : isSuccess
            ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30"
            : "bg-[var(--accent)] text-[var(--muted-foreground)] border-[var(--border)]";

          return (
            <div
              key={card.id}
              className={`rounded-2xl border bg-[var(--surface)] p-4 shadow-sm flex flex-col justify-between space-y-3 transition-all ${
                isMessagesCard
                  ? "border-blue-500/40 bg-gradient-to-br from-blue-500/5 via-[var(--surface)] to-[var(--surface)] shadow-md"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] truncate">
                  {card.title}
                </span>
                {card.statusBadge && (
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold shrink-0 ${badgeClasses}`}>
                    {card.statusBadge.label}
                  </span>
                )}
              </div>

              <div>
                <div className={`font-black tracking-tight text-[var(--foreground)] ${isMessagesCard ? "text-3xl text-blue-600 dark:text-blue-400" : "text-2xl"}`}>
                  {card.value}
                </div>

                {card.trendText && (
                  <div
                    className={`mt-1 text-xs font-semibold flex items-center gap-1 ${
                      card.trendPositive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    <span>{card.trendText}</span>
                  </div>
                )}

                {card.targetText && (
                  <div className="mt-1 text-xs font-semibold text-[var(--muted-foreground)]">
                    {card.targetText}
                  </div>
                )}

                {card.subtext && (
                  <div className="mt-1 text-[11px] text-[var(--muted-foreground)] truncate">
                    {card.subtext}
                  </div>
                )}
              </div>

              {/* Sparkline visualization */}
              {card.sparklineData && card.sparklineData.length > 1 && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <MiniSparkline data={card.sparklineData} positive={card.trendPositive ?? true} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 120;
  const height = 24;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  const strokeColor = positive ? "#10b981" : "#f43f5e";

  return (
    <div className="w-full flex items-center justify-between">
      <span className="text-[10px] text-[var(--muted-foreground)] font-semibold">7-Day Momentum</span>
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
}
