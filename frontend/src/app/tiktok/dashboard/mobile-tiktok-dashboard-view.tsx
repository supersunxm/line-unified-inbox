"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { LanguageControl, useAppLanguage } from "../../language";
import { getTikTokLocale } from "../tiktok-overview-translations";
import type { TikTokAccountListItem, TikTokHistoricalMetricsData, TikTokStoreData, TikTokVideoItem } from "../tiktok-types";
import { getTikTokDashboardText } from "./tiktok-dashboard-translations";
import { TikTokFollowerGrowthChart } from "./tiktok-follower-chart";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type Tab = "overview" | "growth" | "videos";

type Props = {
  data: TikTokStoreData | null;
  historicalMetrics?: TikTokHistoricalMetricsData | null;
  accounts?: TikTokAccountListItem[];
  currentAccountId?: string;
};

function compact(value: number | null | undefined, locale: string) {
  const amount = value ?? 0;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(amount >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return new Intl.NumberFormat(locale).format(amount);
}

function delta(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return "—";
  const formatted = new Intl.NumberFormat(locale).format(value);
  return value > 0 ? `+${formatted}` : formatted;
}

function deltaClass(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "text-[var(--app-text-tertiary)]";
  return value > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

function videoTitle(video: TikTokVideoItem, fallback: string) {
  return video.title || video.video_description || fallback;
}

export function MobileTikTokDashboardView({ data, historicalMetrics, accounts = [], currentAccountId }: Props) {
  const { language } = useAppLanguage();
  const t = getTikTokDashboardText(language);
  const locale = getTikTokLocale(language);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    void api.me().then(setUser).catch(() => undefined);
  }, []);

  const bottomNav = <MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />;
  const languageRow = <div className="flex justify-end px-4 pt-3"><LanguageControl /></div>;

  if (!data) {
    return (
      <MobilePageShell bottomNav={bottomNav}>
        <MobilePageHeader eyebrow={t.monitorTag} title={t.performanceDashboard} description={t.noDataDescription} />
        {languageRow}
        <div className="px-4 py-5"><MobileEmptyState title={t.noDataTitle} description={t.noDataDescription} /><Link href="/tiktok/connect" className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-[var(--app-accent)] px-4 text-sm font-bold text-white">{t.connectTikTok}</Link></div>
        {moreOpen && user && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
      </MobilePageShell>
    );
  }

  const { profile, storeMaster, videos } = data;
  const avatar = profile.avatar_large_url || profile.avatar_url_100 || profile.avatar_url;
  const displayName = storeMaster?.storeName || profile.display_name || t.storeFallback;
  const totals = videos.reduce((result, video) => ({
    views: result.views + (video.view_count || 0),
    likes: result.likes + (video.like_count || 0),
    comments: result.comments + (video.comment_count || 0),
    shares: result.shares + (video.share_count || 0),
  }), { views: 0, likes: 0, comments: 0, shares: 0 });
  const avgViews = videos.length ? Math.round(totals.views / videos.length) : 0;
  const engagement = totals.likes + totals.comments + totals.shares;
  const avgEngagement = videos.length ? Math.round(engagement / videos.length) : 0;
  const topViews = videos.reduce<TikTokVideoItem | null>((best, item) => !best || (item.view_count || 0) > (best.view_count || 0) ? item : best, null);
  const topLikes = videos.reduce<TikTokVideoItem | null>((best, item) => !best || (item.like_count || 0) > (best.like_count || 0) ? item : best, null);
  const summary = historicalMetrics?.summary;

  return (
    <MobilePageShell bottomNav={bottomNav}>
      <MobilePageHeader
        eyebrow={t.performanceDashboard}
        title={displayName}
        description={profile.username ? `@${profile.username}` : t.storePerformanceDashboard}
        action={<Link href="/tiktok" className="flex min-h-10 items-center rounded-xl border border-[var(--app-border)] px-3 text-[10px] font-bold">{t.allStores}</Link>}
      />
      {languageRow}
      {accounts.length > 1 && <div className="border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3"><label className="text-[10px] font-bold text-[var(--app-text-tertiary)]">{t.store.toUpperCase()}</label><select value={currentAccountId || ""} onChange={(event) => { if (event.target.value) window.location.assign(`/tiktok/dashboard/${event.target.value}`); }} className="mt-1 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3 text-[16px] font-semibold outline-none focus:border-[var(--app-accent)]">{accounts.map((account) => <option key={account.id} value={account.id}>{account.storeMaster?.storeName || account.displayName || account.username || t.storeFallback}</option>)}</select></div>}
      <MobileSectionTabs<Tab> value={tab} items={[{ value: "overview", label: t.overview }, { value: "growth", label: t.growth }, { value: "videos", label: t.videos, badge: videos.length }]} onChange={setTab} />

      <div className="space-y-4 px-4 py-4 pb-8">
        {tab === "overview" && <>
          <MobileCard><div className="flex items-center gap-3">{avatar ? <img src={avatar} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--app-accent)]/10 text-xl font-bold text-[var(--app-accent)]">{displayName[0]?.toUpperCase()}</span>}<div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-base font-bold">{profile.display_name || displayName}</p>{profile.is_verified && <span title={t.verifiedAccount} className="text-[var(--app-accent)]">✓</span>}</div>{profile.username && <p className="text-xs font-semibold text-[var(--app-accent)]">@{profile.username}</p>}<p className="mt-1 text-[10px] text-[var(--app-text-tertiary)]">{storeMaster ? `${storeMaster.storeName}${storeMaster.province ? ` · ${storeMaster.province}` : ""}` : t.storeNotLinked}</p></div></div>{profile.profile_web_link && <a href={profile.profile_web_link} target="_blank" rel="noreferrer" className="mt-3 flex min-h-10 items-center justify-center rounded-xl border border-[var(--app-border)] text-[10px] font-bold text-[var(--app-accent)]">{t.viewOnTikTok} ↗</a>}</MobileCard>

          <MobileMetricGrid>
            <MobileMetricCard label={t.followers} value={compact(profile.follower_count, locale)} tone="accent" detail={<span className={deltaClass(summary?.sevenDayFollowerGrowth)}>{delta(summary?.sevenDayFollowerGrowth, locale)} · {t.sevenDays}</span>} />
            <MobileMetricCard label={t.following} value={compact(profile.following_count, locale)} />
            <MobileMetricCard label={t.totalLikes} value={compact(profile.likes_count, locale)} />
            <MobileMetricCard label={t.videos} value={compact(profile.video_count, locale)} detail={t.videosSynced(videos.length)} />
            <MobileMetricCard label={t.totalVideoViews} value={compact(totals.views, locale)} tone="info" />
            <MobileMetricCard label={t.avgViewsPerVideo} value={compact(avgViews, locale)} tone="success" />
          </MobileMetricGrid>

          <MobileSection title={t.performanceHighlights}><div className="space-y-2.5">
            <MobileListCard title={t.topVideoByViews} subtitle={topViews ? videoTitle(topViews, t.untitledVideo) : t.noVideosRecorded} trailing={<strong className="text-sm">{topViews ? compact(topViews.view_count, locale) : "—"}</strong>} />
            <MobileListCard title={t.topVideoByLikes} subtitle={topLikes ? videoTitle(topLikes, t.untitledVideo) : t.noVideosRecorded} trailing={<strong className="text-sm">{topLikes ? compact(topLikes.like_count, locale) : "—"}</strong>} />
            <MobileListCard title={t.totalEngagement} subtitle={t.engagementBreakdown} trailing={<strong className="text-sm">{compact(engagement, locale)}</strong>} />
            <MobileListCard title={t.avgEngagementPerPost} subtitle={t.perPublishedVideo} trailing={<strong className="text-sm">{compact(avgEngagement, locale)}</strong>} />
          </div></MobileSection>
        </>}

        {tab === "growth" && <>
          <MobileMetricGrid>
            <MobileMetricCard label={t.today} value={delta(summary?.dailyFollowerGrowth, locale)} tone={summary?.dailyFollowerGrowth && summary.dailyFollowerGrowth > 0 ? "success" : "default"} />
            <MobileMetricCard label={t.sevenDays} value={delta(summary?.sevenDayFollowerGrowth, locale)} tone={summary?.sevenDayFollowerGrowth && summary.sevenDayFollowerGrowth > 0 ? "success" : "default"} />
            <MobileMetricCard label={t.thirtyDays} value={delta(summary?.thirtyDayFollowerGrowth, locale)} tone={summary?.thirtyDayFollowerGrowth && summary.thirtyDayFollowerGrowth > 0 ? "success" : "default"} wide />
          </MobileMetricGrid>
          {historicalMetrics ? <div className="overflow-hidden rounded-2xl [&>div]:rounded-2xl [&>div]:p-4"><TikTokFollowerGrowthChart history={historicalMetrics.history} summary={historicalMetrics.summary} accountDisplayName={profile.display_name || undefined} /></div> : <MobileEmptyState title={t.growthHistoryMissing} description={t.growthHistoryMissingDescription} />}
        </>}

        {tab === "videos" && <MobileSection title={t.recentVideos} description={t.videosSyncedFromApi(videos.length)}>
          {videos.length === 0 ? <MobileEmptyState title={t.noVideosFound} description={t.noVideosDescription} /> : <div className="space-y-2.5">{videos.map((video) => <MobileListCard key={video.id} title={videoTitle(video, t.untitledVideo)} subtitle={video.create_time ? new Date(video.create_time * 1000).toLocaleDateString(locale) : undefined} leading={video.cover_image_url ? <img src={video.cover_image_url} alt="" className="h-16 w-12 rounded-lg object-cover" /> : undefined} trailing={<strong className="text-xs">{compact(video.view_count, locale)} {t.views}</strong>}>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px]"><div><p className="text-[var(--app-text-tertiary)]">{t.likes}</p><p className="mt-0.5 font-bold">{compact(video.like_count, locale)}</p></div><div><p className="text-[var(--app-text-tertiary)]">{t.comments}</p><p className="mt-0.5 font-bold">{compact(video.comment_count, locale)}</p></div><div><p className="text-[var(--app-text-tertiary)]">{t.shares}</p><p className="mt-0.5 font-bold">{compact(video.share_count, locale)}</p></div></div>
            {video.share_url && <a href={video.share_url} target="_blank" rel="noreferrer" className="mt-3 flex min-h-10 items-center justify-center rounded-xl border border-[var(--app-border)] text-[10px] font-bold text-[var(--app-accent)]">{t.openVideo} ↗</a>}
          </MobileListCard>)}</div>}
        </MobileSection>}
      </div>
      {moreOpen && user && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
    </MobilePageShell>
  );
}
