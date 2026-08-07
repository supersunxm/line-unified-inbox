"use client";

import React, { useState } from "react";
import type { StoreScatterPoint } from "./dashboard-transformers";

interface StoreRiskScatterMatrixProps {
  points: StoreScatterPoint[];
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  onSelectStoreQuickView: (storeId: string) => void;
  onNotifyBm?: (storeId: string, storeName: string) => void;
  title?: string;
  subtitle?: string;
}

export function StoreRiskScatterMatrix({
  points,
  getStoreDisplayName,
  onOpenStore,
  onSelectStoreQuickView,
  onNotifyBm,
  title = "Risk Control Center: Action Queue & Pattern Scatter Analysis",
  subtitle = "Left: Critical Intervention Ranking (Action) | Right: Risk Scatter Canvas (Pattern Analysis)",
}: StoreRiskScatterMatrixProps) {
  const [hoveredPoint, setHoveredPoint] = useState<StoreScatterPoint | null>(null);
  const [notifiedStoreIds, setNotifiedStoreIds] = useState<Set<string>>(new Set());

  if (!points || points.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center text-xs text-[var(--muted-foreground)]">
        No store performance data available for Risk Control Center.
      </div>
    );
  }

  const maxVolume = Math.max(10, ...points.map((p) => p.volume));
  const criticalPoints = points
    .filter((p) => p.quadrant === "CRITICAL" || p.severity === "CRITICAL" || p.severity === "HIGH")
    .sort((a, b) => (b.pendingCount - a.pendingCount) || (a.slaRatePct - b.slaRatePct));

  const handleNotifyBmInternal = (storeId: string, storeName: string) => {
    if (onNotifyBm) {
      onNotifyBm(storeId, storeName);
    }
    setNotifiedStoreIds((prev) => new Set(prev).add(storeId));
  };

  return (
    <div
      data-risk-control-center
      className="rounded-2xl border-2 border-rose-500/30 bg-[var(--surface)] p-5 text-[var(--foreground)] shadow-md space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-rose-600 text-white uppercase tracking-wider">
              RISK CONTROL CENTER
            </span>
            <h2 className="text-base font-extrabold tracking-tight text-[var(--foreground)]">
              🎯 {title}
            </h2>
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)] font-medium">
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-black border border-rose-500/40">
            🚨 {criticalPoints.length} Critical Stores Queue
          </span>
        </div>
      </div>

      {/* Coexisting Main View: Left (Critical Intervention Ranking for Action) + Right (Scatter Canvas for Pattern Analysis) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (lg:col-span-6): Ranked Critical Intervention List (ACTION) */}
        <div className="lg:col-span-6 rounded-xl border border-rose-500/40 bg-[var(--background)] p-4 space-y-3 h-[380px] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <span>📋</span>
              <span>1. Critical Store Action Queue ({criticalPoints.length})</span>
            </h3>
            <span className="text-[10px] font-extrabold text-[var(--muted-foreground)] uppercase">
              Action Required
            </span>
          </div>

          {criticalPoints.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--muted-foreground)]">
              ✨ No critical intervention stores detected. Network response rates meet SLA standards.
            </div>
          ) : (
            <div className="space-y-3">
              {criticalPoints.map((item, idx) => {
                const isNotified = notifiedStoreIds.has(item.storeId);
                const severityBadge = item.severity === "CRITICAL"
                  ? "bg-rose-600 text-white"
                  : "bg-amber-500 text-white";

                return (
                  <div
                    key={item.storeId}
                    className="p-3.5 rounded-xl border-2 border-rose-200 dark:border-rose-900/60 bg-[var(--surface)] space-y-2 text-xs shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-extrabold text-[var(--foreground)] truncate flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="truncate">🏬 {getStoreDisplayName(item.storeName)}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${severityBadge}`}>
                          {item.severity || "HIGH"}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] font-black border border-rose-500/30">
                          SLA {item.slaRatePct}%
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">
                          <span>⏱️</span>
                          <span>Age: {item.problemAge || "1h 30m"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-[var(--muted-foreground)] space-y-1 bg-[var(--background)] p-2.5 rounded-lg border border-[var(--border)]">
                      <div><strong className="text-rose-600 dark:text-rose-400">Root Cause:</strong> {item.problem || `${item.pendingCount} pending messages`}</div>
                      <div><strong className="text-amber-600 dark:text-amber-400">Impact:</strong> {item.businessImpact}</div>
                      <div><strong className="text-blue-600 dark:text-blue-400">Action:</strong> {item.recommendedAction}</div>
                    </div>

                    {/* Quick Escalation Buttons */}
                    <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleNotifyBmInternal(item.storeId, item.storeName)}
                        disabled={isNotified}
                        className={`px-3 py-1 rounded-lg font-bold border transition-colors flex items-center gap-1 ${
                          isNotified
                            ? "bg-[var(--accent)] text-[var(--muted-foreground)] border-[var(--border)] opacity-60 cursor-not-allowed"
                            : "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
                        }`}
                      >
                        <span>📣</span>
                        <span>{isNotified ? "Notified" : "Notify BM"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenStore(item.storeId)}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors flex items-center gap-1"
                      >
                        <span>💬</span>
                        <span>Open Chat</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectStoreQuickView(item.storeId)}
                        className="px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--accent)] text-[var(--foreground)] font-bold transition-colors flex items-center gap-1"
                      >
                        <span>🏬</span>
                        <span>View Store</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (lg:col-span-6): 4-Quadrant Scatter Canvas (PATTERN ANALYSIS) */}
        <div className="lg:col-span-6 relative w-full h-[380px] rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 overflow-hidden shadow-inner">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--foreground)] flex items-center gap-1.5">
              <span>📊</span>
              <span>2. Risk Scatter Matrix (Pattern Analysis)</span>
            </h3>
            <span className="text-[10px] font-extrabold text-[var(--muted-foreground)] uppercase">
              X=Volume | Y=SLA%
            </span>
          </div>

          {/* Quadrant Overlays */}
          <div className="absolute inset-x-4 top-12 bottom-4 grid grid-cols-2 grid-rows-2 pointer-events-none">
            <div className="border-r border-b border-[var(--border)]/60 bg-emerald-500/5 p-2 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Q1: Healthy (Low Vol/High SLA)
            </div>

            <div className="border-b border-[var(--border)]/60 bg-blue-500/5 p-2 text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400 text-right">
              Q2: Leaders (High Vol/High SLA)
            </div>

            <div className="border-r border-[var(--border)]/60 bg-amber-500/5 p-2 flex items-end text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Q3: Low Priority (Low Vol/Low SLA)
            </div>

            <div className="bg-rose-500/10 p-2 flex items-end justify-end text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
              ⚠️ Q4: Critical Intervention
            </div>
          </div>

          {/* Scatter Points */}
          <div className="relative w-full h-[300px]">
            {points.map((pt) => {
              const leftPct = 5 + (pt.volume / maxVolume) * 85;
              const bottomPct = 5 + (pt.slaRatePct / 100) * 85;
              const sizePx = Math.min(32, Math.max(16, 16 + pt.pendingCount * 2.5));

              const isCritical = pt.quadrant === "CRITICAL" || pt.severity === "CRITICAL";
              const isLeader = pt.quadrant === "LEADERS";

              const bubbleBg = isCritical
                ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/50"
                : isLeader
                ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/50"
                : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/50";

              return (
                <React.Fragment key={pt.storeId}>
                  <button
                    type="button"
                    onClick={() => onSelectStoreQuickView(pt.storeId)}
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    style={{
                      left: `${leftPct}%`,
                      bottom: `${bottomPct}%`,
                      width: `${sizePx}px`,
                      height: `${sizePx}px`,
                    }}
                    className={`absolute transform -translate-x-1/2 translate-y-1/2 rounded-full font-extrabold text-[10px] flex items-center justify-center shadow-md transition-all hover:scale-125 focus:outline-none focus:ring-2 focus:ring-blue-500 ${bubbleBg} ${
                      isCritical ? "animate-pulse border-2 border-white dark:border-slate-900" : ""
                    }`}
                    title={`${getStoreDisplayName(pt.storeName)} (SLA: ${pt.slaRatePct}%, Volume: ${pt.volume})`}
                  >
                    {pt.pendingCount > 0 ? pt.pendingCount : "•"}
                  </button>

                  {isCritical && (
                    <div
                      style={{
                        left: `${leftPct}%`,
                        bottom: `${bottomPct + 6}%`,
                      }}
                      className="absolute transform -translate-x-1/2 text-[10px] font-black text-rose-700 dark:text-rose-300 bg-[var(--surface)]/95 px-1.5 py-0.5 rounded border border-rose-500/40 whitespace-nowrap pointer-events-none shadow-xs z-10"
                    >
                      {getStoreDisplayName(pt.storeName)}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Hover Tooltip Overlay */}
          {hoveredPoint && (
            <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-[var(--surface)] border-2 border-blue-500/40 shadow-2xl p-3 rounded-xl text-xs space-y-1.5 z-30 pointer-events-none max-w-xs">
              <div className="font-extrabold text-[var(--foreground)] text-sm flex items-center gap-1.5">
                <span>🏬</span>
                <span>{getStoreDisplayName(hoveredPoint.storeName)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--muted-foreground)]">
                <div>SLA Rate: <strong className={hoveredPoint.slaRatePct >= 80 ? "text-emerald-600" : "text-rose-600"}>{hoveredPoint.slaRatePct}%</strong></div>
                <div>Volume: <strong>{hoveredPoint.volume} msgs</strong></div>
                <div>Pending: <strong className="text-amber-600">{hoveredPoint.pendingCount}</strong></div>
                <div>Severity: <strong className="text-rose-600">{hoveredPoint.severity || "HIGH"}</strong></div>
              </div>
              {hoveredPoint.businessImpact && (
                <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  💥 Impact: {hoveredPoint.businessImpact}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
