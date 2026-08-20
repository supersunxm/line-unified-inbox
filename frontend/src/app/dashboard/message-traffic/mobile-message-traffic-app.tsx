"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { DateRangePicker } from "../../follower-insights/date-range-picker";
import { getBkkDateStr } from "../../follower-insights/follower-insights-utils";
import {
  MobileBottomNav,
  MobileCard,
  MobileEmptyState,
  MobileListCard,
  MobileMetricCard,
  MobileMetricGrid,
  MobileMoreSheet,
  MobilePageHeader,
  MobilePageShell,
  MobileSection,
  MobileSectionTabs,
} from "@/components/mobile/adaptive-mobile";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type HourBucket = { hour: number; count: number };
type StoreTrafficRow = {
  rank: number;
  storeId: string;
  storeName: string;
  externalStoreId: string | null;
  inboundMessages: number;
  distinctConversations: number;
  messagesPerConversation: number;
  peakHour: { hour: number; count: number; window: string };
};
type MessageTrafficResponse = {
  period: "today" | "7d" | "30d" | "custom";
  customRange: { from: string; to: string } | null;
  timezone: string;
  rangeStart: string;
  rangeEnd: string;
  totalInboundMessages: number;
  totalConversations: number;
  messagesPerConversation: number;
  overallPeakHour: { hour: number; count: number; window: string };
  hourlyDistribution: HourBucket[];
  dayOfWeekDistribution: Array<{ dayOfWeek: number; day: string; count: number }>;
  topStores: StoreTrafficRow[];
};

type Tab = "overview" | "time" | "stores";
type StoreSort = "messages" | "conversations" | "intensity" | "peak";

const nf = new Intl.NumberFormat("th-TH");
const dateLabel = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

function quickRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { from: getBkkDateStr(start), to: getBkkDateStr(end) };
}

async function fetchTraffic(from: string, to: string): Promise<MessageTrafficResponse> {
  const query = new URLSearchParams({ from, to });
  const response = await fetch(`/api-backend/dashboard/message-traffic?${query.toString()}`, {
    credentials: "include",
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
  if (!response.ok) {
    let message = `โหลดข้อมูลไม่สำเร็จ (${response.status})`;
    try {
      const body = await response.json() as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<MessageTrafficResponse>;
}

function HourlyChart({ items }: { items: HourBucket[] }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.hour} className="grid grid-cols-[42px_1fr_54px] items-center gap-2 text-[11px]">
          <span className="tabular-nums text-[var(--app-text-secondary)]">{String(item.hour).padStart(2, "0")}:00</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]"><div className="h-full rounded-full bg-[var(--app-accent)]" style={{ width: `${Math.max(item.count ? 2 : 0, (item.count / max) * 100)}%` }} /></div>
          <span className="text-right font-semibold tabular-nums">{nf.format(item.count)}</span>
        </div>
      ))}
    </div>
  );
}

