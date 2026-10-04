"use client";

import React, { useEffect, useMemo, useState } from "react";
import { KpiStrip, SectionCard, Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow } from "@/components/ui";
import { api } from "@/lib/api";
import { FOLLOW_UP_THRESHOLD_MINUTES, RESPONSE_RATE_TARGET_PERCENT, formatWaitMinutes } from "@/lib/v2/business-hours";
import { rateDelta, responseKpis, storeManagerUrlOf, type StoreRow } from "@/lib/v2/response-model";
import type { ResponseUrlState } from "@/lib/v2/response-url";
import { useV2Data } from "./v2-data";
import { DailyRateBars, ManagerLink, MiniTrend, NO_DATA_TEXT, RateDelta, WaitLabel, formatRate } from "./v2-ui";

export function ResponseKpis() {
  const data = useV2Data();
  const kpis = responseKpis(data.storeRows);
  const rate = data.totals7d?.rate ?? null;
  const previous = data.totalsPrev7d?.rate ?? null;
  const delta = rateDelta(rate, previous);
  return (
    <KpiStrip
      columns={4}
      items={[
        {
          id: "follow-up",
          label: "ร้านที่ต้องตาม",
          value: data.waiting.data ? kpis.followUpStores.toLocaleString("th-TH") : null,
          subtext: data.waiting.data ? `จาก ${kpis.storesWithData} ร้านที่มีข้อมูล · ลูกค้ารอ ≥ ${FOLLOW_UP_THRESHOLD_MINUTES} นาที (เวลาเปิดร้าน)` : NO_DATA_TEXT,
        },
        {
          id: "waiting",
          label: "แชทที่รอคำตอบ",
          value: kpis.waitingChats.toLocaleString("th-TH"),
          subtext: `ใน ${kpis.waitingStores} ร้าน จาก ${kpis.storesWithData} ร้านที่มีข้อมูล`,
        },
        {
          id: "rate",
          label: "ตอบใน 24 ชม. · 7 วัน",
          value: formatRate(rate) === "—" ? null : formatRate(rate),
          subtext: rate === null
            ? NO_DATA_TEXT
            : `เป้า ${RESPONSE_RATE_TARGET_PERCENT}% · 7 วันก่อนหน้า ${formatRate(previous)}${delta === null ? "" : ` (${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} จุด)`}`,
        },
        {
          id: "no-data",
          label: "ร้านที่ไม่มีข้อมูล",
          value: data.storesWithData ? kpis.noDataStores.toLocaleString("th-TH") : null,
          subtext: data.storesWithData ? `จาก ${kpis.totalStores} ร้าน · ระบบไม่ได้เก็บแชท ไม่นับในตัวเลขอื่น` : NO_DATA_TEXT,
        },
      ]}
    />
  );
}

