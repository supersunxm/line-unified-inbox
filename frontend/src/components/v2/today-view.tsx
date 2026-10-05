"use client";

import Link from "next/link";
import React from "react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState, SectionCard, SectionCardSkeleton, useDeferredLoading } from "@/components/ui";
import { buildTodayItems, weekComparison, type TodayItem } from "@/lib/v2/today-model";
import { displayedWait, longestWaitPerStore } from "@/lib/v2/response-model";
import { responseHref } from "@/lib/v2/response-url";
import { useV2Data } from "./v2-data";
import { SourceNotice, WaitLabel } from "./v2-ui";

function TodayRow({ item, index }: { item: TodayItem; index: number }) {
  return (
    <li data-v2-today-item={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-xs font-semibold tabular-nums text-[var(--app-text-secondary)]">{index + 1}</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--app-border)] px-2 py-0.5 text-xs font-medium text-[var(--app-text-secondary)]">{item.domain}</span>
          <span className="text-[15px] font-semibold">{item.problem}</span>
        </div>
        <p className="text-xs text-[var(--app-text-secondary)]">{item.comparison}</p>
        {item.stores.length > 0 && (
          <p className="text-sm text-[var(--app-text-primary)]">
            {item.stores.map((store, storeIndex) => (
              <span key={store.name}>
                {storeIndex > 0 && <span className="text-[var(--app-text-tertiary)]"> · </span>}
                <span className="font-medium">{store.name}</span> <span className="text-[var(--app-text-secondary)]">{store.detail}</span>
              </span>
            ))}
            {item.moreStores > 0 && <span className="text-[var(--app-text-secondary)]"> และอีก {item.moreStores} ร้าน</span>}
          </p>
        )}
      </div>
      <Link href={item.action.href} className="shrink-0 rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1.5 text-sm font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]">
        {item.action.label} →
      </Link>
    </li>
  );
}

function LongestWaits() {
  const data = useV2Data();
  const top = longestWaitPerStore(data.storeRows, 5);
  return (
    <SectionCard title="ร้านที่รอนานที่สุด 5 อันดับ" meta="ตั้งแต่เมื่อวาน 10:00 · ร้านละ 1 แถว" bodyPadding="none" footer={<Link href="/v2/response" className="font-medium text-[var(--app-accent)]">ดูทั้งหมด →</Link>}>
      {!data.waiting.data ? (
        <p className="p-4 text-sm text-[var(--app-text-secondary)]">{data.waiting.error ? "ยังไม่มีข้อมูลนี้" : "กำลังโหลด…"}</p>
      ) : top.length === 0 ? (
        <p className="p-4 text-sm text-[var(--app-text-secondary)]">ไม่มีลูกค้ารอคำตอบ</p>
      ) : (
        <ol className="divide-y divide-[var(--app-border-subtle)]">
          {top.map((row) => (
            <li key={row.storeId} data-v2-longest-wait-store={row.storeId}>
              <Link href={responseHref({ view: "chat", store: row.storeId, conversation: row.windowLongestChatId })} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-[var(--app-surface-hover)]">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{row.storeName}</span>
                  <span className="block truncate text-xs text-[var(--app-text-secondary)]">รอตอบตั้งแต่เมื่อวาน {row.sinceYesterdayCount} แชท</span>
                </span>
                <span className="shrink-0 text-right text-sm"><WaitLabel businessMinutes={displayedWait(row, "window").minutes} waitingSince={displayedWait(row, "window").waitingSince} now={data.now} /></span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function WeekComparison() {
  const data = useV2Data();
  const rows = weekComparison(data.totals7d, data.totalsPrev7d);
  return (
    <SectionCard title="สัปดาห์นี้ เทียบสัปดาห์ก่อน" meta="ร้านที่มีข้อมูล">
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--app-text-secondary)]">{data.rates7d.error ? "ยังไม่มีข้อมูลนี้" : "กำลังโหลด…"}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-[var(--app-text-secondary)]">
              <th className="pb-2 text-left font-medium">ตัวชี้วัด</th>
              <th className="pb-2 text-right font-medium">7 วันนี้</th>
              <th className="pb-2 text-right font-medium">7 วันก่อน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--app-border-subtle)]">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="py-2.5">{row.label}</td>
                <td className={`py-2.5 text-right font-semibold tabular-nums ${row.better === false ? "text-[var(--app-danger)]" : ""}`}>{row.current}</td>
                <td className="py-2.5 text-right tabular-nums text-[var(--app-text-secondary)]">{row.previous}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}

export function TodayView() {
  const data = useV2Data();
  const loading = data.coreLoading;
  const showSkeleton = useDeferredLoading(loading);
  const items = buildTodayItems({
    storeRows: data.storeRows,
    waitingLoaded: Boolean(data.waiting.data),
    hasDataLoaded: data.storesWithData !== null,
    totals7d: data.totals7d,
    totalsPrev7d: data.totalsPrev7d,
    googleStores: data.google.data ? data.google.data.map((store) => ({ name: store.name, kpiResult: store.kpiResult })) : null,
  });
  const skipped = [
    data.waiting.error && "ลูกค้าที่รอคำตอบ",
    (data.rates7d.error || data.ratesPrev7d.error) && "อัตราตอบใน 24 ชม.",
    data.google.error && "รีวิว Google",
    data.mirror.error && data.hasDataSource === null && "ร้านที่ไม่มีข้อมูลแชท",
  ].filter(Boolean);

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <PageHeader title="วันนี้" description="เฉพาะเรื่องที่ผิดปกติ เรียงตามความสำคัญ แต่ละเรื่องบอกว่าเทียบกับอะไร ร้านไหนเป็นต้นเหตุ และไปจัดการที่ไหน" />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(300px,380px)] items-start gap-5">
        <div className="space-y-3">
          {skipped.length > 0 && <SourceNotice>ยังไม่ได้ตรวจ: {skipped.join(", ")} (โหลดข้อมูลไม่สำเร็จ)</SourceNotice>}
          {loading ? (
            showSkeleton ? <SectionCardSkeleton title="เรื่องที่ต้องดูวันนี้" lines={6} /> : null
          ) : (
            <SectionCard title="เรื่องที่ต้องดูวันนี้" meta={items.length > 0 ? `${items.length} เรื่อง` : undefined} bodyPadding="none">
              {items.length === 0 ? (
                <EmptyState title="วันนี้ไม่มีเรื่องผิดปกติ" description="ไม่มีร้านที่ลูกค้ารอเกินเกณฑ์ อัตราตอบไม่ต่ำกว่าเป้า และทุกร้านมีข้อมูลแชท" />
              ) : (
                <ol className="divide-y divide-[var(--app-border-subtle)]">
                  {items.map((item, index) => <TodayRow key={item.id} item={item} index={index} />)}
                </ol>
              )}
            </SectionCard>
          )}
        </div>
        <div className="space-y-5">
          <LongestWaits />
          <WeekComparison />
        </div>
      </div>
    </div>
  );
}
