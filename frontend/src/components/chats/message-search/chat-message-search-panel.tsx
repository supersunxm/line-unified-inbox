"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { SearchInput } from "@/components/ui/input";
import { UnifiedPeriodPicker } from "@/components/date-range/unified-period-picker";
import type { AppLanguage } from "../../../app/language-utils.ts";
import type { ChatMessageSearchAdapter } from "./message-search-adapter.ts";
import { ChatMessageSearchResults } from "./chat-message-search-results.tsx";
import { ChatMessageSearchStoreSelect } from "./chat-message-search-store-select.tsx";
import { messageSearchCopy } from "./message-search-copy.ts";
import { bangkokTodayIso, formatMessageSearchPeriod, validateMessageSearchPeriod, type MessageSearchPeriod } from "./message-search-period.ts";
import {
  clearMessageSearchFilters,
  defaultMessageSearchFilters,
  hasActiveMessageSearchFilters,
  parseMessageSearchFilters,
  serializeMessageSearchFilters,
  validateMessageSearchKeyword,
  type MessageSearchFilters,
} from "./message-search-query.ts";
import { reconcileMessageSearchStoreSelection, toggleMessageSearchStore, type MessageSearchStore } from "./message-search-stores.ts";
import { useChatMessageSearch } from "./use-chat-message-search.ts";

type ChatMessageSearchPanelProps = {
  adapter: ChatMessageSearchAdapter;
  language: AppLanguage;
  /** Extra notice shown in the footer, for example when synthetic sample data is in use. */
  notice?: string | null;
};

function subscribeNothing() {
  return () => {};
}

/** False during server rendering and hydration, true once the component is running in the browser. */
function useHasMounted(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}

/**
 * Entry point. The stateful content only mounts in the browser, so the URL can be read as the initial
 * state without an effect and without a server/client markup mismatch.
 */
export function ChatMessageSearchPanel(props: ChatMessageSearchPanelProps) {
  const mounted = useHasMounted();
  if (!mounted) {
    return (
      <main className="min-h-dvh bg-[var(--app-bg)] p-4 text-sm text-[var(--app-text-secondary)]">
        {messageSearchCopy(props.language).loading}
      </main>
    );
  }
  return <ChatMessageSearchContent {...props} />;
}

