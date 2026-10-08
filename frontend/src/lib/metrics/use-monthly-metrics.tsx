"use client";

// useMonthlyMetrics(month): the one data hook behind Home, Dashboard, Store 360 and the v2 report.
// Every source is an existing endpoint shared with an existing page:
//   bm-reply-status-summary?month=  — /chats's month view (แชท / ยังไม่ตอบ / ตอบแล้ว, per store)
//   bm-reply-status-summary?from&to — the same endpoint over Bangkok days (previous month's same days)
//   store-24h-response-summary      — /replymessage (ตอบใน 24 ชม.)
//   /v2/month-close/:month          — a closed month's snapshot (read instead of live data)
//   /v2/tag-coverage?month=         — Parser v4 tag coverage (counts only)
//   /stores, /google-review-kpi     — the store list and location; the month's review results
// Responses are shared by every caller for SHARED_RESPONSE_TTL_MS (2 minutes), so opening Home,
// then Dashboard, then Store 360 asks the backend once. Definitions: docs/metrics-registry.md.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppLanguage } from "@/app/language";
import { api } from "@/lib/api";
import type { ApiConversation, ApiStore, GoogleReviewKpiStoreItem } from "@/types/api";
import { closeStatusLabel, snapshotRates, snapshotSummary, type MonthCloseInfo, type MonthCloseResponse } from "./month-close";
import { comparisonLabel, monthWindow, trendMonths, type MonthWindow } from "./month";
import {
  buildStoreRows,
  networkCounts,
  networkTotals,
  storeCounts,
  unattributedChats,
  type ChatCounts,
  type GroupTotals,
  type MonthSummary,
  type RateResponse,
  type StoreInfo,
  type StoreMetricsRow,
  type StoreMonthConversation,
} from "./store-model";
import { storeCoverage, storesInScope, type StoreCoverage } from "./store-scope";
import { tagCoverageByStore, type TagCoverageCounts, type TagCoverageResponse } from "./tag-coverage";
import { fetchPagesUntil } from "./waiting-pages";

/** /conversations allows pageSize ≤ 100. */
export const MONTH_PAGE_SIZE = 100;
export const MONTH_CONCURRENCY = 5;
/** One store's month: at most this many pages (2,000 chats). */
export const STORE_MONTH_MAX_PAGES = 20;

export type Source<T> = { data: T | null; error: string | null; loading: boolean };

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ";
}

/** A shared response is reused for this long by every page and the sidebar badge. */
export const SHARED_RESPONSE_TTL_MS = 2 * 60 * 1000;

// One promise per key and refresh, shared by every hook on every page.
const inflight = new Map<string, { promise: Promise<unknown>; at: number }>();
export function shared<T>(fullKey: string, load: () => Promise<T>): Promise<T> {
  const existing = inflight.get(fullKey);
  if (existing && Date.now() - existing.at < SHARED_RESPONSE_TTL_MS) return existing.promise as Promise<T>;
  const promise = load();
  inflight.set(fullKey, { promise, at: Date.now() });
  promise.catch(() => inflight.delete(fullKey));
  if (inflight.size > 200) inflight.delete(inflight.keys().next().value as string);
  return promise;
}

const baseOf = (fullKey: string) => fullKey.slice(0, fullKey.lastIndexOf("#"));

/** A source that is waiting on another (e.g. live data waits until the month's close is known). */
const PENDING: Source<never> = { data: null, error: null, loading: true };

/**
 * Loads `loader(key)` whenever key or the refresh nonce changes. While a refresh of the same key
 * is in flight the previous data stays; a different key never shows another key's data.
 */
export function useKeyedSource<T>(name: string, key: string | null, nonce: number, loader: (key: string) => Promise<T>): Source<T> {
  const [loaded, setLoaded] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  const fullKey = key === null ? null : `${key}#${nonce}`;
  useEffect(() => {
    if (key === null || fullKey === null) return;
    let cancelled = false;
    // The cache is shared by every loader, so its key carries the loader's name.
    shared(`${name}:${fullKey}`, () => loader(key)).then(
      (data) => { if (!cancelled) setLoaded({ key: fullKey, data, error: null }); },
      (error: unknown) => { if (!cancelled) setLoaded((previous) => ({ key: fullKey, data: previous && baseOf(previous.key) === key ? previous.data : null, error: messageOf(error) })); },
    );
    return () => { cancelled = true; };
  }, [fullKey, key, loader, name]);
  if (key === null || fullKey === null) return { data: null, error: null, loading: false };
  if (!loaded || baseOf(loaded.key) !== key) return { data: null, error: null, loading: true };
  return { data: loaded.data, error: loaded.error, loading: loaded.key !== fullKey };
}

