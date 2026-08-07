"use client";

import React from "react";
import type { PreparedAiRootCauseProps } from "./dashboard-transformers";

interface AiRootCauseAnalysisPanelProps {
  data: PreparedAiRootCauseProps;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "ระบบวิเคราะห์สาเหตุเชิงลึกด้วยปัญญาประดิษฐ์ (AI Root Cause Analysis Engine)",
    subtitle: "ตอบคำถาม: ทำไมอัตรา SLA ถึงลดลง? พร้อมหลักฐานเชิงประจักษ์ ระดับความเชื่อมั่น และข้อแนะนำ",
    whySlaDropped: "วิเคราะห์สาเหตุการลดลงของ SLA เครือข่าย",
    primaryCause: "สาเหตุหลัก (Primary Cause)",
    evidence: "หลักฐานเชิงประจักษ์ (Empirical Evidence)",
    confidence: "ระดับความเชื่อมั่น (Confidence)",
    recommendation: "ข้อแนะนำการปฏิบัติการ (Recommendation)",
    expectedImpact: "ผลลัพธ์ทางธุรกิจที่คาดการณ์ (Expected Impact)",
  },
  en: {
    title: "AI Root Cause Analysis Engine",
    subtitle: "Answering: Why did SLA drop? Empirical evidence-based diagnosis, confidence score & recommendations",
    whySlaDropped: "Why SLA dropped across network?",
    primaryCause: "Primary Cause",
    evidence: "Empirical Evidence",
    confidence: "Confidence Score",
    recommendation: "Recommended Operational Action",
    expectedImpact: "Expected Business Impact",
  },
  zh: {
    title: "AI 根因分析引擎 (AI Root Cause Analysis Engine)",
    subtitle: "解答: 为何 SLA 下降？基于实证数据的诊断、置信度评估与操作建议",
    whySlaDropped: "网络 SLA 下降根因分析",
    primaryCause: "主要根因",
    evidence: "实证依据",
    confidence: "AI 置信度",
    recommendation: "建议操作",
    expectedImpact: "预期 ROI 效果",
  },
};

export function AiRootCauseAnalysisPanel({ data, language }: AiRootCauseAnalysisPanelProps) {
  const t = LABELS[language] ?? LABELS.en;
  const { summaryText, confidence, totalAffectedStores, insights } = data;

  return (
    <section
      data-ai-root-cause-analysis
      className="rounded-2xl border-2 border-indigo-500/40 bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-md space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2.5">
          <span className="px-3 py-1 text-xs font-black rounded-lg bg-indigo-600 text-white uppercase tracking-wider">
            AI DIAGNOSTICS
          </span>
          <h2 className="text-base font-black tracking-tight text-[var(--foreground)] flex items-center gap-2">
            <span>🤖</span>
            <span>{t.title}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-xs font-black border border-indigo-500/30">
            🎯 {confidence}% AI Certainty
          </span>
          <span className="px-3 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs font-black border border-rose-500/30">
            🏬 {totalAffectedStores} Affected Stores
          </span>
        </div>
      </div>

      {/* Network Summary Banner */}
      <div className="p-4 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-[var(--background)] to-[var(--background)] space-y-1">
        <div className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
          <span>🔍</span>
          <span>{t.whySlaDropped}</span>
        </div>
        <p className="text-xs font-bold text-[var(--foreground)] leading-relaxed">
          {summaryText}
        </p>
      </div>

      {/* Per-Store Root Cause Insight Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {insights.map((item) => {
          const severityBadge = item.severity === "CRITICAL"
            ? "bg-rose-600 text-white"
            : item.severity === "HIGH"
            ? "bg-amber-500 text-white"
            : "bg-blue-600 text-white";

          return (
            <div
              key={item.id}
              className="p-4 rounded-xl border-2 border-[var(--border)] bg-[var(--background)] space-y-3 text-xs shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                {/* Store Header & Badges */}
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
                  <div className="font-extrabold text-[var(--foreground)] text-sm flex items-center gap-1.5">
                    <span>🏬</span>
                    <span>{item.storeName}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${severityBadge}`}>
                      {item.severity}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-black border border-indigo-500/30">
                      Confidence: {item.confidence}%
                    </span>
                  </div>
                </div>

                {/* Primary Cause */}
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    {t.primaryCause}
                  </div>
                  <p className="font-bold text-[var(--foreground)] leading-snug">
                    {item.diagnosis.primaryCause}
                  </p>
                </div>

                {/* Empirical Evidence */}
                <div className="space-y-1 bg-[var(--surface)] p-3 rounded-lg border border-[var(--border)]">
                  <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {t.evidence}
                  </div>
                  <ul className="space-y-1 text-[11px] font-semibold text-[var(--muted-foreground)]">
                    {item.diagnosis.evidence.map((ev, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-indigo-500">•</span>
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action & ROI Impact Footer */}
              <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
                <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-start gap-1">
                  <span>💡</span>
                  <span><strong>{t.recommendation}:</strong> {item.recommendation}</span>
                </div>
                <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-start gap-1">
                  <span>🎯</span>
                  <span><strong>{t.expectedImpact}:</strong> {item.expectedImpact}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
