"use client";

import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  MetricCard,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { LanguageControl, useAppLanguage } from "../../language";
import { getTikTokLocale } from "../tiktok-overview-translations";
import type { TikTokAccountListItem, TikTokHistoricalMetricsData, TikTokStoreData, TikTokVideoItem } from "../tiktok-types";
import { getTikTokDashboardText } from "./tiktok-dashboard-translations";
import { TikTokFollowerGrowthChart } from "./tiktok-follower-chart";

interface TikTokDashboardViewProps {
  data: TikTokStoreData | null;
  historicalMetrics?: TikTokHistoricalMetricsData | null;
  accounts?: TikTokAccountListItem[];
  currentAccountId?: string;
}

function formatNumber(value: number | undefined | null, locale: string): string {
  return new Intl.NumberFormat(locale).format(value ?? 0);
}

function formatCompactNumber(value: number | undefined | null): string {
  const amount = value ?? 0;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(amount);
}

function formatDelta(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return { text: "--", className: "font-medium text-[var(--app-text-tertiary)]" };
  const formatted = new Intl.NumberFormat(locale).format(value);
  if (value > 0) return { text: `+${formatted}`, className: "font-semibold text-[var(--app-success)]" };
  if (value < 0) return { text: formatted, className: "font-semibold text-[var(--app-danger)]" };
  return { text: "0", className: "font-medium text-[var(--app-text-secondary)]" };
}

