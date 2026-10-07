"use client";

import { useAppLanguage } from "@/app/language";

// Data for v2's monthly views. Every source is an existing endpoint shared with an existing page:
//   bm-reply-status-summary?month=  — /chats's month view (แชท / ยังไม่ตอบ / ตอบแล้ว, per store)
//   /conversations?month=&sort=     — /chats's list call (previous month over the same days; one store's month)
//   store-24h-response-summary      — /replymessage (ตอบใน 24 ชม.)
//   /stores, /google-review-kpi     — store list and location; the month's review results
// Definitions are in lib/v2/monthly-model.ts and docs/v2/decisions.md.

import { useSearchParams } from "next/navigation";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { ApiConversation, ApiStore, GoogleReviewKpiStoreItem } from "@/types/api";
import { comparisonLabel, monthWindow, parseV2Month, trendMonths, type MonthWindow } from "@/lib/v2/month";
import {
  buildMonthStoreRows,
  dataCoverage,
  networkCounts,
  networkTotals,
  partnerRows,
  storeCounts,
  unattributedChats,
  v2Stores,
  type ChatCounts,
  type GroupTotals,
  type MonthStoreRow,
  type MonthSummary,
  type PartnerRow,
  type RateResponse,
  type StoreInfo,
  type StoreMonthConversation,
} from "@/lib/v2/monthly-model";
import { fetchPagesUntil } from "@/lib/v2/waiting-pages";
import { storeManagerUrlOf } from "@/lib/v2/response-model";
import type { StorePartnerRow } from "@/lib/v2/partners";
import { closeStatusLabel, snapshotRates, snapshotSummary, type MonthCloseInfo, type MonthCloseResponse } from "@/lib/v2/month-close";
import { tagCoverageByStore, type TagCoverageCounts, type TagCoverageResponse } from "@/lib/v2/tag-coverage";

/** /conversations allows pageSize ≤ 100. */
export const MONTH_PAGE_SIZE = 100;
export const MONTH_CONCURRENCY = 5;
/** One store's month in the scorecard drawer: at most this many pages (2,000 chats). */
export const STORE_MONTH_MAX_PAGES = 20;

export type Source<T> = { data: T | null; error: string | null; loading: boolean };

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ";
}

/** A shared response is reused for this long, so a page opened later (e.g. the report) fetches fresh numbers. */
export const SHARED_RESPONSE_TTL_MS = 2 * 60 * 1000;

