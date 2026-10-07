"use client";

import Link from "next/link";
import React from "react";
import { PageHeader } from "@/components/shell/page-header";
import { KpiStrip, KpiStripSkeleton, SectionCard, SectionCardSkeleton, Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow, useDeferredLoading } from "@/components/ui";
import { RESPONSE_RATE_TARGET_PERCENT } from "@/lib/v2/business-hours";
import { monthLongLabel, periodLabel } from "@/lib/v2/month";
import { storesHref } from "@/lib/v2/month-url";
import { topUnreplied, type GroupTotals } from "@/lib/v2/monthly-model";
import { formatValue, numericValue, type ValueState } from "@/lib/v2/value-state";
import { DataLine, OverviewTabs } from "./v2-month-controls";
import { useV2Month } from "./v2-month-data";
import { DeltaValue, SourceNotice, StateValue } from "./v2-ui";

function kpiValue(state: ValueState, format: "count" | "percent", target?: number) {
  const formatted = formatValue(state, format);
  if (formatted.text === "—") return null;
  return <StateValue state={state} format={format} target={target} />;
}

/** " · +3" when the change can be computed; nothing otherwise (the previous value already says why). */
function deltaPart(state: ValueState, kind: "count" | "points", worseWhen: "up" | "down") {
  return numericValue(state) === null ? null : <> · <DeltaValue state={state} kind={kind} worseWhen={worseWhen} /></>;
}

function previousText(state: ValueState, format: "count" | "percent") {
  const formatted = formatValue(state, format);
  return formatted.text === "—" ? `— (${formatted.reason})` : formatted.text;
}

function NetworkKpis({ totals }: { totals: GroupTotals }) {
  const data = useV2Month();
  const previousLabel = periodLabel(data.frame.previous);
  const reason = (state: ValueState) => formatValue(state, "count").reason;
  return (
    <KpiStrip
      data-v2-network-kpis
      columns={4}
      items={[
        {
          id: "chats",
          label: "แชททั้งหมด",
          period: periodLabel(data.frame.current),
          value: kpiValue(totals.chats, "count"),
          subtext: reason(totals.chats) ?? <>{previousLabel}: {previousText(totals.previousChats, "count")} · เหมือนหน้าแชทร้านค้า</>,
        },
        {
          id: "unreplied",
          label: "ยังไม่ตอบ",
          period: periodLabel(data.frame.current),
          value: kpiValue(totals.unreplied, "count"),
          subtext: reason(totals.unreplied) ?? <>{previousLabel}: {previousText(totals.previousUnreplied, "count")}{deltaPart(totals.unrepliedDelta, "count", "up")}</>,
        },
        {
          id: "replied",
          label: "ตอบแล้ว",
          period: periodLabel(data.frame.current),
          value: kpiValue(totals.replyRate, "percent"),
          subtext: formatValue(totals.replyRate, "percent").reason ?? <>{formatValue(totals.replied).text} แชท · {previousLabel}: {previousText(totals.previousReplyRate, "percent")}{deltaPart(totals.replyRateDelta, "points", "down")}</>,
        },
        {
          id: "rate24",
          label: "ตอบใน 24 ชม.",
          period: periodLabel(data.frame.current),
          value: kpiValue(totals.rate24, "percent", RESPONSE_RATE_TARGET_PERCENT),
          subtext: formatValue(totals.rate24, "percent").reason ?? <>เป้า {RESPONSE_RATE_TARGET_PERCENT}% · {previousLabel}: {previousText(totals.previousRate24, "percent")}{deltaPart(totals.rate24Delta, "points", "down")}</>,
        },
      ]}
    />
  );
}

function PartnerTable() {
  const data = useV2Month();
  return (
    <SectionCard title="Partner" meta={`${data.periodText} · เรียงตามยังไม่ตอบ`} bodyPadding="none">
      <div className="overflow-x-auto">
        <Table data-v2-partner-table>
          <TableHeader>
            <tr>
              <TableHead scope="col">Partner</TableHead>
              <TableHead scope="col" align="right">สาขา</TableHead>
              <TableHead scope="col" align="right">แชท</TableHead>
              <TableHead scope="col" align="right">ยังไม่ตอบ</TableHead>
              <TableHead scope="col" align="right">เทียบเดือนก่อน</TableHead>
              <TableHead scope="col" align="right">ตอบแล้ว %</TableHead>
              <TableHead scope="col" align="right">ตอบใน 24 ชม.</TableHead>
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
                <TableCell align="right" numeric className="font-semibold"><StateValue state={row.unreplied} /></TableCell>
                <TableCell align="right"><DeltaValue state={row.unrepliedDelta} kind="count" worseWhen="up" /></TableCell>
                <TableCell align="right" numeric><StateValue state={row.replyRate} format="percent" /></TableCell>
                <TableCell align="right" numeric><StateValue state={row.rate24} format="percent" target={RESPONSE_RATE_TARGET_PERCENT} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
          {data.partners.length > 0 && (
            <tfoot className="border-t border-[var(--app-border)] text-xs">
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-semibold">ทุกสาขา</th>
                <td className="px-4 py-3 text-right tabular-nums">{data.rows.length.toLocaleString("th-TH")}</td>
                <td className="px-4 py-3 text-right"><StateValue state={data.network.chats} /></td>
                <td className="px-4 py-3 text-right font-semibold"><StateValue state={data.network.unreplied} /></td>
                <td className="px-4 py-3 text-right"><DeltaValue state={data.network.unrepliedDelta} kind="count" worseWhen="up" /></td>
                <td className="px-4 py-3 text-right"><StateValue state={data.network.replyRate} format="percent" /></td>
                <td className="px-4 py-3 text-right"><StateValue state={data.network.rate24} format="percent" target={RESPONSE_RATE_TARGET_PERCENT} /></td>
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
                  <DeltaValue state={row.unrepliedDelta} kind="count" worseWhen="up" />
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
              <KpiStripSkeleton columns={4} labels={["แชททั้งหมด", "ยังไม่ตอบ", "ตอบแล้ว", "ตอบใน 24 ชม."]} />
              <SectionCardSkeleton title="Partner" lines={8} />
            </div>
          ) : null
        ) : (
          <>
            <NetworkKpis totals={data.network} />
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
