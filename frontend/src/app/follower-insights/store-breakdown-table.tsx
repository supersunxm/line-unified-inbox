"use client";

import { useMemo, useRef, useState } from "react";
import type { ByStoreAccountRow } from "@/types/api";
import { exportStoreCsv } from "./follower-insights-utils";
import { getFollowerInsightsText, type Language } from "./follower-insights-translations";
import { StoreAnalyticsOverview } from "./store-analytics-overview";

interface StoreBreakdownTableProps {
  storeData: ByStoreAccountRow[];
  storeError: string | null;
  dateFrom: string;
  dateTo: string;
  endpointsUsable: boolean;
  language?: Language;
  onRetry: () => void;
}

type FilterKey = "all" | "zero-growth" | "high-block" | "low-reach" | "high-growth";
type SortKey =
  | "id"
  | "store"
  | "oa"
  | "startFollowers"
  | "followers"
  | "growth"
  | "growthPct"
  | "reach"
  | "reachPct"
  | "blocks"
  | "blockPct";
type PillTone = "high" | "mid" | "low" | "zero";

type DisplayRow = {
  source: ByStoreAccountRow;
  id: string;
  store: string;
  oa: string;
  startFollowers: number | null;
  followers: number | null;
  growth: number | null;
  growthPct: number | null;
  reach: number | null;
  reachPct: number | null;
  blocks: number | null;
  blockPct: number | null;
};

const PAGE_SIZE = 10;

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function calculatePct(numerator: number | null, denominator: number | null, decimals = 1) {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return round((numerator / denominator) * 100, decimals);
}

function formatSelectedDate(value: string, language: Language) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function getPillTone(pct: number, type: "growth" | "reach" | "block"): PillTone {
  if (type === "growth") {
    if (pct === 0) return "zero";
    if (pct >= 5) return "high";
    if (pct >= 1) return "mid";
    return "low";
  }
  if (type === "reach") {
    if (pct >= 85) return "high";
    if (pct >= 75) return "mid";
    return "low";
  }
  if (pct <= 5) return "high";
  if (pct <= 10) return "mid";
  return "low";
}

function pillClass(tone: PillTone) {
  if (tone === "high") return "bg-[var(--app-success-soft)] text-[var(--app-success)]";
  if (tone === "mid") return "bg-[var(--app-warning-soft)] text-[var(--app-warning)]";
  if (tone === "low") return "bg-[var(--app-danger-soft)] text-[var(--app-danger)]";
  return "bg-[var(--app-neutral-soft)] text-[var(--app-text-secondary)]";
}

function buildPages(current: number, total: number): Array<number | "ellipsis-left" | "ellipsis-right"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages: Array<number | "ellipsis-left" | "ellipsis-right"> = [1];
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);

  if (start > 2) pages.push("ellipsis-left");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push("ellipsis-right");
  pages.push(total);
  return pages;
}

export function StoreBreakdownTable({
  storeData,
  storeError,
  dateFrom,
  dateTo,
  endpointsUsable,
  language = "en",
  onRetry,
}: StoreBreakdownTableProps) {
  return (
    <div className="space-y-4">
      {!storeError && storeData.length > 0 && (
        <StoreAnalyticsOverview
          storeData={storeData}
          endpointsUsable={endpointsUsable}
          language={language}
        />
      )}
      <StoreBreakdownTableInner
        key={`${dateFrom}_${dateTo}_${language}`}
        storeData={storeData}
        storeError={storeError}
        dateFrom={dateFrom}
        dateTo={dateTo}
        endpointsUsable={endpointsUsable}
        language={language}
        onRetry={onRetry}
      />
    </div>
  );
}

