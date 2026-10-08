"use client";

// Data for v2's monthly views: lib/metrics/use-monthly-metrics.tsx (shared with Home, Dashboard and
// Store 360), plus the Store → partner mapping that only v2 (the report) groups by.
// Definitions are in lib/metrics and docs/metrics-registry.md.

import { useSearchParams } from "next/navigation";
import React, { createContext, useContext, useMemo } from "react";
import { parseV2Month } from "@/lib/v2/month";
import { partnerRows, withPartners, type MonthStoreRow, type PartnerRow } from "@/lib/v2/monthly-model";
import type { StorePartnerRow } from "@/lib/v2/partners";
import {
  useKeyedSource,
  useMonthlyMetrics,
  useMonthlyTrend,
  useStoreDailyRateSource,
  useStoreMonthChats,
  type DailyRate,
  type MonthlyMetrics,
  type Source,
  type StoreMonth,
  type TrendPoint,
} from "@/lib/metrics/use-monthly-metrics";

export { fetchMonthClose, fetchRates, MONTH_CONCURRENCY, MONTH_PAGE_SIZE, SHARED_RESPONSE_TTL_MS, STORE_MONTH_MAX_PAGES } from "@/lib/metrics/use-monthly-metrics";
export type { DailyRate, PreviousSource, Source, StoreMonth, TrendPoint } from "@/lib/metrics/use-monthly-metrics";

/** Store → partner from the mapping keyed by Store ID (GET /v2/store-partners). */
export async function fetchStorePartners(): Promise<StorePartnerRow[]> {
  const response = await fetch("/api-backend/v2/store-partners", { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`โหลด partner ของสาขาไม่สำเร็จ (${response.status})`);
  return ((await response.json()) as { stores: StorePartnerRow[] }).stores;
}

export type V2MonthData = MonthlyMetrics & {
  /** The Store → partner mapping; when it fails every store reads "ไม่ระบุ partner" and the page says so. */
  partnerMapping: Source<StorePartnerRow[]>;
  /** Store rows with partner and partner rank. */
  rows: MonthStoreRow[];
  partners: PartnerRow[];
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
  const month = useSelectedMonth();
  const metrics = useMonthlyMetrics(month, { google: true, tagCoverage: true });
  const partnerMapping = useKeyedSource("partners", "all", metrics.nonce, fetchStorePartners);
  const value = useMemo<V2MonthData>(() => {
    const byUuid = new Map((partnerMapping.data ?? []).map((row) => [row.storeUuid, row.partner]));
    const rows = withPartners(metrics.storeRows, byUuid);
    return {
      ...metrics,
      partnerMapping,
      rows,
      partners: partnerRows(rows, metrics.rates, { ...metrics.previousRates, collected: metrics.frame.previousCollected }),
      // Partner grouping waits for the mapping too, so rows never jump from "ไม่ระบุ" to a partner.
      coreLoading: metrics.coreLoading || (!partnerMapping.data && partnerMapping.loading),
    };
  }, [metrics, partnerMapping]);
  return <V2MonthContext.Provider value={value}>{children}</V2MonthContext.Provider>;
}

/** The last ≤ 6 months (never before the first v2 month), loaded only when enabled. */
export function useTrend(enabled: boolean): Source<TrendPoint[]> {
  const { month, now, nonce } = useV2Month();
  return useMonthlyTrend(month, now, nonce, enabled);
}

/** One store's chats in the selected month (scorecard drawer). */
export function useStoreMonth(storeId: string | null, month: string): Source<StoreMonth> {
  const { nonce } = useV2Month();
  return useStoreMonthChats(storeId, month, nonce);
}

/** One store's per-day 24-hour rate over the selected period (scorecard drawer). */
export function useStoreDailyRates(storeId: string | null): Source<DailyRate[]> {
  const { frame, nonce } = useV2Month();
  return useStoreDailyRateSource(storeId, frame, nonce);
}