// ---- Loaders (module-level, so they are stable) ----

async function loadStores(): Promise<StoreInfo[]> {
  // GET /stores returns full Store rows; region, area (province) and _count are not all in ApiStore.
  return (await api.stores()).map((store) => {
    const row = store as ApiStore & { region?: string | null; area?: string | null };
    return { id: store.id, name: store.name, region: row.region ?? null, province: row.area ?? null, lineOaCount: store._count?.lineOfficialAccounts ?? null };
  });
}

/**
 * /chats's month summary. {month} is the /chats call itself; {from, to} is the same endpoint and
 * bucketing over Bangkok days (both inclusive) — used for the previous month's same days.
 */
async function loadSummary(key: string): Promise<MonthSummary> {
  const parsed = JSON.parse(key) as { month: string } | { from: string; to: string };
  if ("month" in parsed) {
    const response = await api.bmReplyStatusSummary(parsed.month);
    return { overview: response.overview, stores: response.stores };
  }
  const params = new URLSearchParams({ from: parsed.from, to: parsed.to });
  const response = await fetch(`/api-backend/conversations/bm-reply-status-summary?${params.toString()}`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`โหลดจำนวนแชทช่วงเทียบไม่สำเร็จ (${response.status})`);
  const body = (await response.json()) as MonthSummary;
  return { overview: body.overview, stores: body.stores };
}

/**
 * A month's /chats summary through the shared cache — the request the sidebar badge, Home,
 * Dashboard and Store 360 all read (the same key useMonthlyMetrics uses on its first load).
 */
export function sharedMonthSummary(month: string): Promise<MonthSummary> {
  const key = JSON.stringify({ month });
  return shared(`summary:${key}#0`, () => loadSummary(key));
}

export async function fetchRates(dateFrom: string, dateTo: string): Promise<RateResponse> {
  const params = new URLSearchParams({ dateFrom, dateTo });
  const response = await fetch(`/api-backend/dashboard/store-24h-response-summary?${params.toString()}`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`โหลดอัตราตอบใน 24 ชม. ไม่สำเร็จ (${response.status})`);
  const body = (await response.json()) as RateResponse;
  return { overview: { total: body.overview.total, within24h: body.overview.within24h }, stores: body.stores };
}

async function loadRates(key: string): Promise<RateResponse> {
  const { dateFrom, dateTo } = JSON.parse(key) as { dateFrom: string; dateTo: string };
  return fetchRates(dateFrom, dateTo);
}

/** The store's LINE OA Manager link when it is known to be valid (as /chats links it). */
function storeManagerUrlOf(store: ApiConversation["store"]): string | null {
  return store?.lineManagerUrlStatus === "VALID" && store.lineManagerUrl ? store.lineManagerUrl : null;
}

type CountedConversation = { latestMessageAt: string; bmReplyStatus: string; effectiveReplyState?: "REPLIED" | "NOT_REPLIED"; store: { id: string } | null };

function slim(conversation: ApiConversation): CountedConversation {
  return { latestMessageAt: conversation.latestMessageAt, bmReplyStatus: conversation.bmReplyStatus, effectiveReplyState: conversation.effectiveReplyState, store: conversation.store ? { id: conversation.store.id } : null };
}

async function loadGoogle(key: string): Promise<GoogleReviewKpiStoreItem[]> {
  const { month } = JSON.parse(key) as { month: string };
  return (await api.getGoogleReviewKpis({ month })).stores;
}

/** A month's close (GET /v2/month-close/:month): the snapshot when closed, close: null while open. */
export async function fetchMonthClose(month: string): Promise<MonthCloseResponse> {
  const response = await fetch(`/api-backend/v2/month-close/${encodeURIComponent(month)}`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`โหลดสถานะปิดเดือนไม่สำเร็จ (${response.status})`);
  return (await response.json()) as MonthCloseResponse;
}

async function loadMonthClose(key: string): Promise<MonthCloseResponse> {
  return fetchMonthClose((JSON.parse(key) as { month: string }).month);
}

