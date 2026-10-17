"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { MESSAGE_SEARCH_DEBOUNCE_MS, MESSAGE_SEARCH_PAGE_SIZE } from "./message-search-config.ts";

import type { ChatMessageSearchAdapter, MessageSearchAdapterRequest } from "./message-search-adapter.ts";
import { buildMessageSearchRequest, type MessageSearchFilters } from "./message-search-query.ts";
import { initialMessageSearchState, messageSearchReducer, type MessageSearchState } from "./message-search-state.ts";
import { shouldAutoLoadNextMessagePage } from "./message-search-autoload-policy.ts";

export const EMBEDDED_SEARCH_PAGE_SIZE = 50;
export const EMBEDDED_SEARCH_MAX_AUTOMATIC_ITEMS = 5000;
const AUTO_LOAD_PAGE_DELAY_MS = 220;

export type UseChatMessageSearchOptions = {
  adapter: ChatMessageSearchAdapter;
  filters: MessageSearchFilters;
  todayIso: string;
  /** Localized text shown when a request fails. */
  errorMessage: string;
  /** Changing this value re-runs the current search (used by the retry button). */
  retryNonce: number;
  /** Embedded /chats search only; standalone search keeps manual pagination. */
  autoLoadAll?: boolean;
  pageSize?: number;
  maxAutoItems?: number;
};

export type UseChatMessageSearchResult = {
  state: MessageSearchState;
  loadMore: () => void;
};

/**
 * Debounced, cancellable search over a ChatMessageSearchAdapter.
 * - No request is made unless the keyword and period are valid (the builder returns null otherwise).
 * - Every change to the filters cancels any in-flight search or load-more request.
 * - A response is applied only if its request is still the latest one (see messageSearchReducer).
 */
export function useChatMessageSearch(options: UseChatMessageSearchOptions): UseChatMessageSearchResult {
  const { adapter, filters, todayIso, errorMessage, retryNonce, autoLoadAll = false,
    pageSize = MESSAGE_SEARCH_PAGE_SIZE, maxAutoItems = EMBEDDED_SEARCH_MAX_AUTOMATIC_ITEMS } = options;
  const [state, dispatch] = useReducer(messageSearchReducer, initialMessageSearchState);
  const stateRef = useRef(state);
  const requestRef = useRef<MessageSearchAdapterRequest | null>(null);
  const sequenceRef = useRef(0);
  const searchControllerRef = useRef<AbortController | null>(null);
  const moreControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const cancelInFlight = useCallback(() => {
    searchControllerRef.current?.abort();
    moreControllerRef.current?.abort();
    searchControllerRef.current = null;
    moreControllerRef.current = null;
  }, []);

  useEffect(() => cancelInFlight, [cancelInFlight]);

  useEffect(() => {
    const request = buildMessageSearchRequest(filters, todayIso);
    cancelInFlight();
    sequenceRef.current += 1;
    const epoch = sequenceRef.current;
    requestRef.current = request;
    // Clear previous results immediately so stale rows never remain under changed filters.
    dispatch({ type: "reset", requestId: epoch });
    if (!request) return;

    const timer = window.setTimeout(() => {
      const controller = new AbortController();
      searchControllerRef.current = controller;
      sequenceRef.current += 1;
      const requestId = sequenceRef.current;
      dispatch({ type: "search-started", requestId });
      adapter
        .search({ ...request, limit: pageSize }, { signal: controller.signal })
        .then((page) => {
          if (!controller.signal.aborted) dispatch({ type: "page-received", requestId, page, append: false });
        })
        .catch(() => {
          if (!controller.signal.aborted) dispatch({ type: "failed", requestId, message: errorMessage, append: false });
        });
    }, MESSAGE_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [adapter, filters, todayIso, errorMessage, retryNonce, cancelInFlight, pageSize]);

  const loadMore = useCallback(() => {
    const current = stateRef.current;
    const request = requestRef.current;
    if (!request || current.status !== "loaded" || !current.hasMore || !current.nextCursor || current.loadingMore) return;
    moreControllerRef.current?.abort();
    const controller = new AbortController();
    moreControllerRef.current = controller;
    const requestId = current.requestId;
    dispatch({ type: "load-more-started", requestId });
    adapter
      .search({ ...request, cursor: current.nextCursor, limit: pageSize }, { signal: controller.signal })
      .then((page) => {
        if (!controller.signal.aborted) dispatch({ type: "page-received", requestId, page, append: true });
      })
      .catch(() => {
        if (!controller.signal.aborted) dispatch({ type: "failed", requestId, message: errorMessage, append: true });
      });
  }, [adapter, errorMessage, pageSize]);

  // An embedded search should never require scrolling down to click "Load more".
  // Fetch one bounded backend page at a time; every filter change cancels the
  // outstanding request and the next scheduled page. Do not retry a failed page
  // indefinitely or silently claim the displayed subset is complete.
  useEffect(() => {
    if (!autoLoadAll || !shouldAutoLoadNextMessagePage(state, maxAutoItems)) return;
    const timer = window.setTimeout(loadMore, AUTO_LOAD_PAGE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoLoadAll, maxAutoItems, state.status, state.hasMore,
      state.nextCursor, state.loadingMore, state.error, state.items.length, loadMore]);

  return { state, loadMore };
}
