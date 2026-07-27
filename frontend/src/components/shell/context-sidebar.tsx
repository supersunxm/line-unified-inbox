import React from "react";

export type SidebarView =
  | "dashboard"
  | "incoming"
  | "followUp"
  | "reminded"
  | "stores"
  | "customerInsights"
  | "lineOaManagement"
  | "systemStatus"
  | "pilotChecklist";

export interface ContextSidebarProps {
  sidebarView: SidebarView;
  selectSidebarView: (view: SidebarView) => void;
  conversationsCount: number;
  followUpCount: number;
  remindedCount: number;
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
  conversationsCount,
  followUpCount,
  remindedCount,
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
        ? "is-selected font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300"
        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
    }`;

  return (
    <aside className="app-surface flex flex-col h-full min-w-0 overflow-y-auto border-r border-slate-200 dark:border-slate-800 p-4">
      {/* Overview Status Section */}
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {text.overview || "ภาพรวม"}
      </p>

      <nav aria-label="Conversation filters" className="space-y-1">
        <button
          type="button"
          onClick={() => selectSidebarView("dashboard")}
          className={sidebarButtonClass("dashboard")}
        >
          📊 {text.dashboard || "แดชบอร์ด"}
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("incoming")}
          className={`${sidebarButtonClass("incoming")} flex items-center justify-between`}
        >
          <span className="truncate">📥 {text.incoming || "ข้อความเข้าใหม่"}</span>
          <span className="ml-2 rounded-full bg-red-100 dark:bg-red-950/80 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            {conversationsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("followUp")}
          className={`${sidebarButtonClass("followUp")} flex items-center justify-between`}
        >
          <span className="truncate">⏰ {text.followUp || "ต้องติดตาม"}</span>
          <span className="ml-2 rounded-full bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            {followUpCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSidebarView("reminded")}
          className={`${sidebarButtonClass("reminded")} flex items-center justify-between`}
        >
          <span className="truncate">📣 {text.reminded || "เตือนแล้ว"}</span>
          <span className="ml-2 rounded-full bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            {remindedCount}
          </span>
        </button>
      </nav>

      {/* Stores Filter Section */}
      <div className="my-4 border-t border-slate-200 dark:border-slate-800" />

      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
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
              ? "is-selected font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>{text.allStores || "ร้านค้าทั้งหมด"}</span>
          <span className="app-chip rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
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
                ? "is-selected font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span className="truncate">{getStoreDisplayName(store.name)}</span>
            {store.waiting > 0 && (
              <span className="app-chip rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {store.waiting}
              </span>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}
