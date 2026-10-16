"use client";

import type { AppLanguage } from "../../../app/language-utils.ts";
import type { MessageSearchItem } from "./message-search-adapter.ts";
import type { MessageSearchCopy } from "./message-search-copy.ts";
import { formatMessageSearchTimestamp, messageSearchDirectionLabel, messageSearchSourceLabel } from "./message-search-format.ts";
import type { MessageSearchState } from "./message-search-state.ts";

type ChatMessageSearchResultsProps = {
  state: MessageSearchState;
  copy: MessageSearchCopy;
  language: AppLanguage;
  onLoadMore: () => void;
  onRetry: () => void;
};

function ResultRow({ item, copy, language }: { item: MessageSearchItem; copy: MessageSearchCopy; language: AppLanguage }) {
  return (
    <li className="min-w-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
        <span className="min-w-0 truncate font-semibold text-[var(--app-text-primary)]">
          {item.customerDisplayName ?? copy.customerUnknown}
        </span>
        <span className="min-w-0 truncate text-[var(--app-text-secondary)]">{item.storeName}</span>
        <span className="ml-auto shrink-0 text-[var(--app-text-secondary)]">{formatMessageSearchTimestamp(item.sentAt, language)}</span>
      </div>
      <p className="mt-2 break-words text-sm text-[var(--app-text-primary)]">{item.snippet}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
        <span className="rounded-full border border-[var(--app-border)] px-2 py-0.5 text-[var(--app-text-secondary)]">
          {messageSearchDirectionLabel(item.direction, language)}
        </span>
        <span className="rounded-full bg-[var(--app-accent-soft)] px-2 py-0.5 text-[var(--app-accent)]">
          {messageSearchSourceLabel(item.source, language)}
        </span>
      </div>
    </li>
  );
}

/** Result list with explicit loading, empty, error, and load-more states. */
export function ChatMessageSearchResults({ state, copy, language, onLoadMore, onRetry }: ChatMessageSearchResultsProps) {
  if (state.status === "loading") {
    return <p role="status" className="py-6 text-center text-sm text-[var(--app-text-secondary)]">{copy.loading}</p>;
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-sm text-[var(--app-danger)]">{state.error ?? copy.searchError}</p>
        <button type="button" onClick={onRetry} className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-subtle)]">
          {copy.retry}
        </button>
      </div>
    );
  }
  if (state.status === "empty") {
    return <p className="py-6 text-center text-sm text-[var(--app-text-secondary)]">{copy.noResults}</p>;
  }
  if (state.status !== "loaded") return null;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {state.items.map((item) => (
          <ResultRow key={item.messageId} item={item} copy={copy} language={language} />
        ))}
      </ul>
      {state.error && <p role="alert" className="text-xs text-[var(--app-danger)]">{state.error}</p>}
      {state.hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={state.loadingMore}
            className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-subtle)] disabled:opacity-40"
          >
            {state.loadingMore ? copy.loadingMore : copy.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
