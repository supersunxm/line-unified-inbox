"use client";

import React, { useState } from "react";
import type { StorePerformanceRow } from "@/types/api";

interface StorePerformanceTableProps {
  stores: StorePerformanceRow[];
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  onSelectStoreQuickView?: (storeId: string) => void;
  language: "th" | "en" | "zh";
}

type FilterStatus = "ALL" | "Excellent" | "Need Attention" | "Improve";
type SortField = "worst_rate" | "highest_pending" | "highest_volume" | "worst_gap";

const LABELS = {
  th: {
    title: "อันดับและเปรียบเทียบค่าเฉลี่ยเครือข่าย (Store Performance & Network Benchmark)",
    rank: "อันดับ",
    store: "สาขา / ร้านค้า",
    messages: "ข้อความทั้งหมด",
    replied: "ตอบกลับแล้ว",
    rate24h: "อัตราตอบกลับ 24 ชม.",
    netAvg: "ค่าเฉลี่ยเครือข่าย",
    gap: "ส่วนต่าง (Gap)",
    pending: "รอดำเนินการ",
    growth: "เติบโตผู้ติดตาม",
    status: "สถานะประสิทธิภาพ",
    action: "การจัดการ",
    viewChats: "ดูบทสนทนา",
    searchPlaceholder: "ค้นหาสาขา...",
    all: "ทั้งหมด (All)",
    excellent: "ดีเยี่ยม (Excellent)",
    needAttention: "ต้องใส่ใจ (Need Attention)",
    improve: "เร่งปรับปรุง (Improve)",
    sortLabel: "จัดเรียงตาม:",
    sortWorstRate: "อัตราตอบกลับต่ำสุด",
    sortHighestPending: "ข้อความค้างสูงสุด",
    sortHighestVolume: "จำนวนข้อความสูงสุด",
    sortWorstGap: "ส่วนต่างติดลบสูงสุด (Worst Gap)",
  },
  en: {
    title: "Store Performance Ranking & Network Benchmark Matrix",
    rank: "Rank",
    store: "Store",
    messages: "Messages",
    replied: "Replied",
    rate24h: "24H Response Rate",
    netAvg: "Network Avg",
    gap: "Benchmark Gap",
    pending: "Pending",
    growth: "Follower Growth",
    status: "Performance Status",
    action: "Action",
    viewChats: "View Chats",
    searchPlaceholder: "Search store...",
    all: "All",
    excellent: "Excellent",
    needAttention: "Need Attention",
    improve: "Improve",
    sortLabel: "Sort by:",
    sortWorstRate: "Worst Response Rate",
    sortHighestPending: "Highest Pending",
    sortHighestVolume: "Highest Volume",
    sortWorstGap: "Worst Gap vs Network Avg",
  },
  zh: {
    title: "门店绩效与网络基准对比矩阵 (Network Benchmark)",
    rank: "排名",
    store: "门店",
    messages: "消息总量",
    replied: "已回复",
    rate24h: "24小时回复率",
    netAvg: "全网平均",
    gap: "基准差距 (Gap)",
    pending: "待处理",
    growth: "好友增长",
    status: "绩效状态",
    action: "操作",
    viewChats: "查看会话",
    searchPlaceholder: "搜索门店...",
    all: "全部",
    excellent: "优秀",
    needAttention: "需要关注",
    improve: "需改进",
    sortLabel: "排序:",
    sortWorstRate: "最低回复率",
    sortHighestPending: "最多待处理",
    sortHighestVolume: "最多消息量",
    sortWorstGap: "最大负差距 (Worst Gap)",
  },
};

function renderStatusBadge(status: StorePerformanceRow["status"], rate: number) {
  if (rate >= 90 || status === "Excellent") {
    return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">🟢 Excellent</span>;
  }
  if (rate < 70 || status === "Improve") {
    return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">🔴 Improve</span>;
  }
  return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">🟡 Need Attention</span>;
}

