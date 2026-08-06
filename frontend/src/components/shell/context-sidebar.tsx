import React, { useMemo, useState } from "react";
import { sortStoresByPriority } from "./store-priority-sorting.ts";
import { filterStoresBySearch } from "./store-search.ts";
import { formatWaitingDuration, getSlaRiskVariant, type StoreBmCountsItem } from "./store-priority-score.ts";

export type SidebarView =
  | "dashboard"
  | "notReplied"
  | "notifiedBm"
  | "replied"
  | "stores"
  | "customerInsights"
  | "lineOaManagement"
  | "systemStatus"
  | "pilotChecklist";

export interface ContextSidebarProps {
  sidebarView: SidebarView;
  selectSidebarView: (view: SidebarView) => void;
  overview: { notReplied: number; notifiedBm: number; replied: number };
  storeBmCounts: Record<string, StoreBmCountsItem>;
  selectedStore: string;
  setSelectedStore: (storeId: string) => void;
  clearAllFilters: () => void;
  stores: Array<{ id: string; name: string; waiting: number; lineOaCount: number; code?: string; accountName?: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  text: Record<string, any>;
  getStoreDisplayName: (name: string) => string;
}

export { sortStoresByPriority, filterStoresBySearch };

export function ContextSidebar({
  sidebarView,
  selectSidebarView,
  overview,
  storeBmCounts,
  selectedStore,
  setSelectedStore,
  clearAllFilters,
  stores,
  text,
  getStoreDisplayName,
}: ContextSidebarProps) {
  const [storeSearch, setStoreSearch] = useState("");

  const sidebarButtonClass = (view: SidebarView) =>
    `app-nav-item w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      sidebarView === view
        ? "is-selected font-semibold"
        : ""
    }`;

  // Filter stores by search keyword, then sort by SLA operational priority.
  const filteredStores = useMemo(() => {
    return filterStoresBySearch(stores, storeSearch, getStoreDisplayName);
  }, [stores, storeSearch, getStoreDisplayName]);

  // Sort stores by operational priority and SLA aging urgency.
  // Stores with oldest unanswered customer conversations
  // must appear first because they require immediate action.
  const sortedStores = useMemo(() => {
    return sortStoresByPriority(filteredStores, storeBmCounts, getStoreDisplayName);
  }, [filteredStores, storeBmCounts, getStoreDisplayName]);

  const handleClearAll = () => {
    setStoreSearch("");
    clearAllFilters();
  };

  return (
    <aside data-chat-pane="sidebar" className="app-surface flex flex-col h-full min-h-0 min-w-0 overflow-y-auto border-r p-4">
      {/* Overview Status Section */}
      <p className="app-muted mb-3 text-xs font-semibold uppercase tracking-wider">
        {text.overview || "ภาพรวม"}
      </p>

      <nav aria-label="Conversation filters" className="space-y-1">
        <button
          type="button"
          onClick={() => selectSidebarView("notReplied")}
          className={`${sidebarButtonClass("notReplied")} flex items-center justify-between`}
        >
          <span className="truncate">⚪ {text.notReplied || "ยังไม่ตอบ"}</span>
          <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {overview.notReplied}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("notifiedBm")}
          className={`${sidebarButtonClass("notifiedBm")} flex items-center justify-between`}
        >
          <span className="truncate">🟣 {text.notifiedBm || "แจ้ง BM แล้ว"}</span>
          <span className="ml-2 rounded-full bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            {overview.notifiedBm}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("replied")}
          className={`${sidebarButtonClass("replied")} flex items-center justify-between`}
        >
          <span className="truncate">🟢 {text.replied || "ตอบแล้ว"}</span>
          <span className="ml-2 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {overview.replied}
          </span>
        </button>
      </nav>

      {/* Stores Filter Section */}
      <div className="my-4 border-t border-slate-200 dark:border-slate-800" />

      <div className="mb-2 flex items-center justify-between">
        <p className="app-muted text-xs font-semibold uppercase tracking-wider">
          {text.stores || "ร้านค้า"}
        </p>
        <button
          type="button"
          onClick={handleClearAll}
          className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded px-1"
        >
          {text.clearAll || "ล้างทั้งหมด"}
        </button>
      </div>

      {/* Inline Store Search Box */}
      <div className="mb-3">
        <label className="relative block">
          <span className="sr-only">{text.searchStores || "ค้นหาร้านค้า"}</span>
          <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            🔍
          </span>
          <input
            type="search"
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
            placeholder={text.searchStoresPlaceholder || "Search stores..."}
            className="app-input h-8 w-full rounded-lg border py-1 pl-8 pr-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </label>
      </div>

      {sortedStores.length === 0 && storeSearch.trim() !== "" ? (
        <div className="py-6 text-center text-xs app-muted">
          <p className="font-semibold text-slate-600 dark:text-slate-400">
            {text.noStoresFound || "No stores found"}
          </p>
          <p className="mt-1 text-slate-400 dark:text-slate-500">
            {text.tryAnotherKeyword || "Try another keyword"}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setSelectedStore("all")}
            className={`app-store-row flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              selectedStore === "all"
                ? "is-selected font-semibold"
                : ""
            }`}
          >
            <span className="truncate">{text.allStores || "ร้านค้าทั้งหมด"}</span>
            <div className="ml-2 flex items-center space-x-1 shrink-0">
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title="Not Replied">
                {overview.notReplied}
              </span>
              <span className="rounded-full bg-purple-100 dark:bg-purple-950/80 px-1.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800" title="Notified BM">
                {overview.notifiedBm}
              </span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title="Replied">
                {overview.replied}
              </span>
            </div>
          </button>

          {sortedStores.map((store) => {
            const counts = storeBmCounts[store.id] ?? { notReplied: 0, notifiedBm: 0, replied: 0, oldestWaitingMinutes: 0 };
            const waitingMins = counts.notReplied > 0 ? (counts.oldestWaitingMinutes ?? 0) : 0;
            const riskVariant = getSlaRiskVariant(waitingMins);

            return (
              <button
                key={store.id}
                type="button"
                onClick={() => setSelectedStore(store.id)}
                className={`app-store-row flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  selectedStore === store.id
                    ? "is-selected font-semibold"
                    : ""
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="truncate">{getStoreDisplayName(store.name)}</span>
                  <div className="ml-2 flex items-center space-x-1 shrink-0">
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title="Not Replied">
                      {counts.notReplied}
                    </span>
                    <span className="rounded-full bg-purple-100 dark:bg-purple-950/80 px-1.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800" title="Notified BM">
                      {counts.notifiedBm}
                    </span>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title="Replied">
                      {counts.replied}
                    </span>
                  </div>
                </div>

                {waitingMins > 0 && (
                  <div className={`mt-0.5 flex items-center text-[11px] font-medium ${
                    riskVariant === "danger"
                      ? "text-red-600 dark:text-red-400 font-semibold"
                      : riskVariant === "warning"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-slate-500 dark:text-slate-400"
                  }`}>
                    <span aria-hidden="true" className="mr-1">
                      {riskVariant === "danger" ? "🔥" : "⏱"}
                    </span>
                    <span>
                      Waiting {formatWaitingDuration(waitingMins)}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
