"use client";

import { useId, useState } from "react";
import { SearchInput } from "@/components/ui/input";
import type { MessageSearchCopy } from "./message-search-copy.ts";
import { filterMessageSearchStores, isAllAuthorizedStores, messageSearchStoreSummary, type MessageSearchStore } from "./message-search-stores.ts";

type ChatMessageSearchStoreSelectProps = {
  stores: MessageSearchStore[];
  selected: string[];
  loading: boolean;
  error: boolean;
  copy: MessageSearchCopy;
  onToggle: (storeId: string) => void;
  onSelectAll: () => void;
};

/** Searchable multi-store filter. An empty selection means all authorized stores. */
export function ChatMessageSearchStoreSelect({ stores, selected, loading, error, copy, onToggle, onSelectAll }: ChatMessageSearchStoreSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panelId = useId();
  const visible = filterMessageSearchStores(stores, query);
  const allSelected = isAllAuthorizedStores(selected);

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex max-w-full items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus:outline-none"
      >
        <span className="text-[var(--app-text-secondary)]">{copy.selectStores}</span>
        <span className="truncate">{messageSearchStoreSummary(selected, stores, copy)}</span>
      </button>

      {open && (
        <div id={panelId} className="mt-2 w-full max-w-[360px] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-lg md:absolute md:left-0 md:z-20">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            placeholder={copy.storeSearchPlaceholder}
            aria-label={copy.storeSearchPlaceholder}
          />
          <button
            type="button"
            onClick={onSelectAll}
            aria-pressed={allSelected}
            className={`mt-2 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold ${allSelected ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]" : "text-[var(--app-text-primary)] hover:bg-[var(--app-surface-subtle)]"}`}
          >
            {copy.allStores}
          </button>
          <div className="mt-1 max-h-60 overflow-y-auto">
            {loading && <p className="px-3 py-2 text-xs text-[var(--app-text-secondary)]">{copy.loading}</p>}
            {error && <p role="alert" className="px-3 py-2 text-xs text-[var(--app-danger)]">{copy.searchError}</p>}
            {!loading && !error && visible.length === 0 && (
              <p className="px-3 py-2 text-xs text-[var(--app-text-secondary)]">{copy.noStoreMatch}</p>
            )}
            {visible.map((store) => {
              const checked = selected.includes(store.id);
              return (
                <label key={store.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--app-text-primary)] hover:bg-[var(--app-surface-subtle)]">
                  <input type="checkbox" checked={checked} onChange={() => onToggle(store.id)} className="h-4 w-4 accent-[var(--app-accent)]" />
                  <span className="min-w-0 truncate">{store.name}</span>
                  {store.storeId && <span className="ml-auto shrink-0 text-[10px] text-[var(--app-text-secondary)]">{store.storeId}</span>}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
