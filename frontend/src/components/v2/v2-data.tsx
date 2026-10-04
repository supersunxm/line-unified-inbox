"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ApiConversation, GoogleReviewKpiStoreItem } from "@/types/api";
import {
  aggregateReplyRate,
  buildStoreRows,
  sortWaitingChats,
  storesWithChatData,
  toWaitingChat,
  type ReplyRateRow,
  type ReplyRateTotals,
  type StoreRow,
  type SummaryStore,
  type WaitingChat,
} from "@/lib/v2/response-model";
import { bangkokDateKey, lastSevenDays, previousSevenDays, sevenSingleDays, type DateRange } from "@/lib/v2/date-ranges";

/** /conversations allows pageSize ≤ 100; stop after this many pages and say so. */
export const WAITING_PAGE_SIZE = 100;
export const WAITING_MAX_PAGES = 20;

type Source<T> = { data: T | null; error: string | null; loading: boolean };
const initialSource = { data: null, error: null, loading: true };

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ";
}

async function fetchReplyRates(range: DateRange): Promise<ReplyRateRow[]> {
  const params = new URLSearchParams({ dateFrom: range.dateFrom, dateTo: range.dateTo });
  const response = await fetch(`/api-backend/dashboard/store-24h-response-summary?${params.toString()}`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`โหลดอัตราตอบกลับไม่สำเร็จ (${response.status})`);
  const body = (await response.json()) as { stores: ReplyRateRow[] };
  return body.stores;
}

async function fetchWaitingConversations(): Promise<{ items: ApiConversation[]; truncated: boolean }> {
  const items: ApiConversation[] = [];
  for (let page = 1; page <= WAITING_MAX_PAGES; page += 1) {
    const response = await api.conversations({ replyState: "NOT_REPLIED", sort: "latest-asc", pageSize: WAITING_PAGE_SIZE, page });
    items.push(...response.items);
    if (items.length >= response.total || response.items.length < WAITING_PAGE_SIZE) return { items, truncated: false };
  }
  return { items, truncated: true };
}

export type V2Data = {
  now: number;
  summary: Source<SummaryStore[]>;
  fleet: Source<Array<{ storeId: string | null; status: string }>>;
  waiting: Source<{ items: ApiConversation[]; truncated: boolean }>;
  rates7d: Source<ReplyRateRow[]>;
  ratesPrev7d: Source<ReplyRateRow[]>;
  google: Source<GoogleReviewKpiStoreItem[]>;
  daily: Source<ReplyRateRow[][]>;
  dailyDays: string[];
  /** Every store, with no-data stores flagged (hasData = false). */
  storeRows: StoreRow[];
  /** Waiting chats in stores with data, longest business wait first. */
  waitingChats: WaitingChat[];
  storesWithData: ReadonlySet<string> | null;
  totals7d: ReplyRateTotals | null;
  totalsPrev7d: ReplyRateTotals | null;
  /** True until the sources the response numbers depend on have loaded. */
  coreLoading: boolean;
  refresh: () => void;
  requestDaily: () => void;
};

const V2DataContext = createContext<V2Data | null>(null);

export function useV2Data(): V2Data {
  const value = useContext(V2DataContext);
  if (!value) throw new Error("useV2Data must be used inside V2DataProvider");
  return value;
}

function useSource<T>(): [Source<T>, (load: () => Promise<T>) => Promise<void>] {
  const [source, setSource] = useState<Source<T>>(initialSource);
  const generation = useRef(0);
  const run = useCallback(async (load: () => Promise<T>) => {
    const current = ++generation.current;
    setSource((previous) => ({ ...previous, loading: true }));
    try {
      const data = await load();
      if (current === generation.current) setSource({ data, error: null, loading: false });
    } catch (error) {
      if (current === generation.current) setSource((previous) => ({ data: previous.data, error: messageOf(error), loading: false }));
    }
  }, []);
  return [source, run];
}

