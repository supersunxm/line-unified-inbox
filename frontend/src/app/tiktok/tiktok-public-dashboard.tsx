"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { PageContainer } from "@/components/shell";
import { useAppLanguage } from "../language";
import type { TikTokPublicDashboardOverview, TikTokPublicDashboardStore } from "./tiktok-public-api";
import { formatDashboardTimestamp } from "./tiktok-public-timestamp";

type Props = {
  overview: TikTokPublicDashboardOverview;
  stores: TikTokPublicDashboardStore[];
};

type MetricIcon = "stores" | "followers" | "likes" | "videos";

function number(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function compact(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function signed(value: number, locale: string) {
  if (value === 0) return "0";
  const formatted = number(Math.abs(value), locale);
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

function growth(value: number | null, locale: string) {
  if (value === null) return "—";
  return signed(value, locale);
}

function GrowthPill({ value, locale }: { value: number | null; locale: string }) {
  const className = value === null
    ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
    : value > 0
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
      : value < 0
        ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  return (
    <span className={`inline-flex min-w-16 justify-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${className}`}>
      {growth(value, locale)}
    </span>
  );
}

function MetricIconGlyph({ type }: { type: MetricIcon }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      {type === "stores" && (
        <>
          <path {...common} d="M4 9h16l-1.5-4h-13L4 9Z" />
          <path {...common} d="M5 10v9h14v-9" />
          <path {...common} d="M8 19v-5h8v5" />
        </>
      )}
      {type === "followers" && (
        <>
          <circle {...common} cx="9" cy="8" r="3.2" />
          <path {...common} d="M3.5 19c.6-4 2.6-6 5.5-6 2.2 0 4 1.2 4.9 3.4" />
          <path {...common} d="M16 9h5m-2.5-2.5v5" />
          <path {...common} d="M16 19c.3-2.8 1.7-4.4 4-4.8" />
        </>
      )}
      {type === "likes" && (
        <path {...common} d="M20.8 5.9c-2.1-2.1-5.4-2.1-7.5 0L12 7.2l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 22l8.8-8.6a5.3 5.3 0 0 0 0-7.5Z" />
      )}
      {type === "videos" && (
        <>
          <rect {...common} x="3" y="5" width="18" height="14" rx="3" />
          <path {...common} d="m10 9 5 3-5 3V9Z" />
        </>
      )}
    </svg>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  growthText,
}: {
  icon: MetricIcon;
  label: string;
  value: string;
  detail: string;
  growthText?: string | null;
}) {
  const iconClass = {
    stores: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
    followers: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    likes: "bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300",
    videos: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
  }[icon];

  return (
    <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.045)] dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}>
          <MetricIconGlyph type={icon} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-3xl font-black tracking-[-0.035em] text-slate-950 dark:text-white">{value}</p>
          {growthText ? (
            <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              {growthText}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-slate-400">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function TikTokPublicDashboard({ overview, stores }: Props) {
  const { language } = useAppLanguage();
  const locale = language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-US";
  const router = useRouter();
  const timestampLabel = formatDashboardTimestamp(overview.latestMetricDate, overview.lastUpdatedAt, locale, language);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("ALL");
  const [province, setProvince] = useState("ALL");
  const [sort, setSort] = useState("followers");
  const [isRefreshing, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const regions = useMemo(
    () => Array.from(new Set(stores.map((store) => store.region).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, locale)),
    [stores, locale],
  );

  const provinces = useMemo(() => {
    const source = region === "ALL" ? stores : stores.filter((store) => store.region === region);
    return Array.from(new Set(source.map((store) => store.province).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, locale));
  }, [stores, region, locale]);

  const visibleStores = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = stores.filter((store) => {
      const matchesQuery = !needle || [store.storeName, store.accountName, store.username, store.province ?? "", store.region ?? ""]
        .some((value) => value.toLowerCase().includes(needle));
      const matchesRegion = region === "ALL" || store.region === region;
      const matchesProvince = province === "ALL" || store.province === province;
      return matchesQuery && matchesRegion && matchesProvince;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "growth1d") {
        const aVal = a.growth.daily.absolute;
        const bVal = b.growth.daily.absolute;
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        return bVal - aVal;
      }
      if (sort === "growth7d") {
        const aVal = a.growth.sevenDay.absolute;
        const bVal = b.growth.sevenDay.absolute;
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        return bVal - aVal;
      }
      if (sort === "growth30d") {
        const aVal = a.growth.thirtyDay.absolute;
        const bVal = b.growth.thirtyDay.absolute;
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        return bVal - aVal;
      }
      if (sort === "storeName") return a.storeName.localeCompare(b.storeName, locale);
      if (sort === "likes") return b.likesCount - a.likesCount;
      if (sort === "videos") return b.videoCount - a.videoCount;
      return b.followerCount - a.followerCount;
    });
  }, [stores, query, region, province, sort, locale]);

  const leaders = useMemo(() => [...stores].sort((a, b) => b.followerCount - a.followerCount).slice(0, 5), [stores]);
  const totalFollowersShown = stores.reduce((sum, store) => sum + store.followerCount, 0);

  const dailySummary = useMemo(() => {
    const comparable = stores.filter((store) => store.growth.daily.absolute !== null);
    const delta = comparable.reduce((sum, store) => sum + (store.growth.daily.absolute ?? 0), 0);
    const currentComparableFollowers = comparable.reduce((sum, store) => sum + store.followerCount, 0);
    const baselineFollowers = currentComparableFollowers - delta;
    return {
      comparable: comparable.length,
      missing: stores.length - comparable.length,
      delta,
      percent: baselineFollowers > 0 ? (delta / baselineFollowers) * 100 : null,
      gainers: comparable.filter((store) => (store.growth.daily.absolute ?? 0) > 0).length,
      losers: comparable.filter((store) => (store.growth.daily.absolute ?? 0) < 0).length,
      flat: comparable.filter((store) => store.growth.daily.absolute === 0).length,
    };
  }, [stores]);

  const handleDownloadCsv = () => {
    const headers = ["Store", "TikTok", "Region", "Province", "Followers", "Likes", "Videos", "1D", "7D", "30D"];
    const rows = visibleStores.map((store) => [
      store.storeName,
      `@${store.username}`,
      store.region ?? "",
      store.province ?? "",
      store.followerCount,
      store.likesCount,
      store.videoCount,
      store.growth.daily.absolute,
      store.growth.sevenDay.absolute,
      store.growth.thirtyDay.absolute,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((value) => csvCell(value)).join(",")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tiktok-store-analytics-${overview.latestMetricDate ?? "latest"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const text = language === "th" ? {
    eyebrow: "OPPO RETAIL",
    title: "TikTok Analytics",
    subtitle: "ติดตามการเติบโตของ TikTok แต่ละสาขา ด้วยข้อมูลจริงจาก Public Profile",
    tracked: "จำนวนสาขา TikTok",
    followers: "ผู้ติดตามรวม",
    likes: "ยอดไลก์รวม",
    videos: "จำนวนวิดีโอรวม",
    exact: "ข้อมูลจริงจาก Public Profile",
    ranking: "Top 5 สาขา",
    rankingSub: "เรียงตามจำนวนผู้ติดตามสูงสุด",
    viewAll: "ดูทั้งหมด",
    dailyOverview: "การเปลี่ยนแปลงผู้ติดตามวันนี้",
    dailyOverviewSub: "คำนวณเฉพาะสาขาที่มีข้อมูลเปรียบเทียบจริง",
    gainers: "เพิ่มขึ้น",
    losers: "ลดลง",
    flat: "คงที่",
    missing: "ยังไม่มี Baseline",
    storePerformance: "รายชื่อสาขาทั้งหมด",
    storePerformanceSub: "ค้นหา กรอง และเปรียบเทียบการเติบโตของแต่ละสาขา",
    search: "ค้นหาชื่อสาขา, @username หรือจังหวัด...",
    allRegions: "ทุกภูมิภาค",
    allProvinces: "ทุกจังหวัด",
    sortBy: "เรียงตาม",
    followerSort: "ผู้ติดตามสูงสุด",
    growth1dSort: "การเติบโต 1 วัน",
    growthSort: "การเติบโต 7 วัน",
    growth30dSort: "การเติบโต 30 วัน",
    storeNameSort: "ชื่อสาขา (ก-ฮ)",
    likesSort: "ยอดไลก์",
    videosSort: "จำนวนวิดีโอ",
    store: "สาขา",
    tiktok: "TikTok",
    daily: "การเติบโต (1 วัน)",
    seven: "การเติบโต (7 วัน)",
    thirty: "การเติบโต (30 วัน)",
    noData: "ไม่พบข้อมูลสาขาตามเงื่อนไขที่เลือก",
    open: "ดูรายละเอียด",
    download: "ดาวน์โหลดข้อมูล",
    refresh: "รีเฟรชข้อมูล",
    result: "สาขาที่แสดง",
    followersWord: "ผู้ติดตาม",
    baselineCoverage: "สาขามี Baseline วันนี้",
  } : {
    eyebrow: "OPPO RETAIL",
    title: "TikTok Analytics",
    subtitle: "Track store-level TikTok growth using exact public profile metrics.",
    tracked: "TikTok stores",
    followers: "Total followers",
    likes: "Total likes",
    videos: "Total videos",
    exact: "Exact public profile data",
    ranking: "Top 5 stores",
    rankingSub: "Ranked by follower count",
    viewAll: "View all",
    dailyOverview: "Today's follower movement",
    dailyOverviewSub: "Calculated only from stores with a real comparison baseline",
    gainers: "Gained",
    losers: "Declined",
    flat: "No change",
    missing: "No baseline",
    storePerformance: "All stores",
    storePerformanceSub: "Search, filter and compare store growth",
    search: "Search store, @username or province...",
    allRegions: "All regions",
    allProvinces: "All provinces",
    sortBy: "Sort by",
    followerSort: "Most followers",
    growth1dSort: "1D growth",
    growthSort: "7D growth",
    growth30dSort: "30D growth",
    storeNameSort: "Store name (A-Z)",
    likesSort: "Likes",
    videosSort: "Videos",
    store: "Store",
    tiktok: "TikTok",
    daily: "1D growth",
    seven: "7D growth",
    thirty: "30D growth",
    noData: "No stores match the selected filters",
    open: "View details",
    download: "Download data",
    refresh: "Refresh",
    result: "stores shown",
    followersWord: "followers",
    baselineCoverage: "stores have today's baseline",
  };

  const dailyGrowthText = dailySummary.comparable > 0
    ? `${signed(dailySummary.delta, locale)}${dailySummary.percent === null ? "" : ` (${dailySummary.percent >= 0 ? "+" : ""}${dailySummary.percent.toFixed(2)}%)`}`
    : null;

  return (
    <PageContainer variant="wide" className="bg-slate-50/70 dark:bg-slate-950/20">
      <div className="space-y-5 pb-10">
        <section className="relative overflow-hidden rounded-[28px] bg-[#07111f] px-6 py-7 text-white shadow-[0_20px_60px_rgba(15,23,42,0.16)] sm:px-8 lg:px-9">
          <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-blue-400/[0.08] blur-3xl" />
          <div className="absolute -bottom-28 right-72 h-64 w-64 rounded-full bg-emerald-400/[0.08] blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] sm:flex">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 text-white">
                  <path d="M13 4v10a4.5 4.5 0 1 1-4-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13 4c1.6 2.8 3.7 4 6 4.3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.18em] text-white/45">{text.eyebrow}</p>
                <h1 className="mt-1 text-3xl font-black tracking-[-0.045em] sm:text-4xl">{text.title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">{text.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {timestampLabel && (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 font-medium text-white/70">
                  {timestampLabel}
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 font-semibold text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {text.exact}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 font-semibold text-white/75">
                {number(overview.trackedStores, locale)} stores
              </span>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 transition hover:bg-white/[0.12] disabled:opacity-50"
                aria-label={text.refresh}
                title={text.refresh}
              >
                <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon="stores"
            label={text.tracked}
            value={number(overview.trackedStores, locale)}
            detail="StoreMaster coverage"
          />
          <MetricCard
            icon="followers"
            label={text.followers}
            value={number(totalFollowersShown, locale)}
            growthText={dailyGrowthText}
            detail={`${dailySummary.comparable}/${stores.length} ${text.baselineCoverage}`}
          />
          <MetricCard
            icon="likes"
            label={text.likes}
            value={number(overview.totalLikes, locale)}
            detail={`${compact(overview.totalLikes, locale)} likes`}
          />
          <MetricCard
            icon="videos"
            label={text.videos}
            value={number(overview.totalVideos, locale)}
            detail="Public profile total"
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.045)] dark:border-white/10 dark:bg-slate-900 sm:p-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">{text.dailyOverview}</h2>
              <p className="mt-1 text-xs text-slate-400">{text.dailyOverviewSub}</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{text.gainers}</div>
                <div className="mt-2 text-3xl font-black text-emerald-700 dark:text-emerald-200">{number(dailySummary.gainers, locale)}</div>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4 dark:bg-rose-500/10">
                <div className="text-xs font-semibold text-rose-700 dark:text-rose-300">{text.losers}</div>
                <div className="mt-2 text-3xl font-black text-rose-700 dark:text-rose-200">{number(dailySummary.losers, locale)}</div>
              </div>
              <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">{text.flat}</div>
                <div className="mt-2 text-3xl font-black text-slate-800 dark:text-slate-100">{number(dailySummary.flat, locale)}</div>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-500/10">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">{text.missing}</div>
                <div className="mt-2 text-3xl font-black text-amber-700 dark:text-amber-200">{number(dailySummary.missing, locale)}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-white/[0.06] dark:bg-slate-950/60">
              <div>
                <div className="text-xs text-slate-400">{text.followers}</div>
                <div className="mt-1 text-xl font-black tabular-nums text-slate-950 dark:text-white">
                  {dailyGrowthText ?? "—"}
                </div>
              </div>
              <div className="text-right text-xs text-slate-400">
                {number(dailySummary.comparable, locale)} / {number(stores.length, locale)} {text.baselineCoverage}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.045)] dark:border-white/10 dark:bg-slate-900 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">{text.ranking}</h2>
                <p className="mt-1 text-xs text-slate-400">{text.rankingSub}</p>
              </div>
              <a href="#tiktok-all-stores" className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300">
                {text.viewAll} →
              </a>
            </div>

            <div className="mt-4 divide-y divide-slate-100 dark:divide-white/[0.06]">
              {leaders.map((store, index) => (
                <Link
                  key={store.storeMasterId}
                  href={`/tiktok/stores/${encodeURIComponent(store.storeMasterId)}`}
                  className="group flex items-center gap-3 py-3.5"
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 0 ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"}`}>
                    {index + 1}
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-black text-slate-500 dark:bg-slate-800">
                    {store.avatarUrl ? <img src={store.avatarUrl} alt="" className="h-full w-full object-cover" /> : "T"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{store.storeName}</p>
                    <p className="truncate text-xs text-slate-400">@{store.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black tabular-nums text-slate-950 dark:text-white">{compact(store.followerCount, locale)}</p>
                    <p className="text-[10px] text-slate-400">{text.followersWord}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="tiktok-all-stores" className="scroll-mt-20 overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.045)] dark:border-white/10 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-5 dark:border-white/[0.06] sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">{text.storePerformance}</h2>
                <p className="mt-1 text-xs text-slate-400">{text.storePerformanceSub}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {number(visibleStores.length, locale)} {text.result}
                </span>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                    <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {text.download}
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {text.refresh}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(280px,1.5fr)_0.7fr_0.7fr_0.9fr]">
              <label className="relative block">
                <span className="sr-only">{text.search}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <circle cx="11" cy="11" r="6" />
                  <path d="m16 16 4 4" strokeLinecap="round" />
                </svg>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={text.search}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-500/10"
                />
              </label>

              <select
                value={region}
                onChange={(event) => {
                  setRegion(event.target.value);
                  setProvince("ALL");
                }}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="ALL">{text.allRegions}</option>
                {regions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>

              <select
                value={province}
                onChange={(event) => setProvince(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="ALL">{text.allProvinces}</option>
                {provinces.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>

              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="followers">{text.sortBy}: {text.followerSort}</option>
                <option value="growth1d">{text.sortBy}: {text.growth1dSort}</option>
                <option value="growth7d">{text.sortBy}: {text.growthSort}</option>
                <option value="growth30d">{text.sortBy}: {text.growth30dSort}</option>
                <option value="storeName">{text.sortBy}: {text.storeNameSort}</option>
                <option value="likes">{text.sortBy}: {text.likesSort}</option>
                <option value="videos">{text.sortBy}: {text.videosSort}</option>
              </select>
            </div>
          </div>

          {visibleStores.length === 0 ? (
            <div className="p-14 text-center text-sm text-slate-400">{text.noData}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-slate-50/80 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:bg-slate-950/60">
                  <tr className="border-b border-slate-100 dark:border-white/[0.06]">
                    <th className="w-12 px-4 py-3 text-center">#</th>
                    <th className="px-4 py-3">{text.store}</th>
                    <th className="px-4 py-3">{text.tiktok}</th>
                    <th className="px-4 py-3 text-right">Followers</th>
                    <th className="px-4 py-3 text-right">Likes</th>
                    <th className="px-4 py-3 text-right">Videos</th>
                    <th className="px-4 py-3 text-center">{text.daily}</th>
                    <th className="px-4 py-3 text-center">{text.seven}</th>
                    <th className="px-4 py-3 text-center">{text.thirty}</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {visibleStores.map((store, index) => (
                    <tr key={store.storeMasterId} className="group transition hover:bg-blue-50/30 dark:hover:bg-white/[0.025]">
                      <td className="px-4 py-4 text-center text-xs font-semibold text-slate-400">{index + 1}</td>
                      <td className="px-4 py-4">
                        <Link href={`/tiktok/stores/${encodeURIComponent(store.storeMasterId)}`} className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-black text-slate-500 dark:bg-slate-800">
                            {store.avatarUrl ? <img src={store.avatarUrl} alt="" className="h-full w-full object-cover" /> : "T"}
                          </div>
                          <div className="min-w-0">
                            <div className="max-w-[320px] truncate font-semibold text-slate-900 dark:text-slate-100">{store.storeName}</div>
                            <div className="mt-0.5 truncate text-xs text-slate-400">
                              {[store.province, store.region].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <a
                          href={store.profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-600 hover:underline dark:text-blue-300"
                        >
                          @{store.username} ↗
                        </a>
                      </td>
                      <td className="px-4 py-4 text-right font-black tabular-nums text-slate-900 dark:text-slate-100">{number(store.followerCount, locale)}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-slate-500">{number(store.likesCount, locale)}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-slate-500">{number(store.videoCount, locale)}</td>
                      <td className="px-4 py-4 text-center"><GrowthPill value={store.growth.daily.absolute} locale={locale} /></td>
                      <td className="px-4 py-4 text-center"><GrowthPill value={store.growth.sevenDay.absolute} locale={locale} /></td>
                      <td className="px-4 py-4 text-center"><GrowthPill value={store.growth.thirtyDay.absolute} locale={locale} /></td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/tiktok/stores/${encodeURIComponent(store.storeMasterId)}`}
                          className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {text.open} →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
