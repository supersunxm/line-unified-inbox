"use client";

import Link from "next/link";
import React from "react";
import { PageHeader } from "@/components/shell/page-header";
import { KpiStripSkeleton, SectionCard, SectionCardSkeleton, Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow, useDeferredLoading } from "@/components/ui";
import { RATE24_TARGET, REPLIED_RATE_TARGET } from "@/lib/v2/kpi";
import { monthLongLabel, periodLabel } from "@/lib/v2/month";
import { reportHref, storesHref } from "@/lib/v2/month-url";
import { topUnreplied } from "@/lib/v2/monthly-model";
import { TwoKpiCards, VolumeLine } from "./kpi-cards";
import { DataLine, OverviewTabs } from "./v2-month-controls";
import { useV2Month } from "./v2-month-data";
import { CountCell, DeltaValue, RateCell, SourceNotice, StateValue } from "./v2-ui";

function PartnerTable() {
  const data = useV2Month();
  return (
    <SectionCard title="Partner" meta={`${data.periodText} · เรียงตามช่องว่างถึงเป้าตอบใน 24 ชม. (ห่างสุดก่อน)`} bodyPadding="none">
      <div className="overflow-x-auto">
        <Table data-v2-partner-table>
          <TableHeader>
            <tr>
              <TableHead scope="col">Partner</TableHead>
              <TableHead scope="col" align="right">สาขา</TableHead>
              <TableHead scope="col" align="right">แชท</TableHead>
              <TableHead scope="col" align="right">ยังไม่ตอบ</TableHead>
              <TableHead scope="col" align="right">ตอบแล้ว %</TableHead>
              <TableHead scope="col" align="right">ตอบใน 24 ชม. %</TableHead>
              <TableHead scope="col"><span className="sr-only">รายงาน</span></TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {data.partners.length === 0 ? (
              <TableEmptyState colSpan={7} message="ยังไม่มีสาขา" />
            ) : data.partners.map((row) => (
              <TableRow key={row.partner} data-v2-partner={row.partner}>
                <TableCell className="font-medium">
                  <Link href={storesHref({ month: data.month, partner: row.partner })} className="text-[var(--app-text-primary)] hover:text-[var(--app-accent)] hover:underline">{row.partner}</Link>
                </TableCell>
                <TableCell align="right" numeric>{row.storeCount.toLocaleString("th-TH")}</TableCell>
                <TableCell align="right" numeric><StateValue state={row.chats} /></TableCell>
                <TableCell align="right" numeric><CountCell value={row.unreplied} delta={row.unrepliedDelta} /></TableCell>
                <TableCell align="right" numeric><RateCell value={row.replyRate} delta={row.replyRateDelta} target={REPLIED_RATE_TARGET} /></TableCell>
                <TableCell align="right" numeric><RateCell value={row.rate24} delta={row.rate24Delta} target={RATE24_TARGET} /></TableCell>
                <TableCell>
                  <Link href={reportHref({ month: data.month, partner: row.partner, store: null })} target="_blank" className="whitespace-nowrap text-xs font-medium text-[var(--app-accent)] hover:underline">รายงาน ↗<span className="sr-only"> {row.partner}</span></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {data.partners.length > 0 && (
            <tfoot className="border-t border-[var(--app-border)] text-xs">
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-semibold">ทุกสาขา</th>
                <td className="px-4 py-3 text-right tabular-nums">{data.rows.length.toLocaleString("th-TH")}</td>
                <td className="px-4 py-3 text-right"><StateValue state={data.network.chats} /></td>
                <td className="px-4 py-3 text-right"><CountCell value={data.network.unreplied} delta={data.network.unrepliedDelta} /></td>
                <td className="px-4 py-3 text-right"><RateCell value={data.network.replyRate} delta={data.network.replyRateDelta} target={REPLIED_RATE_TARGET} /></td>
                <td className="px-4 py-3 text-right"><RateCell value={data.network.rate24} delta={data.network.rate24Delta} target={RATE24_TARGET} /></td>
                <td className="px-4 py-3">
                  <Link href={reportHref({ month: data.month, partner: null, store: null })} target="_blank" className="whitespace-nowrap text-xs font-medium text-[var(--app-accent)] hover:underline">รายงาน ↗<span className="sr-only"> ทุกสาขา</span></Link>
                </td>
              </tr>
            </tfoot>
          )}
        </Table>
      </div>
    </SectionCard>
  );
}

function TopUnreplied() {
  const data = useV2Month();
  const top = topUnreplied(data.rows, 10);
  return (
    <SectionCard
      title="สาขาที่ยังไม่ตอบมากที่สุด"
      meta={`${periodLabel(data.frame.current)} · 10 อันดับ`}
      bodyPadding="none"
      footer={<Link href={storesHref({ month: data.month })} className="font-medium text-[var(--app-accent)]">ดูทุกสาขา →</Link>}
    >
      {top.length === 0 ? (
        <p className="p-4 text-sm text-[var(--app-text-secondary)]">{data.current.error ? `โหลดข้อมูลไม่สำเร็จ: ${data.current.error}` : "ไม่มีแชทที่ยังไม่ตอบในช่วงนี้"}</p>
      ) : (
        <ol data-v2-top-unreplied className="divide-y divide-[var(--app-border-subtle)]">
          {top.map((row, index) => (
            <li key={row.storeId}>
              <Link href={storesHref({ month: data.month, store: row.storeId })} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--app-surface-hover)]">
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-[var(--app-text-secondary)]">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--app-text-primary)]">{row.storeName}</span>
                  <span className="block truncate text-xs text-[var(--app-text-secondary)]">{row.partner}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold"><StateValue state={row.unreplied} /> <span className="text-xs font-normal text-[var(--app-text-secondary)]">แชท</span></span>
                  <span className="block text-xs text-[var(--app-text-secondary)]">ตอบใน 24 ชม. <StateValue state={row.rate24} format="percent" target={RATE24_TARGET ?? undefined} /> · <DeltaValue state={row.unrepliedDelta} kind="count" worseWhen="up" /></span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

export function MonthOverview() {
  const data = useV2Month();
  const showSkeleton = useDeferredLoading(data.coreLoading);
  const failures = [
    data.stores.error && !data.stores.data && `รายชื่อสาขา: ${data.stores.error}`,
    data.partnerMapping.error && !data.partnerMapping.data && `partner ของสาขา (ทุกสาขาแสดงเป็น "ไม่ระบุ partner"): ${data.partnerMapping.error}`,
    data.current.error && !data.current.data && `จำนวนแชท: ${data.current.error}`,
    data.previous.error && `ช่วงเทียบ: ${data.previous.error}`,
    data.rates.error && !data.rates.data && `ตอบใน 24 ชม.: ${data.rates.error}`,
    data.previousRates.error && !data.previousRates.data && `ตอบใน 24 ชม. ช่วงเทียบ: ${data.previousRates.error}`,
  ].filter(Boolean);

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <PageHeader
        title={`ภาพรวมเดือน ${monthLongLabel(data.month)}`}
        description={`${data.periodText} · ตัวเลขแชทตรงกับหน้าแชทร้านค้า · ตอบใน 24 ชม. ตรงกับหน้าอัตราตอบกลับ 24 ชม.`}
        actions={<OverviewTabs active="month" month={data.month} />}
      />
      <div className="space-y-4">
        <DataLine />
        {failures.length > 0 && <SourceNotice>โหลดไม่สำเร็จ — {failures.join(" · ")}</SourceNotice>}
        {data.coreLoading ? (
          showSkeleton ? (
            <div className="space-y-4">
              <KpiStripSkeleton columns={2} labels={["ตอบแล้ว %", "ตอบใน 24 ชม. %"]} />
              <SectionCardSkeleton title="Partner" lines={8} />
            </div>
          ) : null
        ) : (
          <>
            <TwoKpiCards totals={data.network} frame={data.frame} />
            <VolumeLine totals={data.network} frame={data.frame} />
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(300px,380px)] items-start gap-5">
              <PartnerTable />
              <TopUnreplied />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
