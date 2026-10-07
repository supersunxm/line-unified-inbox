"use client";

import Link from "next/link";
import React, { useEffect, useRef } from "react";
import { formatWaitingDuration } from "@/components/shell/store-priority-score";
import { RESPONSE_RATE_TARGET_PERCENT } from "@/lib/v2/business-hours";
import { monthShortLabel, periodLabel } from "@/lib/v2/month";
import { chatsHref } from "@/lib/v2/month-url";
import { dailyBreakdown, storeCounts, tagCoverage, type MonthStoreRow } from "@/lib/v2/monthly-model";
import { thaiLocationLabel } from "@/lib/v2/thai-geo";
import { countState, formatValue, numericValue, rateState, type ValueState } from "@/lib/v2/value-state";
import { useStoreMonth, useTrend, useV2Month } from "./v2-month-data";
import { DeltaValue, ManagerLink, StateValue } from "./v2-ui";

const cell = "px-3 py-2 text-xs whitespace-nowrap";

function Section({ title, meta, children }: { title: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">{title}</h3>
        {meta && <span className="text-xs text-[var(--app-text-secondary)]">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function KpiTable({ row }: { row: MonthStoreRow }) {
  const data = useV2Month();
  const lines: Array<{ label: string; current: ValueState; previous: ValueState; delta: ValueState; format: "count" | "percent"; deltaKind: "count" | "points"; worseWhen: "up" | "down"; target?: number }> = [
    { label: "แชท", current: row.chats, previous: row.previousChats, delta: { kind: "not-applicable", why: "ไม่มีเป้า" }, format: "count", deltaKind: "count", worseWhen: "up" },
    { label: "ยังไม่ตอบ", current: row.unreplied, previous: row.previousUnreplied, delta: row.unrepliedDelta, format: "count", deltaKind: "count", worseWhen: "up" },
    { label: "ตอบแล้ว %", current: row.replyRate, previous: row.previousReplyRate, delta: row.replyRateDelta, format: "percent", deltaKind: "points", worseWhen: "down" },
    { label: "ตอบใน 24 ชม.", current: row.rate24, previous: row.previousRate24, delta: row.rate24Delta, format: "percent", deltaKind: "points", worseWhen: "down", target: RESPONSE_RATE_TARGET_PERCENT },
  ];
  return (
    <table data-v2-drawer-kpis className="w-full text-left">
      <thead className="text-[11px] text-[var(--app-text-secondary)]">
        <tr className="border-b border-[var(--app-border)]">
          <th scope="col" className={`${cell} font-medium`}>ตัวชี้วัด</th>
          <th scope="col" className={`${cell} text-right font-medium`}>{periodLabel(data.frame.current)}</th>
          <th scope="col" className={`${cell} text-right font-medium`}>{periodLabel(data.frame.previous)}</th>
          <th scope="col" className={`${cell} text-right font-medium`}>เปลี่ยน</th>
          <th scope="col" className={`${cell} text-right font-medium`}>เป้า</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--app-border-subtle)]">
        {lines.map((line) => (
          <tr key={line.label}>
            <th scope="row" className={`${cell} font-medium`}>{line.label}</th>
            <td className={`${cell} text-right font-semibold`}><StateValue state={line.current} format={line.format} target={line.target} showN={line.format === "percent"} /></td>
            <td className={`${cell} text-right`}><StateValue state={line.previous} format={line.format} /></td>
            <td className={`${cell} text-right`}>{line.label === "แชท" ? <span className="text-[var(--app-text-secondary)]">—</span> : <DeltaValue state={line.delta} kind={line.deltaKind} worseWhen={line.worseWhen} />}</td>
            <td className={`${cell} text-right text-[var(--app-text-secondary)]`}>{line.target ? `${line.target}%` : line.label === "ยังไม่ตอบ" ? "0" : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Trend({ storeId }: { storeId: string }) {
  const trend = useTrend(true);
  if (!trend.data) return <p className="text-xs text-[var(--app-text-secondary)]">{trend.error ? `โหลดไม่สำเร็จ: ${trend.error}` : "กำลังโหลด…"}</p>;
  const points = trend.data.map((point) => {
    const counts = point.summary ? storeCounts(point.summary).get(storeId) ?? { total: 0, notReplied: 0, replied: 0 } : null;
    const rate = point.rates ? point.rates.stores.find((entry) => entry.storeId === storeId) ?? { total: 0, within24h: 0 } : null;
    const status = { error: point.error };
    return {
      month: point.month,
      chats: counts ? countState(counts.total) : countState(null, status),
      unreplied: counts ? countState(counts.notReplied) : countState(null, status),
      replyRate: counts ? rateState(counts.replied, counts.total) : countState(null, status),
      rate24: rate ? rateState(rate.within24h, rate.total) : countState(null, status),
    };
  });
  return (
    <>
      <table data-v2-drawer-trend className="w-full text-left">
        <thead className="text-[11px] text-[var(--app-text-secondary)]">
          <tr className="border-b border-[var(--app-border)]">
            <th scope="col" className={`${cell} font-medium`}>เดือน</th>
            <th scope="col" className={`${cell} text-right font-medium`}>แชท</th>
            <th scope="col" className={`${cell} text-right font-medium`}>ยังไม่ตอบ</th>
            <th scope="col" className={`${cell} text-right font-medium`}>ตอบแล้ว %</th>
            <th scope="col" className={`${cell} text-right font-medium`}>ตอบใน 24 ชม.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--app-border-subtle)]">
          {points.map((point) => (
            <tr key={point.month}>
              <th scope="row" className={`${cell} font-medium`}>{monthShortLabel(point.month)}</th>
              <td className={`${cell} text-right`}><StateValue state={point.chats} /></td>
              <td className={`${cell} text-right`}><StateValue state={point.unreplied} /></td>
              <td className={`${cell} text-right`}><StateValue state={point.replyRate} format="percent" /></td>
              <td className={`${cell} text-right`}><StateValue state={point.rate24} format="percent" target={RESPONSE_RATE_TARGET_PERCENT} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {points.length < 6 && <p className="text-xs text-[var(--app-text-secondary)]">มีข้อมูลสถานะการตอบตั้งแต่ ก.ย. 2026 จึงแสดง {points.length} เดือน (ยังไม่ครบ 6 เดือน)</p>}
    </>
  );
}

function DailyAndTags({ row }: { row: MonthStoreRow }) {
  const data = useV2Month();
  const storeMonth = useStoreMonth(row.storeId, data.month);
  if (!storeMonth.data) {
    const text = storeMonth.error ? `โหลดไม่สำเร็จ: ${storeMonth.error}` : "กำลังโหลด…";
    return (
      <>
        <Section title="รายวัน"><p className="text-xs text-[var(--app-text-secondary)]">{text}</p></Section>
        <Section title="ความครบของแท็กชื่อลูกค้า"><p className="text-xs text-[var(--app-text-secondary)]">{text}</p></Section>
      </>
    );
  }
  const { items, truncated } = storeMonth.data;
  const days = dailyBreakdown(items, data.frame.current);
  const max = Math.max(1, ...days.map((day) => day.chats));
  const coverage = tagCoverage(items);
  const listed = days.reduce((sum, day) => sum + day.chats, 0);
  const expected = numericValue(row.chats);
  return (
    <>
      <Section title="รายวัน" meta={`ตามวันของข้อความล่าสุด · ${periodLabel(data.frame.current)}`}>
        {truncated && <p className="text-xs text-[var(--app-text-secondary)]">แสดงเฉพาะ {items.length.toLocaleString("th-TH")} แชทล่าสุด จาก {storeMonth.data.total.toLocaleString("th-TH")} แชท</p>}
        {!truncated && expected !== null && listed !== expected && <p className="text-xs text-[var(--app-text-secondary)]">รายวันรวม {listed.toLocaleString("th-TH")} แชท ต่างจากยอดเดือน {expected.toLocaleString("th-TH")} เพราะโหลดคนละเวลา กดรีเฟรชเพื่อให้ตรงกัน</p>}
        <table data-v2-drawer-daily className="w-full text-left">
          <thead className="text-[11px] text-[var(--app-text-secondary)]">
            <tr className="border-b border-[var(--app-border)]">
              <th scope="col" className={`${cell} font-medium`}>วันที่</th>
              <th scope="col" className={`${cell} font-medium`}><span className="sr-only">กราฟ</span></th>
              <th scope="col" className={`${cell} text-right font-medium`}>แชท</th>
              <th scope="col" className={`${cell} text-right font-medium`}>ยังไม่ตอบ</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.day}>
                <th scope="row" className="px-3 py-1 text-xs font-normal tabular-nums text-[var(--app-text-secondary)]">{Number(day.day.slice(8))}</th>
                <td className="w-full px-3 py-1" aria-hidden="true">
                  <span className="flex h-2.5 overflow-hidden rounded-sm bg-[var(--app-surface-subtle)]">
                    <span className="bg-[var(--app-accent)]" style={{ width: `${((day.chats - day.unreplied) / max) * 100}%` }} />
                    <span className="bg-[var(--app-danger)]" style={{ width: `${(day.unreplied / max) * 100}%` }} />
                  </span>
                </td>
                <td className="px-3 py-1 text-right text-xs tabular-nums">{day.chats}</td>
                <td className={`px-3 py-1 text-right text-xs tabular-nums ${day.unreplied > 0 ? "font-semibold text-[var(--app-danger)]" : "text-[var(--app-text-secondary)]"}`}>{day.unreplied}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-[var(--app-text-secondary)]">แถบเขียว = ตอบแล้ว · แถบแดง = ยังไม่ตอบ</p>
      </Section>
      <Section title="ความครบของแท็กชื่อลูกค้า" meta={`${coverage.chats.toLocaleString("th-TH")} แชท`}>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] p-3">
            <dt className="text-[var(--app-text-secondary)]">มีแท็กอย่างน้อย 1 อย่าง</dt>
            <dd className="mt-1 text-lg font-semibold"><StateValue state={coverage.tagged} format="percent" showN /></dd>
            <dd className="text-[var(--app-text-secondary)]">{coverage.taggedCount.toLocaleString("th-TH")} แชท</dd>
          </div>
          <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] p-3">
            <dt className="text-[var(--app-text-secondary)]">มีเดือนที่ซื้อ (MM/YY)</dt>
            <dd className="mt-1 text-lg font-semibold"><StateValue state={coverage.withPeriod} format="percent" showN /></dd>
            <dd className="text-[var(--app-text-secondary)]">{coverage.withPeriodCount.toLocaleString("th-TH")} แชท</dd>
          </div>
        </dl>
        <p className="text-xs text-[var(--app-text-secondary)]">เป็นค่าต่ำสุด: แชทที่ระบบยังไม่ได้อ่านชื่อจาก LINE OA Manager นับเป็นไม่มีแท็ก</p>
      </Section>
      <ManagerLink href={storeMonth.data.managerUrl} />
    </>
  );
}

/** Store scorecard: the month's KPIs vs the comparison period and target, trend, daily, tags, links. */
export function StoreScorecardDrawer({ row, onClose }: { row: MonthStoreRow; onClose: () => void }) {
  const data = useV2Month();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, row.storeId]);
  const location = thaiLocationLabel(row.region, row.province);
  const waiting = row.oldestWaitingMinutes ? formatWaitingDuration(row.oldestWaitingMinutes) : null;
  const titleId = `v2-drawer-${row.storeId}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} data-v2-scorecard-drawer={row.storeId} className="flex h-full w-full max-w-xl flex-col border-l border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-primary)] shadow-[var(--app-shadow-modal)]">
        <header className="flex items-start gap-3 border-b border-[var(--app-border-subtle)] p-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold">{row.storeName}</h2>
            <p className="text-xs text-[var(--app-text-secondary)]">{[`Partner: ${row.partner}`, location].filter(Boolean).join(" · ")}</p>
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{data.periodText}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="ปิดรายละเอียดสาขา" className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-2.5 py-1 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40">ปิด</button>
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          <Section title="ตัวชี้วัดเดือนนี้">
            <KpiTable row={row} />
            <p className="text-xs text-[var(--app-text-secondary)]">
              {waiting ? <>แชทที่ยังไม่ตอบที่ค้างนานสุด: <span className="font-medium text-[var(--app-text-primary)]">{waiting}</span> (นับเวลาจริง เหมือนหน้าแชทร้านค้า)</> : formatValue(row.unreplied).text === "0" ? "ไม่มีแชทที่ยังไม่ตอบในเดือนนี้" : null}
            </p>
          </Section>
          <Section title="แนวโน้มรายเดือน" meta="สูงสุด 6 เดือน">
            <Trend storeId={row.storeId} />
          </Section>
          <DailyAndTags row={row} />
          <Section title="ไปต่อ">
            <div className="flex flex-wrap gap-2 text-xs">
              <Link href={chatsHref({ storeId: row.storeId, month: data.month })} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1.5 font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]">แชทเดือนนี้ในหน้าแชทร้านค้า →</Link>
              <Link href={chatsHref({ storeId: row.storeId, month: data.month, unrepliedOnly: true })} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1.5 font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]">เฉพาะยังไม่ตอบ →</Link>
              <Link href={`/store-360?storeId=${encodeURIComponent(row.storeId)}`} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1.5 font-medium text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]">Store 360 →</Link>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