function ChatMessageSearchContent({ adapter, language, notice = null }: ChatMessageSearchPanelProps) {
  const copy = messageSearchCopy(language);
  const [todayIso] = useState(() => bangkokTodayIso());
  const [filters, setFilters] = useState<MessageSearchFilters>(() => parseMessageSearchFilters(window.location.search, todayIso));
  const [storeList, setStoreList] = useState<{ status: "loading" | "ready" | "error"; stores: MessageSearchStore[] }>({
    status: "loading",
    stores: [],
  });
  const [retryNonce, setRetryNonce] = useState(0);
  const stores = storeList.stores;
  const storesLoading = storeList.status === "loading";
  const storesError = storeList.status === "error";

  // Keep the URL in sync with the filters, using msg* keys only (never the conversation month).
  useEffect(() => {
    const query = serializeMessageSearchFilters(filters, todayIso).toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [filters, todayIso]);

  // Authorized stores come from the backend (scoped). State changes happen only in the async callbacks.
  useEffect(() => {
    const controller = new AbortController();
    adapter
      .listStores({ signal: controller.signal })
      .then((list) => {
        setStoreList({ status: "ready", stores: list });
        // Drop any selected store that is no longer authorized; other filters are left untouched.
        setFilters((current) => {
          const reconciled = reconcileMessageSearchStoreSelection(current.storeIds, list);
          if (reconciled.length === current.storeIds.length && reconciled.every((id, index) => id === current.storeIds[index])) return current;
          return { ...current, storeIds: reconciled };
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setStoreList({ status: "error", stores: [] });
      });
    return () => controller.abort();
  }, [adapter]);

  const search = useChatMessageSearch({
    adapter,
    filters,
    todayIso,
    errorMessage: copy.searchError,
    retryNonce,
  });

  const keyword = validateMessageSearchKeyword(filters.keyword);
  const keywordMessage = keyword.valid
    ? null
    : keyword.reason === "empty"
      ? copy.keywordHint
      : keyword.reason === "tooShort"
        ? copy.keywordTooShort
        : copy.keywordTooLong;
  const periodError = validateMessageSearchPeriod(filters.period, todayIso, language);
  const showChips = hasActiveMessageSearchFilters(filters, todayIso);
  const storeSummaryActive = filters.storeIds.length > 0;

  const setKeyword = (value: string) => setFilters((current) => ({ ...current, keyword: value }));
  const applyPeriod = (dateFrom: string, dateTo: string) => {
    const period: MessageSearchPeriod = { dateFrom, dateTo };
    setFilters((current) => ({ ...current, period }));
  };

  return (
    <main className="min-h-dvh bg-[var(--app-bg)] px-4 py-4 text-[var(--app-text-primary)] md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{copy.pageTitle}</h1>
          <p className="text-xs text-[var(--app-text-secondary)]">{copy.modeLabel}</p>
        </div>
        <Link href="/chats" className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-subtle)]">
          {copy.backToChats}
        </Link>
      </header>

      <section aria-label={copy.pageTitle} className="flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 md:p-4">
        <p className="text-xs text-[var(--app-text-secondary)]">{copy.modeNote}</p>

        <div className="min-w-0">
          <SearchInput
            value={filters.keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onClear={() => setKeyword("")}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchPlaceholder}
            aria-invalid={keyword.valid || keyword.reason === "empty" ? undefined : true}
          />
          {keywordMessage && (
            <p className={`mt-1 text-xs ${keyword.valid ? "text-[var(--app-text-secondary)]" : "text-[var(--app-danger)]"}`}>{keywordMessage}</p>
          )}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-start">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold text-[var(--app-text-secondary)]">
              {copy.periodLabel} · {copy.customPeriod}
            </p>
            <UnifiedPeriodPicker
              dateFrom={filters.period.dateFrom}
              dateTo={filters.period.dateTo}
              language={language}
              presetLabel={copy.preset}
              onApply={applyPeriod}
            />
            {periodError && <p className="mt-1 text-xs text-[var(--app-danger)]">{periodError}</p>}
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold text-[var(--app-text-secondary)]">{copy.selectStores}</p>
            <ChatMessageSearchStoreSelect
              stores={stores}
              selected={filters.storeIds}
              loading={storesLoading}
              error={storesError}
              copy={copy}
              onToggle={(storeId) => setFilters((current) => ({ ...current, storeIds: toggleMessageSearchStore(current.storeIds, storeId) }))}
              onSelectAll={() => setFilters((current) => ({ ...current, storeIds: [] }))}
            />
          </div>
        </div>

        {showChips && (
          <div className="flex flex-wrap items-center gap-2" aria-label={copy.clearFilters}>
            {filters.keyword && (
              <button type="button" onClick={() => setKeyword("")} className="rounded-full border border-[var(--app-border)] px-3 py-1 text-xs font-semibold text-[var(--app-text-primary)]">
                {copy.keywordChip}: {filters.keyword} <span aria-label={copy.removeChip}>×</span>
              </button>
            )}
            {!isDefaultPeriod(filters, todayIso) && (
              <button
                type="button"
                onClick={() => setFilters((current) => ({ ...current, period: defaultMessageSearchFilters(todayIso).period }))}
                className="rounded-full border border-[var(--app-border)] px-3 py-1 text-xs font-semibold text-[var(--app-text-primary)]"
              >
                {copy.periodChip}: {formatMessageSearchPeriod(filters.period, language)} <span aria-label={copy.removeChip}>×</span>
              </button>
            )}
            {storeSummaryActive && (
              <button
                type="button"
                onClick={() => setFilters((current) => ({ ...current, storeIds: [] }))}
                className="rounded-full border border-[var(--app-border)] px-3 py-1 text-xs font-semibold text-[var(--app-text-primary)]"
              >
                {copy.storeChip}: {filters.storeIds.length} <span aria-label={copy.removeChip}>×</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilters(clearMessageSearchFilters(todayIso))}
              className="ml-auto rounded-lg px-3 py-1 text-xs font-semibold text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]"
            >
              {copy.clearFilters}
            </button>
          </div>
        )}
      </section>

      <section aria-label={copy.pageTitle} className="mt-4">
        <ChatMessageSearchResults
          state={search.state}
          copy={copy}
          language={language}
          onLoadMore={search.loadMore}
          onRetry={() => setRetryNonce((value) => value + 1)}
        />
      </section>

      <footer className="mt-6 flex flex-col gap-1 border-t border-[var(--app-border)] pt-3 text-xs text-[var(--app-text-secondary)]">
        <p>{copy.partialDataNote}</p>
        <p>{copy.accountStatusNote}</p>
        {notice && <p className="font-semibold text-[var(--app-text-primary)]">{notice}</p>}
      </footer>
    </main>
  );
}

/** True when the period is the default 7-day window, so the period chip is not shown for it. */
function isDefaultPeriod(filters: MessageSearchFilters, todayIso: string): boolean {
  const defaults = defaultMessageSearchFilters(todayIso).period;
  return filters.period.dateFrom === defaults.dateFrom && filters.period.dateTo === defaults.dateTo;
}
