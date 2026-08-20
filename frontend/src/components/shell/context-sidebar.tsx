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
    `app-nav-item w-full rounded-[var(--app-radius-md)] px-2.5 py-1.5 text-left text-xs font-medium transition-all duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
      sidebarView === view
        ? "is-selected font-semibold bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent)]/20"
        : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
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
    <aside data-chat-pane="sidebar" className="app-surface flex flex-col h-full min-h-0 min-w-0 overflow-y-auto border-r border-[var(--app-border)] bg-[var(--app-surface)] p-3">
      {/* Overview Status Section */}
      <p className="app-muted mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)]">
        {text.overview || "ภาพรวม"}
      </p>

      <nav aria-label="Conversation filters" className="space-y-0.5">
        <button
          type="button"
          onClick={() => selectSidebarView("all")}
          className={`${sidebarButtonClass("all")} flex items-center justify-between`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--app-neutral)] shrink-0" />
            <span>{text.all || "ทั้งหมด"}</span>
          </span>
          <span className="font-tabular ml-2 rounded-[var(--app-radius-sm)] bg-[var(--app-surface-subtle)] border border-[var(--app-border-subtle)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--app-text-secondary)]">
            {totalOverviewCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("notReplied")}
          className={`${sidebarButtonClass("notReplied")} flex items-center justify-between`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--app-danger)] shrink-0" />
            <span>{text.notReplied || "ยังไม่ตอบ"}</span>
          </span>
          <span className="font-tabular ml-2 rounded-[var(--app-radius-sm)] bg-[var(--app-danger-soft)] text-[var(--app-danger)] border border-[var(--app-danger)]/20 px-1.5 py-0.5 text-[11px] font-semibold">
            {overview.notReplied}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("notifiedBm")}
          className={`${sidebarButtonClass("notifiedBm")} flex items-center justify-between`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8e44ec] shrink-0" />
            <span>{text.notifiedBm || "แจ้ง BM แล้ว"}</span>
          </span>
          <span className="font-tabular ml-2 rounded-[var(--app-radius-sm)] bg-[#f3e8ff] dark:bg-[#2b1c40] text-[#8e44ec] dark:text-[#d8b4fe] border border-[#8e44ec]/20 px-1.5 py-0.5 text-[11px] font-semibold">
            {overview.notifiedBm}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("replied")}
          className={`${sidebarButtonClass("replied")} flex items-center justify-between`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--app-success)] shrink-0" />
            <span>{text.replied || "ตอบแล้ว"}</span>
          </span>
          <span className="font-tabular ml-2 rounded-[var(--app-radius-sm)] bg-[var(--app-success-soft)] text-[var(--app-success)] border border-[var(--app-success)]/20 px-1.5 py-0.5 text-[11px] font-semibold">
            {overview.replied}
          </span>
        </button>
      </nav>

      {/* Stores Filter Section */}
      <div className="my-3 border-t border-[var(--app-border-subtle)]" />

      <div className="mb-2 flex items-center justify-between px-1">
        <p className="app-muted text-xs font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)]">
          {text.stores || "ร้านค้า"}
        </p>
        <button
          type="button"
          onClick={handleClearAll}
          className="text-[11px] font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-danger)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-danger)] rounded px-1"
        >
          {text.clearAll || "ล้างทั้งหมด"}
        </button>
      </div>

      {/* Inline Store Search Box */}
      <div className="mb-2.5">
        <label className="relative block">
          <span className="sr-only">{text.searchStores || "ค้นหาร้านค้า"}</span>
          <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--app-text-tertiary)]">
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
            className="app-input h-7 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] py-1 pl-7 pr-2.5 text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          />
        </label>
      </div>

      {sortedStores.length === 0 && storeSearch.trim() !== "" ? (
        <div className="py-6 text-center text-xs app-muted">
          <p className="font-semibold text-[var(--app-text-secondary)]">
            {text.noStoresFound || "No stores found"}
          </p>
          <p className="mt-1 text-[var(--app-text-tertiary)]">
            {text.tryAnotherKeyword || "Try another keyword"}
          </p>
        </div>
      ) : (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setSelectedStore("all")}
            className={`app-store-row flex w-full items-center justify-between rounded-[var(--app-radius-md)] px-2.5 py-1.5 text-left text-xs transition-all duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
              selectedStore === "all"
                ? "is-selected font-semibold bg-[var(--app-surface-active)] text-[var(--app-text-primary)] border border-[var(--app-border)]"
                : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
            }`}
          >
            <span className="truncate">{text.allStores || "ร้านค้าทั้งหมด"}</span>
            <div className="ml-2 flex items-center space-x-1 shrink-0 font-tabular">
              <span className="rounded bg-[var(--app-danger-soft)] text-[var(--app-danger)] px-1 py-0.2 text-[10px] font-medium" title="Not Replied">
                {overview.notReplied}
              </span>
              <span className="rounded bg-[#f3e8ff] dark:bg-[#2b1c40] text-[#8e44ec] dark:text-[#d8b4fe] px-1 py-0.2 text-[10px] font-medium" title="Notified BM">
                {overview.notifiedBm}
              </span>
              <span className="rounded bg-[var(--app-success-soft)] text-[var(--app-success)] px-1 py-0.2 text-[10px] font-medium" title="Replied">
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
                  className={`app-store-row flex w-full flex-col rounded-[var(--app-radius-md)] px-2.5 py-1.5 text-left text-xs transition-all duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                    selectedStore === store.id
                      ? "is-selected font-semibold bg-[var(--app-surface-active)] text-[var(--app-text-primary)] border border-[var(--app-border)]"
                      : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="truncate pr-1 font-medium">
                      {(store.masterStoreId || store.externalStoreId) && (
                        <span className="font-mono text-[10px] text-[var(--app-text-tertiary)] mr-1 opacity-80">
                          [{store.masterStoreId ?? store.externalStoreId}]
                        </span>
                      )}
                      {getStoreDisplayName(store.name)}
                    </span>
                    <div className="ml-2 flex items-center space-x-1 shrink-0 font-tabular">
                      <span className="rounded bg-[var(--app-danger-soft)] text-[var(--app-danger)] px-1 py-0.2 text-[10px] font-medium" title="Not Replied">
                        {counts.notReplied}
                      </span>
                      <span className="rounded bg-[#f3e8ff] dark:bg-[#2b1c40] text-[#8e44ec] dark:text-[#d8b4fe] px-1 py-0.2 text-[10px] font-medium" title="Notified BM">
                        {counts.notifiedBm}
                      </span>
                      <span className="rounded bg-[var(--app-success-soft)] text-[var(--app-success)] px-1 py-0.2 text-[10px] font-medium" title="Replied">
                        {counts.replied}
                      </span>
                    </div>
                  </div>

                  {waitingMins > 0 && (
                    <div className={`mt-0.5 flex items-center text-[10px] font-medium font-tabular ${
                      riskVariant === "danger"
                        ? "text-[var(--app-danger)] font-semibold"
                        : riskVariant === "warning"
                        ? "text-[var(--app-warning)]"
                        : "text-[var(--app-text-tertiary)]"
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
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded px-1 py-0.5 text-xs text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)] bg-[var(--app-surface)]/90 backdrop-blur-xs border border-[var(--app-border)] shadow-2xs transition-opacity"
                    >
                      ⋯
                    </button>

                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-full mt-1 z-30 w-52 rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] py-1 shadow-[var(--app-shadow-elevated)] text-xs backdrop-blur-md"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-3 py-1.5 border-b border-[var(--app-border-subtle)] font-semibold text-[var(--app-text-primary)] truncate text-[11px]">
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
                          className="w-full text-left px-3 py-1.5 hover:bg-[var(--app-success-soft)] text-[var(--app-success)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between text-xs transition-colors"
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
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f3e8ff] dark:hover:bg-[#2b1c40]/60 text-[#8e44ec] dark:text-[#d8b4fe] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between text-xs transition-colors"
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
                          className="w-full text-left px-3 py-1.5 hover:bg-[var(--app-surface-hover)] text-[var(--app-text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between text-xs transition-colors"
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
            <div className="mt-3 flex items-center justify-between border-t border-[var(--app-border-subtle)] pt-2 text-xs text-[var(--app-text-secondary)]">
              <button
                type="button"
                disabled={safeStorePage <= 1}
                onClick={() => setStorePage((p) => Math.max(1, p - 1))}
                className="rounded-[var(--app-radius-sm)] px-2 py-0.5 border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--app-surface-hover)] text-xs"
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
                className="rounded-[var(--app-radius-sm)] px-2 py-0.5 border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--app-surface-hover)] text-xs"
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
