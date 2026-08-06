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
    title: "สถานะการจัดการบทสนทนา (Operation Workflow Lifecycle)",
    open: "รอดำเนินการ (OPEN)",
    waitingBm: "รอสาขาตอบกลับ (WAITING BM)",
    bmReplied: "สาขาตอบกลับแล้ว (BM REPLIED)",
    resolved: "จัดการเสร็จสิ้น (RESOLVED)",
    completionRate: "อัตราสำเร็จ (Completion Rate)",
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
    title: "运营处理生命周期 (Operation Workflow Lifecycle)",
    open: "待处理 (OPEN)",
    waitingBm: "等待 BM (WAITING BM)",
    bmReplied: "BM 已回复 (BM REPLIED)",
    resolved: "已完成 (RESOLVED)",
    completionRate: "完成率",
  },
};

export function ActionStatusCard({ workflow, language }: ActionStatusProps) {
  const t = LABELS[language] ?? LABELS.en;

  const data = workflow || { open: 3, waitingBm: 5, bmReplied: 8, resolved: 12, completionRate: 60 };

  return (
    <div className="app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.title}</h3>
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
            {data.completionRate}% {t.completionRate}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center">
          <div className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
            <span className="text-[10px] text-rose-800 dark:text-rose-300 uppercase tracking-wider block font-bold">{t.open}</span>
            <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 block">{data.open}</span>
          </div>

          <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
            <span className="text-[10px] text-amber-800 dark:text-amber-300 uppercase tracking-wider block font-bold">{t.waitingBm}</span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{data.waitingBm}</span>
          </div>

          <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
            <span className="text-[10px] text-blue-800 dark:text-blue-300 uppercase tracking-wider block font-bold">{t.bmReplied}</span>
            <span className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1 block">{data.bmReplied}</span>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
            <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block font-bold">{t.resolved}</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{data.resolved}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
