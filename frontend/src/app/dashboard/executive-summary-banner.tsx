"use client";

import React from "react";
import type { ExecutiveDecisionHeaderProps } from "./dashboard-transformers";

interface ExecutiveSummaryBannerComponentProps {
  header: ExecutiveDecisionHeaderProps;
}

export function ExecutiveSummaryBanner({ header }: ExecutiveSummaryBannerComponentProps) {
  const {
    networkStatusKey,
    networkStatusLabel,
    healthScore,
    operationalSituation,
    executivePriority,
    lastUpdated,
    executiveFocusList = [],
  } = header;

  const statusBadgeBg =
    networkStatusKey === "CRITICAL"
      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
      : networkStatusKey === "WARNING"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

  const statusIcon = networkStatusKey === "CRITICAL" ? "🔴" : networkStatusKey === "WARNING" ? "🟡" : "🟢";

  return (
    <header
      data-executive-decision-header
      className="rounded-2xl border-2 border-slate-700/50 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 text-white shadow-xl space-y-5"
    >
      {/* Top Bar: Title & Data Freshness Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-[10px] font-black rounded-lg bg-emerald-500 text-slate-950 uppercase tracking-widest">
            EXECUTIVE CONTROL
          </span>
          <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
            <span>🛡️</span>
            <span>OPPO Network Executive Operations Header</span>
          </h2>
        </div>

        {/* Data Freshness Indicator */}
        <div className="flex items-center gap-3 text-xs bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700">
          <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Sync: {lastUpdated}</span>
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300 font-semibold">Coverage: 100% (10 Stores)</span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-black uppercase ${statusBadgeBg}`}>
            <span>{statusIcon}</span>
            <span>{networkStatusLabel} ({healthScore}/100)</span>
          </span>
        </div>
      </div>

      {/* Main 2-Column Layout: Left (Network Situation & Priority) + Right (Today's Executive Focus Top 3 Actions) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Network Situation & Executive Priority */}
        <div className="md:col-span-5 space-y-3 flex flex-col justify-between">
          <div className="bg-slate-850/90 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <span>📊</span> Network Situation
            </div>
            <p className="text-xs font-bold text-slate-200 leading-relaxed">
              {operationalSituation}
            </p>
          </div>

          <div className="bg-slate-850/90 p-4 rounded-xl border border-rose-500/40 bg-rose-500/5 space-y-1.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
              <span>🚨</span> Executive Priority
            </div>
            <p className="text-xs font-black text-rose-200 leading-snug">
              {executivePriority}
            </p>
          </div>
        </div>

        {/* Right Column: Today's Executive Focus (Top 3 Recommended Actions) */}
        <div className="md:col-span-7 bg-slate-850/90 p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="text-[11px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
              <span>💡</span> Today&apos;s Executive Focus (Top 3 Recommended Actions)
            </div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase">
              Action Plan
            </span>
          </div>

          <div className="space-y-2 text-xs font-bold text-slate-100">
            {executiveFocusList.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2.5 text-slate-200"
              >
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="leading-snug">{item.replace(/^\d+\.\s*/, "")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
