"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { SearchInput, SectionCard, SectionCardSkeleton, Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow, useDeferredLoading } from "@/components/ui";
import { RESPONSE_RATE_TARGET_PERCENT } from "@/lib/v2/business-hours";
import { monthLongLabel } from "@/lib/v2/month";
import { parseStoresUrl, storesHref, type StoresUrlState } from "@/lib/v2/month-url";
import { filterMonthRows, MIN_RATE_SAMPLE, sortMonthRows, type MonthSort, type MonthStoreRow } from "@/lib/v2/monthly-model";
import { sortPartnerNames, UNMATCHED_PARTNER } from "@/lib/v2/partners";
import { thaiLocationLabel, thaiRegion } from "@/lib/v2/thai-geo";
import { StoreScorecardDrawer } from "./store-scorecard-drawer";
import { DataLine } from "./v2-month-controls";
import { useV2Month } from "./v2-month-data";
import { DeltaValue, SourceNotice, StateValue } from "./v2-ui";

const SORT_LABELS: Array<[MonthSort, string]> = [
  ["unreplied", "ยังไม่ตอบ (มากสุดก่อน)"],
  ["reply", "ตอบแล้ว % (ต่ำสุดก่อน)"],
  ["rate24", "ตอบใน 24 ชม. (ต่ำสุดก่อน)"],
  ["delta", "เทียบเดือนก่อน (เพิ่มมากสุดก่อน)"],
];

const selectClass = "h-9 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-xs text-[var(--app-text-primary)]";

/** "2/13", or "—" with the reason it is not ranked. */
export function PartnerRank({ row }: { row: MonthStoreRow }) {
  if (row.partnerRank !== null) return <span className="tabular-nums">{row.partnerRank}<span className="text-[var(--app-text-secondary)]">/{row.partnerRankedCount}</span></span>;
  const reason = row.partner === UNMATCHED_PARTNER ? "ไม่ระบุ partner" : `แชทน้อยกว่า ${MIN_RATE_SAMPLE} แชท ไม่จัดอันดับ`;
  return <span title={reason} className="text-[var(--app-text-secondary)]">—<span className="sr-only"> ({reason})</span></span>;
}

function ReviewCell({ result }: { result: { qualifiedReviews: number; targetQualifiedReviews: number; isPassed: boolean } | null }) {
  if (!result) return <span title="ยังไม่ตรวจเดือนนี้" className="text-[var(--app-text-secondary)]">—<span className="sr-only"> (ยังไม่ตรวจเดือนนี้)</span></span>;
  return (
    <span className="whitespace-nowrap">
      <span className="font-semibold tabular-nums">{result.qualifiedReviews}/{result.targetQualifiedReviews}</span>{" "}
      <span className={`text-xs ${result.isPassed ? "text-[var(--app-text-secondary)]" : "text-[var(--app-danger)]"}`}>{result.isPassed ? "ถึงเป้า" : "ต่ำกว่าเป้า"}</span>
    </span>
  );
}

