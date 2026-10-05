"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ApiConversation, GoogleReviewKpiStoreItem } from "@/types/api";
import {
  aggregateReplyRate,
  buildStoreRows,
  sortWaitingChats,
  storesWithChatData,
  storesWithRecentActivity,
  isRecentWait,
  type MirrorRow,
  toWaitingChat,
  type ReplyRateRow,
  type ReplyRateTotals,
  type StoreRow,
  type SummaryStore,
  type WaitingChat,
} from "@/lib/v2/response-model";
import { RECENT_WAIT_WINDOW_MS } from "@/lib/v2/business-hours";
import { fetchPagesUntil } from "@/lib/v2/waiting-pages";
import { bangkokDateKey, lastSevenDays, previousSevenDays, sevenSingleDays, type DateRange } from "@/lib/v2/date-ranges";

/** /conversations allows pageSize ≤ 100. Newest first, ≤ 5 requests at once, stop at 7 days; the cap is a safety net. */
export const WAITING_PAGE_SIZE = 100;
export const WAITING_CONCURRENCY = 5;
export const WAITING_MAX_PAGES = 30;

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

/**
 * Waiting chats from the last 7 days. Older ones are not fetched: the backlog per store is
 * the backend summary count minus these (see buildStoreRows).
 */
async function fetchRecentWaitingConversations(): Promise<{ items: ApiConversation[]; truncated: boolean }> {
  const cutoff = Date.now() - RECENT_WAIT_WINDOW_MS;
  const outcome = await fetchPagesUntil<ApiConversation>({
    fetchPage: (page) => api.conversations({ replyState: "NOT_REPLIED", sort: "latest-desc", pageSize: WAITING_PAGE_SIZE, page }),
    pageSize: WAITING_PAGE_SIZE,
    concurrency: WAITING_CONCURRENCY,
    maxPages: WAITING_MAX_PAGES,
    pastCutoff: (last) => Date.parse(last.latestMessageAt) < cutoff,
  });
  return { items: outcome.items, truncated: outcome.truncated };
}

async function fetchMirrorStatus(): Promise<MirrorRow[]> {
  const response = await fetch("/api-backend/operations/line-chat-nickname/mirror-status", { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`โหลดสถานะการเก็บแชทไม่สำเร็จ (${response.status})`);
  return ((await response.json()) as { stores: MirrorRow[] }).stores;
}

export type V2Data = {
  now: number;
  summary: Source<SummaryStore[]>;
  mirror: Source<MirrorRow[]>;
  waiting: Source<{ items: ApiConversation[]; truncated: boolean }>;
  rates7d: Source<ReplyRateRow[]>;
  ratesPrev7d: Source<ReplyRateRow[]>;
  google: Source<GoogleReviewKpiStoreItem[]>;
  daily: Source<ReplyRateRow[][]>;
  dailyDays: string[];
  /** Every store, with no-data stores flagged (hasData = false). */
  storeRows: StoreRow[];
  /** Recent (≤ 7 days) waiting chats in stores with data, longest business wait first. */
  waitingChats: WaitingChat[];
  storesWithData: ReadonlySet<string> | null;
  /** Where "has data" came from: Live Mirror status, or the 7-day activity fallback when that failed. */
  hasDataSource: "mirror" | "activity" | null;
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
  const [mirror, loadMirror] = useSource<MirrorRow[]>();
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
    void loadMirror(fetchMirrorStatus);
    void loadWaiting(fetchRecentWaitingConversations);
    void loadRates7d(() => fetchReplyRates(lastSevenDays(day)));
    void loadRatesPrev7d(() => fetchReplyRates(previousSevenDays(day)));
    void loadGoogle(async () => (await api.getGoogleReviewKpis({ month: day.slice(0, 7) })).stores);
    if (dailyRequested.current) void loadDaily(() => Promise.all(sevenSingleDays(day).map(fetchReplyRates)));
  }, [loadDaily, loadMirror, loadGoogle, loadRates7d, loadRatesPrev7d, loadSummary, loadWaiting]);

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

  const hasDataSource: V2Data["hasDataSource"] = mirror.data ? "mirror" : mirror.error && rates7d.data ? "activity" : null;
  const storesWithData = useMemo(
    () => (mirror.data ? storesWithChatData(mirror.data, now) : mirror.error && rates7d.data ? storesWithRecentActivity(rates7d.data) : null),
    [mirror.data, mirror.error, rates7d.data, now],
  );
  const regions = useMemo(() => new Map((google.data ?? []).filter((store) => store.storeId).map((store) => [store.storeId as string, store.region])), [google.data]);
  const allWaitingChats = useMemo(() => (waiting.data?.items ?? []).map((conversation) => toWaitingChat(conversation, now)), [waiting.data, now]);

  const value = useMemo<V2Data>(() => {
    const storeRows = buildStoreRows({
      summaryStores: summary.data ?? [],
      waitingChats: allWaitingChats,
      storesWithData,
      now,
      rates7d: rates7d.data ?? [],
      ratesPrev7d: ratesPrev7d.data ?? [],
      daily: daily.data ?? undefined,
      regions,
    });
    const included = new Set(storeRows.filter((row) => row.hasData).map((row) => row.storeId));
    return {
      now,
      summary,
      mirror,
      waiting,
      rates7d,
      ratesPrev7d,
      google,
      daily,
      dailyDays: dailyRanges.map((range) => range.dateFrom),
      storeRows,
      waitingChats: sortWaitingChats(allWaitingChats.filter((chat) => included.has(chat.storeId) && isRecentWait(chat.waitingSince, now))),
      storesWithData,
      hasDataSource,
      totals7d: rates7d.data ? aggregateReplyRate(rates7d.data, included) : null,
      totalsPrev7d: ratesPrev7d.data ? aggregateReplyRate(ratesPrev7d.data, included) : null,
      // Numbers wait for the summary, the recent waiting chats and a has-data source, so they never show and then jump.
      coreLoading: (!summary.data && summary.loading) || (!waiting.data && waiting.loading) || (storesWithData === null && (mirror.loading || rates7d.loading)),
      refresh,
      requestDaily,
    };
  }, [allWaitingChats, daily, dailyRanges, google, hasDataSource, mirror, now, rates7d, ratesPrev7d, refresh, regions, requestDaily, storesWithData, summary, waiting]);

  return <V2DataContext.Provider value={value}>{children}</V2DataContext.Provider>;
}
