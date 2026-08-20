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
import type {
  TikTokAccountListItem,
  TikTokHistoricalMetricsData,
  TikTokStoreData,
  TikTokVideoItem,
} from "../tiktok-types";
import { TikTokFollowerGrowthChart } from "./tiktok-follower-chart";
import { isTikTokDemoGrowthEnabled } from "./tiktok-demo-growth";

interface TikTokDashboardViewProps {
  data: TikTokStoreData | null;
  historicalMetrics?: TikTokHistoricalMetricsData | null;
  accounts?: TikTokAccountListItem[];
  currentAccountId?: string;
}

function formatDelta(delta: number | null | undefined): {
  text: string;
  className: string;
} {
  if (delta === null || delta === undefined) {
    return {
      text: "--",
      className: "text-[var(--app-text-tertiary)] font-medium",
    };
  }

  if (delta > 0) {
    return {
      text: `+${new Intl.NumberFormat("en-US").format(delta)}`,
      className: "text-[var(--app-success)] font-semibold",
    };
  }

  if (delta < 0) {
    return {
      text: new Intl.NumberFormat("en-US").format(delta),
      className: "text-[var(--app-danger)] font-semibold",
    };
  }

  return {
    text: "0",
    className: "text-[var(--app-text-secondary)] font-medium",
  };
}

function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return "0";
  return new Intl.NumberFormat("en-US").format(num);
}

function formatCompactNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return "0";
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
}

