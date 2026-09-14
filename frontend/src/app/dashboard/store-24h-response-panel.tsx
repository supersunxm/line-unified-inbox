"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UnifiedPeriodPicker } from "@/components/date-range/unified-period-picker";
import { rangeForPreset, type DashboardDateRange } from "./dashboard-date-range";

type Store24hRow = {
  storeId: string;
  storeName: string;
  total: number;
  responded: number;
  within24h: number;
  over24h: number;
  pending: number;
  responseRate24h: number | null;
};

type Store24hResponse = {
  dateFrom: string;
  dateTo: string;
  overview: {
    storeCount: number;
    total: number;
    responded: number;
    within24h: number;
    over24h: number;
    pending: number;
    responseRate24h: number | null;
  };
  stores: Store24hRow[];
};

type Props = {
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
};

type SortKey = "storeName" | "within24h" | "over24h" | "pending" | "total" | "responseRate24h";
type SortDirection = "asc" | "desc";

const defaultDirection: Record<SortKey, SortDirection> = {
  storeName: "asc",
  within24h: "desc",
  over24h: "desc",
  pending: "desc",
  total: "desc",
  responseRate24h: "desc",
};

function rateLabel(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function toneClass(value: number | null) {
  if (value === null) return "text-[var(--dash-text-tertiary)]";
  if (value >= 90) return "text-[var(--dash-green)]";
  if (value >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-[var(--dash-red)]";
}

export function Store24hResponsePanel({ getStoreDisplayName, onOpenStore }: Props) {
  const [range, setRange] = useState<DashboardDateRange>(() => rangeForPreset("7d"));
  const [data, setData] = useState<Store24hResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ dateFrom: range.dateFrom, dateTo: range.dateTo });
      const response = await fetch(`/api-backend/dashboard/store-24h-response-summary?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`โหลดอัตราตอบกลับไม่สำเร็จ (${response.status})`);
      setData((await response.json()) as Store24hResponse);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [range.dateFrom, range.dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDirection(defaultDirection[key]);
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDirection === "desc" ? "↓" : "↑";
  };

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("th");
    const filtered = query
      ? (data?.stores ?? []).filter((store) =>
          getStoreDisplayName(store.storeName).toLocaleLowerCase("th").includes(query),
        )
      : data?.stores ?? [];

    if (!sortKey) return filtered;

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => {
      let comparison = 0;

      if (sortKey === "storeName") {
        comparison = getStoreDisplayName(left.storeName).localeCompare(
          getStoreDisplayName(right.storeName),
          "th",
          { sensitivity: "base", numeric: true },
        );
      } else if (sortKey === "responseRate24h") {
        if (left.responseRate24h === null && right.responseRate24h === null) comparison = 0;
        else if (left.responseRate24h === null) return 1;
        else if (right.responseRate24h === null) return -1;
        else comparison = left.responseRate24h - right.responseRate24h;
      } else {
        comparison = left[sortKey] - right[sortKey];
      }

      if (comparison !== 0) return comparison * direction;
      return getStoreDisplayName(left.storeName).localeCompare(
        getStoreDisplayName(right.storeName),
        "th",
        { sensitivity: "base", numeric: true },
      );
    });
  }, [data, getStoreDisplayName, search, sortDirection, sortKey]);

  const overview = data?.overview;

  return (
    <section className="mb-6 rounded-[18px] border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--dash-text-tertiary)]">24H RESPONSE SLA</div>
          <h2 className="mt-1 text-[17px] font-bold text-[var(--dash-text)]">อัตราตอบกลับภายใน 24 ชั่วโมง แยกตามร้าน</h2>
          <p className="mt-1 text-xs text-[var(--dash-text-secondary)]">
            ดูจำนวนและสัดส่วนบทสนทนาที่ร้านตอบลูกค้าภายใน 24 ชั่วโมง ในช่วงเวลาที่เลือก
          </p>
        </div>
        {overview && (
          <div className="rounded-xl bg-[var(--dash-accent-soft)] px-4 py-2.5 text-right">
            <div className="text-[10.5px] font-semibold text-[var(--dash-text-secondary)]">ภาพรวมทุกสาขา</div>
            <div className={`mt-0.5 text-2xl font-bold tabular-nums ${toneClass(overview.responseRate24h)}`}>
              {rateLabel(overview.responseRate24h)}
            </div>
            <div className="text-[10.5px] text-[var(--dash-text-tertiary)]">
              {overview.within24h.toLocaleString()} / {overview.total.toLocaleString()} บทสนทนา
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[10.5px] font-semibold text-[var(--dash-text-secondary)]">ช่วงข้อมูล</div>
          <UnifiedPeriodPicker
            dateFrom={range.dateFrom}
            dateTo={range.dateTo}
            language="th"
            onApply={(dateFrom, dateTo) => setRange({ dateFrom, dateTo })}
          />
        </div>

        <label className="min-w-[200px] text-[10.5px] font-semibold text-[var(--dash-text-secondary)]">
          <span className="mb-1 block">ค้นหาร้าน</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ชื่อร้าน..."
            className="h-9 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 text-xs text-[var(--dash-text)] outline-none placeholder:text-[var(--dash-text-tertiary)] focus:border-[var(--dash-accent)]"
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--dash-red)]/30 bg-[var(--dash-red-soft)] px-3.5 py-3 text-xs text-[var(--dash-red)]">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-bold underline">ลองใหม่</button>
        </div>
      )}

      {loading && !data ? (
        <div className="mt-4 h-56 animate-pulse rounded-xl bg-[var(--dash-bg)]" />
      ) : data ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-[var(--dash-bg)] px-3 py-2.5">
              <div className="text-[10.5px] text-[var(--dash-text-tertiary)]">ตอบภายใน 24 ชม.</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-[var(--dash-green)]">{data.overview.within24h.toLocaleString()}</div>
            </div>
            <div className="rounded-xl bg-[var(--dash-bg)] px-3 py-2.5">
              <div className="text-[10.5px] text-[var(--dash-text-tertiary)]">ตอบเกิน 24 ชม.</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-[var(--dash-red)]">{data.overview.over24h.toLocaleString()}</div>
            </div>
            <div className="rounded-xl bg-[var(--dash-bg)] px-3 py-2.5">
              <div className="text-[10.5px] text-[var(--dash-text-tertiary)]">ยังไม่มีคำตอบ</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">{data.overview.pending.toLocaleString()}</div>
            </div>
            <div className="rounded-xl bg-[var(--dash-bg)] px-3 py-2.5">
              <div className="text-[10.5px] text-[var(--dash-text-tertiary)]">ร้านทั้งหมด</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">{data.overview.storeCount.toLocaleString()}</div>
            </div>
          </div>

          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-[var(--dash-border)] md:block">
            <table className="w-full min-w-[760px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-[var(--dash-border)] bg-[var(--dash-bg)] text-[10px] uppercase text-[var(--dash-text-tertiary)]">
                  <th className="px-3.5 py-2.5 text-left">
                    <button type="button" onClick={() => handleSort("storeName")} className="inline-flex w-full items-center gap-1.5 text-left font-semibold hover:text-[var(--dash-text)]" aria-label="เรียงตามชื่อร้าน">
                      <span>ร้านค้า</span><span aria-hidden="true">{sortIndicator("storeName")}</span>
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button type="button" onClick={() => handleSort("within24h")} className="inline-flex w-full items-center justify-end gap-1.5 font-semibold hover:text-[var(--dash-text)]" aria-label="เรียงตามจำนวนตอบภายใน 24 ชั่วโมง">
                      <span>ภายใน 24 ชม.</span><span aria-hidden="true">{sortIndicator("within24h")}</span>
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button type="button" onClick={() => handleSort("over24h")} className="inline-flex w-full items-center justify-end gap-1.5 font-semibold hover:text-[var(--dash-text)]" aria-label="เรียงตามจำนวนตอบเกิน 24 ชั่วโมง">
                      <span>เกิน 24 ชม.</span><span aria-hidden="true">{sortIndicator("over24h")}</span>
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button type="button" onClick={() => handleSort("pending")} className="inline-flex w-full items-center justify-end gap-1.5 font-semibold hover:text-[var(--dash-text)]" aria-label="เรียงตามจำนวนที่ยังไม่ตอบ">
                      <span>ยังไม่ตอบ</span><span aria-hidden="true">{sortIndicator("pending")}</span>
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button type="button" onClick={() => handleSort("total")} className="inline-flex w-full items-center justify-end gap-1.5 font-semibold hover:text-[var(--dash-text)]" aria-label="เรียงตามจำนวนทั้งหมด">
                      <span>ทั้งหมด</span><span aria-hidden="true">{sortIndicator("total")}</span>
                    </button>
                  </th>
                  <th className="px-3.5 py-2.5 text-right">
                    <button type="button" onClick={() => handleSort("responseRate24h")} className="inline-flex w-full items-center justify-end gap-1.5 font-semibold hover:text-[var(--dash-text)]" aria-label="เรียงตามอัตราตอบกลับภายใน 24 ชั่วโมง">
                      <span>อัตรา 24 ชม.</span><span aria-hidden="true">{sortIndicator("responseRate24h")}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((store) => (
                  <tr key={store.storeId} className="border-b border-[var(--dash-border)] last:border-b-0 hover:bg-[var(--dash-accent-soft)]">
                    <td className="px-3.5 py-3">
                      <button type="button" onClick={() => onOpenStore(store.storeId)} className="max-w-[300px] truncate text-left font-semibold text-[var(--dash-text)] hover:text-[var(--dash-accent)]">
                        {getStoreDisplayName(store.storeName)}
                      </button>
                    </td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums text-[var(--dash-green)]">{store.within24h.toLocaleString()}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-[var(--dash-red)]">{store.over24h.toLocaleString()}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{store.pending.toLocaleString()}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{store.total.toLocaleString()}</td>
                    <td className={`px-3.5 py-3 text-right text-sm font-bold tabular-nums ${toneClass(store.responseRate24h)}`}>{rateLabel(store.responseRate24h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 md:hidden">
            {rows.map((store) => (
              <button
                key={store.storeId}
                type="button"
                onClick={() => onOpenStore(store.storeId)}
                className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-[var(--dash-text)]">{getStoreDisplayName(store.storeName)}</div>
                    <div className="mt-1 text-[10.5px] text-[var(--dash-text-tertiary)]">ภายใน 24 ชม. {store.within24h.toLocaleString()} / {store.total.toLocaleString()} บทสนทนา</div>
                  </div>
                  <div className={`shrink-0 text-xl font-bold tabular-nums ${toneClass(store.responseRate24h)}`}>{rateLabel(store.responseRate24h)}</div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10.5px]">
                  <div className="rounded-lg bg-[var(--dash-bg)] px-2 py-1.5"><span className="text-[var(--dash-text-tertiary)]">≤24ชม.</span><div className="font-bold text-[var(--dash-green)]">{store.within24h}</div></div>
                  <div className="rounded-lg bg-[var(--dash-bg)] px-2 py-1.5"><span className="text-[var(--dash-text-tertiary)]">&gt;24ชม.</span><div className="font-bold text-[var(--dash-red)]">{store.over24h}</div></div>
                  <div className="rounded-lg bg-[var(--dash-bg)] px-2 py-1.5"><span className="text-[var(--dash-text-tertiary)]">ยังไม่ตอบ</span><div className="font-bold">{store.pending}</div></div>
                </div>
              </button>
            ))}
          </div>

          {rows.length === 0 && (
            <div className="py-8 text-center text-xs text-[var(--dash-text-tertiary)]">ไม่พบร้านตามคำค้นหา</div>
          )}
          <div className="mt-3 text-[10.5px] text-[var(--dash-text-tertiary)]">
            สูตร: จำนวนบทสนทนาที่มีคำตอบแรกภายใน 24 ชั่วโมง ÷ บทสนทนาทั้งหมดที่เริ่มในช่วงวันที่เลือก · ร้านที่ไม่มีข้อความจะแสดง “—”
          </div>
        </>
      ) : null}
    </section>
  );
}