export function V2DataProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  const [summary, loadSummary] = useSource<SummaryStore[]>();
  const [fleet, loadFleet] = useSource<Array<{ storeId: string | null; status: string }>>();
  const [waiting, loadWaiting] = useSource<{ items: ApiConversation[]; truncated: boolean }>();
  const [rates7d, loadRates7d] = useSource<ReplyRateRow[]>();
  const [ratesPrev7d, loadRatesPrev7d] = useSource<ReplyRateRow[]>();
  const [google, loadGoogle] = useSource<GoogleReviewKpiStoreItem[]>();
  const [daily, loadDaily] = useSource<ReplyRateRow[][]>();
  const dailyRequested = useRef(false);
  const today = bangkokDateKey(now);
  const dailyRanges = useMemo(() => sevenSingleDays(today), [today]);

  const refresh = useCallback(() => {
    const at = Date.now();
    const day = bangkokDateKey(at);
    setNow(at);
    void loadSummary(async () => (await api.bmReplyStatusSummary()).stores);
    void loadFleet(async () => (await api.lineChatFleetReadiness()).stores);
    void loadWaiting(fetchWaitingConversations);
    void loadRates7d(() => fetchReplyRates(lastSevenDays(day)));
    void loadRatesPrev7d(() => fetchReplyRates(previousSevenDays(day)));
    void loadGoogle(async () => (await api.getGoogleReviewKpis({ month: day.slice(0, 7) })).stores);
    if (dailyRequested.current) void loadDaily(() => Promise.all(sevenSingleDays(day).map(fetchReplyRates)));
  }, [loadDaily, loadFleet, loadGoogle, loadRates7d, loadRatesPrev7d, loadSummary, loadWaiting]);

  const requestDaily = useCallback(() => {
    if (dailyRequested.current) return;
    dailyRequested.current = true;
    void loadDaily(() => Promise.all(sevenSingleDays(bangkokDateKey(Date.now())).map(fetchReplyRates)));
  }, [loadDaily]);

  useEffect(() => {
    const first = window.setTimeout(refresh, 0);
    // Waits are shown in minutes: re-measure every minute, re-fetch every five.
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    const reload = window.setInterval(refresh, 5 * 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(tick);
      window.clearInterval(reload);
    };
  }, [refresh]);

  const storesWithData = useMemo(() => (fleet.data ? storesWithChatData(fleet.data) : null), [fleet.data]);
  const regions = useMemo(() => new Map((google.data ?? []).filter((store) => store.storeId).map((store) => [store.storeId as string, store.region])), [google.data]);
  const allWaitingChats = useMemo(() => (waiting.data?.items ?? []).map((conversation) => toWaitingChat(conversation, now)), [waiting.data, now]);

  const value = useMemo<V2Data>(() => {
    const storeRows = buildStoreRows({
      summaryStores: summary.data ?? [],
      waitingChats: allWaitingChats,
      storesWithData,
      rates7d: rates7d.data ?? [],
      ratesPrev7d: ratesPrev7d.data ?? [],
      daily: daily.data ?? undefined,
      regions,
    });
    const included = new Set(storeRows.filter((row) => row.hasData).map((row) => row.storeId));
    return {
      now,
      summary,
      fleet,
      waiting,
      rates7d,
      ratesPrev7d,
      google,
      daily,
      dailyDays: dailyRanges.map((range) => range.dateFrom),
      storeRows,
      waitingChats: sortWaitingChats(allWaitingChats.filter((chat) => included.has(chat.storeId))),
      storesWithData,
      totals7d: rates7d.data ? aggregateReplyRate(rates7d.data, included) : null,
      totalsPrev7d: ratesPrev7d.data ? aggregateReplyRate(ratesPrev7d.data, included) : null,
      coreLoading: !summary.data && summary.loading,
      refresh,
      requestDaily,
    };
  }, [allWaitingChats, daily, dailyRanges, fleet, google, now, rates7d, ratesPrev7d, refresh, regions, requestDaily, storesWithData, summary, waiting]);

  return <V2DataContext.Provider value={value}>{children}</V2DataContext.Provider>;
}
