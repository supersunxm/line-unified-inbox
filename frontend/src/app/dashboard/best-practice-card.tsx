"use client";

import React from "react";
import type { BestPracticeStoreDetail } from "@/types/api";

interface BestPracticeCardProps {
  store: BestPracticeStoreDetail | null;
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "🏆 สาขาต้นแบบ (Benchmark Store)",
    score: "คะแนนประสิทธิภาพรวม",
    reasonsTitle: "ปัจจัยที่ทำให้ออกมาดีเยี่ยม (Why they perform well):",
    action: "ดูบทสนทนาสาขานี้",
    noStore: "ไม่มีข้อมูลสาขาต้นแบบ",
  },
  en: {
    title: "🏆 Benchmark Store",
    score: "Performance Score",
    reasonsTitle: "Why they perform well:",
    action: "View Store Chats",
    noStore: "No benchmark store data",
  },
  zh: {
    title: "🏆 标杆门店 (Benchmark Store)",
    score: "综合绩效得分",
    reasonsTitle: "优秀运营原因:",
    action: "查看该店会话",
    noStore: "暂无标杆门店数据",
  },
};

export function BestPracticeCard({ store, getStoreDisplayName, onOpenStore, language }: BestPracticeCardProps) {
  const t = LABELS[language] ?? LABELS.en;

  if (!store) {
    return (
      <div className="app-card p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10">
        <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{t.title}</h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-2">{t.noStore}</p>
      </div>
    );
  }

  const defaultReasons = [
    "✓ Fast average reply time",
    "✓ Handles highest customer volume",
    "✓ Lowest pending cases",
    "✓ Strong follower growth",
  ];

  const reasonsList = store.reasons && store.reasons.length > 0 ? store.reasons : defaultReasons;

  return (
    <div className="app-card p-5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/60 to-teal-50/30 dark:from-emerald-950/30 dark:to-teal-950/20 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">{t.title}</h3>
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-600 text-white">Benchmark</span>
        </div>

        <div className="mt-3">
          <h4 className="text-lg font-black text-[var(--foreground)]">{getStoreDisplayName(store.storeName)}</h4>
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{store.responseRate24h}% Response Rate</p>
        </div>

        <div className="mt-4 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/50">
          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 block mb-2">{t.reasonsTitle}</span>
          <div className="space-y-1.5">
            {reasonsList.map((reason, idx) => (
              <div key={idx} className="text-xs text-[var(--foreground)] font-medium flex items-center gap-1.5">
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpenStore(store.storeId)}
        className="mt-4 w-full py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
      >
        {t.action}
      </button>
    </div>
  );
}
