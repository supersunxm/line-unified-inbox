"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/shell";
import { useAppLanguage } from "../language";
import type { TikTokPublicDashboardOverview, TikTokPublicDashboardStore } from "./tiktok-public-api";

type Props = {
  overview: TikTokPublicDashboardOverview;
  stores: TikTokPublicDashboardStore[];
};

function number(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function growth(value: number | null, locale: string) {
  if (value === null) return "—";
  const formatted = number(Math.abs(value), locale);
  return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : "0";
}

function GrowthPill({ value, locale }: { value: number | null; locale: string }) {
  const className = value === null
    ? "bg-[var(--app-surface-subtle)] text-[var(--app-text-tertiary)]"
    : value > 0
      ? "bg-[var(--app-success-soft)] text-[var(--app-success)]"
      : value < 0
        ? "bg-[var(--app-danger-soft)] text-[var(--app-danger)]"
        : "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)]";
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${className}`}>{growth(value, locale)}</span>;
}

export function TikTokPublicDashboard({ overview, stores }: Props) {
  const { language } = useAppLanguage();
  const locale = language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-US";
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("ALL");
  const [sort, setSort] = useState("followers");

  const regions = useMemo(() => Array.from(new Set(stores.map((store) => store.region).filter(Boolean) as string[])).sort(), [stores]);
  const visibleStores = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = stores.filter((store) => {
      const matchesQuery = !needle || [store.storeName, store.accountName, store.username, store.province ?? "", store.region ?? ""]
        .some((value) => value.toLowerCase().includes(needle));
      return matchesQuery && (region === "ALL" || store.region === region);
    });
    return [...filtered].sort((a, b) => {
      if (sort === "growth7d") return (b.growth.sevenDay.percent ?? -Infinity) - (a.growth.sevenDay.percent ?? -Infinity);
      if (sort === "likes") return b.likesCount - a.likesCount;
      if (sort === "videos") return b.videoCount - a.videoCount;
      return b.followerCount - a.followerCount;
    });
  }, [stores, query, region, sort]);

  const text = language === "th" ? {
    title: "TikTok Analytics",
    subtitle: "ข้อมูล Public Profile ของสาขา ใช้ตัวเลข Exact จาก TikTok",
    tracked: "สาขาที่มีข้อมูล",
    followers: "ผู้ติดตามรวม",
    likes: "ยอดไลก์รวม",
    videos: "วิดีโอรวม",
    search: "ค้นหาร้าน / Username / จังหวัด",
    allRegions: "ทุกภูมิภาค",
    ranking: "เรียงตาม",
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
  } : {
    title: "TikTok Analytics",
    subtitle: "Public store profile analytics using exact TikTok metrics",
    tracked: "Tracked stores",
    followers: "Total followers",
    likes: "Total likes",
    videos: "Total videos",
    search: "Search store / username / province",
    allRegions: "All regions",
    ranking: "Sort by",
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
  };

  return (
    <PageContainer variant="wide">
      <PageHeader title={text.title} description={text.subtitle} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [text.tracked, overview.trackedStores],
          [text.followers, overview.totalFollowers],
          [text.likes, overview.totalLikes],
          [text.videos, overview.totalVideos],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)]">
            <div className="text-xs font-medium text-[var(--app-text-tertiary)]">{label}</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-[var(--app-text-primary)]">{number(Number(value), locale)}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)]">
        <div className="flex flex-col gap-3 border-b border-[var(--app-border-subtle)] p-4 lg:flex-row lg:items-center">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} className="h-10 flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--app-accent)]/30" />
          <select value={region} onChange={(event) => setRegion(event.target.value)} className="h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-sm">
            <option value="ALL">{text.allRegions}</option>
            {regions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-sm">
            <option value="followers">{text.ranking}: {text.followerSort}</option>
            <option value="growth7d">{text.ranking}: {text.growthSort}</option>
            <option value="likes">{text.ranking}: {text.likesSort}</option>
            <option value="videos">{text.ranking}: {text.videosSort}</option>
          </select>
        </div>

        {visibleStores.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--app-text-tertiary)]">{text.noData}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[var(--app-surface-subtle)] text-left text-xs text-[var(--app-text-tertiary)]">
                <tr><th className="px-4 py-3">{text.store}</th><th className="px-4 py-3 text-right">Followers</th><th className="px-4 py-3 text-right">Likes</th><th className="px-4 py-3 text-right">Videos</th><th className="px-4 py-3 text-center">{text.daily}</th><th className="px-4 py-3 text-center">{text.seven}</th><th className="px-4 py-3 text-center">{text.thirty}</th><th className="px-4 py-3">{text.updated}</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border-subtle)]">
                {visibleStores.map((store) => (
                  <tr key={store.storeMasterId} className="hover:bg-[var(--app-surface-hover)]">
                    <td className="px-4 py-3"><Link href={`/tiktok/stores/${encodeURIComponent(store.storeMasterId)}`} className="flex items-center gap-3"><div className="h-10 w-10 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]">{store.avatarUrl ? <img src={store.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-bold">T</div>}</div><div><div className="font-semibold text-[var(--app-text-primary)]">{store.storeName}</div><div className="text-xs text-[var(--app-text-tertiary)]">@{store.username}{store.region ? ` · ${store.region}` : ""}</div></div></Link></td>
                    <td className="px-4 py-3 text-right font-semibold">{number(store.followerCount, locale)}</td>
                    <td className="px-4 py-3 text-right">{number(store.likesCount, locale)}</td>
                    <td className="px-4 py-3 text-right">{number(store.videoCount, locale)}</td>
                    <td className="px-4 py-3 text-center"><GrowthPill value={store.growth.daily.absolute} locale={locale} /></td>
                    <td className="px-4 py-3 text-center"><GrowthPill value={store.growth.sevenDay.absolute} locale={locale} /></td>
                    <td className="px-4 py-3 text-center"><GrowthPill value={store.growth.thirtyDay.absolute} locale={locale} /></td>
                    <td className="px-4 py-3 text-xs text-[var(--app-text-tertiary)]">{new Date(store.lastFetchedAt).toLocaleString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
