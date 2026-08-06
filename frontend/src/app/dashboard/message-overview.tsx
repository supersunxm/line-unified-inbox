"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface MessageOverviewProps {
  cards: DashboardAnalyticsResponse["summaryCards"];
  trend: DashboardAnalyticsResponse["trend7Days"];
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    titleDistribution: "สัดส่วนสถานะการจัดการข้อความ",
    titleTrend: "แนวโน้มปริมาณข้อความ 7 วันย้อนหลัง",
    replied: "ตอบกลับแล้ว",
    bmNotified: "แจ้งเตือน BM",
    pending: "รอดำเนินการ",
    total: "รวมข้อความ",
  },
  en: {
    titleDistribution: "Message Status Distribution",
    titleTrend: "7-Day Message Volume Trend",
    replied: "Replied",
    bmNotified: "BM Notified",
    pending: "Pending",
    total: "Total Messages",
  },
  zh: {
    titleDistribution: "消息处理状态分布",
    titleTrend: "7日消息量趋势",
    replied: "已回复",
    bmNotified: "已通知BM",
    pending: "待处理",
    total: "消息总量",
  },
};

export function MessageOverviewCard({ cards, trend, language }: MessageOverviewProps) {
  const t = LABELS[language] ?? LABELS.en;

  const total = cards.messagesToday || 1;
  const repliedPct = Math.round((cards.repliedCount / total) * 100);
  const bmNotifiedPct = Math.round((cards.bmNotifiedCount / total) * 100);
  const pendingPct = Math.max(0, 100 - repliedPct - bmNotifiedPct);

  const maxTrend = Math.max(1, ...trend.map((d) => d.count));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Donut Chart: Message Status Distribution */}
      <div className="lg:col-span-5 app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.titleDistribution}</h3>
        <div className="my-4 flex items-center justify-center gap-6">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="var(--border)" strokeWidth="3.5" />
              {/* Replied (Green) */}
              <circle
                cx="18"
                cy="18"
                r="15.9155"
                fill="transparent"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeDasharray={`${repliedPct} ${100 - repliedPct}`}
                strokeDashoffset="0"
              />
              {/* BM Notified (Yellow) */}
              <circle
                cx="18"
                cy="18"
                r="15.9155"
                fill="transparent"
                stroke="#f59e0b"
                strokeWidth="3.5"
                strokeDasharray={`${bmNotifiedPct} ${100 - bmNotifiedPct}`}
                strokeDashoffset={`-${repliedPct}`}
              />
              {/* Pending (Red) */}
              <circle
                cx="18"
                cy="18"
                r="15.9155"
                fill="transparent"
                stroke="#ef4444"
                strokeWidth="3.5"
                strokeDasharray={`${pendingPct} ${100 - pendingPct}`}
                strokeDashoffset={`-${repliedPct + bmNotifiedPct}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-bold text-[var(--foreground)]">{cards.messagesToday}</span>
              <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">{t.total}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="font-medium text-[var(--foreground)]">{t.replied}: {cards.repliedCount} ({cards.repliedPercentage}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="font-medium text-[var(--foreground)]">{t.bmNotified}: {cards.bmNotifiedCount} ({cards.bmNotifiedPercentage}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="font-medium text-[var(--foreground)]">{t.pending}: {cards.pendingCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bar/Line Chart: 7-Day Message Trend */}
      <div className="lg:col-span-7 app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.titleTrend}</h3>
          <span className="text-xs text-[var(--muted-foreground)]">Last 7 Days</span>
        </div>
        <div className="mt-6 flex items-end justify-between gap-2 h-36 px-2">
          {trend.map((item) => {
            const barHeightPct = Math.max(8, Math.round((item.count / maxTrend) * 100));
            const repliedHeightPct = item.count > 0 ? Math.round((item.replied / item.count) * barHeightPct) : 0;
            return (
              <div key={item.date} className="flex-1 flex flex-col items-center gap-1.5 group">
                <span className="text-[10px] font-medium text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.count}
                </span>
                <div className="w-full max-w-[28px] bg-[var(--border)] rounded-t-md relative overflow-hidden" style={{ height: `${barHeightPct}%` }}>
                  <div className="w-full bg-emerald-500 absolute bottom-0 left-0 transition-all duration-300" style={{ height: `${repliedHeightPct}%` }} />
                </div>
                <span className="text-[11px] font-medium text-[var(--muted-foreground)]">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
