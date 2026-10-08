"use client";

// Followers for a month (lib/metrics/followers.ts has the definitions). Existing endpoints only:
//   /dashboard/analytics?dateFrom&dateTo              — network adds / blocks / net (custom range)
//   /dashboard/executive-store-health?dateFrom&dateTo — the daily follower chart (followerTrend)
//   /follower-insights/by-store?dateFrom=D&dateTo=D   — per LINE OA on one day (per-store change)
// Shared through the metrics layer's response cache.

import { useMemo } from "react";
import { bangkokDateKey } from "./date-keys";
import { followerDays, storeFollowerChanges, storesSeenBy, type FollowerAccountDay, type StoreFollowerChange } from "./followers";
import type { MonthPeriod } from "./month";
import { useKeyedSource, type Source } from "./use-monthly-metrics";

export type FollowerGrowth = { added: number; blocked: number; net: number; totalFriends: number; accountsCompared: number; accountsEligible: number };
export type FollowerTrendPoint = { date: string; followers: number };

async function getJson<T>(path: string, failure: string): Promise<T> {
  const response = await fetch(`/api-backend${path}`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`${failure} (${response.status})`);
  return (await response.json()) as T;
}

async function loadGrowth(key: string): Promise<FollowerGrowth> {
  const { dateFrom, dateTo } = JSON.parse(key) as { dateFrom: string; dateTo: string };
  const params = new URLSearchParams({ period: "30d", dateFrom, dateTo });
  const body = await getJson<{ summaryCards: { followerGrowth: { addedToday: number; blockedToday: number; netToday: number; totalFriends: number; growthAccountsCompared?: number; totalEligibleAccounts?: number } } }>(`/dashboard/analytics?${params.toString()}`, "โหลดผู้ติดตามไม่สำเร็จ");
  const growth = body.summaryCards.followerGrowth;
  return { added: growth.addedToday, blocked: growth.blockedToday, net: growth.netToday, totalFriends: growth.totalFriends, accountsCompared: growth.growthAccountsCompared ?? 0, accountsEligible: growth.totalEligibleAccounts ?? 0 };
}

async function loadTrend(key: string): Promise<FollowerTrendPoint[]> {
  const { dateFrom, dateTo } = JSON.parse(key) as { dateFrom: string; dateTo: string };
  const params = new URLSearchParams({ period: "30d", dateFrom, dateTo });
  return (await getJson<{ followerTrend: FollowerTrendPoint[] }>(`/dashboard/executive-store-health?${params.toString()}`, "โหลดกราฟผู้ติดตามไม่สำเร็จ")).followerTrend;
}

async function loadAccountsOn(key: string): Promise<FollowerAccountDay[]> {
  const { date } = JSON.parse(key) as { date: string };
  const params = new URLSearchParams({ dateFrom: date, dateTo: date });
  const rows = await getJson<Array<FollowerAccountDay & Record<string, unknown>>>(`/follower-insights/by-store?${params.toString()}`, "โหลดผู้ติดตามรายร้านไม่สำเร็จ");
  return rows.map((row) => ({ lineOaId: row.lineOaId, storeId: row.storeId, storeName: row.storeName, followers: row.followers, blocks: row.blocks, status: row.status }));
}

export type MonthlyFollowers = {
  /** null when the period has no daily snapshot yet (day 1 of the month). */
  days: { baseline: string; target: string; seenBy: string } | null;
  growth: Source<FollowerGrowth>;
  previousGrowth: Source<FollowerGrowth>;
  trend: Source<FollowerTrendPoint[]>;
  /** Per-store change for the period (stores with a snapshot on both days). */
  byStore: Source<Map<string, StoreFollowerChange>>;
  /** Stores that already had followers FOLLOWER_MIN_AGE_DAYS before the period. */
  seen: Source<Set<string>>;
};

const idle: Source<never> = { data: null, error: null, loading: false };

/** Followers for the selected period and its comparison period. Parts load only when asked for. */
export function useMonthlyFollowers(input: { current: MonthPeriod; previous: MonthPeriod | null; nonce: number; now: number; parts: { growth?: boolean; previous?: boolean; trend?: boolean; byStore?: boolean } }): MonthlyFollowers {
  const today = bangkokDateKey(input.now);
  const days = followerDays(input.current, today);
  const previousDays = input.previous ? followerDays(input.previous, today) : null;
  const range = days ? JSON.stringify({ dateFrom: input.current.dateFrom, dateTo: days.target }) : null;
  const previousRange = previousDays && input.previous ? JSON.stringify({ dateFrom: input.previous.dateFrom, dateTo: previousDays.target }) : null;
  const growth = useKeyedSource("followers-growth", input.parts.growth ? range : null, input.nonce, loadGrowth);
  const previousGrowth = useKeyedSource("followers-growth", input.parts.previous ? previousRange : null, input.nonce, loadGrowth);
  const trend = useKeyedSource("followers-trend", input.parts.trend ? range : null, input.nonce, loadTrend);
  const baseline = useKeyedSource("followers-day", input.parts.byStore && days ? JSON.stringify({ date: days.baseline }) : null, input.nonce, loadAccountsOn);
  const target = useKeyedSource("followers-day", input.parts.byStore && days ? JSON.stringify({ date: days.target }) : null, input.nonce, loadAccountsOn);
  const seenDay = useKeyedSource("followers-day", input.parts.byStore && days ? JSON.stringify({ date: days.seenBy }) : null, input.nonce, loadAccountsOn);
  const byStore = useMemo<Source<Map<string, StoreFollowerChange>>>(() => {
    if (!input.parts.byStore || !days) return idle;
    if (baseline.data && target.data) return { data: storeFollowerChanges(baseline.data, target.data), error: null, loading: baseline.loading || target.loading };
    return { data: null, error: baseline.error ?? target.error, loading: baseline.loading || target.loading };
  }, [baseline, days, input.parts.byStore, target]);
  const seen = useMemo<Source<Set<string>>>(() => (seenDay.data ? { data: storesSeenBy(seenDay.data), error: null, loading: seenDay.loading } : { data: null, error: seenDay.error, loading: seenDay.loading }), [seenDay]);
  return { days, growth, previousGrowth, trend, byStore, seen };
}
