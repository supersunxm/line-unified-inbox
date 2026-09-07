"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageContainer } from "@/components/shell";
import { useAppLanguage } from "../language";
import type { TikTokPublicDashboardOverview, TikTokPublicDashboardStore } from "./tiktok-public-api";

type Props = {
  overview: TikTokPublicDashboardOverview;
  stores: TikTokPublicDashboardStore[];
};

const previewStores: TikTokPublicDashboardStore[] = [
  {
    storeMasterId: "preview-kanchanaburi",
    storeName: "OBS Big C Kanchanaburi By VTEC",
    accountName: "OPPO Brand Shop",
    province: "Kanchanaburi",
    region: "WEST",
    username: "o_bigckanchanaburi",
    displayName: "OPPO Big C Kanchanaburi",
    avatarUrl: null,
    bioDescription: null,
    isVerified: false,
    followerCount: 19503,
    followingCount: 71,
    likesCount: 135625,
    videoCount: 400,
    profileUrl: "https://www.tiktok.com/@o_bigckanchanaburi",
    lastFetchedAt: "2026-09-07T10:00:00.000Z",
    growth: {
      daily: { absolute: 32, percent: 0.16 },
      sevenDay: { absolute: 241, percent: 1.25 },
      thirtyDay: { absolute: 904, percent: 4.86 },
    },
  },
  {
    storeMasterId: "preview-lopburi",
    storeName: "OBS Big C Lopburi By J.I.",
    accountName: "OPPO Brand Shop",
    province: "Lopburi",
    region: "CENTRAL",
    username: "o_bigclopburi",
    displayName: "OPPO Big C Lopburi",
    avatarUrl: null,
    bioDescription: null,
    isVerified: false,
    followerCount: 10146,
    followingCount: 115,
    likesCount: 83072,
    videoCount: 509,
    profileUrl: "https://www.tiktok.com/@o_bigclopburi",
    lastFetchedAt: "2026-09-07T10:00:00.000Z",
    growth: {
      daily: { absolute: 18, percent: 0.18 },
      sevenDay: { absolute: 176, percent: 1.76 },
      thirtyDay: { absolute: 622, percent: 6.53 },
    },
  },
  {
    storeMasterId: "preview-rama4",
    storeName: "OBS Big C Rama 4 By K K Mobile",
    accountName: "OPPO Brand Shop",
    province: "Bangkok",
    region: "BANGKOK",
    username: "oppobigcrama4",
    displayName: "OPPO Big C Rama 4",
    avatarUrl: null,
    bioDescription: null,
    isVerified: false,
    followerCount: 9236,
    followingCount: 101,
    likesCount: 49621,
    videoCount: 119,
    profileUrl: "https://www.tiktok.com/@oppobigcrama4",
    lastFetchedAt: "2026-09-07T10:00:00.000Z",
    growth: {
      daily: { absolute: 11, percent: 0.12 },
      sevenDay: { absolute: 93, percent: 1.02 },
      thirtyDay: { absolute: 314, percent: 3.52 },
    },
  },
  {
    storeMasterId: "preview-nakhonpathom",
    storeName: "OBS Big C Nakhon Pathom FL.1 By Com7",
    accountName: "OPPO Brand Shop",
    province: "Nakhon Pathom",
    region: "CENTRAL",
    username: "o_bigcnakhonpathom",
    displayName: "OPPO Big C Nakhon Pathom",
    avatarUrl: null,
    bioDescription: null,
    isVerified: false,
    followerCount: 6507,
    followingCount: 175,
    likesCount: 42368,
    videoCount: 479,
    profileUrl: "https://www.tiktok.com/@o_bigcnakhonpathom",
    lastFetchedAt: "2026-09-07T10:00:00.000Z",
    growth: {
      daily: { absolute: -4, percent: -0.06 },
      sevenDay: { absolute: 61, percent: 0.95 },
      thirtyDay: { absolute: 204, percent: 3.24 },
    },
  },
  {
    storeMasterId: "preview-suwinthawong",
    storeName: "OBS Big C Suwinthawong FL.2 By Phechduang",
    accountName: "OPPO Brand Shop",
    province: "Bangkok",
    region: "BANGKOK",
    username: "o_bigcsuwinthawong",
    displayName: "OPPO Big C Suwinthawong",
    avatarUrl: null,
    bioDescription: null,
    isVerified: false,
    followerCount: 6245,
    followingCount: 540,
    likesCount: 56399,
    videoCount: 240,
    profileUrl: "https://www.tiktok.com/@o_bigcsuwinthawong",
    lastFetchedAt: "2026-09-07T10:00:00.000Z",
    growth: {
      daily: { absolute: 7, percent: 0.11 },
      sevenDay: { absolute: 54, percent: 0.87 },
      thirtyDay: { absolute: 188, percent: 3.1 },
    },
  },
];

