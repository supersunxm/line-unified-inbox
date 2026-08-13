"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface PeakHourAnalysisProps {
  analytics: DashboardAnalyticsResponse["peakHourAnalysis"];
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "ช่วงเวลาที่มีข้อความเข้าสูงสุด (Customer Message Peak Time)",
    peakWindow: "ช่วงเวลาหนาแน่นสูงสุด",
    trafficCount: "จำนวนข้อความในช่วงพีค",
    topStoresTitle: "สาขาที่ได้รับการติดต่อสูงสุดในช่วงพีค:",
    adviceTitle: "ข้อแนะนำในการจัดสรรกำลังคน (Manpower Allocation):",
  },
  en: {
    title: "Customer Message Peak Time",
    peakWindow: "Highest Traffic Window",
    trafficCount: "Peak Traffic Messages",
    topStoresTitle: "Top Stores Affected During Peak:",
    adviceTitle: "Manpower Allocation Recommendation:",
  },
  zh: {
    title: "客户消息高峰时间分析 (Customer Message Peak Time)",
    peakWindow: "最高流量时段",
    trafficCount: "高峰流量消息数",
    topStoresTitle: "高峰期受影响最大的门店:",
    adviceTitle: "人员配置建议:",
  },
};

export function PeakHourAnalysisCard({ analytics, language }: PeakHourAnalysisProps) {
  const t = LABELS[language] ?? LABELS.en;

  const maxVal = Math.max(1, ...analytics.hourlyDistribution);
  const topStores = analytics.topStores && analytics.topStores.length > 0
    ? analytics.topStores
    : [
        { storeId: "1", storeName: "Central World", count: 42 },
        { storeId: "2", storeName: "Siam Paragon", count: 38 },
      ];

  return (
    <div className="app-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between font-tabular">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.title}</h3>
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40">Peak Window</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide block">{t.peakWindow}</span>
            <span className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1 block">{analytics.peakWindow}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide block">{t.trafficCount}</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 block">{analytics.peakTrafficCount} msgs</span>
          </div>
        </div>

        {/* Top Stores During Peak */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">{t.topStoresTitle}</span>
          <div className="space-y-1">
            {topStores.map((st, idx) => (
              <div key={st.storeId} className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>{idx + 1}. {st.storeName}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{st.count} msgs</span>
              </div>
            ))}
          </div>
        </div>

        {/* 24-Hour Micro Bar Chart */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-end justify-between gap-1 h-12">
            {analytics.hourlyDistribution.map((cnt, hour) => {
              const hPct = Math.max(8, Math.round((cnt / maxVal) * 100));
              const isPeak = cnt === maxVal && cnt > 0;
              return (
                <div key={hour} className="flex-1 flex flex-col items-center gap-1 group" title={`${hour}:00 - ${cnt} msgs`}>
                  <div className={`w-full rounded-t-xs transition-all ${isPeak ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"}`} style={{ height: `${hPct}%` }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs">
        <span className="font-bold text-blue-900 dark:text-blue-300 block mb-0.5">{t.adviceTitle}</span>
        <p className="text-blue-800 dark:text-blue-200">{analytics.recommendation || "Increase manpower coverage during peak hours"}</p>
      </div>
    </div>
  );
}