export function StoreScorecardView() {
  const data = useV2Month();
  const router = useRouter();
  const params = useSearchParams();
  const state = useMemo(() => ({ ...parseStoresUrl(params, data.now), month: data.month }), [data.month, data.now, params]);
  const [search, setSearch] = useState("");
  const showSkeleton = useDeferredLoading(data.coreLoading);

  const navigate = useCallback((patch: Partial<StoresUrlState>) => {
    router.replace(storesHref({ ...state, ...patch }), { scroll: false });
  }, [router, state]);

  const rows = useMemo(
    () => sortMonthRows(filterMonthRows(data.rows, { partner: state.partner, region: state.region, search }), state.sort),
    [data.rows, search, state.partner, state.region, state.sort],
  );
  const partners = useMemo(() => sortPartnerNames(data.rows.map((row) => row.partner)), [data.rows]);
  const regions = useMemo(
    () => [...new Set(data.rows.map((row) => row.region).filter((value): value is string => Boolean(value)))].sort((a, b) => (thaiRegion(a) ?? a).localeCompare(thaiRegion(b) ?? b, "th")),
    [data.rows],
  );
  const reviews = useMemo(() => new Map((data.google.data ?? []).map((store) => [store.id, store.kpiResult])), [data.google.data]);
  const openRow = state.store ? data.rows.find((row) => row.storeId === state.store) ?? null : null;
  const columns = 7 + (data.hasGoogleResults ? 1 : 0);

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <PageHeader title={`สาขา · ${monthLongLabel(data.month)}`} description={`คะแนนรายเดือนของแต่ละสาขา · ${data.periodText} · คลิกชื่อสาขาเพื่อดูรายละเอียด`} />
      <div className="space-y-4">
        <DataLine />
        {(data.current.error || data.rates.error || data.previous.error) && (
          <SourceNotice>
            โหลดไม่สำเร็จ — {[data.current.error && `จำนวนแชท: ${data.current.error}`, data.rates.error && `ตอบใน 24 ชม.: ${data.rates.error}`, data.previous.error && `ช่วงเทียบ: ${data.previous.error}`].filter(Boolean).join(" · ")}
          </SourceNotice>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
            Partner
            <select data-v2-partner-filter value={state.partner ?? ""} onChange={(event) => navigate({ partner: event.target.value || null, store: null })} className={selectClass}>
              <option value="">ทุก partner</option>
              {partners.map((partner) => <option key={partner} value={partner}>{partner}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
            ภาค
            <select data-v2-region-filter value={state.region ?? ""} onChange={(event) => navigate({ region: event.target.value || null, store: null })} className={selectClass}>
              <option value="">ทุกภาค</option>
              {regions.map((region) => <option key={region} value={region}>{thaiRegion(region) ?? region}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
            เรียงตาม
            <select data-v2-sort value={state.sort} onChange={(event) => navigate({ sort: event.target.value as MonthSort })} className={selectClass}>
              {SORT_LABELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="ml-auto w-72">
            <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} placeholder="ค้นหาชื่อสาขา" />
          </div>
        </div>

        {data.coreLoading ? (
          showSkeleton ? <SectionCardSkeleton title="คะแนนสาขา" lines={10} /> : null
        ) : (
          <SectionCard
            title="คะแนนสาขา"
            meta={`${rows.length} จาก ${data.rows.length} สาขา · ${data.periodText}`}
            bodyPadding="none"
            footer={<span className="text-xs text-[var(--app-text-secondary)]">อัตราที่มาจากแชทน้อยกว่า {MIN_RATE_SAMPLE} แชทแสดงเป็นสีจาง ไม่เทียบเป้า และอยู่ท้ายเมื่อเรียงตามอัตรา · ความครบของแท็กชื่อลูกค้าดูได้ในรายละเอียดสาขา{data.hasGoogleResults ? "" : " · ยังไม่มีผล Google Review ของเดือนนี้ จึงไม่แสดงคอลัมน์"}</span>}
          >
            <div className="overflow-x-auto">
              <Table data-v2-scorecard-table>
                <caption className="sr-only">คะแนนสาขา {data.periodText}</caption>
                <TableHeader>
                  <tr>
                    <TableHead scope="col">สาขา</TableHead>
                    <TableHead scope="col" align="right">แชท</TableHead>
                    <TableHead scope="col" align="right">ยังไม่ตอบ</TableHead>
                    <TableHead scope="col" align="right">ตอบแล้ว %</TableHead>
                    <TableHead scope="col" align="right">ตอบใน 24 ชม. (n)</TableHead>
                    <TableHead scope="col" align="right">เทียบเดือนก่อน</TableHead>
                    <TableHead scope="col" align="right">อันดับใน partner</TableHead>
                    {data.hasGoogleResults && <TableHead scope="col">Google Review</TableHead>}
                  </tr>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableEmptyState colSpan={columns} message="ไม่พบสาขาตามตัวกรองนี้" />
                  ) : rows.map((row) => {
                    const location = thaiLocationLabel(row.region, row.province);
                    return (
                      <TableRow key={row.storeId} data-v2-scorecard-row={row.storeId} isSelected={row.storeId === state.store}>
                        <th scope="row" className="max-w-[18rem] px-4 py-3 text-left text-xs font-normal">
                          <button
                            type="button"
                            onClick={() => navigate({ store: row.storeId })}
                            className="block max-w-full truncate text-left text-sm font-medium text-[var(--app-text-primary)] hover:text-[var(--app-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40"
                            title={row.storeName}
                          >
                            {row.storeName}
                          </button>
                          <span className="block truncate text-[var(--app-text-secondary)]">{[row.partner, location].filter(Boolean).join(" · ")}</span>
                        </th>
                        <TableCell align="right" numeric><StateValue state={row.chats} /></TableCell>
                        <TableCell align="right" numeric className="font-semibold"><StateValue state={row.unreplied} /></TableCell>
                        <TableCell align="right" numeric><StateValue state={row.replyRate} format="percent" /></TableCell>
                        <TableCell align="right" numeric><StateValue state={row.rate24} format="percent" target={RESPONSE_RATE_TARGET_PERCENT} showN /></TableCell>
                        <TableCell align="right"><DeltaValue state={row.unrepliedDelta} kind="count" worseWhen="up" /></TableCell>
                        <TableCell align="right"><PartnerRank row={row} /></TableCell>
                        {data.hasGoogleResults && <TableCell><ReviewCell result={reviews.get(row.storeId) ?? null} /></TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        )}
      </div>
      {openRow && <StoreScorecardDrawer row={openRow} onClose={() => navigate({ store: null })} />}
    </div>
  );
}