function StoreTable({ rows, selectedStoreId, onSelect, tab }: { rows: StoreRow[]; selectedStoreId: string | null; onSelect: (storeId: string) => void; tab: ResponseUrlState["tab"] }) {
  const data = useV2Data();
  const trendLoading = data.daily.loading && !data.daily.data;
  const emptyMessage = tab === "follow-up"
    ? `ไม่มีร้านที่ลูกค้ารอเกิน ${FOLLOW_UP_THRESHOLD_MINUTES} นาทีในเวลาเปิดร้าน`
    : tab === "no-data" ? "ทุกร้านมีข้อมูลแชท" : "ไม่มีร้านที่มีข้อมูล";
  return (
    <SectionCard title="ร้านเรียงตามเวลารอนานสุด" meta={`${rows.length} ร้าน`} bodyPadding="none">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <tr>
              <TableHead>ร้าน</TableHead>
              <TableHead align="right">รอตอบ</TableHead>
              <TableHead>รอนานสุด</TableHead>
              <TableHead>ตอบใน 24 ชม. (7 วัน)</TableHead>
              <TableHead>แนวโน้ม 7 วัน</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableEmptyState colSpan={5} message={emptyMessage} /> : rows.map((row) => (
              <TableRow
                key={row.storeId}
                data-v2-store-row={row.storeId}
                aria-selected={row.storeId === selectedStoreId}
                onClick={() => onSelect(row.storeId)}
                className={`cursor-pointer ${row.storeId === selectedStoreId ? "bg-[var(--app-accent-soft)]" : ""}`}
              >
                <TableCell>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(row.storeId); }} className="text-left font-medium text-[var(--app-text-primary)] hover:underline">
                    {row.storeName}
                  </button>
                  <div className="text-xs text-[var(--app-text-secondary)]">{row.hasData ? row.region ?? "ไม่ระบุภาค" : "ระบบไม่ได้เก็บแชทของร้านนี้"}</div>
                </TableCell>
                <TableCell align="right" numeric>{row.hasData ? row.waitingCount.toLocaleString("th-TH") : "—"}</TableCell>
                <TableCell>{row.hasData ? <WaitLabel businessMinutes={row.longestBusinessMinutes} waitingSince={row.longestWaitingSince} now={data.now} /> : "—"}</TableCell>
                <TableCell>
                  {row.hasData ? (
                    <span className="inline-flex flex-col">
                      <span className={`font-semibold tabular-nums ${row.rate7d !== null && row.rate7d < RESPONSE_RATE_TARGET_PERCENT ? "text-[var(--app-danger)]" : ""}`}>{formatRate(row.rate7d)}</span>
                      <RateDelta delta={row.rateDelta} />
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>{row.hasData ? <MiniTrend values={row.trend} loading={trendLoading} /> : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

/** Manager URL for a store: from a loaded waiting chat, else from one conversation of the store. */
function useStoreManagerUrl(row: StoreRow | null): string | null {
  const [fetched, setFetched] = useState<{ storeId: string; url: string | null } | null>(null);
  const storeId = row?.storeId ?? null;
  const known = row?.managerUrl ?? null;
  useEffect(() => {
    if (!storeId || known) return undefined;
    let cancelled = false;
    void api.conversations({ storeId, pageSize: 1 })
      .then((response) => { if (!cancelled) setFetched({ storeId, url: response.items[0] ? storeManagerUrlOf(response.items[0].store) : null }); })
      .catch(() => { if (!cancelled) setFetched({ storeId, url: null }); });
    return () => { cancelled = true; };
  }, [storeId, known]);
  return known ?? (fetched && fetched.storeId === storeId ? fetched.url : null);
}

function StoreDetail({ row, onOpenConversation }: { row: StoreRow | null; onOpenConversation: (storeId: string, conversationId: string) => void }) {
  const data = useV2Data();
  const managerUrl = useStoreManagerUrl(row);
  const chats = useMemo(() => (row ? data.waitingChats.filter((chat) => chat.storeId === row.storeId) : []), [data.waitingChats, row]);
  if (!row) {
    return (
      <SectionCard title="รายละเอียดร้าน">
        <p className="text-sm text-[var(--app-text-secondary)]">เลือกร้านจากตารางเพื่อดูแชทที่รอและแนวโน้ม 7 วัน</p>
      </SectionCard>
    );
  }
  return (
    <SectionCard title={row.storeName} meta={row.region ?? undefined}>
      <div className="space-y-5">
        {managerUrl && <ManagerLink href={managerUrl} />}
        {!row.hasData && <p className="text-sm text-[var(--app-text-secondary)]">ระบบไม่ได้เก็บแชทของร้านนี้ จึงไม่นับในตัวเลขใด ๆ ดูสถานะที่ LINE Chat Health</p>}
        <dl className="grid grid-cols-3 gap-3">
          <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-3">
            <dt className="text-xs text-[var(--app-text-secondary)]">รอตอบ</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{row.hasData ? row.waitingCount : "—"}</dd>
          </div>
          <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-3">
            <dt className="text-xs text-[var(--app-text-secondary)]">รอนานสุด</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{row.hasData && row.longestBusinessMinutes !== null ? formatWaitMinutes(row.longestBusinessMinutes) : "—"}</dd>
          </div>
          <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-3">
            <dt className="text-xs text-[var(--app-text-secondary)]">ตอบใน 24 ชม.</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{row.hasData ? formatRate(row.rate7d) : "—"}</dd>
            {row.hasData && <dd><RateDelta delta={row.rateDelta} /></dd>}
          </div>
        </dl>
        {row.hasData && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">ตอบใน 24 ชม. รายวัน</h3>
            <DailyRateBars days={data.dailyDays} values={row.trend} target={RESPONSE_RATE_TARGET_PERCENT} loading={data.daily.loading && !data.daily.data} />
          </div>
        )}
        {row.hasData && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">แชทที่รอคำตอบ</h3>
            {chats.length === 0 ? (
              <p className="text-sm text-[var(--app-text-secondary)]">{row.waitingCount > 0 ? "ยังโหลดรายการแชทของร้านนี้ไม่ครบ" : "ไม่มีแชทที่รอคำตอบ"}</p>
            ) : (
              <ul className="divide-y divide-[var(--app-border-subtle)]">
                {chats.map((chat) => (
                  <li key={chat.id}>
                    <button type="button" data-v2-waiting-chat={chat.id} onClick={() => onOpenConversation(row.storeId, chat.id)} className="flex w-full items-start justify-between gap-3 py-2.5 text-left hover:bg-[var(--app-surface-hover)]">
                      <span className="min-w-0 truncate text-sm font-medium">{chat.customerName}</span>
                      <span className="shrink-0 text-right text-sm"><WaitLabel businessMinutes={chat.businessMinutes} waitingSince={chat.waitingSince} now={data.now} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export function ResponseStoresView({ rows, state, onSelectStore, onOpenConversation }: {
  rows: StoreRow[];
  state: ResponseUrlState;
  onSelectStore: (storeId: string) => void;
  onOpenConversation: (storeId: string, conversationId: string) => void;
}) {
  const data = useV2Data();
  const { requestDaily } = data;
  useEffect(() => { requestDaily(); }, [requestDaily]);
  const selected = data.storeRows.find((row) => row.storeId === state.store) ?? null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(320px,400px)] items-start gap-5">
      <StoreTable rows={rows} selectedStoreId={selected?.storeId ?? null} onSelect={onSelectStore} tab={state.tab} />
      <div className="sticky top-0">
        <StoreDetail row={selected} onOpenConversation={onOpenConversation} />
      </div>
    </div>
  );
}
