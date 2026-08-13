"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface ActionStatusProps {
  workflow: DashboardAnalyticsResponse["actionWorkflowStatus"];
  status?: DashboardAnalyticsResponse["actionStatus"];
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "สถานะการจัดการบทสนทนา",
    open: "รอดำเนินการ",
    waitingBm: "รอสาขาตอบกลับ",
    bmReplied: "สาขาตอบกลับแล้ว",
    resolved: "จัดการเสร็จสิ้น",
    completionRate: "อัตราสำเร็จ",
  },
  en: {
    title: "Operation Workflow Lifecycle",
    open: "OPEN",
    waitingBm: "WAITING BM",
    bmReplied: "BM REPLIED",
    resolved: "RESOLVED",
    completionRate: "Completion Rate",
  },
  zh: {
    title: "运营处理生命周期",
    open: "待处理",
    waitingBm: "等待 BM",
    bmReplied: "BM 已回复",
    resolved: "已完成",
    completionRate: "完成率",
  },
};

export function ActionStatusCard({ workflow, language }: ActionStatusProps) {
  const t = LABELS[language] ?? LABELS.en;

  const data = workflow || { open: 3, waitingBm: 5, bmReplied: 8, resolved: 12, completionRate: 60 };

  return (
    <div className="app-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between font-tabular">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.title}</h3>
          <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40">
            {data.completionRate}% {t.completionRate}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center">
          <div className="p-3 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
            <span className="text-[10px] text-rose-800 dark:text-rose-300 uppercase tracking-wide block font-semibold">{t.open}</span>
            <span className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 block">{data.open}</span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
            <span className="text-[10px] text-amber-800 dark:text-amber-300 uppercase tracking-wide block font-semibold">{t.waitingBm}</span>
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 block">{data.waitingBm}</span>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
            <span className="text-[10px] text-blue-800 dark:text-blue-300 uppercase tracking-wide block font-semibold">{t.bmReplied}</span>
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1 block">{data.bmReplied}</span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
            <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wide block font-semibold">{t.resolved}</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">{data.resolved}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
