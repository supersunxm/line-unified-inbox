"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { ByStoreAccountRow, SummaryDailyRow } from "@/types/api";
import { pickLanguageText, useAppLanguage, type AppLanguage } from "../language";
import { DateRangePicker } from "./date-range-picker";
import { formatDateDisplay, getBkkDateStr } from "./follower-insights-utils";

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: "ADMIN" | "VIEWER";
};

type MobileTab = "overview" | "stores" | "daily";
type StoreSort = "growth" | "followers" | "reach" | "block";

type StoreMetric = {
  key: string;
  id: string;
  store: string;
  oa: string;
  followers: number | null;
  growth: number | null;
  growthPct: number | null;
  reachPct: number | null;
  blockPct: number | null;
};

function pct(numerator: number | null, denominator: number | null, decimals = 1) {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  const factor = 10 ** decimals;
  return Math.round(((numerator / denominator) * 100) * factor) / factor;
}

function tone(value: number | null, kind: "growth" | "reach" | "block") {
  if (value === null) return "text-[var(--app-text-secondary)]";
  if (kind === "growth") return value > 0 ? "text-emerald-600 dark:text-emerald-400" : value < 0 ? "text-rose-600 dark:text-rose-400" : "text-[var(--app-text-secondary)]";
  if (kind === "reach") return value >= 85 ? "text-emerald-600 dark:text-emerald-400" : value >= 75 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  return value <= 5 ? "text-emerald-600 dark:text-emerald-400" : value <= 10 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
}

function localeFor(language: AppLanguage) {
  return language === "th" ? "th-TH-u-ca-gregory" : language === "zh" ? "zh-CN" : "en-US";
}

