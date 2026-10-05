"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { KpiStripSkeleton, SectionCardSkeleton, SegmentedControl, useDeferredLoading } from "@/components/ui";
import { FOLLOW_TODAY_LIMIT, FOLLOW_UP_THRESHOLD_MINUTES, RECENT_WAIT_WINDOW_DAYS } from "@/lib/v2/business-hours";
import { defaultSortForTab, filterStoreRows, sortStoreRows, type StoreSort, type StoreTab } from "@/lib/v2/response-model";
import { ALL_STORES, parseResponseUrl, responseUrlQuery, type ResponseUrlState, type ResponseView as View } from "@/lib/v2/response-url";
import { ResponseChatView } from "./response-chat-view";
import { ResponseKpis, ResponseStoresView } from "./response-stores-view";
import { useV2Data, WAITING_MAX_PAGES, WAITING_PAGE_SIZE } from "./v2-data";
import { SourceNotice } from "./v2-ui";

const TAB_LABELS: Record<StoreTab, string> = { "follow-today": "ตามวันนี้", all: "ทั้งหมด", "no-data": "ไม่มีข้อมูล" };
const SORT_LABELS: Array<[StoreSort, string]> = [["recent", "รอตอบตั้งแต่เมื่อวาน"], ["wait", "รอนานสุด"], ["rate", "ตอบใน 24 ชม. (ต่ำสุดก่อน)"], ["age", "แชทค้างนานสุด"]];

function Notices() {
  const data = useV2Data();
  const notices: string[] = [];
  if (data.summary.error) notices.push(`โหลดสถานะการตอบไม่สำเร็จ: ${data.summary.error}`);
  if (data.waiting.error) notices.push(`โหลดรายการแชทที่รอไม่สำเร็จ: ${data.waiting.error}`);
  if (data.waiting.data?.truncated) notices.push(`แชทที่รอใน ${RECENT_WAIT_WINDOW_DAYS} วันมีมากกว่า ${(WAITING_MAX_PAGES * WAITING_PAGE_SIZE).toLocaleString("th-TH")} แชท จึงวัดเวลารอจากแชทล่าสุดเท่านั้น จำนวนแชทที่รอยังนับครบจากระบบ`);
  if (data.mirror.error) notices.push(data.hasDataSource === "activity"
    ? `โหลดสถานะการเก็บแชท (Live Mirror) ไม่สำเร็จ จึงนับร้านที่มีแชทใน 7 วันล่าสุดว่า "มีข้อมูล" แทน: ${data.mirror.error}`
    : `โหลดสถานะการเก็บแชทไม่สำเร็จ จึงยังแยกร้านที่ไม่มีข้อมูลไม่ได้: ${data.mirror.error}`);
  if (data.rates7d.error || data.ratesPrev7d.error) notices.push(`โหลดอัตราตอบใน 24 ชม. ไม่สำเร็จ: ${data.rates7d.error ?? data.ratesPrev7d.error}`);
  if (data.daily.error) notices.push(`โหลดแนวโน้มรายวันไม่สำเร็จ: ${data.daily.error}`);
  if (notices.length === 0) return null;
  return <div className="space-y-2">{notices.map((notice) => <SourceNotice key={notice}>{notice}</SourceNotice>)}</div>;
}

