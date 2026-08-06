"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface ExecutiveKpiProps {
  data: DashboardAnalyticsResponse["summaryCards"];
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    messagesToday: "ข้อความวันนี้",
    vsYesterday: "เทียบกับเมื่อวาน",
    responseRate24h: "อัตราตอบกลับใน 24 ชม.",
    excellent: "ดีเยี่ยม (Excellent)",
    needAttention: "ต้องใส่ใจ (Need Attention)",
    improve: "เร่งปรับปรุง (Improve)",
    repliedToday: "ตอบกลับแล้ววันนี้",
    ofToday: "ของข้อความวันนี้",
    pending: "รอดำเนินการ",
    waitingStore: "รอสาขาตอบกลับ",
    bmEscalated: "ส่งต่อให้ BM",
    actionRequired: "ต้องดำเนินการ",
    friendGrowth: "การเติบโตผู้ติดตาม",
    todayNet: "สุทธิวันนี้",
  },
  en: {
    messagesToday: "Messages Today",
    vsYesterday: "vs yesterday",
    responseRate24h: "24H Response Rate",
    excellent: "Excellent",
    needAttention: "Need Attention",
    improve: "Improve",
    repliedToday: "Replied Today",
    ofToday: "of today's messages",
    pending: "Pending",
    waitingStore: "Waiting for store response",
    bmEscalated: "BM Escalated",
    actionRequired: "Cases requiring manager action",
    friendGrowth: "LINE OA Growth",
    todayNet: "Net Today",
  },
  zh: {
    messagesToday: "今日消息总量",
    vsYesterday: "对比昨日",
    responseRate24h: "24小时回复率",
    excellent: "优秀",
    needAttention: "需要关注",
    improve: "需改进",
    repliedToday: "今日已回复",
    ofToday: "占今日消息",
    pending: "待处理",
    waitingStore: "等待门店回复",
    bmEscalated: "BM 已升级",
    actionRequired: "需管理介入",
    friendGrowth: "LINE OA 好友增长",
    todayNet: "今日净增",
  },
};

export function ExecutiveKpiCards({ data, language }: ExecutiveKpiProps) {
  const t = LABELS[language] ?? LABELS.en;

  const rate = data.responseRate24h;
  let rateBadgeLabel = t.excellent;
  let rateBadgeStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";

  if (rate < 70) {
    rateBadgeLabel = t.improve;
    rateBadgeStyle = "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800";
  } else if (rate < 90) {
    rateBadgeLabel = t.needAttention;
    rateBadgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800";
  }

  const diffSymbol = data.messagesDiffPct >= 0 ? "+" : "";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
      {/* 1. Messages Today */}
      <div className="app-card p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">{t.messagesToday}</span>
          <span className="w-2 h-2 rounded-full bg-blue-500" />
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-[var(--foreground)]">{data.messagesToday.toLocaleString()}</div>
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
            {diffSymbol}{data.messagesDiffPct}% {t.vsYesterday}
          </div>
        </div>
      </div>

      {/* 2. 24H Response Rate (MOST IMPORTANT KPI) */}
      <div className="app-card p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 dark:from-emerald-950/30 dark:to-teal-950/20 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">{t.responseRate24h}</span>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${rateBadgeStyle}`}>
            {rateBadgeLabel}
          </span>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{data.responseRate24h}%</div>
          <div className="text-[11px] font-semibold text-emerald-800/80 dark:text-emerald-400/80 mt-1">
            {data.count24hReplied} / {data.messagesToday} conversations
          </div>
        </div>
      </div>

      {/* 3. Replied Today */}
      <div className="app-card p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">{t.repliedToday}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-[var(--foreground)]">{data.repliedCount.toLocaleString()}</div>
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
            {data.repliedPercentage}% {t.ofToday}
          </div>
        </div>
      </div>

      {/* 4. Pending */}
      <div className="app-card p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">{t.pending}</span>
          <span className={`w-2 h-2 rounded-full ${data.pendingCount > 0 ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`} />
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-[var(--foreground)]">{data.pendingCount.toLocaleString()}</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1 font-medium">{t.waitingStore}</div>
        </div>
      </div>

      {/* 5. BM Escalated */}
      <div className="app-card p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">{t.bmEscalated}</span>
          <span className="w-2 h-2 rounded-full bg-amber-500" />
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-[var(--foreground)]">{data.bmNotifiedCount.toLocaleString()}</div>
          <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">{t.actionRequired}</div>
        </div>
      </div>

      {/* 6. LINE OA Growth */}
      <div className="app-card p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">{t.friendGrowth}</span>
          <span className="w-2 h-2 rounded-full bg-teal-500" />
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-teal-700 dark:text-teal-400">+{data.followerGrowth.netToday}</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1 font-medium">
            +{data.followerGrowth.addedToday} Added / -{data.followerGrowth.blockedToday} Blocked
          </div>
        </div>
      </div>
    </div>
  );
}
