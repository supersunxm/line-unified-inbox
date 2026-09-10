"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ApiStore } from "@/types/api";
import { filterStoreSearchOptions, getActiveOptionScrollTop, storeSearchIdentifier } from "./store-search";

interface StoreSearchComboboxProps {
  stores: ApiStore[];
  selectedStoreId: string;
  onSelect: (storeId: string) => void;
}

export function StoreSearchCombobox({ stores, selectedStoreId, onSelect }: StoreSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? null;
  const filteredStores = useMemo(() => filterStoreSearchOptions(stores, query), [query, stores]);

  const close = (restoreFocus = false) => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  };

  const open = () => {
    setQuery("");
    setActiveIndex(Math.max(0, stores.findIndex((store) => store.id === selectedStoreId)));
    setIsOpen(true);
  };

  const select = (storeId: string) => {
    onSelect(storeId);
    close(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || filteredStores.length === 0) return;
    const results = resultsRef.current;
    const activeOption = document.getElementById(`${listboxId}-option-${activeIndex}`);
    if (!results || !activeOption) return;
    const resultsRect = results.getBoundingClientRect();
    const optionRect = activeOption.getBoundingClientRect();
    results.scrollTop = getActiveOptionScrollTop(
      results.scrollTop,
      resultsRect.top,
      resultsRect.bottom,
      optionRect.top,
      optionRect.bottom,
    );
  }, [activeIndex, filteredStores.length, isOpen, listboxId]);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filteredStores.length === 0) return;
      setActiveIndex((index) => Math.min(index + 1, filteredStores.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filteredStores.length === 0) return;
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && filteredStores[activeIndex]) {
      event.preventDefault();
      select(filteredStores[activeIndex].id);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={(event) => {
          if (!isOpen && ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            open();
          } else if (event.key === "Escape" && isOpen) {
            event.preventDefault();
            close(true);
          }
        }}
        className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-left text-sm font-semibold text-[var(--app-text-primary)] transition-colors hover:bg-[var(--app-surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] sm:w-[290px]"
      >
        <span className="min-w-0">
          <span className="block truncate">{selectedStore?.name ?? "Select store"}</span>
          {selectedStore && <span className="block truncate text-[10px] font-normal text-[var(--app-text-tertiary)]">Store ID: {storeSearchIdentifier(selectedStore)}</span>}
        </span>
        <svg aria-hidden="true" className={`h-4 w-4 shrink-0 text-[var(--app-text-tertiary)] transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-full min-w-[290px] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-[var(--app-shadow-elevated)] sm:w-[360px]">
          <div className="relative">
            <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--app-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-label="Search stores by name or Store ID"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={filteredStores[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
              autoComplete="off"
              value={query}
              placeholder="Search store name or Store ID"
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--input-background)] pl-9 pr-9 text-sm text-[var(--app-text-primary)] outline-none placeholder:text-[var(--app-text-tertiary)] focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent)]/30"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear store search"
                onClick={() => {
                  setQuery("");
                  setActiveIndex(0);
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]"
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>

          <div ref={resultsRef} id={listboxId} role="listbox" aria-label="Authorized stores" onWheel={(event) => event.stopPropagation()} className="mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-xl">
            {filteredStores.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-[var(--app-text-tertiary)]">No stores found</p>
            ) : filteredStores.map((store, index) => {
              const isSelected = store.id === selectedStoreId;
              const isActive = index === activeIndex;
              return (
                <button
                  id={`${listboxId}-option-${index}`}
                  key={store.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(store.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isActive ? "bg-[var(--app-surface-hover)]" : ""} ${isSelected ? "text-[var(--app-accent)]" : "text-[var(--app-text-primary)]"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{store.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-[var(--app-text-tertiary)]">Store ID: {storeSearchIdentifier(store)}</span>
                  </span>
                  {isSelected && <span aria-hidden="true" className="shrink-0 text-sm font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
