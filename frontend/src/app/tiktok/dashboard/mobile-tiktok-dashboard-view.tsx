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
import type { TikTokAccountListItem, TikTokHistoricalMetricsData, TikTokStoreData, TikTokVideoItem } from "../tiktok-types";
import { TikTokFollowerGrowthChart } from "./tiktok-follower-chart";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type Tab = "overview" | "growth" | "videos";

type Props = {
  data: TikTokStoreData | null;
  historicalMetrics?: TikTokHistoricalMetricsData | null;
  accounts?: TikTokAccountListItem[];
  currentAccountId?: string;
};

const number = new Intl.NumberFormat("en-US");

function compact(value: number | null | undefined) {
  const amount = value ?? 0;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(amount >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return number.format(amount);
}

function delta(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return value > 0 ? `+${number.format(value)}` : number.format(value);
}

function deltaClass(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "text-[var(--app-text-tertiary)]";
  return value > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

function videoTitle(video: TikTokVideoItem) {
  return video.title || video.video_description || "TikTok Video";
}

export function MobileTikTokDashboardView({ data, historicalMetrics, accounts = [], currentAccountId }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    void api.me().then(setUser).catch(() => undefined);
  }, []);

  const bottomNav = <MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />;

  if (!data) {
    return (
      <MobilePageShell bottomNav={bottomNav}>
        <MobilePageHeader eyebrow="TikTok Monitor" title="TikTok Performance" description="ยังไม่มีข้อมูล TikTok สำหรับแสดงผล" />
        <div className="px-4 py-5"><MobileEmptyState title="No TikTok Data" description="เชื่อม TikTok retail account เพื่อเริ่มดู performance" /><Link href="/tiktok/connect" className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-[var(--app-accent)] px-4 text-sm font-bold text-white">Connect TikTok</Link></div>
        {moreOpen && user && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
      </MobilePageShell>
    );
  }

  const { profile, storeMaster, videos } = data;
  const avatar = profile.avatar_large_url || profile.avatar_url_100 || profile.avatar_url;
  const displayName = storeMaster?.storeName || profile.display_name || "TikTok Store";
  const totals = useMemo(() => videos.reduce((acc, video) => ({ views: acc.views + (video.view_count || 0), likes: acc.likes + (video.like_count || 0), comments: acc.comments + (video.comment_count || 0), shares: acc.shares + (video.share_count || 0) }), { views: 0, likes: 0, comments: 0, shares: 0 }), [videos]);
  const avgViews = videos.length ? Math.round(totals.views / videos.length) : 0;
  const engagement = totals.likes + totals.comments + totals.shares;
  const avgEngagement = videos.length ? Math.round(engagement / videos.length) : 0;
  const topViews = videos.reduce<TikTokVideoItem | null>((best, item) => !best || (item.view_count || 0) > (best.view_count || 0) ? item : best, null);
  const topLikes = videos.reduce<TikTokVideoItem | null>((best, item) => !best || (item.like_count || 0) > (best.like_count || 0) ? item : best, null);
  const summary = historicalMetrics?.summary;

  return (
    <MobilePageShell bottomNav={bottomNav}>
      <MobilePageHeader
        eyebrow="TikTok Performance"
        title={displayName}
        description={profile.username ? `@${profile.username}` : "Store Performance Dashboard"}
        action={<Link href="/tiktok" className="flex min-h-10 items-center rounded-xl border border-[var(--app-border)] px-3 text-[10px] font-bold">ร้านทั้งหมด</Link>}
      />
      {accounts.length > 1 && (
        <div className="border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
          <label className="text-[10px] font-bold text-[var(--app-text-tertiary)]">STORE</label>
          <select value={currentAccountId || ""} onChange={(event) => { if (event.target.value) window.location.assign(`/tiktok/dashboard/${event.target.value}`); }} className="mt-1 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3 text-[16px] font-semibold outline-none focus:border-[var(--app-accent)]">
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.storeMaster?.storeName || account.displayName || account.username || "Store"}</option>)}
          </select>
        </div>
      )}
      <MobileSectionTabs<Tab> value={tab} items={[{ value: "overview", label: "ภาพรวม" }, { value: "growth", label: "Growth" }, { value: "videos", label: "Videos", badge: videos.length }]} onChange={setTab} />

      <div className="space-y-4 px-4 py-4 pb-8">
        {tab === "overview" && (
          <>
            <MobileCard><div className="flex items-center gap-3">{avatar ? <img src={avatar} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--app-accent)]/10 text-xl font-bold text-[var(--app-accent)]">{displayName[0]?.toUpperCase()}</span>}<div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-base font-bold">{profile.display_name || displayName}</p>{profile.is_verified && <span className="text-[var(--app-accent)]">✓</span>}</div>{profile.username && <p className="text-xs font-semibold text-[var(--app-accent)]">@{profile.username}</p>}<p className="mt-1 text-[10px] text-[var(--app-text-tertiary)]">{storeMaster ? `${storeMaster.storeName}${storeMaster.province ? ` · ${storeMaster.province}` : ""}` : "Store not linked"}</p></div></div>{profile.profile_web_link && <a href={profile.profile_web_link} target="_blank" rel="noreferrer" className="mt-3 flex min-h-10 items-center justify-center rounded-xl border border-[var(--app-border)] text-[10px] font-bold text-[var(--app-accent)]">View on TikTok ↗</a>}</MobileCard>

            <MobileMetricGrid>
              <MobileMetricCard label="Followers" value={compact(profile.follower_count)} tone="accent" detail={<span className={deltaClass(summary?.sevenDayFollowerGrowth)}>{delta(summary?.sevenDayFollowerGrowth)} · 7D</span>} />
              <MobileMetricCard label="Following" value={compact(profile.following_count)} />
              <MobileMetricCard label="Total Likes" value={compact(profile.likes_count)} />
              <MobileMetricCard label="Videos" value={compact(profile.video_count)} detail={`${videos.length} synced`} />
              <MobileMetricCard label="Video Views" value={compact(totals.views)} tone="info" />
              <MobileMetricCard label="Avg Views / Video" value={compact(avgViews)} tone="success" />
            </MobileMetricGrid>

            <MobileSection title="Performance Highlights">
              <div className="space-y-2.5">
                <MobileListCard title="Top Video by Views" subtitle={topViews ? videoTitle(topViews) : "No video"} trailing={<strong className="text-sm">{topViews ? compact(topViews.view_count) : "—"}</strong>} />
                <MobileListCard title="Top Video by Likes" subtitle={topLikes ? videoTitle(topLikes) : "No video"} trailing={<strong className="text-sm">{topLikes ? compact(topLikes.like_count) : "—"}</strong>} />
                <MobileListCard title="Total Engagement" subtitle="Likes + comments + shares" trailing={<strong className="text-sm">{compact(engagement)}</strong>} />
                <MobileListCard title="Avg Engagement / Post" subtitle="ต่อวิดีโอที่ sync" trailing={<strong className="text-sm">{compact(avgEngagement)}</strong>} />
              </div>
            </MobileSection>
          </>
        )}

        {tab === "growth" && (
          <>
            <MobileMetricGrid>
              <MobileMetricCard label="Today" value={delta(summary?.dailyFollowerGrowth)} tone={summary?.dailyFollowerGrowth && summary.dailyFollowerGrowth > 0 ? "success" : "default"} />
              <MobileMetricCard label="7 Days" value={delta(summary?.sevenDayFollowerGrowth)} tone={summary?.sevenDayFollowerGrowth && summary.sevenDayFollowerGrowth > 0 ? "success" : "default"} />
              <MobileMetricCard label="30 Days" value={delta(summary?.thirtyDayFollowerGrowth)} tone={summary?.thirtyDayFollowerGrowth && summary.thirtyDayFollowerGrowth > 0 ? "success" : "default"} wide />
            </MobileMetricGrid>
            {historicalMetrics ? <div className="overflow-hidden rounded-2xl [&>div]:rounded-2xl [&>div]:p-4"><TikTokFollowerGrowthChart history={historicalMetrics.history} summary={historicalMetrics.summary} accountDisplayName={profile.display_name || undefined} /></div> : <MobileEmptyState title="ยังไม่มี Growth History" description="ต้องมีอย่างน้อย 2 daily snapshots เพื่อแสดงแนวโน้ม" />}
          </>
        )}

        {tab === "videos" && (
          <MobileSection title="Recent Videos" description={`${videos.length} videos synced from TikTok API`}>
            {videos.length === 0 ? <MobileEmptyState title="No videos found" description="ยังไม่มีวิดีโอที่ sync สำหรับบัญชีนี้" /> : <div className="space-y-2.5">{videos.map((video) => (
              <MobileListCard key={video.id} title={videoTitle(video)} subtitle={video.create_time ? new Date(video.create_time * 1000).toLocaleDateString("th-TH") : undefined} leading={video.cover_image_url ? <img src={video.cover_image_url} alt="" className="h-16 w-12 rounded-lg object-cover" /> : undefined} trailing={<strong className="text-xs">{compact(video.view_count)} views</strong>}>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]"><div><p className="text-[var(--app-text-tertiary)]">Likes</p><p className="mt-0.5 font-bold">{compact(video.like_count)}</p></div><div><p className="text-[var(--app-text-tertiary)]">Comments</p><p className="mt-0.5 font-bold">{compact(video.comment_count)}</p></div><div><p className="text-[var(--app-text-tertiary)]">Shares</p><p className="mt-0.5 font-bold">{compact(video.share_count)}</p></div></div>
                {video.share_url && <a href={video.share_url} target="_blank" rel="noreferrer" className="mt-3 flex min-h-10 items-center justify-center rounded-xl border border-[var(--app-border)] text-[10px] font-bold text-[var(--app-accent)]">เปิดวิดีโอ ↗</a>}
              </MobileListCard>
            ))}</div>}
          </MobileSection>
        )}
      </div>
      {moreOpen && user && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
    </MobilePageShell>
  );
}
