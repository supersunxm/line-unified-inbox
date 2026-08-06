"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface OperationHealthScoreProps {
  health: DashboardAnalyticsResponse["operationHealth"];
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "ดัชนีสุขภาพการดำเนินงานภาพรวม (Operation Health Score)",
    subtitle: "คำนวณจาก 50% Response SLA + 30% Pending Risk + 15% Escalation Control + 5% Growth",
    excellent: "ดีเยี่ยม (Excellent) 🟢",
    needAttention: "ต้องใส่ใจ (Need Attention) 🟡",
    improve: "เร่งปรับปรุง (Improve) 🔴",
    answeredRatio: "บทสนทนาที่ได้รับการตอบกลับภายใน 24 ชม.",
    vsYesterday: "เทียบกับเมื่อวาน",
    responseSla: "Response SLA",
    pendingControl: "Pending Risk",
    escalationControl: "Escalation Control",
    growth: "Growth",
  },
  en: {
    title: "Operation Health Score",
    subtitle: "Weighted composite: 50% Response SLA + 30% Pending Risk + 15% Escalation Control + 5% Growth",
    excellent: "Excellent 🟢",
    needAttention: "Need Attention 🟡",
    improve: "Improve 🔴",
    answeredRatio: "conversations answered within 24h",
    vsYesterday: "vs yesterday",
    responseSla: "Response SLA",
    pendingControl: "Pending Risk",
    escalationControl: "Escalation Control",
    growth: "Growth",
  },
  zh: {
    title: "运营健康度综合得分 (Operation Health Score)",
    subtitle: "综合权重: 50% Response SLA + 30% Pending Risk + 15% Escalation Control + 5% Growth",
    excellent: "优秀 🟢",
    needAttention: "需要关注 🟡",
    improve: "需改进 🔴",
    answeredRatio: "24小时内已回复会话",
    vsYesterday: "对比昨日",
    responseSla: "Response SLA",
    pendingControl: "Pending Risk",
    escalationControl: "Escalation Control",
    growth: "Growth",
  },
};

export function OperationHealthScoreHero({ health, language }: OperationHealthScoreProps) {
  const t = LABELS[language] ?? LABELS.en;

  const composite = health?.breakdown?.compositeScore ?? health.responseRate24h;
  let statusText = t.excellent;
  let statusBadgeStyle = "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800";
  let bgGradient = "from-emerald-500/10 via-[var(--surface)] to-teal-500/5 border-emerald-300 dark:border-emerald-800";

  if (composite < 70) {
    statusText = t.improve;
    statusBadgeStyle = "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800";
    bgGradient = "from-rose-500/10 via-[var(--surface)] to-rose-500/5 border-rose-300 dark:border-rose-800";
  } else if (composite < 90) {
    statusText = t.needAttention;
    statusBadgeStyle = "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800";
    bgGradient = "from-amber-500/10 via-[var(--surface)] to-amber-500/5 border-amber-300 dark:border-amber-800";
  }

  const diffVal = health.responseRateDiffYesterday;
  const diffSymbol = diffVal >= 0 ? "↑ +" : "↓ ";

  return (
    <div className={`app-card p-6 rounded-2xl border bg-gradient-to-r ${bgGradient} shadow-md space-y-4`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-black rounded bg-emerald-600 text-white tracking-widest uppercase">
              PRIMARY KPI
            </span>
            <h2 className="text-base font-extrabold text-[var(--foreground)] tracking-tight">{t.title}</h2>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="flex items-baseline gap-3 justify-end">
              <span className="text-4xl sm:text-5xl font-black text-[var(--foreground)] tracking-tight">
                {composite}
              </span>
              <span className={`px-3 py-1 text-xs font-bold rounded-full border ${statusBadgeStyle}`}>
                {statusText}
              </span>
            </div>
            <div className="text-xs font-semibold text-[var(--muted-foreground)] mt-1 flex items-center justify-end gap-2">
              <span>
                {health.count24hReplied} / {health.totalMessagesToday} {t.answeredRatio}
              </span>
              <span className={diffVal >= 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                ({diffSymbol}{diffVal}% {t.vsYesterday})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Composite Score Breakdown Pills */}
      {health.breakdown && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[var(--border)] text-xs">
          <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between">
            <span className="text-[var(--muted-foreground)] font-medium">{t.responseSla}</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{health.breakdown.responseSlaScore}%</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between">
            <span className="text-[var(--muted-foreground)] font-medium">{t.pendingControl}</span>
            <span className="font-extrabold text-teal-600 dark:text-teal-400">{health.breakdown.pendingControlScore}%</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between">
            <span className="text-[var(--muted-foreground)] font-medium">{t.escalationControl}</span>
            <span className="font-extrabold text-blue-600 dark:text-blue-400">{health.breakdown.escalationControlScore}%</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between">
            <span className="text-[var(--muted-foreground)] font-medium">{t.growth}</span>
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{health.breakdown.growthScore}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