// One promise per key and refresh, so the trend and the main view share a month's summary.
const inflight = new Map<string, { promise: Promise<unknown>; at: number }>();
function shared<T>(fullKey: string, load: () => Promise<T>): Promise<T> {
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
function useKeyedSource<T>(name: string, key: string | null, nonce: number, loader: (key: string) => Promise<T>): Source<T> {
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

/** Store → partner from the mapping keyed by Store ID (GET /v2/store-partners). */
export async function fetchStorePartners(): Promise<StorePartnerRow[]> {
  const response = await fetch("/api-backend/v2/store-partners", { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`โหลด partner ของสาขาไม่สำเร็จ (${response.status})`);
  return ((await response.json()) as { stores: StorePartnerRow[] }).stores;
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

// ---- Context ----

export type PreviousSource = Source<{ network: ChatCounts; byStore: Map<string, ChatCounts> }> & { collected: boolean };

export type V2MonthData = {
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
  /** The Store → partner mapping; when it fails every store reads "ไม่ระบุ partner" and the page says so. */
  partnerMapping: Source<StorePartnerRow[]>;
  current: Source<MonthSummary>;
  previous: PreviousSource;
  rates: Source<RateResponse>;
  previousRates: Source<RateResponse>;
  google: Source<GoogleReviewKpiStoreItem[]>;
  /** Parser v4 tag coverage (counts only); not part of the month close, so live for every month. */
  tagCoverage: Source<TagCoverageResponse>;
  tagCoverageByStore: Map<string, TagCoverageCounts>;
  rows: MonthStoreRow[];
  placeholders: StoreInfo[];
  network: GroupTotals;
  partners: PartnerRow[];
  coverage: { withChats: number; total: number };
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

const V2MonthContext = createContext<V2MonthData | null>(null);

export function useV2Month(): V2MonthData {
  const value = useContext(V2MonthContext);
  if (!value) throw new Error("useV2Month must be used inside V2MonthDataProvider");
  return value;
}

/** The selected month from ?month= (default: the current Bangkok month). */
export function useSelectedMonth(): string {
  const params = useSearchParams();
  return parseV2Month(params.get("month"));
}

export function V2MonthDataProvider({ children }: { children: React.ReactNode }) {
  const { language } = useAppLanguage();
  const month = useSelectedMonth();
  const [nonce, setNonce] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const refresh = useCallback(() => {
    setNow(Date.now());
    setNonce((value) => value + 1);
  }, []);
  // A month-to-date frame is measured at "now", frozen until the next refresh so keys stay stable.
  const frame = useMemo(() => monthWindow(month, now), [month, now]);

  const rawStores = useKeyedSource("stores", "all", nonce, loadStores);
  const partnerMapping = useKeyedSource("partners", "all", nonce, fetchStorePartners);
  const stores = useMemo<Source<StoreInfo[]>>(() => {
    if (!rawStores.data) return rawStores;
    const byUuid = new Map((partnerMapping.data ?? []).map((row) => [row.storeUuid, row.partner]));
    return { ...rawStores, data: rawStores.data.map((store) => ({ ...store, partner: byUuid.get(store.id) ?? null })) };
  }, [partnerMapping.data, rawStores]);
  // Closed months read their snapshot; open months read live data. If the close lookup fails, live data is used.
  const monthClose = useKeyedSource("month-close", JSON.stringify({ month }), nonce, loadMonthClose);
  const previousClose = useKeyedSource("month-close", frame.previousCollected && !frame.inProgress ? JSON.stringify({ month: frame.previous.month }) : null, nonce, loadMonthClose);
  const closeKnown = monthClose.data !== null || monthClose.error !== null;
  const currentClosed = Boolean(monthClose.data?.close);
  // The open month compares with the previous month's days 1–D (live, from/to); a closed month with the whole previous month.
  const previousCloseKnown = frame.inProgress || !frame.previousCollected || previousClose.data !== null || previousClose.error !== null;
  const previousClosed = !frame.inProgress && Boolean(previousClose.data?.close);
  const liveCurrent = useKeyedSource("summary", closeKnown && !currentClosed ? JSON.stringify({ month }) : null, nonce, loadSummary);
  const liveRates = useKeyedSource("rates", closeKnown && !currentClosed ? JSON.stringify({ dateFrom: frame.current.dateFrom, dateTo: frame.current.dateTo }) : null, nonce, loadRates);
  const livePrevious = useKeyedSource(
    "summary",
    !frame.previousCollected || !previousCloseKnown || previousClosed ? null : frame.inProgress ? JSON.stringify({ from: frame.previous.dateFrom, to: frame.previous.dateTo }) : JSON.stringify({ month: frame.previous.month }),
    nonce,
    loadSummary,
  );
  const livePreviousRates = useKeyedSource("rates", frame.previousCollected && previousCloseKnown && !previousClosed ? JSON.stringify({ dateFrom: frame.previous.dateFrom, dateTo: frame.previous.dateTo }) : null, nonce, loadRates);
  const current = useMemo<Source<MonthSummary>>(() => (currentClosed ? { data: snapshotSummary(monthClose.data!), error: null, loading: false } : closeKnown ? liveCurrent : PENDING), [closeKnown, currentClosed, liveCurrent, monthClose.data]);
  const rates = useMemo<Source<RateResponse>>(() => (currentClosed ? { data: snapshotRates(monthClose.data!), error: null, loading: false } : closeKnown ? liveRates : PENDING), [closeKnown, currentClosed, liveRates, monthClose.data]);
  const previousSummary = useMemo<Source<MonthSummary>>(() => (previousClosed ? { data: snapshotSummary(previousClose.data!), error: null, loading: false } : previousCloseKnown ? livePrevious : PENDING), [livePrevious, previousClose.data, previousCloseKnown, previousClosed]);
  const previousRates = useMemo<Source<RateResponse>>(() => (previousClosed ? { data: snapshotRates(previousClose.data!), error: null, loading: false } : previousCloseKnown ? livePreviousRates : PENDING), [livePreviousRates, previousClose.data, previousCloseKnown, previousClosed]);
  const google = useKeyedSource("google", JSON.stringify({ month }), nonce, loadGoogle);
  const tagCoverage = useKeyedSource("tag-coverage", JSON.stringify({ month }), nonce, loadTagCoverage);

  const value = useMemo<V2MonthData>(() => {
    const universe = stores.data ? v2Stores(stores.data, current.data) : { stores: [], placeholders: [] };
    const previous: PreviousSource = frame.previousCollected
      ? {
        data: previousSummary.data ? { network: networkCounts(previousSummary.data), byStore: storeCounts(previousSummary.data) } : null,
        error: previousSummary.error,
        loading: previousSummary.loading,
        collected: true,
      }
      : { data: null, error: null, loading: false, collected: false };
    const previousSource = { data: previous.data?.byStore ?? null, error: previous.error, loading: previous.loading, collected: previous.collected };
    const rows = buildMonthStoreRows({ stores: universe.stores, current, previous: previousSource, rates, previousRates: { ...previousRates, collected: frame.previousCollected } });
    const network = networkTotals({ current, previous: { data: previous.data?.network ?? null, error: previous.error, loading: previous.loading, collected: previous.collected }, rates, previousRates: { ...previousRates, collected: frame.previousCollected } });
    return {
      month,
      now,
      frame,
      periodText: comparisonLabel(frame, language),
      close: monthClose.data?.close ?? null,
      statusText: closeStatusLabel(monthClose.data?.close ?? null, monthClose.data?.dueAt ?? null, frame, language),
      stores,
      partnerMapping,
      current,
      previous,
      rates,
      previousRates,
      google,
      tagCoverage,
      tagCoverageByStore: tagCoverageByStore(tagCoverage.data),
      rows,
      placeholders: universe.placeholders,
      network,
      partners: partnerRows(rows, rates, { ...previousRates, collected: frame.previousCollected }),
      coverage: dataCoverage(rows),
      unattributed: stores.data && current.data ? unattributedChats(network.chats, rows) : null,
      hasGoogleResults: Boolean(google.data?.some((store) => store.kpiResult)),
      // Partner grouping waits for the mapping too, so rows never jump from "ไม่ระบุ" to a partner.
      coreLoading: (!stores.data && stores.loading) || (!current.data && current.loading) || (!partnerMapping.data && partnerMapping.loading),
      closeError: monthClose.error,
      nonce,
      refresh,
    };
  }, [language, current, google, month, nonce, now, partnerMapping, previousSummary, previousRates, rates, refresh, stores, frame, monthClose.data, monthClose.error, tagCoverage]);

  return <V2MonthContext.Provider value={value}>{children}</V2MonthContext.Provider>;
}

/** The last ≤ 6 months (never before the first v2 month), loaded only when enabled. */
export function useTrend(enabled: boolean): Source<TrendPoint[]> {
  const { month, now, nonce } = useV2Month();
  const points = trendMonths(month).map((entry) => {
    const period = monthWindow(entry, now).current;
    return { month: entry, dateFrom: period.dateFrom, dateTo: period.dateTo };
  });
  return useKeyedSource("trend", enabled ? JSON.stringify({ points }) : null, nonce, loadTrend);
}

/** One store's chats in the selected month (scorecard drawer). */
export function useStoreMonth(storeId: string | null, month: string): Source<StoreMonth> {
  const { nonce } = useV2Month();
  return useKeyedSource("store-month", storeId ? JSON.stringify({ storeId, month }) : null, nonce, loadStoreMonth);
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

/** One store's per-day 24-hour rate over the selected period (scorecard drawer). */
export function useStoreDailyRates(storeId: string | null): Source<DailyRate[]> {
  const { frame, nonce } = useV2Month();
  return useKeyedSource("store-daily-rates", storeId ? JSON.stringify({ storeId, dateFrom: frame.current.dateFrom, dateTo: frame.current.dateTo }) : null, nonce, loadStoreDailyRates);
}
