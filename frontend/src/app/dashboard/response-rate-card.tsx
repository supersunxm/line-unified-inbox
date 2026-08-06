"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface ResponseRateCardProps {
  analytics: DashboardAnalyticsResponse["responseAnalytics"];
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "การจัดการตอบกลับข้อความวันนี้ (Today's Reply Completion)",
    avgTime: "เวลาตอบกลับเฉลี่ย",
    medianTime: "ค่ามัธยฐานเวลาตอบกลับ",
    under4h: "< 4 ชั่วโมง",
    h4to12: "4 - 12 ชั่วโมง",
    h12to24: "12 - 24 ชั่วโมง",
    over24h: "> 24 ชั่วโมง",
    targetNotice: "เป้าหมายการดำเนินงาน: ตอบกลับลูกค้าภายใน 24 ชั่วโมงเสมอ",
    mins: "นาที",
    hours: "ชั่วโมง",
  },
  en: {
    title: "Today's Reply Completion Speed Distribution",
    avgTime: "Average Response Time",
    medianTime: "Median Response Time",
    under4h: "< 4 Hours",
    h4to12: "4 - 12 Hours",
    h12to24: "12 - 24 Hours",
    over24h: "> 24 Hours",
    targetNotice: "Operational SLA: Always respond to customers within 24 hours",
    mins: "mins",
    hours: "hours",
  },
  zh: {
    title: "今日回复完成速度分布",
    avgTime: "平均响应时间",
    medianTime: "中位数响应时间",
    under4h: "< 4小时",
    h4to12: "4 - 12小时",
    h12to24: "12 - 24小时",
    over24h: "> 24小时",
    targetNotice: "运营 SLA: 务必在 24 小时内回复客户",
    mins: "分钟",
    hours: "小时",
  },
};

function formatTime(minutes: number, labels: typeof LABELS.en): string {
  if (minutes < 60) return `${minutes} ${labels.mins}`;
  const hrs = (minutes / 60).toFixed(1);
  return `${hrs} ${labels.hours}`;
}

export function ResponseRateCard({ analytics, language }: ResponseRateCardProps) {
  const t = LABELS[language] ?? LABELS.en;
  const b = analytics.buckets;
  const total = b.under4h + b.between4and12h + b.between12and24h + b.over24h || 1;

  const p1 = Math.round((b.under4h / total) * 100);
  const p2 = Math.round((b.between4and12h / total) * 100);
  const p3 = Math.round((b.between12and24h / total) * 100);
  const p4 = Math.max(0, 100 - p1 - p2 - p3);

  return (
    <div className="app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.title}</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{t.targetNotice}</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)]">
            <span className="text-[var(--muted-foreground)]">{t.avgTime}: </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatTime(analytics.avgResponseMinutes, t)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)]">
            <span className="text-[var(--muted-foreground)]">{t.medianTime}: </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatTime(analytics.medianResponseMinutes, t)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {/* Bucket 1: < 4h */}
        <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">{t.under4h}</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{p1}%</span>
          </div>
          <div className="mt-2 text-xl font-black text-emerald-700 dark:text-emerald-300">{b.under4h}</div>
          <div className="w-full h-1.5 bg-emerald-200 dark:bg-emerald-950 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${p1}%` }} />
          </div>
        </div>

        {/* Bucket 2: 4-12h */}
        <div className="p-3.5 rounded-lg border border-teal-200 dark:border-teal-900/50 bg-teal-50/30 dark:bg-teal-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-800 dark:text-teal-300">{t.h4to12}</span>
            <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{p2}%</span>
          </div>
          <div className="mt-2 text-xl font-black text-teal-700 dark:text-teal-300">{b.between4and12h}</div>
          <div className="w-full h-1.5 bg-teal-200 dark:bg-teal-950 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${p2}%` }} />
          </div>
        </div>

        {/* Bucket 3: 12-24h */}
        <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">{t.h12to24}</span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{p3}%</span>
          </div>
          <div className="mt-2 text-xl font-black text-amber-700 dark:text-amber-300">{b.between12and24h}</div>
          <div className="w-full h-1.5 bg-amber-200 dark:bg-amber-950 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${p3}%` }} />
          </div>
        </div>

        {/* Bucket 4: > 24h */}
        <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">{t.over24h}</span>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{p4}%</span>
          </div>
          <div className="mt-2 text-xl font-black text-rose-700 dark:text-rose-300">{b.over24h}</div>
          <div className="w-full h-1.5 bg-rose-200 dark:bg-rose-950 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${p4}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