function formatDate(timestamp: number | undefined | null, locale: string): string {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

function formatDuration(seconds: number | undefined | null): string {
  if (!seconds) return "—";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function bestVideo(videos: TikTokVideoItem[], metric: "view_count" | "like_count") {
  return videos.reduce<TikTokVideoItem | null>((best, current) => !best || (current[metric] || 0) > (best[metric] || 0) ? current : best, null);
}

export function TikTokDashboardView({ data, historicalMetrics, accounts = [], currentAccountId }: TikTokDashboardViewProps) {
  const { language } = useAppLanguage();
  const t = getTikTokDashboardText(language);
  const locale = getTikTokLocale(language);

  if (!data) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-4xl space-y-6">
          <PageHeader tag={t.monitorTag} title={t.performanceDashboard} description={t.performanceDescription} actions={<div className="flex items-center gap-2"><LanguageControl /><Link href="/tiktok"><Button variant="secondary" size="sm">{t.storesOverview}</Button></Link><Link href="/tiktok/connect"><Button variant="primary" size="sm">{t.connectTikTok}</Button></Link></div>} />
          <Card className="space-y-4 p-10 text-center"><h1 className="text-xl font-bold text-[var(--app-text-primary)]">{t.noDataTitle}</h1><p className="text-xs text-[var(--app-text-secondary)]">{t.noDataDescription}</p><div className="flex justify-center pt-2"><Link href="/tiktok/connect"><Button variant="primary" size="md">{t.connectTikTok}</Button></Link></div></Card>
        </div>
      </PageContainer>
    );
  }

  const { profile, storeMaster, videos } = data;
  const avatarSrc = profile.avatar_large_url || profile.avatar_url_100 || profile.avatar_url;
  const totals = videos.reduce((result, video) => ({
    views: result.views + (video.view_count || 0),
    likes: result.likes + (video.like_count || 0),
    comments: result.comments + (video.comment_count || 0),
    shares: result.shares + (video.share_count || 0),
  }), { views: 0, likes: 0, comments: 0, shares: 0 });
  const avgViews = videos.length ? Math.round(totals.views / videos.length) : 0;
  const totalEngagement = totals.likes + totals.comments + totals.shares;
  const avgEngagement = videos.length ? Math.round(totalEngagement / videos.length) : 0;
  const topVideoByViews = bestVideo(videos, "view_count");
  const topVideoByLikes = bestVideo(videos, "like_count");

  return (
    <PageContainer>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          tag={`${t.monitorTag} · ${t.performanceDashboard}`}
          title={t.storePerformanceDashboard}
          description={t.performanceDescription}
          actions={<div className="flex flex-wrap items-center gap-2">
            <LanguageControl />
            {accounts.length > 1 && <div className="flex items-center gap-1.5"><label htmlFor="tiktok-store-switcher" className="text-xs text-[var(--app-text-secondary)]">{t.store}:</label><select id="tiktok-store-switcher" value={currentAccountId || ""} onChange={(event) => { if (event.target.value) window.location.assign(`/tiktok/dashboard/${event.target.value}`); }} className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs font-semibold text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none">{accounts.map((account) => <option key={account.id} value={account.id}>{account.storeMaster?.storeName || account.displayName || account.username || t.storeFallback}</option>)}</select></div>}
            <Link href="/tiktok"><Button variant="secondary" size="sm">{t.storesOverview}</Button></Link>
            <Link href="/tiktok/connect"><Button variant="primary" size="sm">{t.connectTikTok}</Button></Link>
          </div>}
        />

        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {avatarSrc ? <img src={avatarSrc} alt={profile.display_name || "TikTok"} className="h-16 w-16 rounded-[var(--app-radius-xl)] border border-[var(--app-border)] object-cover shadow-[var(--app-shadow-card)]" /> : <div className="flex h-16 w-16 items-center justify-center rounded-[var(--app-radius-xl)] bg-[var(--app-accent-soft)] text-xl font-bold text-[var(--app-accent)]">{(profile.display_name || "T")[0].toUpperCase()}</div>}
              <div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-bold text-[var(--app-text-primary)]">{profile.display_name || t.storeFallback}</h1>{profile.is_verified && <span title={t.verifiedAccount} className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--app-accent)] text-[10px] text-white">✓</span>}<Badge size="sm" variant="success">{t.connected}</Badge></div>{profile.username && <p className="font-mono text-xs font-medium text-[var(--app-accent)]">@{profile.username}</p>}<div>{storeMaster ? <span className="text-xs font-medium text-[var(--app-text-secondary)]">{storeMaster.storeName} ({storeMaster.province || "—"})</span> : <span className="text-xs text-[var(--app-text-tertiary)]">{t.storeNotLinked}</span>}</div></div>
            </div>
            {profile.profile_web_link && <a href={profile.profile_web_link} target="_blank" rel="noopener noreferrer"><Button variant="secondary" size="sm">{t.viewOnTikTok}</Button></a>}
          </div>
        </Card>

        <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="flex flex-col justify-between p-4"><div><p className="text-xs font-medium uppercase text-[var(--app-text-secondary)]">{t.followers}</p><p className="mt-1.5 text-2xl font-bold text-[var(--app-text-primary)]">{formatNumber(profile.follower_count, locale)}</p></div><div className="mt-2 space-y-0.5 border-t border-[var(--app-border-subtle)] pt-2 text-[10px]">{[[t.today, historicalMetrics?.summary?.dailyFollowerGrowth], [t.sevenDays, historicalMetrics?.summary?.sevenDayFollowerGrowth], [t.thirtyDays, historicalMetrics?.summary?.thirtyDayFollowerGrowth]].map(([label, value]) => { const item = formatDelta(value as number | null | undefined, locale); return <div key={String(label)} className="flex justify-between"><span className="text-[var(--app-text-tertiary)]">{String(label)}</span><span className={item.className}>{item.text}</span></div>; })}</div></Card>
          <MetricCard label={t.following} value={formatNumber(profile.following_count, locale)} subtext={t.accounts} tone="default" />
          <MetricCard label={t.totalLikes} value={formatCompactNumber(profile.likes_count)} subtext={t.likesCount(formatNumber(profile.likes_count, locale))} tone="accent" />
          <MetricCard label={t.totalVideos} value={formatNumber(profile.video_count, locale)} subtext={t.videosSynced(videos.length)} tone="default" />
          <MetricCard label={t.totalVideoViews} value={formatCompactNumber(totals.views)} subtext={t.viewsCount(formatNumber(totals.views, locale))} tone="info" />
          <MetricCard label={t.avgViewsPerVideo} value={formatCompactNumber(avgViews)} subtext={t.perVideo(formatNumber(avgViews, locale))} tone="success" />
        </section>

        {historicalMetrics && <TikTokFollowerGrowthChart history={historicalMetrics.history} summary={historicalMetrics.summary} accountDisplayName={profile.display_name || undefined} />}

        <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="space-y-1 p-4"><p className="text-xs font-semibold uppercase text-[var(--app-text-tertiary)]">{t.topVideoByViews}</p><p className="text-xl font-bold text-[var(--app-text-primary)]">{topVideoByViews ? formatCompactNumber(topVideoByViews.view_count) : "—"}</p><p className="truncate text-xs text-[var(--app-text-secondary)]">{topVideoByViews?.title || topVideoByViews?.video_description || t.noVideosRecorded}</p></Card>
          <Card className="space-y-1 p-4"><p className="text-xs font-semibold uppercase text-[var(--app-text-tertiary)]">{t.topVideoByLikes}</p><p className="text-xl font-bold text-[var(--app-text-primary)]">{topVideoByLikes ? formatCompactNumber(topVideoByLikes.like_count) : "—"}</p><p className="truncate text-xs text-[var(--app-text-secondary)]">{topVideoByLikes?.title || topVideoByLikes?.video_description || t.noVideosRecorded}</p></Card>
          <MetricCard label={t.totalEngagement} value={formatCompactNumber(totalEngagement)} subtext={t.engagementBreakdown} tone="default" />
          <MetricCard label={t.avgEngagementPerPost} value={formatCompactNumber(avgEngagement)} subtext={t.perPublishedVideo} tone="accent" />
        </section>

        <Card>
          <CardHeader><CardTitle>{t.recentVideos}</CardTitle><CardDescription>{t.videosSyncedFromApi(videos.length)}</CardDescription></CardHeader>
          <CardContent>
            {videos.length === 0 ? <EmptyState title={t.noVideosFound} description={t.noVideosDescription} /> : <TableContainer><Table><TableHeader><TableRow><TableHead>{t.video}</TableHead><TableHead>{t.published}</TableHead><TableHead align="right">{t.views}</TableHead><TableHead align="right">{t.likes}</TableHead><TableHead align="right">{t.comments}</TableHead><TableHead align="right">{t.shares}</TableHead><TableHead align="right">{t.duration}</TableHead><TableHead align="right">{t.action}</TableHead></TableRow></TableHeader><TableBody>{videos.map((video) => <TableRow key={video.id}>
              <TableCell><div className="flex min-w-[200px] max-w-sm items-center gap-3">{video.cover_image_url ? <img src={video.cover_image_url} alt={video.title || t.videoThumbnail} className="h-10 w-8 shrink-0 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] object-cover" /> : <div className="h-10 w-8 shrink-0 rounded-[var(--app-radius-sm)] bg-[var(--app-surface-subtle)]" />}<div className="min-w-0"><p className="truncate text-xs font-semibold text-[var(--app-text-primary)]">{video.title || video.video_description || t.untitledVideo}</p>{video.video_description && video.title && <p className="truncate text-[11px] text-[var(--app-text-tertiary)]">{video.video_description}</p>}</div></div></TableCell>
              <TableCell className="whitespace-nowrap font-mono text-[11px] text-[var(--app-text-secondary)]">{formatDate(video.create_time, locale)}</TableCell>
              <TableCell align="right" className="font-mono text-xs font-semibold text-[var(--app-text-primary)]">{formatNumber(video.view_count, locale)}</TableCell>
              <TableCell align="right" className="font-mono text-xs text-[var(--app-text-secondary)]">{formatNumber(video.like_count, locale)}</TableCell>
              <TableCell align="right" className="font-mono text-xs text-[var(--app-text-secondary)]">{formatNumber(video.comment_count, locale)}</TableCell>
              <TableCell align="right" className="font-mono text-xs text-[var(--app-text-secondary)]">{formatNumber(video.share_count, locale)}</TableCell>
              <TableCell align="right" className="font-mono text-xs text-[var(--app-text-tertiary)]">{formatDuration(video.duration)}</TableCell>
              <TableCell align="right">{video.share_url ? <a href={video.share_url} target="_blank" rel="noopener noreferrer"><Button variant="secondary" size="sm">{t.watch}</Button></a> : <span className="text-[11px] text-[var(--app-text-tertiary)]">—</span>}</TableCell>
            </TableRow>)}</TableBody></Table></TableContainer>}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