/** Tag coverage per store for a month (GET /v2/tag-coverage?month=). Live for every month. */
async function loadTagCoverage(key: string): Promise<TagCoverageResponse> {
  const { month } = JSON.parse(key) as { month: string };
  const response = await fetch(`/api-backend/v2/tag-coverage?month=${encodeURIComponent(month)}`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`โหลดความครบของแท็กไม่สำเร็จ (${response.status})`);
  return (await response.json()) as TagCoverageResponse;
}

export type TrendPoint = { month: string; dateFrom: string; dateTo: string; summary: MonthSummary | null; rates: RateResponse | null; error: string | null };

async function loadTrend(key: string): Promise<TrendPoint[]> {
  const { points } = JSON.parse(key) as { points: Array<{ month: string; dateFrom: string; dateTo: string }> };
  return Promise.all(points.map(async (point) => {
    // A closed month reads its snapshot; an open one reads live data.
    const close = await fetchMonthClose(point.month).catch(() => null);
    if (close?.close) return { ...point, summary: snapshotSummary(close), rates: snapshotRates(close), error: null };
    const [summary, rates] = await Promise.allSettled([
      shared(`summary:${JSON.stringify({ month: point.month })}#trend`, () => loadSummary(JSON.stringify({ month: point.month }))),
      fetchRates(point.dateFrom, point.dateTo),
    ]);
    return {
      ...point,
      summary: summary.status === "fulfilled" ? summary.value : null,
      rates: rates.status === "fulfilled" ? rates.value : null,
      error: summary.status === "rejected" ? messageOf(summary.reason) : rates.status === "rejected" ? messageOf(rates.reason) : null,
    };
  }));
}

export type StoreMonth = { items: StoreMonthConversation[]; truncated: boolean; total: number; managerUrl: string | null };

/** One store's chats in the month: the /chats list call (?storeId=&month=), newest first. */
async function loadStoreMonth(key: string): Promise<StoreMonth> {
  const { storeId, month } = JSON.parse(key) as { storeId: string; month: string };
  let total = 0;
  let managerUrl: string | null = null;
  const outcome = await fetchPagesUntil<ApiConversation>({
    fetchPage: async (page) => {
      const result = await api.conversations({ storeId, month, sort: "latest-desc", pageSize: MONTH_PAGE_SIZE, page });
      total = result.total;
      return result;
    },
    pageSize: MONTH_PAGE_SIZE,
    concurrency: MONTH_CONCURRENCY,
    maxPages: STORE_MONTH_MAX_PAGES,
    pastCutoff: () => false,
  });
  const items = outcome.items.map((conversation) => {
    managerUrl ??= storeManagerUrlOf(conversation.store);
    return { ...slim(conversation), nicknameDerivedMetadata: conversation.nicknameDerivedMetadata ?? null };
  });
  return { items, truncated: outcome.truncated, total, managerUrl };
}

/** One day of one store's 24-hour rate: within24h (numerator) ÷ total (denominator). */
export type DailyRate = { date: string; total: number; within24h: number };

/** store-24h-response-summary with storeId: its `dates` array is that store's per-day breakdown. */
async function loadStoreDailyRates(key: string): Promise<DailyRate[]> {
  const { storeId, dateFrom, dateTo } = JSON.parse(key) as { storeId: string; dateFrom: string; dateTo: string };
  const params = new URLSearchParams({ dateFrom, dateTo, storeId });
  const response = await fetch(`/api-backend/dashboard/store-24h-response-summary?${params.toString()}`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`โหลดตอบใน 24 ชม. รายวันไม่สำเร็จ (${response.status})`);
  const body = (await response.json()) as { dates?: DailyRate[] };
  return (body.dates ?? []).map((day) => ({ date: day.date, total: day.total, within24h: day.within24h }));
}

// ---- The hook ----

export type PreviousSource = Source<{ network: ChatCounts; byStore: Map<string, ChatCounts> }> & { collected: boolean };

