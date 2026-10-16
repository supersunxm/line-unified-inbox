/**
 * Search result state machine. Pure reducer, so stale-response handling and paging are testable.
 * A response is applied only when its request is still the latest one; older responses are dropped.
 */
import type { MessageSearchItem, MessageSearchPage } from "./message-search-adapter.ts";

export type MessageSearchStatus = "idle" | "loading" | "loaded" | "empty" | "error";

export type MessageSearchState = {
  status: MessageSearchStatus;
  items: MessageSearchItem[];
  hasMore: boolean;
  nextCursor: string | null;
  loadingMore: boolean;
  error: string | null;
  requestId: number;
};

export type MessageSearchAction =
  | { type: "search-started"; requestId: number }
  | { type: "load-more-started"; requestId: number }
  | { type: "page-received"; requestId: number; page: MessageSearchPage; append: boolean }
  | { type: "failed"; requestId: number; message: string; append: boolean }
  | { type: "reset"; requestId: number };

export const initialMessageSearchState: MessageSearchState = {
  status: "idle",
  items: [],
  hasMore: false,
  nextCursor: null,
  loadingMore: false,
  error: null,
  requestId: 0,
};

export function messageSearchReducer(state: MessageSearchState, action: MessageSearchAction): MessageSearchState {
  switch (action.type) {
    case "reset":
      return { ...initialMessageSearchState, requestId: action.requestId };
    case "search-started":
      return {
        ...state,
        status: "loading",
        items: [],
        hasMore: false,
        nextCursor: null,
        loadingMore: false,
        error: null,
        requestId: action.requestId,
      };
    case "load-more-started":
      if (action.requestId !== state.requestId) return state;
      return { ...state, loadingMore: true, error: null, requestId: action.requestId };
    case "page-received": {
      if (action.requestId !== state.requestId) return state;
      const items = action.append ? [...state.items, ...action.page.items] : action.page.items;
      return {
        ...state,
        status: items.length === 0 ? "empty" : "loaded",
        items,
        hasMore: action.page.hasMore,
        nextCursor: action.page.nextCursor,
        loadingMore: false,
        error: null,
      };
    }
    case "failed": {
      if (action.requestId !== state.requestId) return state;
      if (action.append) return { ...state, loadingMore: false, error: action.message };
      return { ...state, status: "error", items: [], hasMore: false, nextCursor: null, loadingMore: false, error: action.message };
    }
  }
}
