"use client";

import React from "react";

interface DailyOperationBriefProps {
  insights: string[];
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "📋 สรุปการดำเนินงานประจำวัน (Daily Operation Brief)",
    subtitle: "ข้อสรุปสถิติสำคัญและการดำเนินการถัดไปสำหรับผู้บริหารและผู้จัดการสาขา",
  },
  en: {
    title: "📋 Daily Operation Brief",
    subtitle: "Executive summary of network SLA status, demand trends, and recommended next actions",
  },
  zh: {
    title: "📋 每日运营简报 (Daily Operation Brief)",
    subtitle: "针对管理层的网络 SLA 状态、需求趋势及建议下一步行动的简报",
  },
};

export function OperationalInsightCard({ insights, language }: DailyOperationBriefProps) {
  const t = LABELS[language] ?? LABELS.en;

  const defaultBrief = [
    "🟢 Overall Health: 96.5% response performance across network.",
    "⚠️ Attention: 3 stores operating below 24H SLA target.",
    "📈 Demand: Reno16 Pro inquiries increased 25% today.",
    "Action: Follow up with Robinson Chonburi store manager.",
  ];

  const briefList = insights && insights.length > 0 ? insights : defaultBrief;

  return (
    <div className="app-card p-5 rounded-xl border border-teal-300 dark:border-teal-800 bg-gradient-to-br from-teal-50/50 via-[var(--surface)] to-emerald-50/30 dark:from-teal-950/30 dark:to-emerald-950/20 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-0.5 rounded bg-teal-600 text-white text-xs font-bold uppercase tracking-wider">DAILY BRIEF</span>
        <h3 className="text-sm font-bold text-[var(--foreground)]">{t.title}</h3>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{t.subtitle}</p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {briefList.map((item, idx) => (
          <div key={idx} className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs flex items-start gap-2.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm shrink-0">✓</span>
            <p className="text-xs text-[var(--foreground)] leading-relaxed font-semibold">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
