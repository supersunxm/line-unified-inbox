/** Pure policy for bounded, sequential embedded search loading. */
import type { MessageSearchState } from "./message-search-state.ts";

/**
 * Do not generate unbounded simultaneous requests. A failed request, missing
 * cursor or exhausted page budget must stop automatic pagination.
 */
export function shouldAutoLoadNextMessagePage(
  state: Pick<MessageSearchState, "status" | "hasMore" | "nextCursor" | "loadingMore" | "error" | "items">,
  maxItems: number,
): boolean {
  return state.status === "loaded" && state.hasMore &&
    typeof state.nextCursor === "string" && state.nextCursor.length > 0 &&
    !state.loadingMore && state.error === null &&
    state.items.length < maxItems;
}
