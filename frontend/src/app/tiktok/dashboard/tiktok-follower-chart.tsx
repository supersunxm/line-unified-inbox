"use client";

import { useMemo, useState } from "react";
import { useAppLanguage } from "../../language";
import { getTikTokLocale } from "../tiktok-overview-translations";
import type { TikTokDailyMetricItem, TikTokGrowthSummary } from "../tiktok-types";
import { getTikTokDashboardText } from "./tiktok-dashboard-translations";
import { isTikTokDemoGrowthEnabled } from "./tiktok-demo-growth";

interface TikTokFollowerChartProps {
  history: TikTokDailyMetricItem[];
  summary: TikTokGrowthSummary;
  accountDisplayName?: string;
}

function formatNumber(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat(locale).format(value);
}

function formatDelta(value: number | null | undefined, locale: string): {
  text: string;
  className: string;
  chipClass: string;
} {
  if (value === null || value === undefined) {
    return {
      text: "--",
      className: "font-medium text-slate-400 dark:text-slate-500",
      chipClass: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    };
  }
  const formatted = new Intl.NumberFormat(locale).format(value);
  if (value > 0) {
    return {
      text: `+${formatted}`,
      className: "font-semibold text-emerald-600 dark:text-emerald-400",
      chipClass: "border border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300",
    };
  }
  if (value < 0) {
    return {
      text: formatted,
      className: "font-semibold text-rose-600 dark:text-rose-400",
      chipClass: "border border-rose-200/60 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/60 dark:text-rose-300",
    };
  }
  return {
    text: "0",
    className: "font-medium text-slate-500 dark:text-slate-400",
    chipClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
}

function formatDateLabel(dateStr: string, locale: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function TikTokFollowerGrowthChart({ history, summary, accountDisplayName }: TikTokFollowerChartProps) {
  const { language } = useAppLanguage();
  const t = getTikTokDashboardText(language);
  const locale = getTikTokLocale(language);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const todayDelta = formatDelta(summary.dailyFollowerGrowth, locale);
  const sevenDayDelta = formatDelta(summary.sevenDayFollowerGrowth, locale);
  const thirtyDayDelta = formatDelta(summary.thirtyDayFollowerGrowth, locale);

  const sortedData = useMemo(() => [...history].sort((a, b) => a.metricDate.localeCompare(b.metricDate)), [history]);
  const hasEnoughData = sortedData.length >= 2;
  const chartWidth = 800;
  const chartHeight = 220;
  const paddingX = 40;
  const paddingY = 24;
  const innerW = chartWidth - paddingX * 2;
  const innerH = chartHeight - paddingY * 2;

  const { points, linePath, areaPath } = useMemo(() => {
    if (!hasEnoughData) return { points: [] as Array<{ x: number; y: number; item: TikTokDailyMetricItem; idx: number }>, linePath: "", areaPath: "" };
    const counts = sortedData.map((item) => item.followerCount);
    const minValue = Math.min(...counts);
    const maxValue = Math.max(...counts);
    const range = maxValue - minValue || 10;
    const yMin = Math.max(0, minValue - range * 0.15);
    const yMax = maxValue + range * 0.15;
    const computedPoints = sortedData.map((item, idx) => ({
      x: paddingX + (idx / (sortedData.length - 1)) * innerW,
      y: chartHeight - paddingY - ((item.followerCount - yMin) / (yMax - yMin)) * innerH,
      item,
      idx,
    }));
    const line = computedPoints.reduce((path, point, index) => index === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`, "");
    const firstPoint = computedPoints[0];
    const lastPoint = computedPoints[computedPoints.length - 1];
    const baselineY = chartHeight - paddingY;
    return {
      points: computedPoints,
      linePath: line,
      areaPath: `${line} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`,
    };
  }, [chartHeight, hasEnoughData, innerH, innerW, paddingX, paddingY, sortedData]);

  const hoveredPoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm transition-colors sm:p-6">
      <div className="flex flex-col gap-4 border-b border-[var(--app-border-subtle)] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--app-success-soft)] text-[var(--app-success)]"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg></span>
            <h2 className="text-base font-bold text-[var(--app-text-primary)]">{t.followerGrowthHistory}</h2>
            {isTikTokDemoGrowthEnabled() && <span className="rounded-full border border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/70 dark:text-amber-300">{t.demoMode}</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{accountDisplayName ? `${accountDisplayName} · ` : ""}{t.dailySnapshotsDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {[[t.today, todayDelta], [t.sevenDays, sevenDayDelta], [t.thirtyDays, thirtyDayDelta]].map(([label, value]) => {
            const item = value as ReturnType<typeof formatDelta>;
            return <div key={String(label)} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${item.chipClass}`}><span className="text-[10px] uppercase tracking-wider opacity-75">{String(label)}</span><span className="font-bold">{item.text}</span></div>;
          })}
        </div>
      </div>

      <div className="mt-5">
        {!hasEnoughData ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg></div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{t.collectingSnapshots}</h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">{sortedData.length === 1 ? t.firstSnapshotDescription : t.twoSnapshotsDescription}</p>
          </div>
        ) : (
          <div className="relative">
            <div className="w-full overflow-hidden">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-48 w-full overflow-visible sm:h-56" preserveAspectRatio="none">
                <defs><linearGradient id="followerAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity="0.25" /><stop offset="100%" stopColor="#10b981" stopOpacity="0" /></linearGradient></defs>
                <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="4 4" />
                <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="4 4" />
                <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                <path d={areaPath} fill="url(#followerAreaGrad)" />
                <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((point) => {
                  const isHovered = hoveredIndex === point.idx;
                  return <g key={point.item.id} className="cursor-pointer"><circle cx={point.x} cy={point.y} r={isHovered ? 6 : 3.5} fill={isHovered ? "#059669" : "#10b981"} stroke="#ffffff" strokeWidth={isHovered ? 2.5 : 1.5} className="transition-all duration-150" onMouseEnter={() => setHoveredIndex(point.idx)} onMouseLeave={() => setHoveredIndex(null)} /></g>;
                })}
              </svg>
            </div>

            {hoveredPoint && <div className="pointer-events-none absolute top-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs shadow-lg backdrop-blur-xs transition-all" style={{ left: `${Math.min(Math.max(10, (hoveredPoint.x / chartWidth) * 100), 85)}%`, transform: "translateX(-50%)" }}>
              <p className="font-medium text-[var(--app-text-secondary)]">{formatDateLabel(hoveredPoint.item.metricDate, locale)}</p>
              <p className="text-sm font-bold text-[var(--app-text-primary)]">{formatNumber(hoveredPoint.item.followerCount, locale)} <span className="text-[11px] font-normal text-[var(--app-text-tertiary)]">{t.followers}</span></p>
              {hoveredPoint.idx > 0 && points[hoveredPoint.idx - 1] && <p className="mt-0.5 text-[11px]">{(() => { const info = formatDelta(hoveredPoint.item.followerCount - points[hoveredPoint.idx - 1].item.followerCount, locale); return <span className={info.className}>{info.text} {t.versusPreviousDay}</span>; })()}</p>}
            </div>}

            <div className="mt-2 flex justify-between px-2 text-[10px] font-medium text-slate-400 dark:text-slate-500">
              <span>{formatDateLabel(sortedData[0]?.metricDate, locale)}</span>
              {sortedData.length > 2 && <span>{formatDateLabel(sortedData[Math.floor(sortedData.length / 2)]?.metricDate, locale)}</span>}
              <span>{formatDateLabel(sortedData[sortedData.length - 1]?.metricDate, locale)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
