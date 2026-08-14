"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface FollowerGrowthProps {
  growth: DashboardAnalyticsResponse["summaryCards"]["followerGrowth"];
  language: "th" | "en" | "zh";
  period?: "today" | "7d" | "30d";
}

const LABELS = {
  th: {
    title: "ภาพรวมการเติบโตของผู้ติดตาม LINE OA (LINE OA Follower Growth)",
    totalFriends: "ผู้ติดตามทั้งหมด",
    addedToday: "ผู้ติดตามใหม่",
    blockedToday: "บล็อก",
    netGrowth: "การเติบโตสุทธิ",
    todaySuffix: "วันนี้",
    period7dSuffix: "7 วันที่เลือก",
    period30dSuffix: "30 วันที่เลือก",
  },
  en: {
    title: "LINE OA Follower Growth Analytics",
    totalFriends: "Total Followers",
    addedToday: "New Followers",
    blockedToday: "Blocked",
    netGrowth: "Net Growth",
    todaySuffix: "Today",
    period7dSuffix: "7 Days",
    period30dSuffix: "30 Days",
  },
  zh: {
    title: "LINE OA 粉丝增长分析",
    totalFriends: "粉丝总数",
    addedToday: "新增粉丝",
    blockedToday: "封禁数",
    netGrowth: "净增长",
    todaySuffix: "今日",
    period7dSuffix: "所选7天",
    period30dSuffix: "所选30天",
  },
};

export function FollowerGrowthCard({ growth, language, period = "today" }: FollowerGrowthProps) {
  const t = LABELS[language] ?? LABELS.en;
  const suffix = period === "7d" ? ` (${t.period7dSuffix})` : period === "30d" ? ` (${t.period30dSuffix})` : ` (${t.todaySuffix})`;

  const addedVal = growth.addedToday ?? 0;
  const blockedVal = growth.blockedToday ?? 0;
  const netVal = growth.netToday ?? 0;

  return (
    <div className="app-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs font-tabular">
      <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.title}</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-center">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide block">{t.totalFriends}</span>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 block">{(growth.totalFriends ?? 0).toLocaleString()}</span>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
          <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wide block">{t.addedToday}{suffix}</span>
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
            {addedVal >= 0 ? `+${addedVal.toLocaleString()}` : addedVal.toLocaleString()}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
          <span className="text-[10px] text-rose-800 dark:text-rose-300 uppercase tracking-wide block">{t.blockedToday}{suffix}</span>
          <span className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1 block">
            {blockedVal > 0 ? `-${blockedVal.toLocaleString()}` : blockedVal === 0 ? "0" : `+${Math.abs(blockedVal).toLocaleString()}`}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/40">
          <span className="text-[10px] text-teal-800 dark:text-teal-300 uppercase tracking-wide block">{t.netGrowth}{suffix}</span>
          <span className="text-lg font-bold text-teal-600 dark:text-teal-400 mt-1 block">
            {netVal >= 0 ? `+${netVal.toLocaleString()}` : netVal.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
