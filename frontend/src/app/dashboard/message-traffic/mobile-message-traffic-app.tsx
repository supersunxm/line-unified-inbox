"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { DateRangePicker } from "../../follower-insights/date-range-picker";
import { getBkkDateStr } from "../../follower-insights/follower-insights-utils";
import { pickLanguageText, useAppLanguage, type AppLanguage } from "../../language";
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

function localeFor(language: AppLanguage) {
  return language === "th" ? "th-TH-u-ca-gregory" : language === "zh" ? "zh-CN" : "en-US";
}

function dayLabel(dayOfWeek: number, language: AppLanguage) {
  const labels = {
    th: ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"],
    en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    zh: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
  } as const;
  return labels[language][dayOfWeek] ?? "—";
}

function quickRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { from: getBkkDateStr(start), to: getBkkDateStr(end) };
}

async function fetchTraffic(from: string, to: string, failureText: string): Promise<MessageTrafficResponse> {
  const query = new URLSearchParams({ from, to });
  const response = await fetch(`/api-backend/dashboard/message-traffic?${query.toString()}`, {
    credentials: "include",
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
  if (!response.ok) {
    let message = `${failureText} (${response.status})`;
    try {
      const body = await response.json() as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<MessageTrafficResponse>;
}

function HourlyChart({ items, formatter }: { items: HourBucket[]; formatter: Intl.NumberFormat }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.hour} className="grid grid-cols-[42px_1fr_54px] items-center gap-2 text-[11px]">
          <span className="tabular-nums text-[var(--app-text-secondary)]">{String(item.hour).padStart(2, "0")}:00</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]"><div className="h-full rounded-full bg-[var(--app-accent)]" style={{ width: `${Math.max(item.count ? 2 : 0, (item.count / max) * 100)}%` }} /></div>
          <span className="text-right font-semibold tabular-nums">{formatter.format(item.count)}</span>
        </div>
      ))}
    </div>
  );
}