export type MonthlyMetrics = {
  month: string;
  now: number;
  frame: MonthWindow;
  /** "1–7 ต.ค. 2026 เทียบ 1–7 ก.ย. 2026". */
  periodText: string;
  /** The month's close when closed (its snapshot is what every view shows), else null. */
  close: MonthCloseInfo | null;
  /** "ปิดเดือนแล้ว เมื่อ …" / "ปิดย้อนหลัง เมื่อ …" / "เดือนนี้ยังไม่ปิด …" / "สิ้นเดือนแล้ว รอปิดอัตโนมัติ …". */
  statusText: string;
  stores: Source<StoreInfo[]>;
  current: Source<MonthSummary>;
  previous: PreviousSource;
  rates: Source<RateResponse>;
  previousRates: Source<RateResponse>;
  google: Source<GoogleReviewKpiStoreItem[]>;
  /** Parser v4 tag coverage (counts only); not part of the month close, so live for every month. */
  tagCoverage: Source<TagCoverageResponse>;
  tagCoverageByStore: Map<string, TagCoverageCounts>;
  /** One row per store in scope (lib/metrics/store-scope.ts). */
  storeRows: StoreMetricsRow[];
  placeholders: StoreInfo[];
  network: GroupTotals;
  /** Stores with chat data among the stores in scope. */
  coverage: StoreCoverage;
  /** Network chats not in any listed store (should be 0). */
  unattributed: number | null;
  /** The close lookup failed: live numbers are shown instead. */
  closeError: string | null;
  /** At least one store has a Google Review result for the month. */
  hasGoogleResults: boolean;
  coreLoading: boolean;
  nonce: number;
  refresh: () => void;
};

export type MonthlyMetricsOptions = {
  /** Google Review results and tag coverage are loaded only by the pages that show them. */
  google?: boolean;
  tagCoverage?: boolean;
  /** False: load nothing (e.g. before the user is known). */
  enabled?: boolean;
};

