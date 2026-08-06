"use client";

import React from "react";
import type { NeedImprovementStoreDetail } from "@/types/api";

interface ImprovementCardProps {
  store: NeedImprovementStoreDetail | null;
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "⚠️ สาขาที่ต้องการการสนับสนุน (Store Requiring Support)",
    score: "คะแนนประสิทธิภาพ",
    issuesTitle: "ปัญหาและข้อจำกัดที่พบ (Issues Identified):",
    recommendationTitle: "ข้อเสนอแนะในการแก้ไข (Actionable Recommendation):",
    action: "เข้าช่วยเหลือและดูบทสนทนา",
    noStore: "ไม่มีสาขาที่ประสบปัญหาการตอบกลับ",
  },
  en: {
    title: "⚠️ Store Requiring Support",
    score: "Performance Score",
    issuesTitle: "Operational Issues Identified:",
    recommendationTitle: "Actionable Recommendation:",
    action: "Review & Support Store",
    noStore: "All stores are operating within target response SLA",
  },
  zh: {
    title: "⚠️ 需要支持的门店 (Store Requiring Support)",
    score: "综合绩效得分",
    issuesTitle: "发现的运营问题:",
    recommendationTitle: "改进建议:",
    action: "协助处理该店会话",
    noStore: "所有门店均在目标回复SLA范围内",
  },
};

export function ImprovementCard({ store, getStoreDisplayName, onOpenStore, language }: ImprovementCardProps) {
  const t = LABELS[language] ?? LABELS.en;

  if (!store) {
    return (
      <div className="app-card p-5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10">
        <h3 className="text-sm font-bold text-rose-800 dark:text-rose-300">{t.title}</h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-2">{t.noStore}</p>
      </div>
    );
  }

  const defaultIssues = [
    `• ${store.pending} pending conversations`,
    `• Response rate below target (${store.responseRate24h}%)`,
    "• High evening traffic volume",
  ];

  const issuesList = store.issues && store.issues.length > 0 ? store.issues : defaultIssues;
  const recommendation = store.recommendation || "Review manpower allocation during peak hours";

  return (
    <div className="app-card p-5 rounded-xl border border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50/60 to-rose-50/30 dark:from-amber-950/30 dark:to-rose-950/20 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">{t.title}</h3>
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-600 text-white">Support Needed</span>
        </div>

        <div className="mt-3">
          <h4 className="text-lg font-black text-[var(--foreground)]">{getStoreDisplayName(store.storeName)}</h4>
          <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">{store.responseRate24h}% Response Rate</p>
        </div>

        <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-900/50 space-y-3">
          <div>
            <span className="text-xs font-bold text-rose-900 dark:text-rose-300 block mb-1.5">{t.issuesTitle}</span>
            <div className="space-y-1">
              {issuesList.map((issue, idx) => (
                <p key={idx} className="text-xs text-[var(--foreground)] font-medium">{issue}</p>
              ))}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-xs">
            <span className="font-bold text-amber-900 dark:text-amber-300 block mb-0.5">{t.recommendationTitle}</span>
            <p className="text-amber-800 dark:text-amber-200">{recommendation}</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpenStore(store.storeId)}
        className="mt-4 w-full py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
      >
        {t.action}
      </button>
    </div>
  );
}
