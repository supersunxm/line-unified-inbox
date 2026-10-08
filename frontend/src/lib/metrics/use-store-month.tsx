"use client";

// Store 360's per-store sources (existing endpoints, through the metrics layer's shared cache):
//   /conversations?storeId=&sort=latest-desc&pageSize=1   — the store's latest chat, any month (coverage chip)
//   /follower-insights/summary?storeId=&dateFrom&dateTo   — the store's daily followers (chart)
//   /store-insights/:storeId/customer-voice?from&to       — Customer Voice coverage (shown only at ≥ 20%)

import { api } from "@/lib/api";
import { useKeyedSource, type Source } from "./use-monthly-metrics";

export type StoreLatestChat = { total: number; latestMessageAt: string | null };

async function loadLatest(key: string): Promise<StoreLatestChat> {
  const { storeId } = JSON.parse(key) as { storeId: string };
  const result = await api.conversations({ storeId, sort: "latest-desc", pageSize: 1, page: 1 });
  return { total: result.total, latestMessageAt: result.items[0]?.latestMessageAt ?? null };
}

export type StoreFollowerDay = { date: string; followers: number | null; blocks: number | null };

async function loadFollowerDays(key: string): Promise<StoreFollowerDay[]> {
  const { storeId, dateFrom, dateTo } = JSON.parse(key) as { storeId: string; dateFrom: string; dateTo: string };
  const rows = await api.followerInsightsSummary({ storeId, dateFrom, dateTo });
  return rows.map((row) => ({ date: row.date, followers: row.followers, blocks: row.blocks }));
}

async function loadCustomerVoiceShare(key: string): Promise<number | null> {
  const { storeId, from, to } = JSON.parse(key) as { storeId: string; from: string; to: string };
  return (await api.storeInsightsCustomerVoice(storeId, { from, to })).coverage.classifiedPercentage;
}

/** The store's latest chat of any month: has the system ever collected its chats, and up to when. */
export function useStoreLatestChat(storeId: string | null, nonce: number): Source<StoreLatestChat> {
  return useKeyedSource("store-latest-chat", storeId ? JSON.stringify({ storeId }) : null, nonce, loadLatest);
}

/** The store's daily followers over [dateFrom, dateTo]. */
export function useStoreFollowerDays(storeId: string | null, range: { dateFrom: string; dateTo: string } | null, nonce: number): Source<StoreFollowerDay[]> {
  return useKeyedSource("store-follower-days", storeId && range ? JSON.stringify({ storeId, ...range }) : null, nonce, loadFollowerDays);
}

/** Share of the store's chats in the period that Customer Voice classified (0–1), or null. */
export function useCustomerVoiceShare(storeId: string | null, range: { from: string; to: string } | null, nonce: number): Source<number | null> {
  return useKeyedSource("store-customer-voice", storeId && range ? JSON.stringify({ storeId, ...range }) : null, nonce, loadCustomerVoiceShare);
}
