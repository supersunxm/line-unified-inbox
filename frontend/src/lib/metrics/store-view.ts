import { type AppLanguage } from "../../app/language-utils.ts";
import { v2Text } from "./translations.ts";

// Store 360 for one store and month. Pure: node --test imports it directly.

import type { NicknameMetadataLike, StoreMetricsRow } from "./store-model.ts";
import { meetsSample, numericValue } from "./value-state.ts";

/** localStorage key of the last store opened in Store 360. */
export const LAST_STORE_KEY = "oppo-store360-last-store";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** The last viewed store id, or null (no storage, blocked storage, nothing saved). */
export function readLastStore(storage: StorageLike | null | undefined): string | null {
  try {
    const value = storage?.getItem(LAST_STORE_KEY);
    return value ? value : null;
  } catch {
    return null;
  }
}

export function writeLastStore(storage: StorageLike | null | undefined, storeId: string): void {
  try {
    storage?.setItem(LAST_STORE_KEY, storeId);
  } catch {
    /* storage blocked: Store 360 opens the picker next time */
  }
}

/**
 * Where /store-360 without a storeId goes: the last viewed store when it is still in scope, else
 * nowhere (the page shows the picker and the stores to check). Never an arbitrary store.
 */
export function storeToOpen(lastStore: string | null, scope: ReadonlyArray<{ storeId: string }>): string | null {
  return lastStore && scope.some((row) => row.storeId === lastStore) ? lastStore : null;
}

/**
 * "อันดับ X จาก N" for the 24-hour rate among the stores with at least MIN_RATE_SAMPLE chats
 * (rank 1 = highest rate; ties share the better rank). null when this store is below the sample.
 */
export function rate24Rank(rows: ReadonlyArray<Pick<StoreMetricsRow, "storeId" | "rate24">>, storeId: string): { rank: number; total: number } | null {
  const ranked = rows.filter((row) => meetsSample(row.rate24));
  const own = ranked.find((row) => row.storeId === storeId);
  if (!own) return null;
  const value = numericValue(own.rate24) ?? 0;
  return { rank: ranked.filter((row) => (numericValue(row.rate24) ?? 0) > value).length + 1, total: ranked.length };
}

export type CountItem = { key: string; count: number };

export type CustomerTagMix = {
  /** Chats in the list (the store's month, newest first, bounded). */
  chats: number;
  /** Chats whose name carries at least one recognised tag. */
  tagged: number;
  products: CountItem[];
  sources: CountItem[];
  finance: CountItem[];
};

function top(map: Map<string, number>, limit: number): CountItem[] {
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, limit);
}

/**
 * Products, sources and payment/finance from the customer-name tags of a store's month (the backend's
 * parsed name metadata on /conversations). Counted per chat. Never a sales figure.
 * Source: the platform when named, else "ONLINE" for online customers; nothing is invented for
 * untagged chats, they are simply not counted.
 */
export function customerTagMix(items: ReadonlyArray<{ nicknameDerivedMetadata?: NicknameMetadataLike }>, limit = 5): CustomerTagMix {
  const products = new Map<string, number>();
  const sources = new Map<string, number>();
  const finance = new Map<string, number>();
  let tagged = 0;
  const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const item of items) {
    const meta = item.nicknameDerivedMetadata;
    if (!meta) continue;
    let any = false;
    if (meta.product?.name) { add(products, meta.product.name); any = true; }
    const source = meta.source ?? (meta.customerType === "ONLINE" ? "ONLINE" : null);
    if (source) { add(sources, source); any = true; }
    const money = meta.financeProvider ?? meta.paymentMethod;
    if (money) { add(finance, money); any = true; }
    if (any || meta.service || meta.period || meta.eventDate) tagged += 1;
  }
  return { chats: items.length, tagged, products: top(products, limit), sources: top(sources, limit), finance: top(finance, limit) };
}

/** Customer Voice is shown (as a link only) when at least this share of chats was classified. */
export const CUSTOMER_VOICE_MIN_COVERAGE = 0.2;

export function showCustomerVoice(classifiedShare: number | null | undefined): boolean {
  return typeof classifiedShare === "number" && classifiedShare >= CUSTOMER_VOICE_MIN_COVERAGE;
}

/** A tag value as the UI shows it: known codes translated, names (products, platforms, lenders) as written. */
export function tagValueLabel(value: string, language: AppLanguage = "th"): string {
  const t = v2Text(language);
  if (value === "ONLINE") return t("tagValueOnline");
  if (value === "CASH") return t("tagValueCash");
  if (value === "INSTALLMENT") return t("tagValueInstallment");
  if (value === "CREDIT_CARD") return t("tagValueCreditCard");
  if (value === "OTHER") return t("tagValueOther");
  if (value === "SG_FINANCE") return "SG Finance";
  if (value === "UFUND") return "Ufund";
  return value;
}
