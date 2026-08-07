"use client";

import React from "react";
import type { OperationalMemorySummary } from "@/types/api";

interface AiOperationalMemoryPanelProps {
  summary: OperationalMemorySummary;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "ระบบคลังความรู้เชิงปฏิบัติการ AI (AI Operational Memory)",
    subtitle: "บันทึกรูปแบบปัญหา เรียนรู้กลยุทธ์ที่สำเร็จในอดีต และเสนอแนะทางแก้ปัญหาที่มีระดับความเชื่อมั่นสูง",
    totalCases: "รูปแบบปัญหาที่จัดเก็บ (Memory Patterns)",
    avgConfidence: "ความเชื่อมั่นเฉลี่ย (Avg Strategy Confidence)",
    topLift: "รูปแบบการฟื้นตัวสูงสุด (Top SLA Recovery)",
    casesTitle: "คลังรูปแบบความสำเร็จเชิงปฏิบัติการ (Historical Operational Knowledge Base)",
    problemPattern: "รูปแบบปัญหาที่เกิดขึ้น (Problem Pattern)",
    rootCauseCategory: "หมวดหมู่สาเหตุ (Root Cause Category)",
    successfulAction: "กลยุทธ์ที่สำเร็จในอดีต (Verified Successful Action)",
    timesApplied: "จำนวนครั้งที่ใช้สำเร็จ",
    avgLift: "อัตราฟื้นฟู SLA เฉลี่ย",
  },
  en: {
    title: "AI Operational Memory & Self-Learning Engine",
    subtitle: "Store historical operational cases, learn verified high-confidence resolution patterns, and optimize recommendations",
    totalCases: "Stored Memory Patterns",
    avgConfidence: "Avg Strategy Confidence",
    topLift: "Top SLA Recovery Case",
    casesTitle: "Historical Operational Knowledge Base",
    problemPattern: "Problem Pattern",
    rootCauseCategory: "Root Cause Category",
    successfulAction: "Verified Successful Action",
    timesApplied: "Times Applied",
    avgLift: "Avg SLA Lift",
  },
  zh: {
    title: "AI 运营记忆与自学习引擎 (AI Operational Memory)",
    subtitle: "存储历史运营案例，自主学习高置信度解决方案，持续优化决策建议",
    totalCases: "已存储模式数",
    avgConfidence: "平均策略置信度",
    topLift: "最高 SLA 恢复案例",
    casesTitle: "历史运营知识库 (Historical Knowledge Base)",
    problemPattern: "问题模式",
    rootCauseCategory: "根因分类",
    successfulAction: "验证有效的策略",
    timesApplied: "成功应用次数",
    avgLift: "平均 SLA 提升",
  },
};

export function AiOperationalMemoryPanel({ summary, language }: AiOperationalMemoryPanelProps) {
  const t = LABELS[language] ?? LABELS.en;

  return (
    <section
      data-ai-operational-memory
      className="rounded-2xl border-2 border-purple-500/40 bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-md space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-xs font-black rounded-lg bg-purple-600 text-white uppercase tracking-wider">
            OPERATIONAL MEMORY
          </span>
          <div>
            <h2 className="text-lg font-black tracking-tight text-[var(--foreground)] flex items-center gap-2">
              <span>🧠</span>
              <span>{t.title}</span>
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] font-medium mt-0.5">
              {t.subtitle}
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full bg-purple-500/15 text-purple-800 dark:text-purple-300 text-xs font-black border border-purple-500/30">
          ⚡ Memory Active ({summary.totalStoredCases} Patterns)
        </span>
      </div>

      {/* Hero Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-1">
          <div className="text-[10px] font-black uppercase text-[var(--muted-foreground)]">
            {t.totalCases}
          </div>
          <div className="text-2xl font-black text-[var(--foreground)]">
            {summary.totalStoredCases}
          </div>
          <div className="text-[11px] text-[var(--muted-foreground)]">Verified operational cases</div>
        </div>

        <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 space-y-1">
          <div className="text-[10px] font-black uppercase text-purple-800 dark:text-purple-300">
            {t.avgConfidence}
          </div>
          <div className="text-2xl font-black text-purple-700 dark:text-purple-400">
            {summary.avgConfidencePct}%
          </div>
          <div className="text-[11px] text-purple-800 dark:text-purple-300 font-semibold">
            High decision accuracy
          </div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-1">
          <div className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">
            {t.topLift}
          </div>
          <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 leading-snug">
            {summary.topSlaLiftCase}
          </div>
        </div>
      </div>

      {/* Historical Cases Grid */}
      <div className="space-y-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted-foreground)]">
          {t.casesTitle}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summary.cases.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="font-black text-xs text-[var(--foreground)]">
                  🏬 {c.storeName}
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-800 dark:text-purple-300 text-[10px] font-bold uppercase">
                  {c.rootCauseCategory}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="text-[10px] font-extrabold text-[var(--muted-foreground)] uppercase">
                    {t.problemPattern}
                  </div>
                  <p className="font-semibold text-[var(--foreground)] mt-0.5">{c.problemPattern}</p>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <div className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase">
                    💡 {t.successfulAction}
                  </div>
                  <p className="font-bold text-[var(--foreground)]">{c.successfulAction}</p>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="font-semibold text-[var(--muted-foreground)]">
                    🔄 {t.timesApplied}: <strong>{c.timesApplied}x</strong>
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    📈 +{c.avgSlaLiftPct}% SLA Lift ({c.confidence}% Confidence)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
