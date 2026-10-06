"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import {
  KpiStrip,
  KpiStripSkeleton,
  SearchInput,
  SectionCard,
  SectionCardSkeleton,
  Table,
  TableBody,
  TableCell,
  TableEmptyState,
  TableHead,
  TableHeader,
  TableRow,
  useDeferredLoading,
} from "@/components/ui";
import { RESPONSE_RATE_TARGET_PERCENT, RECENT_WAIT_WINDOW_DAYS } from "@/lib/v2/business-hours";
import { locationLabel } from "@/lib/v2/response-model";
import { responseHref } from "@/lib/v2/response-url";
import {
  buildStoreHealthRows,
  filterStoreHealthRows,
  sortStoreHealthRows,
  storeHealthKpis,
  type StoreHealthRow,
  type StoreHealthTab,
} from "@/lib/v2/stores-model";
import { thaiRegion } from "@/lib/v2/thai-geo";
import { useV2Data } from "./v2-data";
import { NO_DATA_TEXT, RateDelta, SourceNotice, formatRate } from "./v2-ui";

const TAB_LABELS: Record<StoreHealthTab, string> = {
  attention: "ต้องดู",
  all: "ทั้งหมด",
  "no-data": "ไม่มีข้อมูลแชท",
};

function IssuePill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "danger" | "warning" | "success" | "neutral" }) {
  const styles = {
    danger: "border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] text-[var(--app-danger)]",
    warning: "border-[var(--app-warning)]/30 bg-[var(--app-warning-soft)] text-[var(--app-text-primary)]",
    success: "border-[var(--app-success)]/30 bg-[var(--app-success-soft)] text-[var(--app-text-primary)]",
    neutral: "border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)]",
  }[tone];
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles}`}>{children}</span>;
}

function StoreIssues({ row }: { row: StoreHealthRow }) {
  const issues: React.ReactNode[] = [];
  if (!row.hasData) issues.push(<IssuePill key="no-data" tone="danger">ไม่มีข้อมูลแชท</IssuePill>);
  if (row.followTodayCount > 0) issues.push(<IssuePill key="follow" tone="danger">ตามวันนี้ {row.followTodayCount} แชท</IssuePill>);
  if (row.oldWaitingCount > 0) issues.push(<IssuePill key="backlog" tone="warning">ค้างเกิน {RECENT_WAIT_WINDOW_DAYS} วัน {row.oldWaitingCount}</IssuePill>);
  if (row.rate7d !== null && row.rate7d < RESPONSE_RATE_TARGET_PERCENT) {
    issues.push(<IssuePill key="rate" tone="warning">24 ชม. {formatRate(row.rate7d)}</IssuePill>);
  }
  if (row.reviewPassed === false && row.reviewQualified !== null && row.reviewTarget !== null) {
    issues.push(<IssuePill key="review" tone="warning">รีวิว {row.reviewQualified}/{row.reviewTarget}</IssuePill>);
  }
  if (issues.length === 0) return <IssuePill tone="success">ไม่มีประเด็นจากข้อมูลที่มี</IssuePill>;
  return <div className="flex flex-wrap gap-1.5">{issues}</div>;
}

function ReviewCell({ row, reviewError }: { row: StoreHealthRow; reviewError: string | null }) {
  if (!row.reviewLoaded) return <span className="text-[var(--app-text-secondary)]">{reviewError ? NO_DATA_TEXT : "กำลังโหลด…"}</span>;
  if (!row.reviewChecked) return <span className="text-[var(--app-text-secondary)]">ยังไม่ตรวจเดือนนี้</span>;
  return (
    <div className="whitespace-nowrap">
      <div className="font-semibold tabular-nums">{row.reviewQualified}/{row.reviewTarget}</div>
      <div className={`text-xs ${row.reviewPassed ? "text-[var(--app-success)]" : "text-[var(--app-danger)]"}`}>
        {row.reviewPassed ? "ถึงเป้าแล้ว" : "ยังไม่ถึงเป้า"}
      </div>
    </div>
  );
}

export function StoresView() {
  const data = useV2Data();
  const [tab, setTab] = useState<StoreHealthTab>("attention");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const pageLoading = data.coreLoading || (!data.google.data && !data.google.error && data.google.loading);
  const showSkeleton = useDeferredLoading(pageLoading);

  const healthRows = useMemo(
    () => buildStoreHealthRows(
      data.storeRows,
      data.google.data?.map((store) => ({ id: store.id, kpiResult: store.kpiResult })) ?? null,
    ),
    [data.google.data, data.storeRows],
  );
  const kpis = useMemo(() => storeHealthKpis(healthRows), [healthRows]);
  const rows = useMemo(
    () => sortStoreHealthRows(filterStoreHealthRows(healthRows, { tab, search, region: region || undefined })),
    [healthRows, region, search, tab],
  );
  const regions = useMemo(
    () => [...new Set(data.storeRows.map((row) => row.region).filter((value): value is string => Boolean(value)))]
      .sort((a, b) => (thaiRegion(a) ?? a).localeCompare(thaiRegion(b) ?? b, "th")),
    [data.storeRows],
  );

  if (pageLoading) {
    return (
      <div className="h-full overflow-y-auto px-6 py-5">
        <PageHeader title="สาขา" description="สุขภาพของแต่ละสาขาในมุมเดียว จากข้อมูลแชท อัตราตอบ และ Google Review ที่ระบบมีอยู่" />
        {showSkeleton ? (
          <div className="space-y-4">
            <KpiStripSkeleton columns={5} labels={["สาขาที่ต้องดู", "มีข้อมูลแชท", "ต้องตามวันนี้", "ต่ำกว่าเป้า 24 ชม.", "Google Review ต่ำกว่าเป้า"]} />
            <SectionCardSkeleton title="สุขภาพสาขา" lines={8} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <PageHeader
        title="สาขา"
        description="รวมสัญญาณสำคัญต่อสาขา เพื่อรู้ว่าร้านไหนต้องดู เพราะอะไร และไปจัดการต่อที่ไหน"
      />

      <div className="space-y-4">
        {(data.summary.error || data.mirror.error || data.rates7d.error || data.google.error) && (
          <SourceNotice>
            บางแหล่งโหลดไม่สำเร็จ: {[data.summary.error && "สถานะแชท", data.mirror.error && "Live Mirror", data.rates7d.error && "อัตราตอบ 24 ชม.", data.google.error && "Google Review"].filter(Boolean).join(", ")}
          </SourceNotice>
        )}

        <KpiStrip
          columns={5}
          items={[
            {
              id: "attention",
              label: "สาขาที่ต้องดู",
              value: kpis.attentionStores.toLocaleString("th-TH"),
              subtext: `จาก ${kpis.totalStores} ร้าน · มีอย่างน้อย 1 ประเด็นที่แสดงในตาราง`,
            },
            {
              id: "has-data",
              label: "มีข้อมูลแชท",
              value: data.storesWithData ? kpis.storesWithData.toLocaleString("th-TH") : null,
              subtext: data.storesWithData ? `จาก ${kpis.totalStores} ร้าน · ไม่มีข้อมูล ${kpis.totalStores - kpis.storesWithData} ร้าน` : NO_DATA_TEXT,
            },
            {
              id: "follow",
              label: "ต้องตามวันนี้",
              value: data.waiting.data ? kpis.followTodayStores.toLocaleString("th-TH") : null,
              subtext: data.waiting.data ? `จาก ${kpis.storesWithData} ร้านที่มีข้อมูล · เกณฑ์เดียวกับหน้า การตอบแชท` : NO_DATA_TEXT,
            },
            {
              id: "rate",
              label: "ต่ำกว่าเป้า 24 ชม.",
              value: data.rates7d.data ? kpis.belowRateTargetStores.toLocaleString("th-TH") : null,
              subtext: data.rates7d.data ? `จาก ${kpis.rateMeasuredStores} ร้านที่มีค่า · เป้า ${RESPONSE_RATE_TARGET_PERCENT}% · 7 วัน` : NO_DATA_TEXT,
            },
            {
              id: "review",
              label: "Google Review ต่ำกว่าเป้า",
              value: data.google.data ? kpis.belowReviewTargetStores.toLocaleString("th-TH") : null,
              subtext: data.google.data ? `จาก ${kpis.reviewMeasuredStores} ร้านที่ตรวจแล้วเดือนนี้` : NO_DATA_TEXT,
            },
          ]}
        />

        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="ตัวกรองสุขภาพสาขา" className="inline-flex gap-1 rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-1">
            {(Object.keys(TAB_LABELS) as StoreHealthTab[]).map((value) => {
              const count = filterStoreHealthRows(healthRows, { tab: value }).length;
              const active = tab === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(value)}
                  className={`rounded-[var(--app-radius-sm)] px-3 py-1.5 text-sm font-medium ${active ? "bg-[var(--app-surface)] text-[var(--app-text-primary)] shadow-[var(--app-shadow-card)]" : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"}`}
                >
                  {TAB_LABELS[value]} <span className="tabular-nums text-[var(--app-text-tertiary)]">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <div className="w-72">
              <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} placeholder="ค้นหาชื่อร้าน / ภาค / จังหวัด" />
            </div>
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              aria-label="กรองตามภาค"
              className="h-9 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-xs text-[var(--app-text-primary)]"
            >
              <option value="">ทุกภาค</option>
              {regions.map((value) => <option key={value} value={value}>{thaiRegion(value) ?? value}</option>)}
            </select>
          </div>
        </div>

        <SectionCard title="สุขภาพสาขา" meta={`${rows.length} จาก ${healthRows.length} ร้าน`} bodyPadding="none">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>สาขา</TableHead>
                  <TableHead>ประเด็นที่ต้องดู</TableHead>
                  <TableHead align="right">รอตอบ</TableHead>
                  <TableHead>ตอบใน 24 ชม.</TableHead>
                  <TableHead>Google Review</TableHead>
                  <TableHead>ไปต่อ</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableEmptyState colSpan={6} message="ไม่พบสาขาตามตัวกรองนี้" />
                ) : rows.map((row) => (
                  <TableRow key={row.storeId} data-v2-store-health={row.storeId}>
                    <TableCell className="max-w-[15rem]">
                      <div className="truncate font-medium text-[var(--app-text-primary)]" title={row.storeName}>{row.storeName}</div>
                      {locationLabel(row) && <div className="truncate text-xs text-[var(--app-text-secondary)]" title={locationLabel(row) ?? undefined}>{locationLabel(row)}</div>}
                    </TableCell>
                    <TableCell className="min-w-[18rem]"><StoreIssues row={row} /></TableCell>
                    <TableCell align="right" numeric>
                      {row.hasData ? row.waitingCount.toLocaleString("th-TH") : "—"}
                      {row.hasData && row.oldWaitingCount > 0 && <div className="whitespace-nowrap text-xs font-normal text-[var(--app-text-secondary)]">ค้างเกิน {RECENT_WAIT_WINDOW_DAYS} วัน {row.oldWaitingCount}</div>}
                    </TableCell>
                    <TableCell>
                      {row.hasData ? (
                        <span className="inline-flex flex-col whitespace-nowrap">
                          <span className={`font-semibold tabular-nums ${row.rate7d !== null && row.rate7d < RESPONSE_RATE_TARGET_PERCENT ? "text-[var(--app-danger)]" : ""}`}>{formatRate(row.rate7d)}</span>
                          <RateDelta delta={row.rateDelta} />
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell><ReviewCell row={row} reviewError={data.google.error} /></TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1.5 whitespace-nowrap text-xs">
                        <Link href={responseHref({ tab: "all", store: row.storeId })} className="font-medium text-[var(--app-accent)] hover:underline">การตอบแชท →</Link>
                        <Link href={`/store-360?storeId=${encodeURIComponent(row.storeId)}`} className="text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:underline">Store 360 →</Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
