// v2 monthly numbers. Pure: node --test imports it directly.
//
// The store model itself (counts, rates, comparisons, sorting, store scope) moved to
// lib/metrics (store-model.ts, store-scope.ts), shared with Home, Dashboard and Store 360.
// This file keeps only what /v2/report still prints on top of it: the partner grouping.

import { partnerOrUnmatched, UNMATCHED_PARTNER } from "./partners.ts";
import {
  buildStoreRows,
  filterStoreRows,
  periodStatus,
  rateKey,
  sortStoreRows,
  sumStates,
  totalsFrom,
  valueOr,
  type ChatCounts,
  type GroupTotals,
  type MonthSort,
  type MonthSummary,
  type PeriodSource,
  type RateResponse,
  type StoreInfo,
  type StoreMetricsRow,
} from "../metrics/store-model.ts";
import { isPlaceholderStore, storeCoverage, storesInScope } from "../metrics/store-scope.ts";
import { meetsSample } from "./value-state.ts";

export * from "../metrics/store-model.ts";
export { isPlaceholderStore };

/** A store row with its partner (from the Store ID mapping) and its rank inside that partner. */
export type MonthStoreRow = StoreMetricsRow & {
  partner: string;
  /** 1 = best in its partner (see rankWithinPartners); null when below the sample or unranked. */
  partnerRank: number | null;
  partnerRankedCount: number;
};

/** The v2 store universe: lib/metrics/store-scope.ts storesInScope. */
export const v2Stores = storesInScope;

/** "Stores with chat data N/M": lib/metrics/store-scope.ts storeCoverage. */
export const dataCoverage = storeCoverage;

export function buildMonthStoreRows(input: {
  stores: StoreInfo[];
  current: PeriodSource<MonthSummary>;
  previous: PeriodSource<Map<string, ChatCounts>>;
  rates: PeriodSource<RateResponse>;
  previousRates: PeriodSource<RateResponse>;
}): MonthStoreRow[] {
  const partners = new Map(input.stores.map((store) => [store.id, store.partner]));
  return withPartners(buildStoreRows(input), partners);
}

/** Adds partner and partner rank to store rows. */
export function withPartners(rows: StoreMetricsRow[], partners: Map<string, string | null | undefined>): MonthStoreRow[] {
  return rankWithinPartners(rows.map((row) => ({ ...row, partner: partnerOrUnmatched(partners.get(row.storeId)), partnerRank: null, partnerRankedCount: 0 })));
}

/**
 * อันดับใน partner: among a partner's stores with at least MIN_RATE_SAMPLE chats, the highest
 * ตอบแล้ว % first, then the highest 24-hour %, then the fewest unreplied, then name.
 * Stores below the sample are not ranked. Mutates and returns rows.
 */
export function rankWithinPartners(rows: MonthStoreRow[]): MonthStoreRow[] {
  const byPartner = new Map<string, MonthStoreRow[]>();
  for (const row of rows) {
    if (row.partner === UNMATCHED_PARTNER || !meetsSample(row.replyRate)) continue;
    const list = byPartner.get(row.partner) ?? [];
    list.push(row);
    byPartner.set(row.partner, list);
  }
  for (const list of byPartner.values()) {
    list.sort((a, b) => valueOr(b.replyRate, -1) - valueOr(a.replyRate, -1)
      || (meetsSample(b.rate24) ? valueOr(b.rate24, -1) : -1) - (meetsSample(a.rate24) ? valueOr(a.rate24, -1) : -1)
      || valueOr(a.unreplied, 0) - valueOr(b.unreplied, 0)
      || a.storeName.localeCompare(b.storeName, "th"));
    list.forEach((row, index) => { row.partnerRank = index + 1; row.partnerRankedCount = list.length; });
  }
  for (const row of rows) if (row.partnerRank === null) row.partnerRankedCount = byPartner.get(row.partner)?.length ?? 0;
  return rows;
}

export function sortMonthRows<T extends StoreMetricsRow>(rows: T[], sort: MonthSort = "rate24"): T[] {
  return sortStoreRows(rows, sort);
}

export function filterMonthRows(rows: MonthStoreRow[], input: { partner?: string | null; region?: string | null; search?: string | null }): MonthStoreRow[] {
  return filterStoreRows(rows, input).filter((row) => !input.partner || row.partner === input.partner);
}

export type PartnerRow = GroupTotals & { partner: string; storeCount: number; storeIds: string[] };

/** One row per partner: its stores' counts summed, its 24-hour rate as Σwithin24h ÷ Σtotal. */
export function partnerRows(rows: MonthStoreRow[], rates: PeriodSource<RateResponse>, previousRates: PeriodSource<RateResponse>): PartnerRow[] {
  const groups = new Map<string, MonthStoreRow[]>();
  for (const row of rows) groups.set(row.partner, [...(groups.get(row.partner) ?? []), row]);
  const rateSum = (source: PeriodSource<RateResponse>, ids: Set<string>) => {
    if (!source.data) return null;
    return source.data.stores.filter((row) => ids.has(row.storeId)).reduce((sum, row) => ({ total: sum.total + row.total, within24h: sum.within24h + row.within24h }), { total: 0, within24h: 0 });
  };
  const result = [...groups.entries()].map(([partner, members]): PartnerRow => {
    const ids = new Set(members.map((row) => row.storeId));
    return {
      partner,
      storeCount: members.length,
      storeIds: [...ids],
      ...totalsFrom({
        chats: sumStates(members.map((row) => row.chats)),
        unreplied: sumStates(members.map((row) => row.unreplied)),
        replied: sumStates(members.map((row) => row.replied)),
        previousChats: sumStates(members.map((row) => row.previousChats)),
        previousUnreplied: sumStates(members.map((row) => row.previousUnreplied)),
        previousReplied: sumStates(members.map((row) => row.previousReplied)),
        rate: rateSum(rates, ids),
        rateStatus: periodStatus(rates),
        previousRate: rateSum(previousRates, ids),
        previousRateStatus: periodStatus(previousRates),
      }),
    };
  });
  // Worst 24-hour rate first (its gap to the target); low-sample partners last.
  return result.sort((a, b) => {
    const order = rateKey(a.rate24) - rateKey(b.rate24);
    return (Number.isNaN(order) ? 0 : order) || valueOr(b.unreplied, -1) - valueOr(a.unreplied, -1) || a.partner.localeCompare(b.partner, "en");
  });
}
