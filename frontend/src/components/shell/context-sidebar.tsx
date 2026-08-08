import React, { useMemo, useState } from "react";
import { sortStoresByPriority } from "./store-priority-sorting.ts";
import { filterStoresBySearch } from "./store-search.ts";
import { formatWaitingDuration, getSlaRiskVariant, type StoreBmCountsItem } from "./store-priority-score.ts";

export type SidebarView =
  | "dashboard"
  | "all"
  | "notReplied"
  | "notifiedBm"
  | "replied"
  | "stores"
  | "customerInsights"
  | "lineOaManagement"
  | "systemStatus"
  | "pilotChecklist";

export interface BulkUpdateRequest {
  storeId: string;
  storeName: string;
  targetStatus: "NOT_REPLIED" | "NOTIFIED_BM" | "REPLIED";
  fromStatuses?: Array<"NOT_REPLIED" | "NOTIFIED_BM" | "REPLIED">;
  affectedCount: number;
}

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
  onRequestBulkUpdate?: (request: BulkUpdateRequest) => void;
}

export const STORE_LIST_PAGE_SIZE = 60;

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
  onRequestBulkUpdate,
}: ContextSidebarProps) {
  const [storeSearch, setStoreSearch] = useState("");
  const [storePage, setStorePage] = useState(1);
  const [activeMenuStoreId, setActiveMenuStoreId] = useState<string | null>(null);

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
  const sortedStores = useMemo(() => {
    return sortStoresByPriority(filteredStores, storeBmCounts, getStoreDisplayName);
  }, [filteredStores, storeBmCounts, getStoreDisplayName]);

  const totalStorePages = Math.max(1, Math.ceil(sortedStores.length / STORE_LIST_PAGE_SIZE));
  const safeStorePage = Math.max(1, Math.min(storePage, totalStorePages));
  const startIndex = (safeStorePage - 1) * STORE_LIST_PAGE_SIZE;
  const visibleStores = sortedStores.slice(startIndex, startIndex + STORE_LIST_PAGE_SIZE);

  const handleClearAll = () => {
    setStoreSearch("");
    setStorePage(1);
    clearAllFilters();
  };

  const totalOverviewCount = (overview.notReplied ?? 0) + (overview.notifiedBm ?? 0) + (overview.replied ?? 0);

  return (
    <aside data-chat-pane="sidebar" className="app-surface flex flex-col h-full min-h-0 min-w-0 overflow-y-auto border-r p-4">
      {/* Overview Status Section */}
      <p className="app-muted mb-3 text-xs font-semibold uppercase tracking-wider">
        {text.overview || "ภาพรวม"}
      </p>

      <nav aria-label="Conversation filters" className="space-y-1">
        <button
          type="button"
          onClick={() => selectSidebarView("all")}
          className={`${sidebarButtonClass("all")} flex items-center justify-between`}
        >
          <span className="truncate">🌐 {text.all || "ทั้งหมด"}</span>
          <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {totalOverviewCount}
          </span>
        </button>

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
            onChange={(e) => {
              setStoreSearch(e.target.value);
              setStorePage(1);
            }}
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

          {visibleStores.map((store) => {
            const counts = storeBmCounts[store.id] ?? { notReplied: 0, notifiedBm: 0, replied: 0, oldestWaitingMinutes: 0 };
            const waitingMins = counts.notReplied > 0 ? (counts.oldestWaitingMinutes ?? 0) : 0;
            const riskVariant = getSlaRiskVariant(waitingMins);
            const pendingCount = counts.notReplied + counts.notifiedBm;
            const isMenuOpen = activeMenuStoreId === store.id;

            return (
              <div key={store.id} className="relative group">
                <button
                  type="button"
                  onClick={() => setSelectedStore(store.id)}
                  className={`app-store-row flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    selectedStore === store.id
                      ? "is-selected font-semibold"
                      : ""
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="truncate pr-1">{getStoreDisplayName(store.name)}</span>
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

                {onRequestBulkUpdate && (
                  <div className="absolute right-1 top-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuStoreId(isMenuOpen ? null : store.id);
                      }}
                      title="Store bulk actions"
                      aria-label={`Bulk actions for ${getStoreDisplayName(store.name)}`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                      ⋯
                    </button>

                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-full mt-1 z-30 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-lg text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {getStoreDisplayName(store.name)}
                        </div>

                        <button
                          type="button"
                          disabled={pendingCount === 0}
                          onClick={() => {
                            setActiveMenuStoreId(null);
                            onRequestBulkUpdate({
                              storeId: store.id,
                              storeName: getStoreDisplayName(store.name),
                              targetStatus: "REPLIED",
                              fromStatuses: ["NOT_REPLIED", "NOTIFIED_BM"],
                              affectedCount: pendingCount,
                            });
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
                        >
                          <span>🟢 ตอบแล้วทั้งหมด</span>
                          <span className="font-semibold">({pendingCount})</span>
                        </button>

                        <button
                          type="button"
                          disabled={counts.notReplied === 0}
                          onClick={() => {
                            setActiveMenuStoreId(null);
                            onRequestBulkUpdate({
                              storeId: store.id,
                              storeName: getStoreDisplayName(store.name),
                              targetStatus: "NOTIFIED_BM",
                              fromStatuses: ["NOT_REPLIED"],
                              affectedCount: counts.notReplied,
                            });
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-950/50 text-purple-700 dark:text-purple-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
                        >
                          <span>🟣 แจ้ง BM ทั้งหมด</span>
                          <span className="font-semibold">({counts.notReplied})</span>
                        </button>

                        <button
                          type="button"
                          disabled={counts.notifiedBm + counts.replied === 0}
                          onClick={() => {
                            setActiveMenuStoreId(null);
                            onRequestBulkUpdate({
                              storeId: store.id,
                              storeName: getStoreDisplayName(store.name),
                              targetStatus: "NOT_REPLIED",
                              fromStatuses: ["NOTIFIED_BM", "REPLIED"],
                              affectedCount: counts.notifiedBm + counts.replied,
                            });
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
                        >
                          <span>⚪ รีเซ็ตเป็นยังไม่ตอบ</span>
                          <span className="font-semibold">({counts.notifiedBm + counts.replied})</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {totalStorePages > 1 && (
            <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2 text-xs text-slate-500">
              <button
                type="button"
                disabled={safeStorePage <= 1}
                onClick={() => setStorePage((p) => Math.max(1, p - 1))}
                className="rounded px-2 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
                aria-label="Previous stores page"
              >
                ‹
              </button>
              <span className="text-[11px] font-medium">
                {safeStorePage} / {totalStorePages} ({sortedStores.length})
              </span>
              <button
                type="button"
                disabled={safeStorePage >= totalStorePages}
                onClick={() => setStorePage((p) => Math.min(totalStorePages, p + 1))}
                className="rounded px-2 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
                aria-label="Next stores page"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
