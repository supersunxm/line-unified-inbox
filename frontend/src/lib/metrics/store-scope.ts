import { type AppLanguage } from "../../app/language-utils.ts";
import { v2Text } from "./translations.ts";

// ONE definition of "stores in scope" and "stores with chat data". Pure: node --test imports it.
// Every page that shows a store count uses these and phrases it with storeScopeText:
// "X จาก Y ร้านที่มีข้อมูลแชท" (docs/metrics-registry.md).

import type { MonthSummary, StoreInfo } from "./store-model.ts";
import { numericValue, type ValueState } from "./value-state.ts";

/**
 * A placeholder store ("xxx", "Waitng for new store") is recognised only by a Store signal, never
 * by name: an active store with no LINE OA at all (GET /stores _count.lineOfficialAccounts = 0)
 * cannot have chats. An unknown count (null) is not a signal: the store stays in scope.
 */
export function isPlaceholderStore(store: StoreInfo): boolean {
  return store.lineOaCount === 0;
}

/**
 * Stores in scope: GET /stores rows (active, non-archived Store records the caller may see) that are
 * also rows of the /chats month summary — so the summary's synthetic focus group, which is not a
 * Store, never counts — minus placeholder stores (no LINE OA). Placeholders are returned separately
 * so the page can list what it left out.
 */
export function storesInScope(stores: StoreInfo[], summary: MonthSummary | null): { stores: StoreInfo[]; placeholders: StoreInfo[] } {
  const summaryIds = summary ? new Set(summary.stores.map((store) => store.storeId)) : null;
  const inScope = stores.filter((store) => !summaryIds || summaryIds.has(store.id));
  return { stores: inScope.filter((store) => !isPlaceholderStore(store)), placeholders: inScope.filter(isPlaceholderStore) };
}

/** A store "has chat data" for a period when it has at least one chat in it (the /chats count). */
export function hasChatData(row: { chats: ValueState }): boolean {
  return (numericValue(row.chats) ?? 0) > 0;
}

export type StoreCoverage = { withChats: number; total: number };

/** Stores with chat data among the stores in scope. */
export function storeCoverage(rows: ReadonlyArray<{ chats: ValueState }>): StoreCoverage {
  return { withChats: rows.filter(hasChatData).length, total: rows.length };
}

/** "134 จาก 150 ร้านที่มีข้อมูลแชท" — the one phrasing of a store count. */
export function storeScopeText(coverage: StoreCoverage, language: AppLanguage = "th"): string {
  return v2Text(language)("storeScope", { count: coverage.withChats.toLocaleString("en-US"), total: coverage.total.toLocaleString("en-US") });
}
