import React from "react";

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
  notRepliedCount: number;
  notifiedBmCount: number;
  repliedCount: number;
  conversationsCount: number;
  selectedStore: string;
  setSelectedStore: (storeId: string) => void;
  clearAllFilters: () => void;
  stores: Array<{ id: string; name: string; waiting: number; lineOaCount: number }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  text: Record<string, any>;
  getStoreDisplayName: (name: string) => string;
}

export function ContextSidebar({
  sidebarView,
  selectSidebarView,
  notRepliedCount,
  notifiedBmCount,
  repliedCount,
  conversationsCount,
  selectedStore,
  setSelectedStore,
  clearAllFilters,
  stores,
  text,
  getStoreDisplayName,
}: ContextSidebarProps) {
  const sidebarButtonClass = (view: SidebarView) =>
    `app-nav-item w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      sidebarView === view
        ? "is-selected font-semibold"
        : ""
    }`;

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
            {notRepliedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("notifiedBm")}
          className={`${sidebarButtonClass("notifiedBm")} flex items-center justify-between`}
        >
          <span className="truncate">🟣 {text.notifiedBm || "แจ้ง BM แล้ว"}</span>
          <span className="ml-2 rounded-full bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            {notifiedBmCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("replied")}
          className={`${sidebarButtonClass("replied")} flex items-center justify-between`}
        >
          <span className="truncate">🟢 {text.replied || "ตอบแล้ว"}</span>
          <span className="ml-2 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {repliedCount}
          </span>
        </button>
      </nav>

      {/* Stores Filter Section */}
      <div className="my-4 border-t border-slate-200 dark:border-slate-800" />

      <div className="mb-3 flex items-center justify-between">
        <p className="app-muted text-xs font-semibold uppercase tracking-wider">
          {text.stores || "ร้านค้า"}
        </p>
        <button
          type="button"
          onClick={clearAllFilters}
          className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded px-1"
        >
          {text.clearAll || "ล้างทั้งหมด"}
        </button>
      </div>

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
          <span>{text.allStores || "ร้านค้าทั้งหมด"}</span>
          <span className="app-chip rounded-full px-2 py-0.5 text-xs font-medium">
            {conversationsCount}
          </span>
        </button>

        {stores.map((store) => (
          <button
            key={store.id}
            type="button"
            onClick={() => setSelectedStore(store.id)}
            className={`app-store-row flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              selectedStore === store.id
                ? "is-selected font-semibold"
                : ""
            }`}
          >
            <span className="truncate">{getStoreDisplayName(store.name)}</span>
            {store.waiting > 0 && (
              <span className="app-chip ml-2 rounded-full px-2 py-0.5 text-xs font-medium">
                {store.waiting}
              </span>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}
