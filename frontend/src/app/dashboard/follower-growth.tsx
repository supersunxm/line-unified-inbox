"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface FollowerGrowthProps {
  growth: DashboardAnalyticsResponse["summaryCards"]["followerGrowth"];
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "ภาพรวมการเติบโตของผู้ติดตาม LINE OA (LINE OA Friend Growth)",
    totalFriends: "ผู้ติดตามทั้งหมด",
    addedToday: "เพิ่มเพื่อนวันนี้",
    blockedToday: "บล็อกวันนี้",
    netGrowth: "การเติบโตสุทธิ",
  },
  en: {
    title: "LINE OA Friend Growth Analytics",
    totalFriends: "Total Friends",
    addedToday: "Added Today",
    blockedToday: "Blocked Today",
    netGrowth: "Net Growth",
  },
  zh: {
    title: "LINE OA 好友增长分析",
    totalFriends: "好友总数",
    addedToday: "今日新增",
    blockedToday: "今日封禁",
    netGrowth: "净增长",
  },
};

export function FollowerGrowthCard({ growth, language }: FollowerGrowthProps) {
  const t = LABELS[language] ?? LABELS.en;

  return (
    <div className="app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.title}</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-center">
        <div className="p-3 rounded-lg bg-[var(--accent)] border border-[var(--border)]">
          <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider block">{t.totalFriends}</span>
          <span className="text-lg font-bold text-[var(--foreground)] mt-1 block">{growth.totalFriends.toLocaleString()}</span>
        </div>
        <div className="p-3 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
          <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">{t.addedToday}</span>
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">+{growth.addedToday}</span>
        </div>
        <div className="p-3 rounded-lg bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
          <span className="text-[10px] text-rose-800 dark:text-rose-300 uppercase tracking-wider block">{t.blockedToday}</span>
          <span className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1 block">-{growth.blockedToday}</span>
        </div>
        <div className="p-3 rounded-lg bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40">
          <span className="text-[10px] text-teal-800 dark:text-teal-300 uppercase tracking-wider block">{t.netGrowth}</span>
          <span className="text-lg font-bold text-teal-600 dark:text-teal-400 mt-1 block">+{growth.netToday}</span>
        </div>
      </div>
    </div>
  );
}
