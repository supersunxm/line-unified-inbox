"use client";

import React from "react";
import type { ImpactSummary } from "@/types/api";

interface AiImpactDashboardPanelProps {
  summary: ImpactSummary;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "ระบบวัดผลกระทบเชิงธุรกิจและการเรียนรู้อัตโนมัติ (AI Impact Measurement)",
    subtitle: "ประเมินผลการปฏิบัติงานจริง ยืนยันความคุ้มค่าของการอนุมัติคำสั่ง และเรียนรู้รูปแบบกลยุทธ์ที่สำเร็จสูงสุด",
    evaluated: "คำสั่งที่ถูกประเมินผลแล้ว",
    successRate: "อัตราความสำเร็จ (Success Rate)",
    avgRecovery: "เฉลี่ยการฟื้นฟู SLA (Avg SLA Recovery)",
    successfulActionsTitle: "คำสั่งปฏิบัติการที่ประสบความสำเร็จสูงสุด (Top Successful Actions)",
    beforeAfterTitle: "เปรียบเทียบตัวเลขก่อนและหลังปฏิบัติการ (Before vs After Telemetry)",
    learningTitle: "องค์ความรู้และรูปแบบที่ AI เรียนรู้จากการปฏิบัติการ (AI Self-Learning Summary)",
    beforeLabel: "ก่อนทำ",
    afterLabel: "หลังทำ",
    pendingLabel: "ข้อความค้าง",
    responseLabel: "ความเร็วตอบ",
  },
  en: {
    title: "AI Impact Measurement & Learning Engine",
    subtitle: "Closed-loop evaluation measuring actual ROI improvement and learning optimal store operational patterns",
    evaluated: "Actions Evaluated",
    successRate: "Overall Success Rate",
    avgRecovery: "Average SLA Recovery",
    successfulActionsTitle: "Top Successful Operational Actions",
    beforeAfterTitle: "Telemetry Shift (Before vs After)",
    learningTitle: "AI Self-Learning Summary Insights",
    beforeLabel: "Before",
    afterLabel: "After",
    pendingLabel: "Pending",
    responseLabel: "Avg Velocity",
  },
  zh: {
    title: "AI 影响评估与自学习引擎 (AI Impact Measurement)",
    subtitle: "闭环评估实际运营投资回报，并自主学习优化门店策略",
    evaluated: "已评估操作数",
    successRate: "总体成功率",
    avgRecovery: "平均 SLA 恢复幅度",
    successfulActionsTitle: "高成效运营操作",
    beforeAfterTitle: "指标对比 (执行前 vs 执行后)",
    learningTitle: "AI 自主学习提炼模式 (Learning Insights)",
    beforeLabel: "执行前",
    afterLabel: "执行后",
    pendingLabel: "待处理",
    responseLabel: "平均响应",
  },
};

export function AiImpactDashboardPanel({ summary, language }: AiImpactDashboardPanelProps) {
  const t = LABELS[language] ?? LABELS.en;

  return (
    <section
      data-ai-impact-dashboard
      className="rounded-2xl border-2 border-indigo-500/40 bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-md space-y-6"
    >
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-xs font-black rounded-lg bg-indigo-600 text-white uppercase tracking-wider">
            CLOSED-LOOP AI
          </span>
          <div>
            <h2 className="text-lg font-black tracking-tight text-[var(--foreground)] flex items-center gap-2">
              <span>📈</span>
              <span>{t.title}</span>
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] font-medium mt-0.5">
              {t.subtitle}
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-xs font-black border border-indigo-500/30">
          🧠 Self-Learning Active
        </span>
      </div>

      {/* 3 Hero KPI Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-1">
          <div className="text-[10px] font-black uppercase text-[var(--muted-foreground)]">
            {t.evaluated}
          </div>
          <div className="text-2xl font-black text-[var(--foreground)]">
            {summary.totalEvaluated}
          </div>
          <div className="text-[11px] text-[var(--muted-foreground)]">Completed action audit cycles</div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-1">
          <div className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">
            {t.successRate}
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {summary.successRatePct}%
          </div>
          <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
            High effectiveness rating
          </div>
        </div>

        <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 space-y-1">
          <div className="text-[10px] font-black uppercase text-indigo-800 dark:text-indigo-300">
            {t.avgRecovery}
          </div>
          <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
            +{summary.avgSlaRecoveryPct}%
          </div>
          <div className="text-[11px] text-indigo-800 dark:text-indigo-300 font-semibold">
            Average network SLA lift
          </div>
        </div>
      </div>

      {/* Top Successful Actions List */}
      <div className="space-y-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted-foreground)]">
          {t.successfulActionsTitle}
        </div>

        <div className="space-y-3">
          {summary.topSuccessfulActions.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2 text-xs">
                <div className="flex items-center gap-2 font-extrabold text-[var(--foreground)]">
                  <span>🏬 {item.storeName}</span>
                  <span>•</span>
                  <span>{item.actionTitle}</span>
                </div>

                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black border border-emerald-500/30 uppercase">
                  {item.effectiveness} ({item.impactScore}% Score)
                </span>
              </div>

              {/* Before vs After Telemetry Comparison */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)] space-y-0.5">
                  <div className="text-[10px] font-bold text-[var(--muted-foreground)]">SLA Rate</div>
                  <div className="font-extrabold text-[var(--foreground)]">
                    <span className="line-through text-rose-500">{item.beforeMetrics.slaRate}%</span>
                    <span className="ml-1 text-emerald-600 dark:text-emerald-400">→ {item.afterMetrics.slaRate}%</span>
                  </div>
                </div>

                <div className="bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)] space-y-0.5">
                  <div className="text-[10px] font-bold text-[var(--muted-foreground)]">{t.pendingLabel}</div>
                  <div className="font-extrabold text-[var(--foreground)]">
                    <span className="text-rose-500">{item.beforeMetrics.pendingCount}</span>
                    <span className="ml-1 text-emerald-600 dark:text-emerald-400">→ {item.afterMetrics.pendingCount}</span>
                  </div>
                </div>

                <div className="bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)] space-y-0.5">
                  <div className="text-[10px] font-bold text-[var(--muted-foreground)]">{t.responseLabel}</div>
                  <div className="font-extrabold text-[var(--foreground)]">
                    <span>{item.beforeMetrics.responseTimeMinutes}m</span>
                    <span className="ml-1 text-emerald-600 dark:text-emerald-400">→ {item.afterMetrics.responseTimeMinutes}m</span>
                  </div>
                </div>

                <div className="bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)] space-y-0.5 flex flex-col justify-center">
                  <div className="text-[10px] font-bold text-[var(--muted-foreground)]">Improvement</div>
                  <div className="font-black text-indigo-600 dark:text-indigo-400">
                    +{item.afterMetrics.slaRate - item.beforeMetrics.slaRate}% SLA
                  </div>
                </div>
              </div>

              <p className="text-xs text-[var(--foreground)] font-medium bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)] leading-relaxed">
                💡 {item.improvementSummary}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Learning Summary Box */}
      <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 space-y-2 text-xs">
        <div className="text-[10px] uppercase font-black tracking-wider text-indigo-800 dark:text-indigo-300">
          🧠 {t.learningTitle}
        </div>
        <ul className="space-y-1 text-[var(--foreground)] font-medium leading-relaxed">
          {summary.learnedPatterns.map((pat, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">•</span>
              <span>{pat}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