export function MobileMessageTrafficApp() {
  const { language } = useAppLanguage();
  const locale = localeFor(language);
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const dateLabel = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }), [locale]);
  const text = pickLanguageText(language, {
    th: {
      failed: "โหลดข้อมูลไม่สำเร็จ", openFailed: "โหลด Message Traffic ไม่สำเร็จ", authFailed: "ตรวจสอบบัญชีไม่สำเร็จ", opening: "กำลังเปิด Message Traffic...", eyebrow: "Analytics · Message Traffic", title: "Message Traffic", description: "ดูว่าลูกค้าทักเข้ามาเมื่อไหร่ และร้านไหนมีปริมาณข้อความมากที่สุด", refresh: "รีเฟรช", overview: "ภาพรวม", time: "ช่วงเวลา", stores: "รายสาขา", loading: "กำลังโหลดข้อมูล...", inbound: "ข้อความจากลูกค้า", conversations: "บทสนทนา", inboundConversations: "บทสนทนาที่มีข้อความเข้า", perConversation: "ข้อความ / ห้อง", intensity: "ความเข้มข้นของบทสนทนา", peak: "ช่วงพีค", messages: "ข้อความ", busiestDay: "วันที่คึกคักสุด", noData: "ไม่มีข้อมูล", topHours: "ช่วงเวลาที่เด่น", topHoursDesc: "5 ชั่วโมงที่มีข้อความเข้ามามากที่สุด", topStores: "ร้านที่มีข้อความมากที่สุด", topStoresDesc: "5 อันดับจากช่วงวันที่ที่เลือก", hourly: "ข้อความเข้าแยกตามชั่วโมง", hourlyDesc: "นับจาก Message.sentAt ตามเวลา Asia/Bangkok", weekday: "Traffic แยกตามวันในสัปดาห์", storeCountSuffix: "ร้านจากข้อมูลช่วงนี้", search: "ค้นหาชื่อร้านหรือ Store ID", rooms: "ห้อง", noStores: "ไม่พบข้อมูลร้าน", noStoresDesc: "ลองเปลี่ยนคำค้นหาหรือช่วงวันที่", showMore: "แสดงเพิ่มอีก", storesUnit: "ร้าน", peakHour: "ช่วงพีค",
    },
    en: {
      failed: "Failed to load data", openFailed: "Failed to load Message Traffic", authFailed: "Failed to verify account", opening: "Opening Message Traffic...", eyebrow: "Analytics · Message Traffic", title: "Message Traffic", description: "See when customers message and which stores receive the most inbound traffic.", refresh: "Refresh", overview: "Overview", time: "Time", stores: "By store", loading: "Loading data...", inbound: "Inbound messages", conversations: "Conversations", inboundConversations: "Conversations with inbound messages", perConversation: "Messages / conversation", intensity: "Conversation intensity", peak: "Peak period", messages: "messages", busiestDay: "Busiest day", noData: "No data", topHours: "Top hours", topHoursDesc: "5 hours with the most inbound messages", topStores: "Stores with the most messages", topStoresDesc: "Top 5 for the selected date range", hourly: "Inbound messages by hour", hourlyDesc: "Based on Message.sentAt in Asia/Bangkok time", weekday: "Traffic by day of week", storeCountSuffix: "stores in this period", search: "Search store name or Store ID", rooms: "Conversations", noStores: "No store data found", noStoresDesc: "Try another search or date range", showMore: "Show", storesUnit: "more stores", peakHour: "Peak hour",
    },
    zh: {
      failed: "加载数据失败", openFailed: "加载 Message Traffic 失败", authFailed: "账户验证失败", opening: "正在打开 Message Traffic...", eyebrow: "分析 · 消息流量", title: "消息流量", description: "查看客户何时发来消息，以及哪些门店收到的消息最多。", refresh: "刷新", overview: "概览", time: "时段", stores: "按门店", loading: "正在加载数据...", inbound: "客户消息", conversations: "会话", inboundConversations: "有客户消息的会话", perConversation: "消息 / 会话", intensity: "会话强度", peak: "高峰时段", messages: "条消息", busiestDay: "最繁忙日期", noData: "暂无数据", topHours: "高峰时段", topHoursDesc: "客户消息最多的 5 个小时", topStores: "消息最多的门店", topStoresDesc: "所选日期范围内前 5 名", hourly: "按小时统计客户消息", hourlyDesc: "按 Asia/Bangkok 时区的 Message.sentAt 统计", weekday: "按星期统计流量", storeCountSuffix: "家门店（当前时段）", search: "搜索门店名称或 Store ID", rooms: "会话", noStores: "未找到门店数据", noStoresDesc: "请尝试其他搜索词或日期范围", showMore: "再显示", storesUnit: "家门店", peakHour: "高峰时段",
    },
  });

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
    try { setData(await fetchTraffic(from, to, text.failed)); }
    catch (err) { setError(err instanceof Error ? err.message : text.openFailed); }
    finally { setLoading(false); }
  }, [text.failed, text.openFailed]);

  useEffect(() => {
    let active = true;
    void api.me()
      .then((value) => { if (active) setUser(value); })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) window.location.replace("/login");
        else setError(err instanceof Error ? err.message : text.authFailed);
      })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, [text.authFailed]);

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
  const activeRange = useMemo(() => data ? `${dateLabel.format(new Date(data.rangeStart))} – ${dateLabel.format(new Date(data.rangeEnd))}` : "", [data, dateLabel]);

  const stores = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const filtered = data.topStores.filter((store) => !q || store.storeName.toLowerCase().includes(q) || (store.externalStoreId || "").toLowerCase().includes(q));
    const value = (store: StoreTrafficRow) => sort === "conversations" ? store.distinctConversations : sort === "intensity" ? store.messagesPerConversation : sort === "peak" ? store.peakHour.count : store.inboundMessages;
    return [...filtered].sort((a, b) => value(b) - value(a));
  }, [data, search, sort]);

  if (!authChecked || !user) {
    return <main className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">{text.opening}</main>;
  }

  return (
    <MobilePageShell bottomNav={<MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />}>
      <MobilePageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} action={<button type="button" disabled={loading} onClick={() => void loadRange(dateFrom, dateTo)} className="min-h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs font-semibold disabled:opacity-50">{text.refresh}</button>} />

      <div className="space-y-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
        <div className="grid grid-cols-3 rounded-xl bg-[var(--app-surface-subtle)] p-1">
          {[7, 14, 30].map((days) => <button key={days} type="button" disabled={loading} onClick={() => applyQuickRange(days)} className={`min-h-10 rounded-lg text-xs font-bold ${quickDays === days ? "bg-[var(--app-accent)] text-white shadow-sm" : "text-[var(--app-text-secondary)]"}`}>{days}D</button>)}
        </div>
        <div className="[&>div]:block [&>div>button]:w-full [&>div>button]:justify-between">
          <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} language={language} onApply={applyCalendarRange} onQuickRange={applyQuickRange} />
        </div>
      </div>

      <MobileSectionTabs value={tab} onChange={setTab} items={[{ value: "overview", label: text.overview }, { value: "time", label: text.time }, { value: "stores", label: text.stores }]} />

      <div className="space-y-5 px-4 py-4 pb-8">
        {error && <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-xs leading-5 text-rose-600 dark:text-rose-400">{error}</div>}
        {loading && !data ? <div className="py-16 text-center text-sm text-[var(--app-text-secondary)]">{text.loading}</div> : data && (
          <>
            {tab === "overview" && (
              <>
                <MobileMetricGrid>
                  <MobileMetricCard wide label={text.inbound} value={nf.format(data.totalInboundMessages)} detail={activeRange} tone="accent" />
                  <MobileMetricCard label={text.conversations} value={nf.format(data.totalConversations)} detail={text.inboundConversations} />
                  <MobileMetricCard label={text.perConversation} value={data.messagesPerConversation.toFixed(2)} detail={text.intensity} />
                  <MobileMetricCard label={text.peak} value={<span className="text-[20px]">{data.overallPeakHour.window}</span>} detail={`${nf.format(data.overallPeakHour.count)} ${text.messages}`} tone="info" />
                  <MobileMetricCard label={text.busiestDay} value={<span className="text-[20px]">{busiestDay ? dayLabel(busiestDay.dayOfWeek, language) : "—"}</span>} detail={busiestDay ? `${nf.format(busiestDay.count)} ${text.messages}` : text.noData} />
                </MobileMetricGrid>

                <MobileSection title={text.topHours} description={text.topHoursDesc}>
                  <MobileCard><div className="space-y-3">{peakHours.map((item, index) => <div key={item.hour} className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-[11px] font-bold">{index + 1}</span><span className="text-sm font-semibold">{String(item.hour).padStart(2, "0")}:00 – {String((item.hour + 1) % 24).padStart(2, "0")}:00</span></div><span className="text-sm font-bold tabular-nums text-[var(--app-accent)]">{nf.format(item.count)}</span></div>)}</div></MobileCard>
                </MobileSection>

                <MobileSection title={text.topStores} description={text.topStoresDesc}>
                  <div className="space-y-2.5">{data.topStores.slice(0, 5).map((store) => <MobileListCard key={store.storeId} title={`${store.rank}. ${store.storeName}`} subtitle={store.externalStoreId || undefined} trailing={<span className="text-sm font-bold tabular-nums text-[var(--app-accent)]">{nf.format(store.inboundMessages)}</span>}><div className="grid grid-cols-3 gap-2 text-[11px]"><div><p className="text-[var(--app-text-tertiary)]">{text.conversations}</p><p className="mt-0.5 font-bold tabular-nums">{nf.format(store.distinctConversations)}</p></div><div><p className="text-[var(--app-text-tertiary)]">{text.perConversation}</p><p className="mt-0.5 font-bold tabular-nums">{store.messagesPerConversation.toFixed(2)}</p></div><div><p className="text-[var(--app-text-tertiary)]">{text.peak}</p><p className="mt-0.5 font-bold">{store.peakHour.window}</p></div></div></MobileListCard>)}</div>
                </MobileSection>
              </>
            )}

            {tab === "time" && (
              <>
                <MobileSection title={text.hourly} description={text.hourlyDesc}><MobileCard><HourlyChart items={data.hourlyDistribution} formatter={nf} /></MobileCard></MobileSection>
                <MobileSection title={text.weekday}><MobileCard><div className="space-y-3">{[...data.dayOfWeekDistribution].sort((a, b) => b.count - a.count).map((item, index) => <div key={item.dayOfWeek} className="flex items-center justify-between border-b border-[var(--app-border-subtle)] pb-3 last:border-0 last:pb-0"><div className="flex items-center gap-3"><span className="text-xs font-bold text-[var(--app-text-tertiary)]">#{index + 1}</span><span className="text-sm font-semibold">{dayLabel(item.dayOfWeek, language)}</span></div><span className="text-sm font-bold tabular-nums">{nf.format(item.count)}</span></div>)}</div></MobileCard></MobileSection>
              </>
            )}

            {tab === "stores" && (
              <>
                <MobileSection title={text.stores} description={`${nf.format(stores.length)} ${text.storeCountSuffix}`}>
                  <div className="space-y-2.5">
                    <input value={search} onChange={(event) => { setSearch(event.target.value); setLimit(30); }} placeholder={text.search} className="h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-base outline-none focus:border-[var(--app-accent)]" />
                    <div className="grid grid-cols-4 gap-1 rounded-xl bg-[var(--app-surface-subtle)] p-1">
                      {([["messages", text.inbound], ["conversations", text.rooms], ["intensity", text.intensity], ["peak", text.peak]] as Array<[StoreSort,string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setSort(value)} className={`min-h-9 rounded-lg text-[10px] font-bold ${sort === value ? "bg-[var(--app-surface)] text-[var(--app-accent)] shadow-sm" : "text-[var(--app-text-secondary)]"}`}>{label}</button>)}
                    </div>
                  </div>
                </MobileSection>
                <div className="space-y-2.5">
                  {stores.length === 0 ? <MobileEmptyState title={text.noStores} description={text.noStoresDesc} /> : stores.slice(0, limit).map((store, index) => <MobileListCard key={store.storeId} leading={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-xs font-bold">{index + 1}</span>} title={store.storeName} subtitle={store.externalStoreId || undefined} trailing={<div className="text-right"><p className="text-base font-bold tabular-nums text-[var(--app-accent)]">{nf.format(store.inboundMessages)}</p><p className="text-[10px] text-[var(--app-text-tertiary)]">{text.messages}</p></div>}><div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--app-surface-subtle)] p-3 text-[11px]"><div><p className="text-[var(--app-text-tertiary)]">{text.conversations}</p><p className="mt-1 font-bold tabular-nums">{nf.format(store.distinctConversations)}</p></div><div><p className="text-[var(--app-text-tertiary)]">{text.perConversation}</p><p className="mt-1 font-bold tabular-nums">{store.messagesPerConversation.toFixed(2)}</p></div><div><p className="text-[var(--app-text-tertiary)]">{text.peakHour}</p><p className="mt-1 font-bold">{store.peakHour.window}</p><p className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">{nf.format(store.peakHour.count)} {text.messages}</p></div></div></MobileListCard>)}
                  {limit < stores.length && <button type="button" onClick={() => setLimit((value) => value + 30)} className="min-h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-xs font-bold">{text.showMore} {nf.format(Math.min(30, stores.length - limit))} {text.storesUnit}</button>}
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
