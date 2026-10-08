// Followers for a month. Pure: node --test imports it directly.
//
// Network headline (Dashboard, Home): the existing GET /dashboard/analytics follower growth with the
// month as a custom range (adds = Δfollowers, blocks = Δblocks, net = adds − blocks; the backend
// compares the day before day 1 with the last day). Daily chart: GET /dashboard/executive-store-health
// followerTrend over the same range.
// Per store (Dashboard movers and column, Store 360): GET /follower-insights/by-store for one day at a
// time — the baseline day (the day before day 1) and the last day — summed over the store's LINE OAs,
// with the same adds/blocks/net arithmetic. A store needs a ready snapshot on both days.

import { shiftDateKey } from "./date-keys.ts";

/** Stores with fewer followers than this at the baseline are left out of the top movers. */
export const FOLLOWER_MIN_BASE = 100;
/** Stores first seen less than this many days before the period are left out of the top movers. */
export const FOLLOWER_MIN_AGE_DAYS = 30;
/** How many growers and decliners are listed. */
export const FOLLOWER_MOVERS_LIMIT = 5;

/** A row of GET /follower-insights/by-store (one LINE OA on one day). */
export type FollowerAccountDay = { lineOaId: string; storeId: string; storeName: string; followers: number | null; blocks: number | null; status: string };

export type StoreFollowerChange = {
  storeId: string;
  storeName: string;
  /** Followers at the baseline (summed over the store's OAs with both snapshots). */
  base: number;
  adds: number;
  blocks: number;
  net: number;
};

/**
 * Bangkok dates a period's follower change compares: the day before day 1 (baseline) and the last
 * day with a daily snapshot (target). Snapshots are taken once a day for the day before, so a period
 * that runs to today ends at yesterday. null when no day of the period has a snapshot yet (day 1).
 */
export function followerDays(period: { dateFrom: string; dateTo: string }, today: string): { baseline: string; target: string; seenBy: string } | null {
  const baseline = shiftDateKey(period.dateFrom, -1);
  const yesterday = shiftDateKey(today, -1);
  const target = period.dateTo < yesterday ? period.dateTo : yesterday;
  if (target < period.dateFrom) return null;
  return { baseline, target, seenBy: shiftDateKey(baseline, -FOLLOWER_MIN_AGE_DAYS) };
}

/** Per store: adds = Δfollowers, blocks = Δblocks, net = adds − blocks, over OAs ready on both days. */
export function storeFollowerChanges(baseline: FollowerAccountDay[], target: FollowerAccountDay[]): Map<string, StoreFollowerChange> {
  const before = new Map(baseline.filter((row) => row.followers !== null).map((row) => [row.lineOaId, row]));
  const result = new Map<string, StoreFollowerChange>();
  for (const row of target) {
    const start = before.get(row.lineOaId);
    if (row.followers === null || !start || start.followers === null) continue;
    const entry = result.get(row.storeId) ?? { storeId: row.storeId, storeName: row.storeName, base: 0, adds: 0, blocks: 0, net: 0 };
    const adds = row.followers - start.followers;
    const blocks = row.blocks !== null && start.blocks !== null ? row.blocks - start.blocks : 0;
    entry.base += start.followers;
    entry.adds += adds;
    entry.blocks += blocks;
    entry.net += adds - blocks;
    result.set(row.storeId, entry);
  }
  return result;
}

/** Stores that had a follower count on `seenBy` (first seen at least FOLLOWER_MIN_AGE_DAYS earlier). */
export function storesSeenBy(rows: FollowerAccountDay[]): Set<string> {
  return new Set(rows.filter((row) => row.followers !== null).map((row) => row.storeId));
}

export type FollowerMovers = {
  growers: StoreFollowerChange[];
  decliners: StoreFollowerChange[];
  /** "+X จาก N ร้านที่เพิ่ม · −Y จาก M ร้านที่ลด" over every store with both snapshots. */
  gained: { total: number; stores: number };
  lost: { total: number; stores: number };
  /** Stores left out of the movers: small base or new. */
  excluded: number;
};

/**
 * Top growers and decliners by net change, excluding stores with fewer than minBase followers at the
 * baseline and stores not seen FOLLOWER_MIN_AGE_DAYS before the period (likely new stores).
 * `inScope`, when given, limits everything to the stores in scope.
 */
export function followerMovers(changes: Map<string, StoreFollowerChange>, seen: Set<string> | null, options: { minBase?: number; limit?: number; inScope?: Set<string> } = {}): FollowerMovers {
  const minBase = options.minBase ?? FOLLOWER_MIN_BASE;
  const limit = options.limit ?? FOLLOWER_MOVERS_LIMIT;
  const all = [...changes.values()].filter((row) => !options.inScope || options.inScope.has(row.storeId));
  const eligible = all.filter((row) => row.base >= minBase && (seen === null || seen.has(row.storeId)));
  const byName = (a: StoreFollowerChange, b: StoreFollowerChange) => a.storeName.localeCompare(b.storeName, "th");
  return {
    growers: eligible.filter((row) => row.net > 0).sort((a, b) => b.net - a.net || byName(a, b)).slice(0, limit),
    decliners: eligible.filter((row) => row.net < 0).sort((a, b) => a.net - b.net || byName(a, b)).slice(0, limit),
    gained: { total: all.filter((row) => row.net > 0).reduce((sum, row) => sum + row.net, 0), stores: all.filter((row) => row.net > 0).length },
    lost: { total: all.filter((row) => row.net < 0).reduce((sum, row) => sum - row.net, 0), stores: all.filter((row) => row.net < 0).length },
    excluded: all.length - eligible.length,
  };
}