function number(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function compact(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function growth(value: number | null, locale: string) {
  if (value === null) return "—";
  const formatted = number(Math.abs(value), locale);
  return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : "0";
}

function GrowthPill({ value, locale }: { value: number | null; locale: string }) {
  const className = value === null
    ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
    : value > 0
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
      : value < 0
        ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  return <span className={`inline-flex min-w-14 justify-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${className}`}>{growth(value, locale)}</span>;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-slate-900">
      <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-slate-100/70 dark:bg-white/[0.03]" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">{value}</p>
        <p className="mt-2 text-xs text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

export function TikTokPublicDashboard({ overview, stores }: Props) {
  const { language } = useAppLanguage();
  const locale = language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-US";
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("ALL");
  const [sort, setSort] = useState("followers");

  const isPreview = process.env.NODE_ENV !== "production" && stores.length === 0;
  const sourceStores = isPreview ? previewStores : stores;
  const sourceOverview = isPreview
    ? {
        trackedStores: 148,
        totalFollowers: previewStores.reduce((sum, store) => sum + store.followerCount, 0),
        totalLikes: previewStores.reduce((sum, store) => sum + store.likesCount, 0),
        totalVideos: previewStores.reduce((sum, store) => sum + store.videoCount, 0),
        lastUpdatedAt: previewStores[0]?.lastFetchedAt ?? null,
      }
    : overview;

  const regions = useMemo(() => Array.from(new Set(sourceStores.map((store) => store.region).filter(Boolean) as string[])).sort(), [sourceStores]);
  const visibleStores = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = sourceStores.filter((store) => {
      const matchesQuery = !needle || [store.storeName, store.accountName, store.username, store.province ?? "", store.region ?? ""]
        .some((value) => value.toLowerCase().includes(needle));
      return matchesQuery && (region === "ALL" || store.region === region);
    });
    return [...filtered].sort((a, b) => {
      if (sort === "growth7d") return (b.growth.sevenDay.absolute ?? -Infinity) - (a.growth.sevenDay.absolute ?? -Infinity);
      if (sort === "likes") return b.likesCount - a.likesCount;
      if (sort === "videos") return b.videoCount - a.videoCount;
      return b.followerCount - a.followerCount;
    });
  }, [sourceStores, query, region, sort]);

  const leaders = useMemo(() => [...sourceStores].sort((a, b) => b.followerCount - a.followerCount).slice(0, 5), [sourceStores]);
  const totalFollowersShown = sourceStores.reduce((sum, store) => sum + store.followerCount, 0);

  const text = language === "th" ? {
    eyebrow: "RETAIL SOCIAL INTELLIGENCE",
    title: "TikTok Analytics",
    subtitle: "ดูภาพรวมการเติบโตของ TikTok ทุกสาขา จากตัวเลข Exact ของ Public Profile",
    preview: "Preview Mode — ใช้ข้อมูลตัวอย่างจาก Dry Run เพื่อดูหน้าตาเท่านั้น ยังไม่ได้บันทึกลงฐานข้อมูล",
    tracked: "สาขาที่มี TikTok",
    followers: "Followers ที่แสดง",
    likes: "Likes ที่แสดง",
    videos: "Videos ที่แสดง",
    exact: "Exact metrics only · statsV2",
    ranking: "Top stores",
    rankingSub: "เรียงตามจำนวน Followers",
    storePerformance: "Store performance",
    storePerformanceSub: "ค้นหา กรอง และเปรียบเทียบการเติบโตของแต่ละสาขา",
    search: "ค้นหาร้าน, username หรือจังหวัด",
    allRegions: "ทุกภูมิภาค",
    sortBy: "เรียงตาม",
    followerSort: "Followers",
    growthSort: "Growth 7 วัน",
    likesSort: "Likes",
    videosSort: "Videos",
    store: "สาขา",
    daily: "วันนี้",
    seven: "7 วัน",
    thirty: "30 วัน",
    updated: "อัปเดตล่าสุด",
    noData: "ยังไม่มีข้อมูล Public TikTok ของสาขา",
    open: "ดูรายละเอียด",
  } : {
    eyebrow: "RETAIL SOCIAL INTELLIGENCE",
    title: "TikTok Analytics",
    subtitle: "Track store-level TikTok growth using exact public profile metrics.",
    preview: "Preview Mode — sample dry-run data for UI preview only. Nothing has been persisted yet.",
    tracked: "TikTok stores",
    followers: "Shown followers",
    likes: "Shown likes",
    videos: "Shown videos",
    exact: "Exact metrics only · statsV2",
    ranking: "Top stores",
    rankingSub: "Ranked by follower count",
    storePerformance: "Store performance",
    storePerformanceSub: "Search, filter and compare store growth",
    search: "Search store, username or province",
    allRegions: "All regions",
    sortBy: "Sort by",
    followerSort: "Followers",
    growthSort: "7D growth",
    likesSort: "Likes",
    videosSort: "Videos",
    store: "Store",
    daily: "Today",
    seven: "7 days",
    thirty: "30 days",
    updated: "Last updated",
    noData: "No public TikTok profile data yet",
    open: "View details",
  };

  return (
    <PageContainer variant="wide">
      <div className="space-y-6 pb-8">
        <section className="relative overflow-hidden rounded-[32px] border border-black/[0.06] bg-slate-950 px-6 py-8 text-white shadow-[0_22px_70px_rgba(15,23,42,0.14)] sm:px-8 lg:px-10">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.05] blur-2xl" />
          <div className="absolute -bottom-28 right-36 h-64 w-64 rounded-full bg-emerald-400/[0.08] blur-3xl" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold tracking-[0.18em] text-white/45">{text.eyebrow}</p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-4xl lg:text-5xl">{text.title}</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/60 sm:text-base">{text.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 font-semibold text-white/75">{text.exact}</span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 font-semibold text-emerald-300">{number(sourceOverview.trackedStores, locale)} stores</span>
            </div>
          </div>
        </section>

        {isPreview && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            {text.preview}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={text.tracked} value={number(sourceOverview.trackedStores, locale)} detail="StoreMaster coverage" />
          <MetricCard label={text.followers} value={compact(totalFollowersShown, locale)} detail={`${number(totalFollowersShown, locale)} followers`} />
          <MetricCard label={text.likes} value={compact(sourceOverview.totalLikes, locale)} detail={`${number(sourceOverview.totalLikes, locale)} likes`} />
          <MetricCard label={text.videos} value={number(sourceOverview.totalVideos, locale)} detail="Public profile total" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.7fr]">
          <div className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">{text.ranking}</h2>
                <p className="mt-1 text-xs text-slate-400">{text.rankingSub}</p>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Top 5</span>
            </div>
            <div className="mt-5 space-y-1.5">
              {leaders.map((store, index) => (
                <Link key={store.storeMasterId} href={isPreview ? "#" : `/tiktok/stores/${encodeURIComponent(store.storeMasterId)}`} className="group flex items-center gap-3 rounded-2xl px-2 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${index === 0 ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{store.storeName}</p>
                    <p className="truncate text-xs text-slate-400">@{store.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-slate-950 dark:text-white">{compact(store.followerCount, locale)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-300">followers</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-black/[0.06] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-5 dark:border-white/[0.06]">
              <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">{text.storePerformance}</h2>
              <p className="mt-1 text-xs text-slate-400">{text.storePerformanceSub}</p>
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                <select value={region} onChange={(event) => setRegion(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  <option value="ALL">{text.allRegions}</option>
                  {regions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  <option value="followers">{text.sortBy}: {text.followerSort}</option>
                  <option value="growth7d">{text.sortBy}: {text.growthSort}</option>
                  <option value="likes">{text.sortBy}: {text.likesSort}</option>
                  <option value="videos">{text.sortBy}: {text.videosSort}</option>
                </select>
              </div>
            </div>

            {visibleStores.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">{text.noData}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[930px] text-sm">
                  <thead className="text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    <tr className="border-b border-slate-100 dark:border-white/[0.06]">
                      <th className="px-5 py-3">{text.store}</th>
                      <th className="px-4 py-3 text-right">Followers</th>
                      <th className="px-4 py-3 text-right">Likes</th>
                      <th className="px-4 py-3 text-right">Videos</th>
                      <th className="px-4 py-3 text-center">{text.daily}</th>
                      <th className="px-4 py-3 text-center">{text.seven}</th>
                      <th className="px-4 py-3 text-center">{text.thirty}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {visibleStores.map((store) => (
                      <tr key={store.storeMasterId} className="group transition hover:bg-slate-50/80 dark:hover:bg-white/[0.025]">
                        <td className="px-5 py-4">
                          <Link href={isPreview ? "#" : `/tiktok/stores/${encodeURIComponent(store.storeMasterId)}`} className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 text-sm font-black text-white dark:bg-white dark:text-slate-950">
                              {store.avatarUrl ? <img src={store.avatarUrl} alt="" className="h-full w-full object-cover" /> : "T"}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-900 dark:text-slate-100">{store.storeName}</div>
                              <div className="mt-0.5 truncate text-xs text-slate-400">@{store.username}{store.region ? ` · ${store.region}` : ""}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">{number(store.followerCount, locale)}</td>
                        <td className="px-4 py-4 text-right tabular-nums text-slate-500">{number(store.likesCount, locale)}</td>
                        <td className="px-4 py-4 text-right tabular-nums text-slate-500">{number(store.videoCount, locale)}</td>
                        <td className="px-4 py-4 text-center"><GrowthPill value={store.growth.daily.absolute} locale={locale} /></td>
                        <td className="px-4 py-4 text-center"><GrowthPill value={store.growth.sevenDay.absolute} locale={locale} /></td>
                        <td className="px-4 py-4 text-center"><GrowthPill value={store.growth.thirtyDay.absolute} locale={locale} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