export function MobileMessageTrafficApp() {
  const initialRange = useMemo(() => quickRange(30), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [quickDays, setQuickDays] = useState<number | null>(30);
  const [data, setData] = useState<MessageTrafficResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [moreOpen, setMoreOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<StoreSort>("messages");
  const [limit, setLimit] = useState(30);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const loadRange = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try { setData(await fetchTraffic(from, to)); }
    catch (err) { setError(err instanceof Error ? err.message : "โหลด Message Traffic ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void api.me()
      .then((value) => { if (active) setUser(value); })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) window.location.replace("/login");
        else setError(err instanceof Error ? err.message : "ตรวจสอบบัญชีไม่สำเร็จ");
      })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (user) void loadRange(dateFrom, dateTo); }, [dateFrom, dateTo, loadRange, user]);

  const applyQuickRange = useCallback((days: number) => {
    const range = quickRange(days);
    setQuickDays(days);
    setDateFrom(range.from);
    setDateTo(range.to);
  }, []);

  const applyCalendarRange = useCallback((start: string, end: string) => {
    setQuickDays(null);
    setDateFrom(start);
    setDateTo(end);
  }, []);

  const busiestDay = useMemo(() => data?.dayOfWeekDistribution.length ? [...data.dayOfWeekDistribution].sort((a, b) => b.count - a.count)[0] : null, [data]);
  const peakHours = useMemo(() => data ? [...data.hourlyDistribution].sort((a, b) => b.count - a.count).slice(0, 5) : [], [data]);
  const activeRange = useMemo(() => data ? `${dateLabel.format(new Date(data.rangeStart))} – ${dateLabel.format(new Date(data.rangeEnd))}` : "", [data]);

  const stores = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const filtered = data.topStores.filter((store) => !q || store.storeName.toLowerCase().includes(q) || (store.externalStoreId || "").toLowerCase().includes(q));
    const value = (store: StoreTrafficRow) => sort === "conversations" ? store.distinctConversations : sort === "intensity" ? store.messagesPerConversation : sort === "peak" ? store.peakHour.count : store.inboundMessages;
    return [...filtered].sort((a, b) => value(b) - value(a));
  }, [data, search, sort]);

  if (!authChecked || !user) {
    return <main className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิด Message Traffic...</main>;
  }

  return (
    <MobilePageShell bottomNav={<MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />}>
      <MobilePageHeader
        eyebrow="Analytics · Message Traffic"
        title="Message Traffic"
        description="ดูว่าลูกค้าทักเข้ามาเมื่อไหร่ และร้านไหนมีปริมาณข้อความมากที่สุด"
        action={<button type="button" disabled={loading} onClick={() => void loadRange(dateFrom, dateTo)} className="min-h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs font-semibold disabled:opacity-50">รีเฟรช</button>}
      />

      <div className="space-y-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
        <div className="grid grid-cols-3 rounded-xl bg-[var(--app-surface-subtle)] p-1">
          {[7, 14, 30].map((days) => <button key={days} type="button" disabled={loading} onClick={() => applyQuickRange(days)} className={`min-h-10 rounded-lg text-xs font-bold ${quickDays === days ? "bg-[var(--app-accent)] text-white shadow-sm" : "text-[var(--app-text-secondary)]"}`}>{days}D</button>)}
        </div>
        <div className="[&>div]:block [&>div>button]:w-full [&>div>button]:justify-between">
          <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} language="th" onApply={applyCalendarRange} onQuickRange={applyQuickRange} />
        </div>
      </div>

      <MobileSectionTabs value={tab} onChange={setTab} items={[{ value: "overview", label: "ภาพรวม" }, { value: "time", label: "ช่วงเวลา" }, { value: "stores", label: "รายสาขา" }]} />

      <div className="space-y-5 px-4 py-4 pb-8">
        {error && <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-xs leading-5 text-rose-600 dark:text-rose-400">{error}</div>}
        {loading && !data ? <div className="py-16 text-center text-sm text-[var(--app-text-secondary)]">กำลังโหลดข้อมูล...</div> : data && (
          <>
            {tab === "overview" && (
              <>
                <MobileMetricGrid>
                  <MobileMetricCard wide label="ข้อความจากลูกค้า" value={nf.format(data.totalInboundMessages)} detail={activeRange} tone="accent" />
                  <MobileMetricCard label="บทสนทนา" value={nf.format(data.totalConversations)} detail="บทสนทนาที่มีข้อความเข้า" />
                  <MobileMetricCard label="ข้อความ / ห้อง" value={data.messagesPerConversation.toFixed(2)} detail="ความเข้มข้นของบทสนทนา" />
                  <MobileMetricCard label="ช่วงพีค" value={<span className="text-[20px]">{data.overallPeakHour.window}</span>} detail={`${nf.format(data.overallPeakHour.count)} ข้อความ`} tone="info" />
                  <MobileMetricCard label="วันที่คึกคักสุด" value={<span className="text-[20px]">{busiestDay?.day ?? "—"}</span>} detail={busiestDay ? `${nf.format(busiestDay.count)} ข้อความ` : "ไม่มีข้อมูล"} />
                </MobileMetricGrid>

                <MobileSection title="ช่วงเวลาที่เด่น" description="5 ชั่วโมงที่มีข้อความเข้ามามากที่สุด">
                  <MobileCard>
                    <div className="space-y-3">{peakHours.map((item, index) => <div key={item.hour} className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-[11px] font-bold">{index + 1}</span><span className="text-sm font-semibold">{String(item.hour).padStart(2, "0")}:00 – {String((item.hour + 1) % 24).padStart(2, "0")}:00</span></div><span className="text-sm font-bold tabular-nums text-[var(--app-accent)]">{nf.format(item.count)}</span></div>)}</div>
                  </MobileCard>
                </MobileSection>

                <MobileSection title="ร้านที่มีข้อความมากที่สุด" description="Top 5 จากช่วงวันที่ที่เลือก">
                  <div className="space-y-2.5">
                    {data.topStores.slice(0, 5).map((store) => <MobileListCard key={store.storeId} title={`${store.rank}. ${store.storeName}`} subtitle={store.externalStoreId || undefined} trailing={<span className="text-sm font-bold tabular-nums text-[var(--app-accent)]">{nf.format(store.inboundMessages)}</span>}><div className="grid grid-cols-3 gap-2 text-[11px]"><div><p className="text-[var(--app-text-tertiary)]">บทสนทนา</p><p className="mt-0.5 font-bold tabular-nums">{nf.format(store.distinctConversations)}</p></div><div><p className="text-[var(--app-text-tertiary)]">ข้อความ/ห้อง</p><p className="mt-0.5 font-bold tabular-nums">{store.messagesPerConversation.toFixed(2)}</p></div><div><p className="text-[var(--app-text-tertiary)]">พีค</p><p className="mt-0.5 font-bold">{store.peakHour.window}</p></div></div></MobileListCard>)}
                  </div>
                </MobileSection>
              </>
            )}

            {tab === "time" && (
              <>
                <MobileSection title="ข้อความเข้าแยกตามชั่วโมง" description="นับจาก Message.sentAt ตามเวลา Asia/Bangkok"><MobileCard><HourlyChart items={data.hourlyDistribution} /></MobileCard></MobileSection>
                <MobileSection title="Traffic แยกตามวันในสัปดาห์">
                  <MobileCard><div className="space-y-3">{[...data.dayOfWeekDistribution].sort((a, b) => b.count - a.count).map((item, index) => <div key={item.day} className="flex items-center justify-between border-b border-[var(--app-border-subtle)] pb-3 last:border-0 last:pb-0"><div className="flex items-center gap-3"><span className="text-xs font-bold text-[var(--app-text-tertiary)]">#{index + 1}</span><span className="text-sm font-semibold">{item.day}</span></div><span className="text-sm font-bold tabular-nums">{nf.format(item.count)}</span></div>)}</div></MobileCard>
                </MobileSection>
              </>
            )}

            {tab === "stores" && (
              <>
                <MobileSection title="รายสาขา" description={`${nf.format(stores.length)} ร้านจากข้อมูลช่วงนี้`}>
                  <div className="space-y-2.5">
                    <input value={search} onChange={(event) => { setSearch(event.target.value); setLimit(30); }} placeholder="ค้นหาชื่อร้านหรือ Store ID" className="h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-base outline-none focus:border-[var(--app-accent)]" />
                    <div className="grid grid-cols-4 gap-1 rounded-xl bg-[var(--app-surface-subtle)] p-1">
                      {([['messages','ข้อความ'],['conversations','ห้อง'],['intensity','เข้มข้น'],['peak','พีค']] as Array<[StoreSort,string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setSort(value)} className={`min-h-9 rounded-lg text-[10px] font-bold ${sort === value ? "bg-[var(--app-surface)] text-[var(--app-accent)] shadow-sm" : "text-[var(--app-text-secondary)]"}`}>{label}</button>)}
                    </div>
                  </div>
                </MobileSection>
                <div className="space-y-2.5">
                  {stores.length === 0 ? <MobileEmptyState title="ไม่พบข้อมูลร้าน" description="ลองเปลี่ยนคำค้นหาหรือช่วงวันที่" /> : stores.slice(0, limit).map((store, index) => <MobileListCard key={store.storeId} leading={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-xs font-bold">{index + 1}</span>} title={store.storeName} subtitle={store.externalStoreId || undefined} trailing={<div className="text-right"><p className="text-base font-bold tabular-nums text-[var(--app-accent)]">{nf.format(store.inboundMessages)}</p><p className="text-[10px] text-[var(--app-text-tertiary)]">ข้อความ</p></div>}><div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--app-surface-subtle)] p-3 text-[11px]"><div><p className="text-[var(--app-text-tertiary)]">บทสนทนา</p><p className="mt-1 font-bold tabular-nums">{nf.format(store.distinctConversations)}</p></div><div><p className="text-[var(--app-text-tertiary)]">ข้อความ/ห้อง</p><p className="mt-1 font-bold tabular-nums">{store.messagesPerConversation.toFixed(2)}</p></div><div><p className="text-[var(--app-text-tertiary)]">Peak Hour</p><p className="mt-1 font-bold">{store.peakHour.window}</p><p className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">{nf.format(store.peakHour.count)} ข้อความ</p></div></div></MobileListCard>)}
                  {limit < stores.length && <button type="button" onClick={() => setLimit((value) => value + 30)} className="min-h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-xs font-bold">แสดงเพิ่มอีก {Math.min(30, stores.length - limit)} ร้าน</button>}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {moreOpen && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
    </MobilePageShell>
  );
}
