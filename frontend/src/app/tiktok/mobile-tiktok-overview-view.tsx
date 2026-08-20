"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { api } from "@/lib/api";
import type {
  TikTokAccountListItem,
  TikTokAccountMetricsGrowthSummary,
  TikTokBulkMetricsSummaryResponse,
  TikTokGrowthPeriod,
  TikTokHistoricalMetricsData,
  TikTokStoreData,
} from "./tiktok-types";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };

type Props = {
  accounts?: TikTokAccountListItem[];
  singleAccountData?: TikTokStoreData | null;
  historicalMetrics?: TikTokHistoricalMetricsData | null;
  bulkMetricsSummary?: TikTokBulkMetricsSummaryResponse | null;
  data?: TikTokStoreData | null;
};

const inputClass = "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3 text-[16px] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]";
const number = new Intl.NumberFormat("en-US");

function compact(value: number | null | undefined) {
  const amount = value ?? 0;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(amount >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return number.format(amount);
}

function growthText(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (value > 0) return `+${number.format(value)}`;
  return number.format(value);
}

function growthTone(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "text-[var(--app-text-tertiary)]";
  return value > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

export function MobileTikTokOverviewView({
  accounts = [],
  singleAccountData,
  historicalMetrics,
  bulkMetricsSummary,
  data,
}: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [period, setPeriod] = useState<TikTokGrowthPeriod>("sevenDays");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("ALL");
  const [province, setProvince] = useState("ALL");
  const [sort, setSort] = useState("storeNameAsc");

  useEffect(() => {
    void api.me().then(setUser).catch(() => undefined);
  }, []);

  const growthMap = useMemo(() => {
    const map = new Map<string, { today: TikTokAccountMetricsGrowthSummary; sevenDays: TikTokAccountMetricsGrowthSummary; thirtyDays: TikTokAccountMetricsGrowthSummary }>();
    for (const item of bulkMetricsSummary?.accounts ?? []) map.set(item.accountId, item.growth);
    return map;
  }, [bulkMetricsSummary]);

  const regions = useMemo(() => [...new Set(accounts.map((item) => item.storeMaster?.region?.trim()).filter((value): value is string => Boolean(value)))].sort(), [accounts]);
  const provinces = useMemo(() => [...new Set(accounts.map((item) => item.storeMaster?.province?.trim()).filter((value): value is string => Boolean(value)))].sort(), [accounts]);

  const growthFor = (account: TikTokAccountListItem) => growthMap.get(account.id)?.[period] ?? { followers: null, following: null, likes: null, videos: null };

  const visibleAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = accounts.filter((account) => {
      if (region !== "ALL" && account.storeMaster?.region !== region) return false;
      if (province !== "ALL" && account.storeMaster?.province !== province) return false;
      if (!query) return true;
      return [account.storeMaster?.storeName, account.storeMaster?.accountName, account.displayName, account.username]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });

    return [...filtered].sort((a, b) => {
      const nameA = a.storeMaster?.storeName || a.displayName || "";
      const nameB = b.storeMaster?.storeName || b.displayName || "";
      if (sort === "followersDesc") return (b.followerCount || 0) - (a.followerCount || 0);
      if (sort === "growthDesc") return (growthFor(b).followers ?? Number.NEGATIVE_INFINITY) - (growthFor(a).followers ?? Number.NEGATIVE_INFINITY);
      if (sort === "likesDesc") return (b.likesCount || 0) - (a.likesCount || 0);
      if (sort === "videosDesc") return (b.videoCountRecorded ?? b.videoCount ?? 0) - (a.videoCountRecorded ?? a.videoCount ?? 0);
      return nameA.localeCompare(nameB);
    });
  }, [accounts, growthMap, period, province, region, search, sort]);

  const effectiveData = singleAccountData || data || null;
  const single = accounts.length === 1 ? accounts[0] : null;
  const profile = effectiveData?.profile;
  const profileName = profile?.display_name || single?.displayName || "TikTok Store Account";
  const username = profile?.username || single?.username || null;
  const avatar = profile?.avatar_large_url || profile?.avatar_url_100 || profile?.avatar_url || single?.avatarLargeUrl || single?.avatarUrl100 || single?.avatarUrl || null;
  const storeMaster = effectiveData?.storeMaster || single?.storeMaster || null;
  const videos = effectiveData?.videos ?? [];
  const followerCount = profile?.follower_count ?? single?.followerCount ?? 0;
  const followingCount = profile?.following_count ?? single?.followingCount ?? 0;
  const likesCount = profile?.likes_count ?? single?.likesCount ?? 0;
  const videoCount = profile?.video_count ?? single?.videoCountRecorded ?? single?.videoCount ?? 0;

  const bottomNav = <MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />;

  if (accounts.length === 0 && !effectiveData) {
    return (
      <MobilePageShell bottomNav={bottomNav}>
        <MobilePageHeader eyebrow="OPPO Retail TikTok Monitor" title="TikTok Store Accounts" description="เชื่อมบัญชี TikTok ของร้านเพื่อดูผู้ติดตามและ Performance" />
        <div className="px-4 py-5"><MobileEmptyState title="ยังไม่มี TikTok Account" description="เชื่อมบัญชีร้านเพื่อเริ่มติดตาม Followers, Likes และ Video Performance" /><Link href="/tiktok/connect" className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-[var(--app-accent)] px-4 text-sm font-bold text-white">Connect TikTok Account</Link></div>
        {moreOpen && user && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
      </MobilePageShell>
    );
  }

  if (accounts.length > 1) {
    const totals = accounts.reduce((acc, account) => ({ followers: acc.followers + (account.followerCount || 0), likes: acc.likes + (account.likesCount || 0), videos: acc.videos + (account.videoCountRecorded ?? account.videoCount ?? 0) }), { followers: 0, likes: 0, videos: 0 });
    return (
      <MobilePageShell bottomNav={bottomNav}>
        <MobilePageHeader eyebrow="TikTok Monitor" title="TikTok Stores" description={`${accounts.length} บัญชีที่เชื่อมอยู่`} action={<Link href="/tiktok/connect" className="flex min-h-10 items-center rounded-xl bg-[var(--app-accent)] px-3 text-[10px] font-bold text-white">+ Connect</Link>} />
        <MobileSectionTabs<TikTokGrowthPeriod> value={period} items={[{ value: "today", label: "วันนี้" }, { value: "sevenDays", label: "7 วัน" }, { value: "thirtyDays", label: "30 วัน" }]} onChange={setPeriod} />
        <div className="space-y-4 px-4 py-4 pb-8">
          <MobileMetricGrid>
            <MobileMetricCard label="Accounts" value={accounts.length} />
            <MobileMetricCard label="Followers" value={compact(totals.followers)} tone="accent" />
            <MobileMetricCard label="Likes" value={compact(totals.likes)} />
            <MobileMetricCard label="Videos" value={compact(totals.videos)} />
          </MobileMetricGrid>

          <MobileCard className="space-y-3">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาร้าน / username" className={inputClass} />
            <div className="grid grid-cols-2 gap-2">
              <select value={region} onChange={(event) => setRegion(event.target.value)} className={inputClass}><option value="ALL">ทุก Region</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={province} onChange={(event) => setProvince(event.target.value)} className={inputClass}><option value="ALL">ทุกจังหวัด</option>{provinces.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            </div>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className={inputClass}><option value="storeNameAsc">เรียงตามชื่อร้าน</option><option value="followersDesc">Followers สูงสุด</option><option value="growthDesc">Follower Growth สูงสุด</option><option value="likesDesc">Likes สูงสุด</option><option value="videosDesc">Videos สูงสุด</option></select>
          </MobileCard>

          <MobileSection title="ร้านค้า" description={`${visibleAccounts.length} ร้าน`}>
            {visibleAccounts.length === 0 ? <MobileEmptyState title="ไม่พบร้าน" description="ลองเปลี่ยนตัวกรองหรือคำค้นหา" /> : <div className="space-y-2.5">{visibleAccounts.map((account) => {
              const growth = growthFor(account);
              const name = account.storeMaster?.storeName || account.displayName || "TikTok Store";
              return (
                <MobileListCard key={account.id} title={name} subtitle={`${account.username ? `@${account.username}` : account.displayName}${account.storeMaster?.province ? ` · ${account.storeMaster.province}` : ""}`} leading={account.avatarUrl ? <img src={account.avatarUrl} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--app-accent)]/10 text-base font-bold text-[var(--app-accent)]">{name[0]?.toUpperCase()}</span>} trailing={<span className={`rounded-full px-2 py-1 text-[9px] font-bold ${account.connectionStatus === "CONNECTED" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>{account.connectionStatus}</span>}>
                  <div className="grid grid-cols-3 gap-2 text-center"><div><p className="text-[9px] text-[var(--app-text-tertiary)]">Followers</p><p className="mt-0.5 text-sm font-bold">{compact(account.followerCount)}</p><p className={`text-[9px] font-bold ${growthTone(growth.followers)}`}>{growthText(growth.followers)}</p></div><div><p className="text-[9px] text-[var(--app-text-tertiary)]">Likes</p><p className="mt-0.5 text-sm font-bold">{compact(account.likesCount)}</p><p className={`text-[9px] font-bold ${growthTone(growth.likes)}`}>{growthText(growth.likes)}</p></div><div><p className="text-[9px] text-[var(--app-text-tertiary)]">Videos</p><p className="mt-0.5 text-sm font-bold">{compact(account.videoCountRecorded ?? account.videoCount)}</p><p className={`text-[9px] font-bold ${growthTone(growth.videos)}`}>{growthText(growth.videos)}</p></div></div>
                  <Link href={`/tiktok/dashboard/${account.id}`} className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-[var(--app-border)] text-xs font-bold text-[var(--app-accent)]">เปิด Dashboard</Link>
                </MobileListCard>
              );
            })}</div>}
          </MobileSection>
        </div>
        {moreOpen && user && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
      </MobilePageShell>
    );
  }

  const growthSummary = historicalMetrics?.summary;
  return (
    <MobilePageShell bottomNav={bottomNav}>
      <MobilePageHeader eyebrow="TikTok Account" title={storeMaster?.storeName || profileName} description={username ? `@${username}` : "TikTok Store Account"} action={<Link href={single?.id ? `/tiktok/dashboard/${single.id}` : "/tiktok/dashboard"} className="flex min-h-10 items-center rounded-xl bg-[var(--app-accent)] px-3 text-[10px] font-bold text-white">Dashboard</Link>} />
      <div className="space-y-4 px-4 py-4 pb-8">
        <MobileCard><div className="flex items-center gap-3">{avatar ? <img src={avatar} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--app-accent)]/10 text-xl font-bold text-[var(--app-accent)]">{profileName[0]?.toUpperCase()}</span>}<div className="min-w-0"><p className="truncate text-base font-bold">{profileName}</p>{username && <p className="text-xs font-semibold text-[var(--app-accent)]">@{username}</p>}<p className="mt-1 text-[10px] text-[var(--app-text-tertiary)]">{storeMaster ? `${storeMaster.storeName}${storeMaster.province ? ` · ${storeMaster.province}` : ""}` : "Store not linked"}</p></div></div></MobileCard>
        <MobileMetricGrid><MobileMetricCard label="Followers" value={compact(followerCount)} tone="accent" detail={<span className={growthTone(growthSummary?.sevenDayFollowerGrowth)}>{growthText(growthSummary?.sevenDayFollowerGrowth)} ใน 7 วัน</span>} /><MobileMetricCard label="Following" value={compact(followingCount)} /><MobileMetricCard label="Likes" value={compact(likesCount)} /><MobileMetricCard label="Videos" value={compact(videoCount)} /></MobileMetricGrid>
        <MobileSection title="Follower Growth"><MobileCard className="grid grid-cols-3 gap-2 text-center"><div><p className="text-[9px] text-[var(--app-text-tertiary)]">Today</p><p className={`mt-1 text-sm font-bold ${growthTone(growthSummary?.dailyFollowerGrowth)}`}>{growthText(growthSummary?.dailyFollowerGrowth)}</p></div><div><p className="text-[9px] text-[var(--app-text-tertiary)]">7 Days</p><p className={`mt-1 text-sm font-bold ${growthTone(growthSummary?.sevenDayFollowerGrowth)}`}>{growthText(growthSummary?.sevenDayFollowerGrowth)}</p></div><div><p className="text-[9px] text-[var(--app-text-tertiary)]">30 Days</p><p className={`mt-1 text-sm font-bold ${growthTone(growthSummary?.thirtyDayFollowerGrowth)}`}>{growthText(growthSummary?.thirtyDayFollowerGrowth)}</p></div></MobileCard></MobileSection>
        {videos.length > 0 && <MobileSection title="วิดีโอล่าสุด" description={`${videos.length} videos synced`}><div className="space-y-2.5">{videos.slice(0, 5).map((video) => <MobileListCard key={video.id} title={video.title || video.video_description || "TikTok Video"} subtitle={video.create_time ? new Date(video.create_time * 1000).toLocaleDateString("th-TH") : undefined} trailing={<strong className="text-xs">{compact(video.view_count)} views</strong>}><div className="flex gap-4 text-[10px] text-[var(--app-text-secondary)]"><span>♥ {compact(video.like_count)}</span><span>Comments {compact(video.comment_count)}</span><span>Shares {compact(video.share_count)}</span></div>{video.share_url && <a href={video.share_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[10px] font-bold text-[var(--app-accent)]">เปิดใน TikTok ↗</a>}</MobileListCard>)}</div></MobileSection>}
      </div>
      {moreOpen && user && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
    </MobilePageShell>
  );
}