function StoreBreakdownTableInner({
  storeData,
  storeError,
  dateFrom,
  dateTo,
  endpointsUsable,
  language = "en",
  onRetry,
}: StoreBreakdownTableProps) {
  const t = getFollowerInsightsText(language);
  const tableTopRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortField, setSortField] = useState<SortKey>("growth");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);

  const startDateLabel = formatSelectedDate(dateFrom, language);
  const endDateLabel = formatSelectedDate(dateTo, language);

  const labels = language === "th"
    ? {
        title: "ข้อมูลรายสาขา",
        subtitle: "วิเคราะห์การเติบโต การเข้าถึง และอัตราบล็อกของ LINE OA แต่ละสาขา",
        search: "ค้นหาชื่อสาขา, LINE OA หรือรหัสสาขา...",
        all: "ทุกสาขา",
        zero: "ไม่มีการเติบโต (0)",
        highBlock: "อัตราบล็อกสูง (>10%)",
        lowReach: "การเข้าถึงต่ำ (<80%)",
        highGrowth: "การเติบโตสูง (>5%)",
        count: (shown: number, total: number) => `แสดง ${shown} / ${total} สาขา`,
        code: "รหัส",
        store: "ร้านค้า",
        startFollowers: `วันเริ่มต้น · ${startDateLabel}`,
        endFollowers: `วันสิ้นสุด · ${endDateLabel}`,
        growth: "เพิ่มขึ้น",
        growthPct: "% เติบโต",
        reach: "เข้าถึงได้",
        reachPct: "% เข้าถึง",
        blocks: "บล็อก",
        blockPct: "% บล็อก",
        noResults: "ไม่พบสาขาที่ตรงกับการค้นหาหรือตัวกรอง",
        showing: (start: number, end: number, total: number) => `แสดงรายที่ ${start} – ${end} จากทั้งหมด ${total} ร้าน`,
      }
    : {
        title: "Store performance",
        subtitle: "Growth, reach and block-rate performance for each LINE OA account",
        search: "Search store, LINE OA or store code...",
        all: "All stores",
        zero: "No growth (0)",
        highBlock: "High block rate (>10%)",
        lowReach: "Low reach (<80%)",
        highGrowth: "High growth (>5%)",
        count: (shown: number, total: number) => `Showing ${shown} / ${total} stores`,
        code: "Code",
        store: "Store",
        startFollowers: `Start · ${startDateLabel}`,
        endFollowers: `End · ${endDateLabel}`,
        growth: "Growth",
        growthPct: "Growth %",
        reach: "Reach",
        reachPct: "Reach %",
        blocks: "Blocks",
        blockPct: "Block %",
        noResults: "No stores match the current search or filter",
        showing: (start: number, end: number, total: number) => `Showing ${start} – ${end} of ${total} stores`,
      };

  const rows = useMemo<DisplayRow[]>(() => {
    return storeData.map((row) => {
      const growth = endpointsUsable ? row.periodIncrease : null;
      const startFollowers = endpointsUsable ? row.startFollowers : null;
      return {
        source: row,
        id: row.masterStoreId || row.externalStoreId || row.storeId || row.lineOaId,
        store: row.storeName,
        oa: row.accountName,
        startFollowers,
        followers: row.followers,
        growth,
        growthPct:
          endpointsUsable && growth !== null && startFollowers !== null && startFollowers > 0
            ? round((growth / startFollowers) * 100, 2)
            : endpointsUsable && growth === 0
              ? 0
              : null,
        reach: row.targetedReaches,
        reachPct: calculatePct(row.targetedReaches, row.followers),
        blocks: row.blocks,
        blockPct: calculatePct(row.blocks, row.followers),
      };
    });
  }, [storeData, endpointsUsable]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !q ||
        row.store.toLowerCase().includes(q) ||
        row.oa.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q) ||
        row.source.lineOaId.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (filter === "zero-growth") return row.growth === 0;
      if (filter === "high-block") return row.blockPct !== null && row.blockPct > 10;
      if (filter === "low-reach") return row.reachPct !== null && row.reachPct < 80;
      if (filter === "high-growth") return row.growthPct !== null && row.growthPct > 5;
      return true;
    });
  }, [rows, searchQuery, filter]);

  const sortedRows = useMemo(() => {
    const getValue = (row: DisplayRow): string | number | null => {
      if (sortField === "id") return row.id;
      if (sortField === "store") return row.store;
      if (sortField === "oa") return row.oa;
      return row[sortField];
    };

    return [...filteredRows].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      const direction = sortDir === "asc" ? 1 : -1;
      if (typeof aValue === "string" && typeof bValue === "string") {
        return direction * aValue.localeCompare(bValue, language === "th" ? "th" : "en");
      }
      return direction * (Number(aValue) - Number(bValue));
    });
  }, [filteredRows, sortField, sortDir, language]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedRows = sortedRows.slice(startIndex, startIndex + PAGE_SIZE);
  const startRecord = sortedRows.length === 0 ? 0 : startIndex + 1;
  const endRecord = Math.min(startIndex + PAGE_SIZE, sortedRows.length);
  const pages = buildPages(safePage, totalPages);

  const resetPage = () => setCurrentPage(1);

  const handleSort = (field: SortKey) => {
    setSortField((current) => {
      if (current === field) {
        setSortDir((direction) => (direction === "desc" ? "asc" : "desc"));
        return current;
      }
      setSortDir(field === "id" || field === "store" || field === "oa" ? "asc" : "desc");
      return field;
    });
    resetPage();
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.requestAnimationFrame(() => {
      tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const sortButton = (field: SortKey, label: string, align: "left" | "right" = "left") => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className={`flex w-full items-center gap-1 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.045em] text-[var(--muted)] hover:text-[#00A651] ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
    >
      {label}
      {sortField === field && <span aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );

  const pctPill = (value: number | null, type: "growth" | "reach" | "block", decimals: number) => {
    if (value === null) return <span className="text-[var(--muted)]">—</span>;
    return (
      <span className={`inline-flex min-w-[58px] justify-center rounded-full px-2 py-1 text-xs font-semibold ${pillClass(getPillTone(value, type))}`}>
        {value.toFixed(decimals)}%
      </span>
    );
  };

  return (
    <div ref={tableTopRef} className="scroll-mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="border-b border-[var(--border)] px-5 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--foreground)]">{labels.title}</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">{labels.subtitle}</p>
          </div>

          {!storeError && storeData.length > 0 && (
            <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto xl:min-w-[650px]">
              <div className="relative min-w-0 flex-1">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    resetPage();
                  }}
                  placeholder={labels.search}
                  className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] pl-10 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as FilterKey);
                  resetPage();
                }}
                className="h-10 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{labels.all}</option>
                <option value="zero-growth">{labels.zero}</option>
                <option value="high-block">{labels.highBlock}</option>
                <option value="low-reach">{labels.lowReach}</option>
                <option value="high-growth">{labels.highGrowth}</option>
              </select>

              <span className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[10px] bg-[var(--surface-elevated)] px-3 text-xs font-medium text-[var(--muted)]">
                {labels.count(filteredRows.length, rows.length)}
              </span>

              <button
                type="button"
                onClick={() => exportStoreCsv(filteredRows.map((row) => row.source), dateFrom, dateTo, language)}
                disabled={filteredRows.length === 0}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--foreground)] hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-40"
                title={t.exportCsv}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v5m0 0-2-2m2 2 2-2" />
                </svg>
                {t.exportCsv}
              </button>
            </div>
          )}
        </div>
      </div>

      {storeError ? (
        <div className="flex flex-col items-center justify-center gap-3 p-10 text-center text-sm text-[var(--app-danger)]">
          <p>{t.errorLoadingStore}: {storeError}</p>
          <button type="button" onClick={onRetry} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] hover:border-emerald-500">
            {t.retryStore}
          </button>
        </div>
      ) : storeData.length === 0 ? (
        <div className="p-10 text-center text-sm text-[var(--muted)]">{t.noStoreBreakdownData}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1310px] text-left text-[13px]">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-elevated)]">
                <tr>
                  <th className="p-0">{sortButton("id", labels.code)}</th>
                  <th className="p-0">{sortButton("store", labels.store)}</th>
                  <th className="p-0">{sortButton("oa", "LINE OA")}</th>
                  <th className="p-0 text-right">{sortButton("startFollowers", labels.startFollowers, "right")}</th>
                  <th className="p-0 text-right">{sortButton("followers", labels.endFollowers, "right")}</th>
                  <th className="p-0 text-right">{sortButton("growth", labels.growth, "right")}</th>
                  <th className="p-0 text-right">{sortButton("growthPct", labels.growthPct, "right")}</th>
                  <th className="p-0 text-right">{sortButton("reach", labels.reach, "right")}</th>
                  <th className="p-0 text-right">{sortButton("reachPct", labels.reachPct, "right")}</th>
                  <th className="p-0 text-right">{sortButton("blocks", labels.blocks, "right")}</th>
                  <th className="p-0 text-right">{sortButton("blockPct", labels.blockPct, "right")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                {paginatedRows.map((row) => (
                  <tr key={row.source.lineOaId} className="transition-colors hover:bg-[var(--hover)]">
                    <td className="px-3 py-3 font-mono text-[11px] text-[var(--muted)]">{row.id}</td>
                    <td className="max-w-[300px] whitespace-normal px-3 py-3 font-medium leading-5">{row.store}</td>
                    <td className="max-w-[220px] whitespace-normal px-3 py-3 text-xs text-[var(--muted)]">{row.oa}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-[var(--muted)]">{row.startFollowers?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{row.followers?.toLocaleString() ?? "—"}</td>
                    <td className={`px-3 py-3 text-right font-semibold tabular-nums ${row.growth !== null && row.growth > 0 ? "text-emerald-600 dark:text-emerald-400" : row.growth !== null && row.growth < 0 ? "text-rose-600 dark:text-rose-400" : "text-[var(--foreground)]"}`}>
                      {row.growth === null ? "—" : `${row.growth > 0 ? "+" : ""}${row.growth.toLocaleString()}`}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{pctPill(row.growthPct, "growth", 2)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.reach?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{pctPill(row.reachPct, "reach", 1)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.blocks?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{pctPill(row.blockPct, "block", 1)}</td>
                  </tr>
                ))}
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-sm text-[var(--muted)]">{labels.noResults}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-[var(--muted)]">{labels.showing(startRecord, endRecord, sortedRows.length)}</span>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--foreground)] hover:border-emerald-500 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t.previous}
              </button>

              {pages.map((page) =>
                typeof page === "number" ? (
                  <button
                    key={page}
                    type="button"
                    onClick={() => goToPage(page)}
                    className={`h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                      safePage === page
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-emerald-500 hover:text-emerald-600"
                    }`}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={page} className="px-1 text-xs text-[var(--muted)]">…</span>
                )
              )}

              <button
                type="button"
                onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
                className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--foreground)] hover:border-emerald-500 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t.next}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
