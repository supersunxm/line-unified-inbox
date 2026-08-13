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

const LABELS = {
  th: {
    sectionTitle: "Store Performance",
    title: "ประสิทธิภาพการดำเนินงานรายสาขา",
    subtitle: "เปรียบเทียบสาขาที่มีผลการดำเนินงานยอดเยี่ยมและสาขาที่ต้องการการดูแล",
    topStoresTitle: "สาขาต้นแบบยอดเยี่ยม (Top Performers)",
    attentionStoresTitle: "สาขาที่ต้องให้ความสนใจ (Need Attention)",
    viewAllStores: "ดูตารางสาขาทั้งหมด",
    hideAllStores: "ซ่อนตารางสาขาทั้งหมด",
    storeName: "สาขา",
    rate: "อัตราตอบกลับ",
    pending: "รอดำเนินการ",
    replied: "ตอบกลับแล้ว",
    avgTime: "เวลาเฉลี่ย",
    details: "รายละเอียด",
  },
  en: {
    sectionTitle: "Store Performance",
    title: "Store Operational Performance",
    subtitle: "Comparison of top performing stores vs stores requiring attention",
    topStoresTitle: "Top Performing Stores",
    attentionStoresTitle: "Stores Requiring Attention",
    viewAllStores: "View All Stores Table",
    hideAllStores: "Hide Full Store Table",
    storeName: "Store",
    rate: "Response Rate",
    pending: "Pending",
    replied: "Replied",
    avgTime: "Avg Time",
    details: "Details",
  },
  zh: {
    sectionTitle: "门店运营绩效",
    title: "各门店运营效率概览",
    subtitle: "表现优秀门店与需重点关注门店对比",
    topStoresTitle: "优秀标杆门店 (Top Performers)",
    attentionStoresTitle: "需关注门店 (Need Attention)",
    viewAllStores: "查看完整门店表格",
    hideAllStores: "隐藏完整门店表格",
    storeName: "门店",
    rate: "回复率",
    pending: "待处理",
    replied: "已回复",
    avgTime: "平均耗时",
    details: "详情",
  },
};

function formatRate(rate: number): number {
  if (rate <= 1 && rate > 0) return Math.round(rate * 100);
  return Math.round(rate);
}

export function StorePerformanceOverview({
  stores,
  getStoreDisplayName,
  onOpenStore,
  onSelectStoreQuickView,
  language,
}: StorePerformanceOverviewProps) {
  const t = LABELS[language] ?? LABELS.en;
  const [showFullTable, setShowFullTable] = useState(false);

  const topBestPracticeStores = stores
    .slice()
    .sort((a, b) => b.responseRate24h - a.responseRate24h || b.messages - a.messages)
    .slice(0, 5);

  const needAttentionStores = stores
    .slice()
    .sort((a, b) => a.responseRate24h - b.responseRate24h || b.pending - a.pending)
    .slice(0, 5);

  return (
    <section data-store-performance-overview className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t.sectionTitle}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowFullTable((prev) => !prev)}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition-all font-tabular"
        >
          {showFullTable ? `▲ ${t.hideAllStores}` : `▼ ${t.viewAllStores}`}
        </button>
      </div>

      {/* 2-Column: Top Performers vs Stores Requiring Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 font-tabular">
        {/* Top Performers */}
        <div className="app-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {t.topStoresTitle}
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/40">
              High Response
            </span>
          </div>

          <div className="space-y-2">
            {topBestPracticeStores.map((store, idx) => (
              <div
                key={store.storeId}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    #{idx + 1} {getStoreDisplayName(store.storeName)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 flex gap-2">
                    <span>{t.replied}: <strong className="text-emerald-600 dark:text-emerald-400">{store.replied}</strong></span>
                    <span>•</span>
                    <span>{t.avgTime}: <strong>{store.avgResponseMinutes || 15}m</strong></span>
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-3">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {formatRate(store.responseRate24h)}%
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectStoreQuickView(store.storeId)}
                    className="text-[11px] font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {t.details} ➔
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stores Requiring Attention */}
        <div className="app-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {t.attentionStoresTitle}
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-800/40">
              Needs Follow-up
            </span>
          </div>

          <div className="space-y-2">
            {needAttentionStores.map((store, idx) => (
              <div
                key={store.storeId}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    #{idx + 1} {getStoreDisplayName(store.storeName)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 flex gap-2">
                    <span>{t.pending}: <strong className="text-rose-600 dark:text-rose-400">{store.pending}</strong></span>
                    <span>•</span>
                    <span>{t.avgTime}: <strong>{store.avgResponseMinutes || 45}m</strong></span>
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-3">
                  <div className={`font-bold text-sm ${
                    formatRate(store.responseRate24h) < 70
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}>
                    {formatRate(store.responseRate24h)}%
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectStoreQuickView(store.storeId)}
                    className="text-[11px] font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {t.details} ➔
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

