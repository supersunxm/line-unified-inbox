"use client";

import React, { useState } from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";
import { StorePerformanceTable } from "./store-performance-table";

interface StorePerformanceOverviewProps {
  stores: DashboardAnalyticsResponse["storeRanking"];
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  onSelectStoreQuickView: (storeId: string) => void;
  language: "th" | "en" | "zh";
}

const labels = {
  th: {
    title: "ภาพรวมประสิทธิภาพสาขา (Store Performance Overview)",
    subtitle: "เปรียบเทียบสาขาที่ต้องเข้าแทรกแซง และ สาขาต้นแบบ",
    needAttentionTitle: "🔴 สาขาที่ต้องให้ความสนใจด่วน (Need Attention)",
    bestPracticeTitle: "🥇 สาขาต้นแบบยอดเยี่ยม (Best Practice)",
    viewAllStores: "ดูสาขาทั้งหมด (View All Stores)",
    hideAllStores: "ซ่อนตารางสาขาทั้งหมด",
    storeName: "สาขา",
    slaRate: "อัตราตอบกลับ",
    pending: "รอดำเนินการ",
    action: "การดำเนินการ",
    openDrawer: "รายละเอียด",
  },
  en: {
    title: "Store Performance Overview",
    subtitle: "Comparison of stores needing intervention vs top performers",
    needAttentionTitle: "🔴 Need Immediate Attention (Top 5)",
    bestPracticeTitle: "🥇 Best Practice Stores (Top 5)",
    viewAllStores: "View All Stores Table",
    hideAllStores: "Hide Full Store Table",
    storeName: "Store",
    slaRate: "Response Rate",
    pending: "Pending",
    action: "Action",
    openDrawer: "Details",
  },
  zh: {
    title: "门店绩效概览",
    subtitle: "需要干预的门店与表现最佳门店对比",
    needAttentionTitle: "🔴 需要立即注意的门店 (前 5)",
    bestPracticeTitle: "🥇 最佳实践门店 (前 5)",
    viewAllStores: "查看所有门店表格",
    hideAllStores: "隐藏完整门店表格",
    storeName: "门店",
    slaRate: "回复率",
    pending: "待处理",
    action: "操作",
    openDrawer: "详情",
  },
};

export function StorePerformanceOverview({
  stores,
  getStoreDisplayName,
  onOpenStore,
  onSelectStoreQuickView,
  language,
}: StorePerformanceOverviewProps) {
  const t = labels[language] ?? labels.th;
  const [showFullTable, setShowFullTable] = useState(false);

  const needAttentionStores = stores
    .slice()
    .sort((a, b) => a.responseRate24h - b.responseRate24h)
    .slice(0, 5);

  const topBestPracticeStores = stores
    .slice()
    .sort((a, b) => b.responseRate24h - a.responseRate24h)
    .slice(0, 5);

  return (
    <section data-store-performance-overview className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-emerald-600 text-white uppercase tracking-wider">
              LEVEL 4 · STORES
            </span>
            <h2 className="text-base font-extrabold text-[var(--foreground)] tracking-tight">
              🏬 {t.title}
            </h2>
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)] font-medium">
            {t.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowFullTable((prev) => !prev)}
          className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--accent)] text-xs font-bold text-[var(--foreground)] shadow-sm transition-all"
        >
          {showFullTable ? `▲ ${t.hideAllStores}` : `▼ ${t.viewAllStores}`}
        </button>
      </div>

      {/* Dichotomy Cards (Top 5 Need Attention vs Top 5 Best Practice) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Need Attention Column */}
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-[var(--surface)] p-4 shadow-sm space-y-3">
          <h3 className="font-extrabold text-sm text-rose-700 dark:text-rose-300">
            {t.needAttentionTitle}
          </h3>

          <div className="space-y-2">
            {needAttentionStores.map((store) => (
              <div
                key={store.storeId}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-rose-100 dark:border-rose-950 bg-rose-50/40 dark:bg-rose-950/20 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[var(--foreground)] truncate">
                    {getStoreDisplayName(store.storeName)}
                  </div>
                  <div className="mt-0.5 text-slate-500 flex gap-2">
                    <span>Pending: <strong className="text-rose-600">{store.pending}</strong></span>
                    <span>Avg time: <strong>{store.avgResponseMinutes}m</strong></span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-black text-rose-600 text-sm">
                    {Math.round(store.responseRate24h * 100)}% Rate
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectStoreQuickView(store.storeId)}
                    className="mt-1 text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    {t.openDrawer} ➔
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best Practice Column */}
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-[var(--surface)] p-4 shadow-sm space-y-3">
          <h3 className="font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
            {t.bestPracticeTitle}
          </h3>

          <div className="space-y-2">
            {topBestPracticeStores.map((store) => (
              <div
                key={store.storeId}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-emerald-100 dark:border-emerald-950 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[var(--foreground)] truncate">
                    {getStoreDisplayName(store.storeName)}
                  </div>
                  <div className="mt-0.5 text-slate-500 flex gap-2">
                    <span>Replied: <strong className="text-emerald-600">{store.replied}</strong></span>
                    <span>Avg time: <strong>{store.avgResponseMinutes}m</strong></span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-black text-emerald-600 text-sm">
                    {Math.round(store.responseRate24h * 100)}% Rate
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectStoreQuickView(store.storeId)}
                    className="mt-1 text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    {t.openDrawer} ➔
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Expandable Full Table View */}
      {showFullTable && (
        <div className="pt-2 animate-fadeIn">
          <StorePerformanceTable
            stores={stores}
            getStoreDisplayName={getStoreDisplayName}
            onOpenStore={onOpenStore}
            onSelectStoreQuickView={onSelectStoreQuickView}
            language={language}
          />
        </div>
      )}
    </section>
  );
}