function formatSigned(value: number | null, locale: string) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString(locale)}`;
}

function MiniTrend({ data, language }: { data: SummaryDailyRow[]; language: AppLanguage }) {
  const points = useMemo(() => data.filter((item): item is SummaryDailyRow & { followers: number } => item.followers !== null), [data]);
  if (points.length < 2) {
    return <div className="flex h-28 items-center justify-center text-xs text-[var(--app-text-tertiary)]">{pickLanguageText(language, { th: "ข้อมูลยังไม่พอสำหรับกราฟ", en: "Not enough data for the chart", zh: "数据不足，无法绘制图表" })}</div>;
  }
  const values = points.map((item) => item.followers);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const polyline = points.map((item, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 34 - ((item.followers - min) / range) * 28;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="pt-2">
      <svg viewBox="0 0 100 38" className="h-28 w-full overflow-visible" preserveAspectRatio="none" aria-label={pickLanguageText(language, { th: "แนวโน้มผู้ติดตาม", en: "Follower trend", zh: "关注者趋势" })}>
        <line x1="0" y1="34" x2="100" y2="34" stroke="currentColor" className="text-[var(--app-border)]" strokeWidth="0.45" />
        <polyline points={polyline} fill="none" stroke="currentColor" className="text-[var(--app-accent)]" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        {points.map((item, index) => {
          const [x, y] = polyline.split(" ")[index].split(",");
          return <circle key={item.date} cx={x} cy={y} r="1.05" fill="currentColor" className="text-[var(--app-accent)]" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--app-text-tertiary)]">
        <span>{formatDateDisplay(points[0].date, language)}</span>
        <span>{formatDateDisplay(points[points.length - 1].date, language)}</span>
      </div>
    </div>
  );
}

function BottomNav({ onMore, language }: { onMore: () => void; language: AppLanguage }) {
  const labels = pickLanguageText(language, {
    th: { dashboard: "แดชบอร์ด", chats: "แชทร้านค้า", followers: "ข้อมูลผู้ติดตาม", more: "เพิ่มเติม" },
    en: { dashboard: "Dashboard", chats: "Store chats", followers: "Followers", more: "More" },
    zh: { dashboard: "仪表板", chats: "门店聊天", followers: "关注者", more: "更多" },
  });
  return (
    <nav className="grid shrink-0 grid-cols-4 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-1 pt-1.5" style={{ paddingBottom: "max(0.45rem, env(safe-area-inset-bottom))" }}>
      <Link href="/dashboard" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-[var(--app-text-secondary)]"><span className="text-lg">▦</span><span>{labels.dashboard}</span></Link>
      <Link href="/chats" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-[var(--app-text-secondary)]"><span className="text-lg">◫</span><span>{labels.chats}</span></Link>
      <Link href="/follower-insights" aria-current="page" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-[var(--app-accent)]"><span className="text-lg">↗</span><span>{labels.followers}</span></Link>
      <button type="button" onClick={onMore} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-[var(--app-text-secondary)]"><span className="text-xl">•••</span><span>{labels.more}</span></button>
    </nav>
  );
}

function MoreSheet({ user, onClose, language }: { user: AuthUser; onClose: () => void; language: AppLanguage }) {
  const labels = pickLanguageText(language, {
    th: { more: "เพิ่มเติม", coupons: "คูปอง", stores: "จัดการร้านค้า", purchase: "ข้อมูลการซื้อ", messages: "ส่งข้อความ" },
    en: { more: "More", coupons: "Coupons", stores: "Store management", purchase: "Purchase analytics", messages: "Mass messages" },
    zh: { more: "更多", coupons: "优惠券", stores: "门店管理", purchase: "购买分析", messages: "群发消息" },
  });
  const links = [
    { href: "/dashboard/message-traffic", label: "Message Traffic" },
    { href: "/coupons", label: labels.coupons },
    { href: "/stores", label: labels.stores },
    ...(user.role === "ADMIN" ? [{ href: "/admin/purchase-analytics", label: labels.purchase }, { href: "/mass-messages", label: labels.messages }] : []),
  ];
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/35" onClick={onClose}>
      <div className="w-full rounded-t-[1.6rem] border-t border-[var(--app-border)] bg-[var(--app-surface)] px-4 pt-3 shadow-2xl" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }} onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--app-border)]" />
        <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-bold">{labels.more}</p><p className="mt-0.5 text-xs text-[var(--app-text-tertiary)]">{user.displayName}</p></div><button onClick={onClose} aria-label={pickLanguageText(language, { th: "ปิด", en: "Close", zh: "关闭" })} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-lg">×</button></div>
        <div className="grid grid-cols-2 gap-2">{links.map((item) => <Link key={item.href} href={item.href} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-3 text-sm font-semibold">{item.label}</Link>)}</div>
      </div>
    </div>
  );
}

export function MobileFollowerInsightsApp() {
  const { language } = useAppLanguage();
  const locale = localeFor(language);
  const text = pickLanguageText(language, {
    th: { opening: "กำลังเปิดข้อมูลผู้ติดตาม...", authError: "ไม่สามารถตรวจสอบบัญชีได้", loadError: "โหลดข้อมูลผู้ติดตามไม่สำเร็จ", title: "ข้อมูลผู้ติดตาม", overview: "ภาพรวม", stores: "รายสาขา", daily: "รายวัน", retry: "ลองอีกครั้ง", totalFollowers: "ผู้ติดตามรวม", storesReady: "สาขาพร้อมใช้งาน", growth: "เติบโต", dataStores: "สาขาที่มีข้อมูล", attention: "จุดที่ต้องติดตาม", noGrowth: "ไม่เติบโต", noGrowthData: "ไม่มีข้อมูลการเติบโต", search: "ค้นหาสาขา หรือ LINE OA", storeUnit: "สาขา", showMore: "แสดงเพิ่มอีก 30 สาขา", data: "ข้อมูล", ready: "พร้อม", partial: "บางส่วน", missing: "ไม่มีข้อมูล", dailyIncrease: "เพิ่มขึ้นรายวัน", refresh: "รีเฟรชข้อมูล" },
    en: { opening: "Opening follower insights...", authError: "Unable to verify your account", loadError: "Failed to load follower insights", title: "Follower Insights", overview: "Overview", stores: "By store", daily: "Daily", retry: "Try again", totalFollowers: "Total followers", storesReady: "stores ready", growth: "Growth", dataStores: "Stores with data", attention: "Needs attention", noGrowth: "No growth", noGrowthData: "No growth data", search: "Search store or LINE OA", storeUnit: "stores", showMore: "Show 30 more stores", data: "Data", ready: "Ready", partial: "Partial", missing: "Missing", dailyIncrease: "Daily increase", refresh: "Refresh data" },
    zh: { opening: "正在打开关注者数据...", authError: "无法验证账户", loadError: "加载关注者数据失败", title: "关注者数据", overview: "概览", stores: "按门店", daily: "每日", retry: "重试", totalFollowers: "关注者总数", storesReady: "家门店已就绪", growth: "增长", dataStores: "有数据的门店", attention: "需要关注", noGrowth: "无增长", noGrowthData: "暂无增长数据", search: "搜索门店或 LINE OA", storeUnit: "家门店", showMore: "再显示 30 家门店", data: "数据", ready: "就绪", partial: "部分", missing: "无数据", dailyIncrease: "每日增长", refresh: "刷新数据" },
  });

  const today = new Date();
  const endInitial = getBkkDateStr(today);
  const startInitialDate = new Date(today);
  startInitialDate.setDate(startInitialDate.getDate() - 6);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<MobileTab>("overview");
  const [dateFrom, setDateFrom] = useState(getBkkDateStr(startInitialDate));
  const [dateTo, setDateTo] = useState(endInitial);
  const [summary, setSummary] = useState<SummaryDailyRow[]>([]);
  const [stores, setStores] = useState<ByStoreAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<StoreSort>("growth");
  const [storeLimit, setStoreLimit] = useState(30);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    let active = true;
    void api.me()
      .then((value) => { if (active) setUser(value); })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) window.location.replace("/login");
        else setError(err instanceof Error ? err.message : text.authError);
      })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, [text.authError]);

  const loadData = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, storeResponse] = await Promise.all([
        api.followerInsightsSummary({ dateFrom: from, dateTo: to }),
        api.followerInsightsByStore(from, to),
      ]);
      setSummary(summaryResponse);
      setStores(storeResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [text.loadError]);

  useEffect(() => { if (user) void loadData(dateFrom, dateTo); }, [dateFrom, dateTo, loadData, user]);

  const applyQuickRange = useCallback((days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setDateFrom(getBkkDateStr(start));
    setDateTo(getBkkDateStr(end));
  }, []);

  const readyDates = useMemo(() => new Set(summary.filter((row) => row.accountsExpected > 0 && row.accountsReady === row.accountsExpected && row.followers !== null).map((row) => row.date)), [summary]);
  const partialDates = useMemo(() => new Set(summary.filter((row) => (row.accountsWithData ?? 0) > 0 && row.accountsReady !== row.accountsExpected).map((row) => row.date)), [summary]);
  const missingDates = useMemo(() => new Set(summary.filter((row) => (row.accountsWithData ?? 0) === 0 || row.followers === null).map((row) => row.date)), [summary]);

  const metrics = useMemo<StoreMetric[]>(() => stores.map((row) => ({
    key: row.lineOaId,
    id: row.masterStoreId || row.externalStoreId || row.storeId || row.lineOaId,
    store: row.storeName,
    oa: row.accountName,
    followers: row.followers,
    growth: row.periodIncrease,
    growthPct: row.periodIncrease !== null && row.startFollowers !== null && row.startFollowers > 0 ? pct(row.periodIncrease, row.startFollowers, 2) : row.periodIncrease === 0 ? 0 : null,
    reachPct: pct(row.targetedReaches, row.followers, 1),
    blockPct: pct(row.blocks, row.followers, 1),
  })), [stores]);

  const overview = useMemo(() => {
    const endRow = summary.find((row) => row.date === dateTo) || summary[summary.length - 1] || null;
    const comparable = metrics.filter((row) => row.growth !== null);
    const growth = comparable.reduce((sum, row) => sum + (row.growth || 0), 0);
    const starts = stores.reduce((sum, row) => sum + (row.startFollowers || 0), 0);
    const reachRows = stores.filter((row) => row.targetedReaches !== null && row.followers !== null);
    const blockRows = stores.filter((row) => row.blocks !== null && row.followers !== null);
    const reach = reachRows.reduce((sum, row) => sum + (row.targetedReaches || 0), 0);
    const reachFollowers = reachRows.reduce((sum, row) => sum + (row.followers || 0), 0);
    const blocks = blockRows.reduce((sum, row) => sum + (row.blocks || 0), 0);
    const blockFollowers = blockRows.reduce((sum, row) => sum + (row.followers || 0), 0);
    return {
      followers: endRow?.followers ?? metrics.reduce((sum, row) => sum + (row.followers || 0), 0),
      growth,
      growthPct: starts > 0 ? pct(growth, starts, 2) : null,
      reachPct: reachFollowers > 0 ? pct(reach, reachFollowers, 1) : null,
      blockPct: blockFollowers > 0 ? pct(blocks, blockFollowers, 1) : null,
      ready: endRow?.accountsReady ?? 0,
      expected: endRow?.accountsExpected ?? metrics.length,
      lowReach: metrics.filter((row) => row.reachPct !== null && row.reachPct < 80).length,
      highBlock: metrics.filter((row) => row.blockPct !== null && row.blockPct > 10).length,
      zeroGrowth: metrics.filter((row) => row.growth === 0).length,
    };
  }, [dateTo, metrics, stores, summary]);

  const sortedStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = metrics.filter((row) => !q || row.store.toLowerCase().includes(q) || row.oa.toLowerCase().includes(q) || row.id.toLowerCase().includes(q));
    const value = (row: StoreMetric) => sort === "followers" ? row.followers : sort === "reach" ? row.reachPct : sort === "block" ? row.blockPct : row.growth;
    return [...filtered].sort((a, b) => (value(b) ?? Number.NEGATIVE_INFINITY) - (value(a) ?? Number.NEGATIVE_INFINITY));
  }, [metrics, search, sort]);

  const topGrowth = useMemo(() => [...metrics].filter((row) => row.growth !== null && row.growth > 0).sort((a, b) => (b.growth || 0) - (a.growth || 0)).slice(0, 5), [metrics]);
  const dailyRows = useMemo(() => [...summary].reverse(), [summary]);

  if (!authChecked || !user) {
    return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)] md:hidden">{text.opening}</div>;
  }

  return (
    <div className="fixed inset-0 z-[60] flex h-dvh w-full flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--app-text-primary)] md:hidden [--surface:var(--app-surface)] [--surface-elevated:var(--app-surface-subtle)] [--border:var(--app-border)] [--foreground:var(--app-text-primary)] [--muted:var(--app-text-secondary)] [--hover:var(--app-surface-hover)]">
      <header className="shrink-0 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-3 pb-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h1 className="text-xl font-bold tracking-tight">{text.title}</h1><p className="mt-0.5 text-xs text-[var(--app-text-tertiary)]">{formatDateDisplay(dateFrom, language)} – {formatDateDisplay(dateTo, language)}</p></div>
          <button type="button" onClick={() => void loadData(dateFrom, dateTo)} aria-label={text.refresh} title={text.refresh} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-lg">↻</button>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="grid shrink-0 grid-cols-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-1">
            {[7, 14, 30].map((days) => <button key={days} type="button" onClick={() => applyQuickRange(days)} className="min-h-9 rounded-lg px-3 text-xs font-bold active:bg-[var(--app-surface-hover)]">{days}D</button>)}
          </div>
          <div className="min-w-0 flex-1 [&>div]:w-full [&>div>button]:w-full [&>div>button]:justify-between [&>div>button]:px-3">
            <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} readyDates={readyDates} partialDates={partialDates} missingDates={missingDates} language={language} onApply={(from, to) => { setDateFrom(from); setDateTo(to); }} onQuickRange={applyQuickRange} />
          </div>
        </div>
      </header>

      <nav className="grid shrink-0 grid-cols-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
        {([["overview", text.overview], ["stores", text.stores], ["daily", text.daily]] as Array<[MobileTab,string]>).map(([value,label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`min-h-10 rounded-xl text-sm font-semibold ${tab === value ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]" : "text-[var(--app-text-secondary)]"}`}>{label}</button>)}
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && summary.length === 0 && stores.length === 0 ? (
          <div className="space-y-3 p-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-[var(--app-surface-subtle)]" />)}</div>
        ) : error ? (
          <div className="p-8 text-center"><p className="text-sm font-semibold text-[var(--app-danger)]">{error}</p><button onClick={() => void loadData(dateFrom, dateTo)} className="mt-3 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-bold text-white">{text.retry}</button></div>
        ) : tab === "overview" ? (
          <div className="space-y-3 p-3 pb-6">
            <section className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--app-text-secondary)]">{text.totalFollowers}</p><p className="mt-2 text-[34px] font-bold leading-none tracking-tight tabular-nums">{overview.followers.toLocaleString(locale)}</p><p className="mt-2 text-xs text-[var(--app-text-tertiary)]">{overview.ready.toLocaleString(locale)}/{overview.expected.toLocaleString(locale)} {text.storesReady}</p></div><div className={`rounded-full bg-[var(--app-surface-subtle)] px-3 py-1.5 text-sm font-bold ${tone(overview.growth, "growth")}`}>{formatSigned(overview.growth, locale)}</div></div>
              <MiniTrend data={summary} language={language} />
            </section>
            <div className="grid grid-cols-2 gap-3">
              {[{label:text.growth,value:overview.growthPct === null ? "—" : `${overview.growthPct.toFixed(2)}%`,className:tone(overview.growthPct,"growth")},{label:"Reach",value:overview.reachPct === null ? "—" : `${overview.reachPct.toFixed(1)}%`,className:tone(overview.reachPct,"reach")},{label:"Block",value:overview.blockPct === null ? "—" : `${overview.blockPct.toFixed(1)}%`,className:tone(overview.blockPct,"block")},{label:text.dataStores,value:`${overview.ready.toLocaleString(locale)}/${overview.expected.toLocaleString(locale)}`,className:"text-[var(--app-text-primary)]"}].map((item) => <div key={item.label} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4"><p className="text-xs text-[var(--app-text-secondary)]">{item.label}</p><p className={`mt-2 text-2xl font-bold tabular-nums ${item.className}`}>{item.value}</p></div>)}
            </div>
            <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4"><h2 className="text-sm font-bold">{text.attention}</h2><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[var(--app-danger-soft)] p-3"><p className="text-xl font-bold text-[var(--app-danger)]">{overview.lowReach.toLocaleString(locale)}</p><p className="mt-1 text-[10px] text-[var(--app-text-secondary)]">Reach &lt;80%</p></div><div className="rounded-xl bg-[var(--app-warning-soft)] p-3"><p className="text-xl font-bold text-[var(--app-warning)]">{overview.highBlock.toLocaleString(locale)}</p><p className="mt-1 text-[10px] text-[var(--app-text-secondary)]">Block &gt;10%</p></div><div className="rounded-xl bg-[var(--app-neutral-soft)] p-3"><p className="text-xl font-bold">{overview.zeroGrowth.toLocaleString(locale)}</p><p className="mt-1 text-[10px] text-[var(--app-text-secondary)]">{text.noGrowth}</p></div></div></section>
            <section className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]"><div className="border-b border-[var(--app-border)] px-4 py-3"><h2 className="text-sm font-bold">Top growth</h2></div>{topGrowth.length ? topGrowth.map((row,index) => <div key={row.key} className="flex items-center gap-3 border-b border-[var(--app-border-subtle)] px-4 py-3 last:border-b-0"><span className="w-5 text-xs font-bold text-[var(--app-text-tertiary)]">#{index+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{row.store}</p><p className="truncate text-[11px] text-[var(--app-text-tertiary)]">{row.oa}</p></div><span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatSigned(row.growth, locale)}</span></div>) : <p className="p-5 text-center text-sm text-[var(--app-text-tertiary)]">{text.noGrowthData}</p>}</section>
          </div>
        ) : tab === "stores" ? (
          <div className="p-3 pb-6">
            <div className="sticky top-0 z-10 -mx-3 -mt-3 border-b border-[var(--app-border)] bg-[var(--app-bg)]/95 px-3 pb-3 pt-3 backdrop-blur"><input value={search} onChange={(event) => { setSearch(event.target.value); setStoreLimit(30); }} placeholder={text.search} className="h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-base outline-none focus:border-[var(--app-accent)]" /><div className="mt-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">{([["growth","Growth"],["followers","Followers"],["reach","Reach"],["block","Block"]] as Array<[StoreSort,string]>).map(([value,label]) => <button key={value} onClick={() => setSort(value)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${sort === value ? "bg-[var(--app-accent)] text-white" : "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-secondary)]"}`}>{label}</button>)}</div></div>
            <p className="py-3 text-xs text-[var(--app-text-tertiary)]">{sortedStores.length.toLocaleString(locale)} {text.storeUnit}</p>
            <div className="space-y-2.5">{sortedStores.slice(0,storeLimit).map((row,index) => <article key={row.key} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4"><div className="flex items-start gap-3"><span className="mt-0.5 text-xs font-bold text-[var(--app-text-tertiary)]">#{index+1}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold leading-5">{row.store}</p><p className="mt-0.5 truncate text-[11px] text-[var(--app-text-tertiary)]">{row.id} · {row.oa}</p></div><div className="text-right"><p className="text-lg font-bold tabular-nums">{row.followers?.toLocaleString(locale) ?? "—"}</p><p className={`text-xs font-bold ${tone(row.growth,"growth")}`}>{formatSigned(row.growth, locale)}</p></div></div><div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-xl bg-[var(--app-surface-subtle)] p-2.5"><p className="text-[10px] text-[var(--app-text-tertiary)]">Growth</p><p className={`mt-1 text-sm font-bold ${tone(row.growthPct,"growth")}`}>{row.growthPct === null ? "—" : `${row.growthPct.toFixed(2)}%`}</p></div><div className="rounded-xl bg-[var(--app-surface-subtle)] p-2.5"><p className="text-[10px] text-[var(--app-text-tertiary)]">Reach</p><p className={`mt-1 text-sm font-bold ${tone(row.reachPct,"reach")}`}>{row.reachPct === null ? "—" : `${row.reachPct.toFixed(1)}%`}</p></div><div className="rounded-xl bg-[var(--app-surface-subtle)] p-2.5"><p className="text-[10px] text-[var(--app-text-tertiary)]">Block</p><p className={`mt-1 text-sm font-bold ${tone(row.blockPct,"block")}`}>{row.blockPct === null ? "—" : `${row.blockPct.toFixed(1)}%`}</p></div></div></article>)}</div>
            {storeLimit < sortedStores.length && <button onClick={() => setStoreLimit((value) => value + 30)} className="mt-3 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] py-3 text-sm font-bold">{text.showMore}</button>}
          </div>
        ) : (
          <div className="space-y-2.5 p-3 pb-6">{dailyRows.map((row) => { const full = row.accountsExpected > 0 && row.accountsReady === row.accountsExpected; const partial = (row.accountsWithData ?? 0) > 0 && !full; return <article key={row.date} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{formatDateDisplay(row.date,language)}</p><p className="mt-1 text-xs text-[var(--app-text-tertiary)]">{text.data} {row.accountsReady.toLocaleString(locale)}/{row.accountsExpected.toLocaleString(locale)} {text.storeUnit}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${full ? "bg-[var(--app-success-soft)] text-[var(--app-success)]" : partial ? "bg-[var(--app-warning-soft)] text-[var(--app-warning)]" : "bg-[var(--app-danger-soft)] text-[var(--app-danger)]"}`}>{full ? text.ready : partial ? text.partial : text.missing}</span></div><div className="mt-3 flex items-end justify-between"><div><p className="text-[10px] text-[var(--app-text-tertiary)]">Followers</p><p className="mt-1 text-xl font-bold tabular-nums">{row.followers?.toLocaleString(locale) ?? "—"}</p></div><div className="text-right"><p className="text-[10px] text-[var(--app-text-tertiary)]">{text.dailyIncrease}</p><p className={`mt-1 text-base font-bold ${tone(row.dailyIncrease,"growth")}`}>{formatSigned(row.dailyIncrease, locale)}</p></div></div></article>; })}</div>
        )}
      </main>

      <BottomNav onMore={() => setMoreOpen(true)} language={language} />
      {moreOpen && <MoreSheet user={user} onClose={() => setMoreOpen(false)} language={language} />}
    </div>
  );
}