/** The selected month's numbers, vs the comparison period, for every store in scope. */
export function useMonthlyMetrics(month: string, options: MonthlyMetricsOptions = {}): MonthlyMetrics {
  const { language } = useAppLanguage();
  const enabled = options.enabled !== false;
  const [nonce, setNonce] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const refresh = useCallback(() => {
    setNow(Date.now());
    setNonce((value) => value + 1);
  }, []);
  // A month-to-date frame is measured at "now", frozen until the next refresh so keys stay stable.
  const frame = useMemo(() => monthWindow(month, now), [month, now]);
  const on = (key: string | null) => (enabled ? key : null);

  const stores = useKeyedSource("stores", on("all"), nonce, loadStores);
  // Closed months read their snapshot; open months read live data. If the close lookup fails, live data is used.
  const monthClose = useKeyedSource("month-close", on(JSON.stringify({ month })), nonce, loadMonthClose);
  const previousClose = useKeyedSource("month-close", on(frame.previousCollected && !frame.inProgress ? JSON.stringify({ month: frame.previous.month }) : null), nonce, loadMonthClose);
  const closeKnown = monthClose.data !== null || monthClose.error !== null;
  const currentClosed = Boolean(monthClose.data?.close);
  // The open month compares with the previous month's days 1–D (live, from/to); a closed month with the whole previous month.
  const previousCloseKnown = frame.inProgress || !frame.previousCollected || previousClose.data !== null || previousClose.error !== null;
  const previousClosed = !frame.inProgress && Boolean(previousClose.data?.close);
  const liveCurrent = useKeyedSource("summary", on(closeKnown && !currentClosed ? JSON.stringify({ month }) : null), nonce, loadSummary);
  const liveRates = useKeyedSource("rates", on(closeKnown && !currentClosed ? JSON.stringify({ dateFrom: frame.current.dateFrom, dateTo: frame.current.dateTo }) : null), nonce, loadRates);
  const livePrevious = useKeyedSource(
    "summary",
    on(!frame.previousCollected || !previousCloseKnown || previousClosed ? null : frame.inProgress ? JSON.stringify({ from: frame.previous.dateFrom, to: frame.previous.dateTo }) : JSON.stringify({ month: frame.previous.month })),
    nonce,
    loadSummary,
  );
  const livePreviousRates = useKeyedSource("rates", on(frame.previousCollected && previousCloseKnown && !previousClosed ? JSON.stringify({ dateFrom: frame.previous.dateFrom, dateTo: frame.previous.dateTo }) : null), nonce, loadRates);
  const current = useMemo<Source<MonthSummary>>(() => (currentClosed ? { data: snapshotSummary(monthClose.data!), error: null, loading: false } : closeKnown ? liveCurrent : PENDING), [closeKnown, currentClosed, liveCurrent, monthClose.data]);
  const rates = useMemo<Source<RateResponse>>(() => (currentClosed ? { data: snapshotRates(monthClose.data!), error: null, loading: false } : closeKnown ? liveRates : PENDING), [closeKnown, currentClosed, liveRates, monthClose.data]);
  const previousSummary = useMemo<Source<MonthSummary>>(() => (previousClosed ? { data: snapshotSummary(previousClose.data!), error: null, loading: false } : previousCloseKnown ? livePrevious : PENDING), [livePrevious, previousClose.data, previousCloseKnown, previousClosed]);
  const previousRates = useMemo<Source<RateResponse>>(() => (previousClosed ? { data: snapshotRates(previousClose.data!), error: null, loading: false } : previousCloseKnown ? livePreviousRates : PENDING), [livePreviousRates, previousClose.data, previousCloseKnown, previousClosed]);
  const google = useKeyedSource("google", on(options.google ? JSON.stringify({ month }) : null), nonce, loadGoogle);
  const tagCoverage = useKeyedSource("tag-coverage", on(options.tagCoverage ? JSON.stringify({ month }) : null), nonce, loadTagCoverage);

  return useMemo<MonthlyMetrics>(() => {
    const universe = stores.data ? storesInScope(stores.data, current.data) : { stores: [], placeholders: [] };
    const previous: PreviousSource = frame.previousCollected
      ? {
        data: previousSummary.data ? { network: networkCounts(previousSummary.data), byStore: storeCounts(previousSummary.data) } : null,
        error: previousSummary.error,
        loading: previousSummary.loading,
        collected: true,
      }
      : { data: null, error: null, loading: false, collected: false };
    const previousSource = { data: previous.data?.byStore ?? null, error: previous.error, loading: previous.loading, collected: previous.collected };
    const previousRatesSource = { ...previousRates, collected: frame.previousCollected };
    const storeRows = buildStoreRows({ stores: universe.stores, current, previous: previousSource, rates, previousRates: previousRatesSource });
    const network = networkTotals({ current, previous: { data: previous.data?.network ?? null, error: previous.error, loading: previous.loading, collected: previous.collected }, rates, previousRates: previousRatesSource });
    return {
      month,
      now,
      frame,
      periodText: comparisonLabel(frame, language),
      close: monthClose.data?.close ?? null,
      statusText: closeStatusLabel(monthClose.data?.close ?? null, monthClose.data?.dueAt ?? null, frame, language),
      stores,
      current,
      previous,
      rates,
      previousRates,
      google,
      tagCoverage,
      tagCoverageByStore: tagCoverageByStore(tagCoverage.data),
      storeRows,
      placeholders: universe.placeholders,
      network,
      coverage: storeCoverage(storeRows),
      unattributed: stores.data && current.data ? unattributedChats(network.chats, storeRows) : null,
      hasGoogleResults: Boolean(google.data?.some((store) => store.kpiResult)),
      coreLoading: (!stores.data && stores.loading) || (!current.data && current.loading),
      closeError: monthClose.error,
      nonce,
      refresh,
    };
  }, [language, current, google, month, nonce, now, previousSummary, previousRates, rates, refresh, stores, frame, monthClose.data, monthClose.error, tagCoverage]);
}

/** The last ≤ 6 months ending at `month` (never before the first v2 month), loaded only when enabled. */
export function useMonthlyTrend(month: string, now: number, nonce: number, enabled: boolean): Source<TrendPoint[]> {
  const points = trendMonths(month).map((entry) => {
    const period = monthWindow(entry, now).current;
    return { month: entry, dateFrom: period.dateFrom, dateTo: period.dateTo };
  });
  return useKeyedSource("trend", enabled ? JSON.stringify({ points }) : null, nonce, loadTrend);
}

/** One store's chats in a month (/chats's list call). */
export function useStoreMonthChats(storeId: string | null, month: string, nonce: number): Source<StoreMonth> {
  return useKeyedSource("store-month", storeId ? JSON.stringify({ storeId, month }) : null, nonce, loadStoreMonth);
}

/** One store's per-day 24-hour rate over a period. */
export function useStoreDailyRateSource(storeId: string | null, frame: MonthWindow, nonce: number): Source<DailyRate[]> {
  return useKeyedSource("store-daily-rates", storeId ? JSON.stringify({ storeId, dateFrom: frame.current.dateFrom, dateTo: frame.current.dateTo }) : null, nonce, loadStoreDailyRates);
}
