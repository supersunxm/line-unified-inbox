/**
 * Store selection for message search. Pure module.
 *
 * An empty selection means "all stores the caller is authorized for". The authorized list comes
 * from the backend (/stores is already scoped server-side); this module never widens it.
 */
import { filterStoresBySearch } from "../../shell/store-search.ts";
import { MESSAGE_SEARCH_MAX_STORE_SELECTION } from "./message-search-config.ts";
import type { MessageSearchCopy } from "./message-search-copy.ts";

export type MessageSearchStore = {
  id: string;
  name: string;
  code: string | null;
  storeId: string | null;
};

/** Keeps only selected IDs that are still in the authorized list, de-duplicated and capped. */
export function reconcileMessageSearchStoreSelection(selected: string[], authorized: MessageSearchStore[]): string[] {
  const allowed = new Set(authorized.map((store) => store.id));
  return [...new Set(selected)].filter((id) => allowed.has(id)).slice(0, MESSAGE_SEARCH_MAX_STORE_SELECTION);
}

export function toggleMessageSearchStore(selected: string[], storeId: string): string[] {
  if (selected.includes(storeId)) return selected.filter((id) => id !== storeId);
  if (selected.length >= MESSAGE_SEARCH_MAX_STORE_SELECTION) return selected;
  return [...selected, storeId];
}

export function isAllAuthorizedStores(selected: string[]): boolean {
  return selected.length === 0;
}

export function filterMessageSearchStores(stores: MessageSearchStore[], query: string): MessageSearchStore[] {
  return filterStoresBySearch(stores, query);
}

export function messageSearchStoreSummary(
  selected: string[],
  authorized: MessageSearchStore[],
  copy: Pick<MessageSearchCopy, "allStores" | "storesSelected">,
): string {
  if (isAllAuthorizedStores(selected)) return copy.allStores;
  if (selected.length === 1) {
    const match = authorized.find((store) => store.id === selected[0]);
    return match ? match.name : copy.storesSelected(1);
  }
  return copy.storesSelected(selected.length);
}