function formatDate(timestamp: number | undefined | null): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number | undefined | null): string {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TikTokDashboardView({
  data,
  historicalMetrics,
  accounts = [],
  currentAccountId,
}: TikTokDashboardViewProps) {
  // 1. Empty State
  if (!data) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-4xl space-y-6">
          <PageHeader
            tag="OPPO Retail TikTok Monitor"
            title="TikTok Performance Dashboard"
            description="Real-time retail TikTok store performance analytics, audience growth metrics, and video engagement insights."
            actions={
              <div className="flex items-center gap-2">
                <Link href="/tiktok">
                  <Button variant="secondary" size="sm">
                    Stores Overview
                  </Button>
                </Link>
                <Link href="/tiktok/connect">
                  <Button variant="primary" size="sm">
                    Connect TikTok
                  </Button>
                </Link>
              </div>
            }
          />
          <Card className="p-10 text-center space-y-4">
            <h1 className="text-xl font-bold text-[var(--app-text-primary)]">
              No TikTok Data Available
            </h1>
            <p className="text-xs text-[var(--app-text-secondary)]">
              Connect an authorized TikTok retail store account to inspect video performance.
            </p>
            <div className="pt-2 flex justify-center">
              <Link href="/tiktok/connect">
                <Button variant="primary" size="md">
                  Connect TikTok
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const { profile, storeMaster, videos } = data;
  const avatarSrc = profile.avatar_large_url || profile.avatar_url_100 || profile.avatar_url;

  const totals = {
    totalViews: videos.reduce((acc, v) => acc + (v.view_count || 0), 0),
    totalLikes: videos.reduce((acc, v) => acc + (v.like_count || 0), 0),
    totalComments: videos.reduce((acc, v) => acc + (v.comment_count || 0), 0),
    totalShares: videos.reduce((acc, v) => acc + (v.share_count || 0), 0),
    avgViewsPerVideo:
      videos.length > 0
        ? Math.round(videos.reduce((acc, v) => acc + (v.view_count || 0), 0) / videos.length)
        : 0,
  };

  // Video performance rankings
  const topVideoByViews = videos.reduce<TikTokVideoItem | null>((best, cur) => {
    if (!best || (cur.view_count || 0) > (best.view_count || 0)) return cur;
    return best;
  }, null);

  const topVideoByLikes = videos.reduce<TikTokVideoItem | null>((best, cur) => {
    if (!best || (cur.like_count || 0) > (best.like_count || 0)) return cur;
    return best;
  }, null);

  const totalEngagement = (totals.totalLikes || 0) + (totals.totalComments || 0) + (totals.totalShares || 0);
  const avgEngagementPerPost = videos.length > 0 ? Math.round(totalEngagement / videos.length) : 0;

  return (
    <PageContainer>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          tag="OPPO Retail TikTok Monitor · Performance Dashboard"
          title="Store Performance Dashboard"
          description="Real-time retail TikTok store performance analytics, audience growth metrics, and video engagement insights."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {accounts.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="tiktok-store-switcher" className="text-xs text-[var(--app-text-secondary)]">Store:</label>
                  <select
                    id="tiktok-store-switcher"
                    value={currentAccountId || ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        window.location.assign(`/tiktok/dashboard/${e.target.value}`);
                      }
                    }}
                    className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)] font-semibold focus:border-[var(--app-accent)] focus:outline-none"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.storeMaster?.storeName || acc.displayName || acc.username || "Store"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Link href="/tiktok">
                <Button variant="secondary" size="sm">
                  Stores Overview
                </Button>
              </Link>
              <Link href="/tiktok/connect">
                <Button variant="primary" size="sm">
                  Connect TikTok
                </Button>
              </Link>
            </div>
          }
        />

        {/* Store Profile Card */}
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt={profile.display_name || "TikTok"}
                  className="h-16 w-16 rounded-[var(--app-radius-xl)] border border-[var(--app-border)] object-cover shadow-[var(--app-shadow-card)]"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-[var(--app-radius-xl)] bg-[var(--app-accent-soft)] font-bold text-xl text-[var(--app-accent)]">
                  {(profile.display_name || "T")[0].toUpperCase()}
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-[var(--app-text-primary)]">
                    {profile.display_name || "TikTok Store Account"}
                  </h1>
                  {profile.is_verified && (
                    <span title="Verified Account" className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--app-accent)] text-white text-[10px]">
                      ✓
                    </span>
                  )}
                  <Badge size="sm" variant="success">Connected</Badge>
                </div>
                {profile.username && (
                  <p className="text-xs font-mono text-[var(--app-accent)] font-medium">
                    @{profile.username}
                  </p>
                )}
                <div>
                  {storeMaster ? (
                    <span className="text-xs text-[var(--app-text-secondary)] font-medium">
                      {storeMaster.storeName} ({storeMaster.province || "—"})
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--app-text-tertiary)]">
                      Store not linked yet
                    </span>
                  )}
                </div>
              </div>
            </div>
            {profile.profile_web_link && (
              <a href={profile.profile_web_link} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm">
                  View on TikTok
                </Button>
              </a>
            )}
          </div>
        </Card>

        {/* 6 Core KPIs Grid */}
        <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="p-4 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--app-text-secondary)] uppercase">Followers</p>
              <p className="mt-1.5 text-2xl font-bold text-[var(--app-text-primary)]">
                {formatNumber(profile.follower_count)}
              </p>
            </div>
            <div className="mt-2 space-y-0.5 border-t border-[var(--app-border-subtle)] pt-2 text-[10px]">
              <div className="flex justify-between">
                <span className="text-[var(--app-text-tertiary)]">Today</span>
                {(() => {
                  const d = formatDelta(historicalMetrics?.summary?.dailyFollowerGrowth);
                  return <span className={d.className}>{d.text}</span>;
                })()}
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--app-text-tertiary)]">7 Days</span>
                {(() => {
                  const d = formatDelta(historicalMetrics?.summary?.sevenDayFollowerGrowth);
                  return <span className={d.className}>{d.text}</span>;
                })()}
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--app-text-tertiary)]">30 Days</span>
                {(() => {
                  const d = formatDelta(historicalMetrics?.summary?.thirtyDayFollowerGrowth);
                  return <span className={d.className}>{d.text}</span>;
                })()}
              </div>
            </div>
          </Card>

          <MetricCard
            label="Following"
            value={formatNumber(profile.following_count)}
            subtext="Accounts"
            tone="default"
          />

          <MetricCard
            label="Total Likes"
            value={formatCompactNumber(profile.likes_count)}
            subtext={`${formatNumber(profile.likes_count)} likes`}
            tone="accent"
          />

          <MetricCard
            label="Total Videos"
            value={formatNumber(profile.video_count)}
            subtext={`${videos.length} videos synced`}
            tone="default"
          />

          <MetricCard
            label="Total Video Views"
            value={formatCompactNumber(totals.totalViews)}
            subtext={`${formatNumber(totals.totalViews)} views`}
            tone="info"
          />

          <MetricCard
            label="Avg Views / Video"
            value={formatCompactNumber(totals.avgViewsPerVideo)}
            subtext={`${formatNumber(totals.avgViewsPerVideo)} / video`}
            tone="success"
          />
        </section>

        {/* Follower Growth Chart */}
        {historicalMetrics && (
          <TikTokFollowerGrowthChart
            history={historicalMetrics.history}
            summary={historicalMetrics.summary}
            accountDisplayName={profile.display_name || undefined}
          />
        )}

        {/* 4 Performance Highlights */}
        <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4 space-y-1">
            <p className="text-xs font-semibold text-[var(--app-text-tertiary)] uppercase">Top Video by Views</p>
            <p className="text-xl font-bold text-[var(--app-text-primary)]">
              {topVideoByViews ? formatCompactNumber(topVideoByViews.view_count) : "—"}
            </p>
            <p className="text-xs text-[var(--app-text-secondary)] truncate">
              {topVideoByViews?.title || topVideoByViews?.video_description || "No videos recorded"}
            </p>
          </Card>

          <Card className="p-4 space-y-1">
            <p className="text-xs font-semibold text-[var(--app-text-tertiary)] uppercase">Top Video by Likes</p>
            <p className="text-xl font-bold text-[var(--app-text-primary)]">
              {topVideoByLikes ? formatCompactNumber(topVideoByLikes.like_count) : "—"}
            </p>
            <p className="text-xs text-[var(--app-text-secondary)] truncate">
              {topVideoByLikes?.title || topVideoByLikes?.video_description || "No videos recorded"}
            </p>
          </Card>

          <MetricCard
            label="Total Engagement"
            value={formatCompactNumber(totalEngagement)}
            subtext="Likes + comments + shares"
            tone="default"
          />

          <MetricCard
            label="Avg Engagement / Post"
            value={formatCompactNumber(avgEngagementPerPost)}
            subtext="Per published video"
            tone="accent"
          />
        </section>

        {/* Recent Videos Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Videos</CardTitle>
            <CardDescription>
              {videos.length} videos synced from official TikTok API
            </CardDescription>
          </CardHeader>
          <CardContent>
            {videos.length === 0 ? (
              <EmptyState title="No videos found" description="No videos synced for this account yet." />
            ) : (
              <TableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Video</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead align="right">Views</TableHead>
                      <TableHead align="right">Likes</TableHead>
                      <TableHead align="right">Comments</TableHead>
                      <TableHead align="right">Shares</TableHead>
                      <TableHead align="right">Duration</TableHead>
                      <TableHead align="right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {videos.map((vid) => (
                      <TableRow key={vid.id}>
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-[200px] max-w-sm">
                            {vid.cover_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={vid.cover_image_url}
                                alt={vid.title || "Video thumbnail"}
                                className="h-10 w-8 rounded-[var(--app-radius-sm)] object-cover shrink-0 border border-[var(--app-border)]"
                              />
                            ) : (
                              <div className="h-10 w-8 rounded-[var(--app-radius-sm)] bg-[var(--app-surface-subtle)] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[var(--app-text-primary)] truncate">
                                {vid.title || vid.video_description || "Untitled Video"}
                              </p>
                              {vid.video_description && vid.title && (
                                <p className="text-[11px] text-[var(--app-text-tertiary)] truncate">
                                  {vid.video_description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-[var(--app-text-secondary)] whitespace-nowrap font-mono text-[11px]">
                          {formatDate(vid.create_time)}
                        </TableCell>
                        <TableCell align="right" className="font-mono text-xs font-semibold text-[var(--app-text-primary)]">
                          {formatNumber(vid.view_count)}
                        </TableCell>
                        <TableCell align="right" className="font-mono text-xs text-[var(--app-text-secondary)]">
                          {formatNumber(vid.like_count)}
                        </TableCell>
                        <TableCell align="right" className="font-mono text-xs text-[var(--app-text-secondary)]">
                          {formatNumber(vid.comment_count)}
                        </TableCell>
                        <TableCell align="right" className="font-mono text-xs text-[var(--app-text-secondary)]">
                          {formatNumber(vid.share_count)}
                        </TableCell>
                        <TableCell align="right" className="font-mono text-xs text-[var(--app-text-tertiary)]">
                          {formatDuration(vid.duration)}
                        </TableCell>
                        <TableCell align="right">
                          {vid.share_url ? (
                            <a href={vid.share_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="secondary" size="sm">
                                Watch
                              </Button>
                            </a>
                          ) : (
                            <span className="text-[11px] text-[var(--app-text-tertiary)]">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
