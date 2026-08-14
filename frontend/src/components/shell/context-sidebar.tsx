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
  stores: Array<{ id: string; storeId?: string | null; masterStoreId?: string | null; externalStoreId?: string | null; name: string; waiting: number; lineOaCount: number; code?: string; accountName?: string }>;
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
    `app-nav-item w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
      sidebarView === view
        ? "is-selected font-semibold bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
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
    <aside data-chat-pane="sidebar" className="app-surface flex flex-col h-full min-h-0 min-w-0 overflow-y-auto border-r border-slate-200 dark:border-slate-800 p-3">
      {/* Overview Status Section */}
      <p className="app-muted mb-3 text-xs font-semibold uppercase tracking-wider">
        {text.overview || "ภาพรวม"}
      </p>

      <nav aria-label="Conversation filters" className="space-y-0.5">
        <button
          type="button"
          onClick={() => selectSidebarView("all")}
          className={`${sidebarButtonClass("all")} flex items-center justify-between`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
            <span>{text.all || "ทั้งหมด"}</span>
          </span>
          <span className="font-tabular ml-2 rounded-md bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            {totalOverviewCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("notReplied")}
          className={`${sidebarButtonClass("notReplied")} flex items-center justify-between`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            <span>{text.notReplied || "ยังไม่ตอบ"}</span>
          </span>
          <span className="font-tabular ml-2 rounded-md bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40">
            {overview.notReplied}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("notifiedBm")}
          className={`${sidebarButtonClass("notifiedBm")} flex items-center justify-between`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
            <span>{text.notifiedBm || "แจ้ง BM แล้ว"}</span>
          </span>
          <span className="font-tabular ml-2 rounded-md bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900/40">
            {overview.notifiedBm}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("replied")}
          className={`${sidebarButtonClass("replied")} flex items-center justify-between`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>{text.replied || "ตอบแล้ว"}</span>
          </span>
          <span className="font-tabular ml-2 rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40">
            {overview.replied}
          </span>
        </button>
      </nav>

      {/* Stores Filter Section */}
      <div className="my-3 border-t border-slate-200 dark:border-slate-800" />

      <div className="mb-2 flex items-center justify-between px-1">
        <p className="app-muted text-xs font-semibold uppercase tracking-wider">
          {text.stores || "ร้านค้า"}
        </p>
        <button
          type="button"
          onClick={handleClearAll}
          className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded px-1"
        >
          {text.clearAll || "ล้างทั้งหมด"}
        </button>
      </div>

      {/* Inline Store Search Box */}
      <div className="mb-2.5">
        <label className="relative block">
          <span className="sr-only">{text.searchStores || "ค้นหาร้านค้า"}</span>
          <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            ⌕
          </span>
          <input
            type="search"
            value={storeSearch}
            onChange={(e) => {
              setStoreSearch(e.target.value);
              setStorePage(1);
            }}
            placeholder={text.searchStoresPlaceholder || "Search stores..."}
            className="app-input h-7 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 py-1 pl-7 pr-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
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
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setSelectedStore("all")}
            className={`app-store-row flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-all duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
              selectedStore === "all"
                ? "is-selected font-semibold bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
            }`}
          >
            <span className="truncate">{text.allStores || "ร้านค้าทั้งหมด"}</span>
            <div className="ml-2 flex items-center space-x-1 shrink-0 font-tabular">
              <span className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.2 text-[10px] font-medium text-slate-600 dark:text-slate-300" title="Not Replied">
                {overview.notReplied}
              </span>
              <span className="rounded bg-purple-50 dark:bg-purple-950/60 px-1 py-0.2 text-[10px] font-medium text-purple-600 dark:text-purple-300" title="Notified BM">
                {overview.notifiedBm}
              </span>
              <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 text-[10px] font-medium text-emerald-600 dark:text-emerald-300" title="Replied">
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
                  className={`app-store-row flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left text-xs transition-all duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                    selectedStore === store.id
                      ? "is-selected font-semibold bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="truncate pr-1 font-medium">
                      {(store.masterStoreId || store.externalStoreId) && (
                        <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 mr-1 opacity-80">
                          [{store.masterStoreId ?? store.externalStoreId}]
                        </span>
                      )}
                      {getStoreDisplayName(store.name)}
                    </span>
                    <div className="ml-2 flex items-center space-x-1 shrink-0 font-tabular">
                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.2 text-[10px] font-medium text-slate-600 dark:text-slate-300" title="Not Replied">
                        {counts.notReplied}
                      </span>
                      <span className="rounded bg-purple-50 dark:bg-purple-950/60 px-1 py-0.2 text-[10px] font-medium text-purple-600 dark:text-purple-300" title="Notified BM">
                        {counts.notifiedBm}
                      </span>
                      <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 text-[10px] font-medium text-emerald-600 dark:text-emerald-300" title="Replied">
                        {counts.replied}
                      </span>
                    </div>
                  </div>

                  {waitingMins > 0 && (
                    <div className={`mt-0.5 flex items-center text-[10px] font-medium font-tabular ${
                      riskVariant === "danger"
                        ? "text-red-600 dark:text-red-400 font-semibold"
                        : riskVariant === "warning"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-slate-400 dark:text-slate-500"
                    }`}>
                      <span aria-hidden="true" className="mr-1 text-[9px]">
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
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded px-1 py-0.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-2xs transition-opacity"
                    >
                      ⋯
                    </button>

                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 shadow-xl text-xs backdrop-blur-md"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300 truncate text-[11px]">
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
                          className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between text-xs transition-colors"
                        >
                          <span>🟢 ตอบแล้วทั้งหมด</span>
                          <span className="font-semibold font-tabular">({pendingCount})</span>
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
                          className="w-full text-left px-3 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between text-xs transition-colors"
                        >
                          <span>🟣 แจ้ง BM ทั้งหมด</span>
                          <span className="font-semibold font-tabular">({counts.notReplied})</span>
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
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between text-xs transition-colors"
                        >
                          <span>⚪ รีเซ็ตเป็นยังไม่ตอบ</span>
                          <span className="font-semibold font-tabular">({counts.notifiedBm + counts.replied})</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {totalStorePages > 1 && (
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-xs text-slate-500">
              <button
                type="button"
                disabled={safeStorePage <= 1}
                onClick={() => setStorePage((p) => Math.max(1, p - 1))}
                className="rounded px-2 py-0.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 text-xs"
                aria-label="Previous stores page"
              >
                ‹
              </button>
              <span className="text-[11px] font-medium font-tabular">
                {safeStorePage} / {totalStorePages} ({sortedStores.length})
              </span>
              <button
                type="button"
                disabled={safeStorePage >= totalStorePages}
                onClick={() => setStorePage((p) => Math.min(totalStorePages, p + 1))}
                className="rounded px-2 py-0.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 text-xs"
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
