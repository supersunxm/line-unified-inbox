"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface NetworkHealthBannerProps {
  health: DashboardAnalyticsResponse["operationHealth"];
  efficiency: DashboardAnalyticsResponse["operationEfficiency"];
  language: "th" | "en" | "zh";
}

const statusConfig = {
  CRITICAL: {
    badgeClass: "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300",
    icon: "🔴",
    th: "วิกฤต (Critical)",
    en: "Critical",
    zh: "严重",
  },
  WARNING: {
    badgeClass: "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300",
    icon: "🟡",
    th: "ต้องให้ความสนใจ (Attention Required)",
    en: "Attention Required",
    zh: "需要注意",
  },
  GOOD: {
    badgeClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300",
    icon: "🟢",
    th: "ปกติ (Healthy)",
    en: "Healthy",
    zh: "健康",
  },
};

const labels = {
  th: {
    title: "สถานะการดำเนินงานเครือข่าย",
    scoreLabel: "คะแนนสุขภาพระบบ",
    reasonsTitle: "เหตุผลหลักที่ต้องติดตาม",
    totalToday: "การสนทนาทั้งหมดวันนี้",
    resolvedToday: "ตอบแล้วเสร็จ",
    pendingToday: "รอดำเนินการ",
    storesAtRisk: "สาขาเสี่ยงผิด SLA",
    slaRate: "อัตราตอบตาม SLA",
  },
  en: {
    title: "Network Operation Health",
    scoreLabel: "Health Score",
    reasonsTitle: "Operational Explanation",
    totalToday: "Total Messages Today",
    resolvedToday: "Resolved",
    pendingToday: "Pending Action",
    storesAtRisk: "Stores at SLA Risk",
    slaRate: "SLA Achievement Rate",
  },
  zh: {
    title: "网络运营健康状态",
    scoreLabel: "健康评分",
    reasonsTitle: "运营说明",
    totalToday: "今日消息总数",
    resolvedToday: "已解决",
    pendingToday: "待处理",
    storesAtRisk: "SLA 风险门店",
    slaRate: "SLA 达成率",
  },
};

export function NetworkHealthBanner({ health, efficiency, language }: NetworkHealthBannerProps) {
  const t = labels[language] ?? labels.th;

  const score = Math.round(health.breakdown.compositeScore * 100);
  const statusKey: "CRITICAL" | "WARNING" | "GOOD" =
    score < 60 ? "CRITICAL" : score < 80 ? "WARNING" : "GOOD";

  const currentStatus = statusConfig[statusKey];

  const factors = [
    `ข้อความรอดำเนินการทั้งหมด: ${efficiency.opened} รายการ`,
    `อัตราตอบกลับภายใน 24 ชม.: ${Math.round(health.responseRate24h * 100)}%`,
    `อัตราปิดเคสตามเป้าหมาย: ${Math.round(efficiency.closureRate * 100)}%`,
  ];

  return (
    <div
      data-network-health-banner
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--foreground)] shadow-sm"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Status & Operational Reason (Level 1 Core) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--muted-foreground)]">
              LEVEL 1 · {t.title}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${currentStatus.badgeClass}`}
            >
              <span>{currentStatus.icon}</span>
              <span>{currentStatus[language] ?? currentStatus.en}</span>
            </span>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              {t.reasonsTitle}
            </h2>
            <ul className="mt-1.5 space-y-1 text-sm font-medium text-[var(--foreground)]">
              {factors.map((factor, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="text-amber-500">▪</span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Operational Score & Today's Volume Counters */}
        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-[var(--border)] pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between h-full space-y-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">{t.scoreLabel}</span>
            <div className="text-right">
              <span className="text-2xl font-black tracking-tight text-[var(--foreground)]">{score}</span>
              <span className="text-xs text-[var(--muted-foreground)]"> / 100</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)] text-xs">
            <div className="bg-[var(--background)] p-2.5 rounded-xl border border-[var(--border)]">
              <div className="text-[var(--muted-foreground)] font-semibold">{t.pendingToday}</div>
              <div className="text-base font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                {efficiency.opened}
              </div>
            </div>
            <div className="bg-[var(--background)] p-2.5 rounded-lg border border-[var(--border)]">
              <div className="text-[var(--muted-foreground)] font-semibold">{t.slaRate}</div>
              <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {Math.round(efficiency.closureRate * 100)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