export function ResponseView() {
  const data = useV2Data();
  const router = useRouter();
  const pathname = usePathname() || "/v2/response";
  const searchParams = useSearchParams();
  const state = useMemo(() => parseResponseUrl(searchParams), [searchParams]);
  const showSkeleton = useDeferredLoading(data.coreLoading);

  const navigate = useCallback((patch: Partial<ResponseUrlState>) => {
    router.replace(`${pathname}${responseUrlQuery({ ...state, ...patch })}`, { scroll: false });
  }, [pathname, router, state]);

  const sort = state.sort ?? defaultSortForTab(state.tab);
  const rows = useMemo(() => sortStoreRows(filterStoreRows(data.storeRows, state.tab), sort), [data.storeRows, state.tab, sort]);

  // Stores view: select the first row when nothing is selected, so the detail panel is never empty.
  const firstStoreId = rows[0]?.storeId ?? null;
  const needsDefaultStore = state.view === "stores" && !data.coreLoading && firstStoreId !== null && (!state.store || state.store === ALL_STORES);
  useEffect(() => {
    if (needsDefaultStore && firstStoreId) navigate({ store: firstStoreId, conversation: null });
  }, [firstStoreId, navigate, needsDefaultStore]);

  const tabs = (
    <div role="tablist" aria-label="ตัวกรองร้าน" className="inline-flex gap-1 rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-1">
      {(Object.keys(TAB_LABELS) as StoreTab[]).map((tab) => {
        const count = filterStoreRows(data.storeRows, tab).length;
        const active = state.tab === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            data-v2-tab={tab}
            onClick={() => navigate({ tab, sort: null, store: state.store === ALL_STORES ? ALL_STORES : null, conversation: null })}
            className={`rounded-[var(--app-radius-sm)] px-3 py-1.5 text-sm font-medium ${active ? "bg-[var(--app-surface)] text-[var(--app-text-primary)] shadow-[var(--app-shadow-card)]" : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"}`}
          >
            {TAB_LABELS[tab]} <span className="tabular-nums text-[var(--app-text-tertiary)]">{data.summary.data ? count : ""}</span>
          </button>
        );
      })}
    </div>
  );

  // "ทั้งหมด" can be re-sorted; "ตามวันนี้" keeps its own order (count, then longest wait).
  const sortControl = state.tab === "all" ? (
    <label className="flex items-center gap-2 text-sm text-[var(--app-text-secondary)]">
      เรียงตาม
      <select
        data-v2-sort
        value={sort}
        onChange={(event) => navigate({ sort: event.target.value as StoreSort })}
        className="h-9 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-sm text-[var(--app-text-primary)]"
      >
        {SORT_LABELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  ) : null;

  return (
    <div className={`flex h-full min-h-0 flex-col gap-4 px-6 py-5 ${state.view === "stores" ? "overflow-y-auto" : "overflow-hidden"}`}>
      <PageHeader
        title="การตอบแชท"
        description={`ลูกค้าที่รอคำตอบ นับเวลาเฉพาะช่วงเปิดร้าน 10:00–21:00 · ตามวันนี้ = ร้านที่ลูกค้ารอ ≥ ${FOLLOW_UP_THRESHOLD_MINUTES} นาทีตั้งแต่เมื่อวาน 10:00 มากที่สุด ${FOLLOW_TODAY_LIMIT} ร้าน · ร้านที่ไม่มีข้อมูลไม่นับในทุกตัวเลข`}
        actions={
          <SegmentedControl<View>
            aria-label="มุมมอง"
            value={state.view}
            onChange={(view) => navigate({ view })}
            items={[{ id: "stores", label: "ภาพรวมร้าน" }, { id: "chat", label: "หน้าแชท" }]}
          />
        }
      />
      <Notices />
      {data.coreLoading ? (
        showSkeleton ? (
          <div className="space-y-4">
            <KpiStripSkeleton columns={5} labels={["ร้านที่ต้องตามวันนี้", "แชทที่รอคำตอบ", `ค้างเกิน ${RECENT_WAIT_WINDOW_DAYS} วัน`, "ตอบใน 24 ชม. · 7 วัน", "ร้านที่ไม่มีข้อมูล"]} />
            <SectionCardSkeleton title="ร้านเรียงตามเวลารอนานสุด" lines={8} />
          </div>
        ) : null
      ) : state.view === "stores" ? (
        <>
          <ResponseKpis />
          <div className="flex flex-wrap items-center justify-between gap-3">{tabs}{sortControl}</div>
          <ResponseStoresView
            rows={rows}
            state={{ ...state, sort }}
            onSelectStore={(store) => navigate({ store, conversation: null })}
            onOpenConversation={(store, conversation) => navigate({ view: "chat", store, conversation })}
          />
        </>
      ) : (
        <>
          {tabs}
          <div className="min-h-0 flex-1">
            <ResponseChatView
              rows={rows}
              state={state}
              onSelectStore={(store) => navigate({ store, conversation: null })}
              onSelectConversation={(store, conversation) => navigate({ store, conversation })}
            />
          </div>
        </>
      )}
    </div>
  );
}