export function StorePerformanceTable({
  stores,
  getStoreDisplayName,
  onOpenStore,
  onSelectStoreQuickView,
  language,
}: StorePerformanceTableProps) {
  const t = LABELS[language] ?? LABELS.en;
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [sortBy, setSortBy] = useState<SortField>("worst_rate");

  let processed = stores.filter((s) => {
    const matchSearch = getStoreDisplayName(s.storeName).toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterStatus === "ALL") return true;
    if (filterStatus === "Excellent") return s.responseRate24h >= 90;
    if (filterStatus === "Improve") return s.responseRate24h < 70;
    if (filterStatus === "Need Attention") return s.responseRate24h >= 70 && s.responseRate24h < 90;
    return true;
  });

  processed = [...processed].sort((a, b) => {
    if (sortBy === "worst_rate") return a.responseRate24h - b.responseRate24h;
    if (sortBy === "worst_gap") return a.gapVsNetworkAvg - b.gapVsNetworkAvg;
    if (sortBy === "highest_pending") return b.pending - a.pending;
    if (sortBy === "highest_volume") return b.messages - a.messages;
    return 0;
  });

  return (
    <div className="app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.title}</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Benchmarking individual store response SLA against national network averages</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--accent)] text-[var(--foreground)] outline-none focus:ring-1 focus:ring-emerald-500 w-full sm:w-64"
        />
      </div>

      {/* Filter and Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border)] text-xs">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(["ALL", "Excellent", "Need Attention", "Improve"] as FilterStatus[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                filterStatus === st
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {st === "ALL" ? t.all : st === "Excellent" ? t.excellent : st === "Need Attention" ? t.needAttention : t.improve}
            </button>
          ))}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <span className="font-semibold">{t.sortLabel}</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="px-2.5 py-1 text-xs rounded-md border border-[var(--border)] bg-[var(--accent)] text-[var(--foreground)] outline-none font-medium"
          >
            <option value="worst_rate">{t.sortWorstRate}</option>
            <option value="worst_gap">{t.sortWorstGap}</option>
            <option value="highest_pending">{t.sortHighestPending}</option>
            <option value="highest_volume">{t.sortHighestVolume}</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)] font-medium">
              <th className="py-2.5 px-3">{t.rank}</th>
              <th className="py-2.5 px-3">{t.store}</th>
              <th className="py-2.5 px-3 text-right">{t.messages}</th>
              <th className="py-2.5 px-3 text-right">{t.rate24h}</th>
              <th className="py-2.5 px-3 text-right">{t.netAvg}</th>
              <th className="py-2.5 px-3 text-right">{t.gap}</th>
              <th className="py-2.5 px-3 text-right">{t.pending}</th>
              <th className="py-2.5 px-3 text-center">{t.status}</th>
              <th className="py-2.5 px-3 text-right">{t.action}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {processed.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-[var(--muted-foreground)]">No stores match filter</td>
              </tr>
            ) : (
              processed.map((s) => {
                const gap = s.gapVsNetworkAvg ?? (s.responseRate24h - 91);
                const gapSymbol = gap >= 0 ? "+" : "";
                return (
                  <tr
                    key={s.storeId}
                    onClick={() => (onSelectStoreQuickView ? onSelectStoreQuickView(s.storeId) : onOpenStore(s.storeId))}
                    className="hover:bg-[var(--accent)]/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3 font-bold text-[var(--foreground)]">#{s.rank}</td>
                    <td className="py-3 px-3 font-semibold text-[var(--foreground)]">{getStoreDisplayName(s.storeName)}</td>
                    <td className="py-3 px-3 text-right font-medium text-[var(--foreground)]">{s.messages}</td>
                    <td className="py-3 px-3 text-right font-black text-emerald-700 dark:text-emerald-300">{s.responseRate24h}%</td>
                    <td className="py-3 px-3 text-right font-medium text-[var(--muted-foreground)]">{s.networkAvgResponseRate24h || 91}%</td>
                    <td className="py-3 px-3 text-right font-bold">
                      <span className={gap < 0 ? "text-rose-600 dark:text-rose-400 font-extrabold" : "text-emerald-600 dark:text-emerald-400 font-extrabold"}>
                        {gapSymbol}{gap}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={s.pending > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-[var(--muted-foreground)]"}>
                        {s.pending}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">{renderStatusBadge(s.status, s.responseRate24h)}</td>
                    <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onOpenStore(s.storeId)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                      >
                        {t.viewChats}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
