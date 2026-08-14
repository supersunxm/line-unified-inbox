"use client";

import Link from "next/link";
import type {
  TikTokAccountListItem,
  TikTokHistoricalMetricsData,
  TikTokStoreData,
  TikTokVideoItem,
} from "../tiktok-types";
import { TikTokFollowerGrowthChart } from "./tiktok-follower-chart";

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
      className: "text-slate-400 dark:text-slate-500 font-medium",
    };
  }

  if (delta > 0) {
    return {
      text: `+${new Intl.NumberFormat("en-US").format(delta)}`,
      className: "text-emerald-600 dark:text-emerald-400 font-semibold",
    };
  }

  if (delta < 0) {
    return {
      text: new Intl.NumberFormat("en-US").format(delta),
      className: "text-rose-600 dark:text-rose-400 font-semibold",
    };
  }

  return {
    text: "0",
    className: "text-slate-500 dark:text-slate-400 font-medium",
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
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-[#0b0d11] dark:text-slate-100">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-[#12151c]/90">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 font-bold text-xs text-white shadow-xs dark:bg-emerald-500">
                O
              </span>
              <div>
                <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  OPPO Retail TikTok Monitor
                </span>
                <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
                  {" "}
                  · TikTok Dashboard
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/tiktok"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Stores Overview
              </Link>
              <Link
                href="/tiktok/connect"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Connect TikTok
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-16 sm:px-6">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-[#12151c] sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              No TikTok Account Connected Yet
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
              Connect your authorized TikTok store account to start monitoring real-time audience metrics and video engagement performance.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/tiktok/connect"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Connect TikTok Account
              </Link>
              <Link
                href="/tiktok"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Overview
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 2. Active Dashboard State
  const { profile, videos, updatedAt, storeMaster } = data;
  const avatarSrc = profile.avatar_large_url || profile.avatar_url || profile.avatar_url_100;
  const profileUrl =
    profile.profile_web_link ||
    (profile.username ? `https://www.tiktok.com/@${profile.username}` : undefined);

  // Calculated Metrics across persisted videos
  const totalVideoViews = videos.reduce((sum, v) => sum + (v.view_count || 0), 0);
  const avgViewsPerVideo = videos.length > 0 ? Math.round(totalVideoViews / videos.length) : 0;
  const totalLikesOnVideos = videos.reduce((sum, v) => sum + (v.like_count || 0), 0);
  const totalComments = videos.reduce((sum, v) => sum + (v.comment_count || 0), 0);
  const totalShares = videos.reduce((sum, v) => sum + (v.share_count || 0), 0);
  const totalEngagement = totalLikesOnVideos + totalComments + totalShares;
  const avgEngagementPerVideo =
    videos.length > 0 ? Math.round(totalEngagement / videos.length) : 0;

  // Top Performing Videos
  const topVideoByViews: TikTokVideoItem | undefined =
    videos.length > 0
      ? [...videos].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))[0]
      : undefined;

  const topVideoByLikes: TikTokVideoItem | undefined =
    videos.length > 0
      ? [...videos].sort((a, b) => (b.like_count || 0) - (a.like_count || 0))[0]
      : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-[#0b0d11] dark:text-slate-100">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-[#12151c]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 font-bold text-xs text-white shadow-xs dark:bg-emerald-500">
              O
            </span>
            <div>
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                OPPO Retail TikTok Monitor
              </span>
              <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
                {" "}
                · TikTok Dashboard
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/tiktok"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Overview
            </Link>
            <Link
              href="/tiktok/connect"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Connect Account
            </Link>
          </div>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        {/* Account / Store Identity Header Banner */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#12151c] sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4 sm:gap-5">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt={profile.display_name || "TikTok Profile"}
                  className="h-16 w-16 rounded-2xl border-2 border-emerald-500/20 object-cover shadow-xs dark:border-emerald-500/30 sm:h-20 sm:w-20"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 font-bold text-2xl text-white shadow-xs sm:h-20 sm:w-20">
                  {(profile.display_name || "T")[0].toUpperCase()}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
                    {profile.display_name || "TikTok Store Account"}
                  </h1>
                  {profile.is_verified && (
                    <span
                      title="Verified Account"
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white"
                    >
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Connected
                  </span>
                </div>

                {profile.username && (
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    @{profile.username}
                  </p>
                )}

                {/* Store Mapping Location Tag */}
                <div className="pt-0.5">
                  {storeMaster ? (
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {storeMaster.storeName}
                      </span>
                      {storeMaster.province && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span>{storeMaster.province}</span>
                        </>
                      )}
                      {storeMaster.region && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="text-slate-500">{storeMaster.region}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Store not linked yet
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
              {accounts.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="tiktok-store-switcher" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Store:
                  </label>
                  <select
                    id="tiktok-store-switcher"
                    value={currentAccountId || data.id || ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        window.location.href = `/tiktok/dashboard/${e.target.value}`;
                      }
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.storeMaster?.storeName || acc.displayName} (@{acc.username || acc.displayName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {profileUrl && (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span>View on TikTok</span>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              )}
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Synced {new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        </section>

        {/* 6 Key Performance Indicators (KPI) Grid */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Followers
              </span>
              <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
                {formatNumber(profile.follower_count)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                {formatCompactNumber(profile.follower_count)} total
              </p>
            </div>

            {/* Growth delta breakdown: Today, 7D, 30D */}
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Today</span>
                {(() => {
                  const d = formatDelta(historicalMetrics?.summary?.dailyFollowerGrowth);
                  return <span className={d.className}>{d.text}</span>;
                })()}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">7 Days</span>
                {(() => {
                  const d = formatDelta(historicalMetrics?.summary?.sevenDayFollowerGrowth);
                  return <span className={d.className}>{d.text}</span>;
                })()}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">30 Days</span>
                {(() => {
                  const d = formatDelta(historicalMetrics?.summary?.thirtyDayFollowerGrowth);
                  return <span className={d.className}>{d.text}</span>;
                })()}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Following
            </span>
            <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
              {formatNumber(profile.following_count)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
              Accounts
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Likes
            </span>
            <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
              {formatNumber(profile.likes_count)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
              {formatCompactNumber(profile.likes_count)} likes
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Videos
            </span>
            <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
              {formatNumber(profile.video_count)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
              Public posts
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Video Views
            </span>
            <p className="mt-2 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-2xl">
              {formatNumber(totalVideoViews)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
              Across synced videos
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Avg Views / Video
            </span>
            <p className="mt-2 text-xl font-bold tracking-tight text-sky-600 dark:text-sky-400 sm:text-2xl">
              {formatNumber(avgViewsPerVideo)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
              Per video average
            </p>
          </div>
        </section>

        {/* Follower Growth Trend Line Chart */}
        {historicalMetrics && (
          <section>
            <TikTokFollowerGrowthChart
              history={historicalMetrics.history}
              summary={historicalMetrics.summary}
              accountDisplayName={profile.display_name}
            />
          </section>
        )}

        {/* Video Performance Summary Highlights */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 sm:gap-6">
          {/* Top Video by Views */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  🔥 Top Video by Views
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {formatCompactNumber(topVideoByViews?.view_count)} views
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {topVideoByViews?.title || topVideoByViews?.video_description || "Latest Featured Video"}
              </p>
            </div>
            {topVideoByViews?.share_url && (
              <a
                href={topVideoByViews.share_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
              >
                <span>Watch video on TikTok</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            )}
          </div>

          {/* Top Video by Likes */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  ❤️ Top Video by Likes
                </span>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                  {formatCompactNumber(topVideoByLikes?.like_count)} likes
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {topVideoByLikes?.title || topVideoByLikes?.video_description || "Top Liked Content"}
              </p>
            </div>
            {topVideoByLikes?.share_url && (
              <a
                href={topVideoByLikes.share_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
              >
                <span>Watch video on TikTok</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            )}
          </div>

          {/* Total Video Engagement */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              📊 Total Engagement
            </span>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {formatNumber(totalEngagement)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Likes ({formatCompactNumber(totalLikesOnVideos)}) + Comments ({formatCompactNumber(totalComments)}) + Shares ({formatCompactNumber(totalShares)})
            </p>
          </div>

          {/* Average Engagement per Video */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              🎯 Avg Engagement / Post
            </span>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {formatNumber(avgEngagementPerVideo)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Combined audience interactions per video
            </p>
          </div>
        </section>

        {/* Recent Videos Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">
                Recent Published Videos
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detailed performance metrics for {videos.length} videos synced from TikTok.
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {videos.length} Videos
            </span>
          </div>

          {videos.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No public videos found on this TikTok account yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-[#12151c]"
                >
                  {/* Cover Image / Thumbnail Container */}
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                    {video.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={video.cover_image_url}
                        alt={video.title || "TikTok Video"}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-600">
                        <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.85.12V9.41a6.33 6.33 0 0 0-.85-.06 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.28 8.28 0 0 0 4.84 1.55V6.85a4.85 4.85 0 0 1-1.07-.16z" />
                        </svg>
                      </div>
                    )}
                    {video.duration && (
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                        {formatDuration(video.duration)}
                      </span>
                    )}
                  </div>

                  {/* Video Metadata & Stats */}
                  <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                    <div>
                      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        {formatDate(video.create_time)}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
                        {video.title || video.video_description || "Untitled Video"}
                      </h3>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <span className="block text-[10px] uppercase text-slate-400 dark:text-slate-500">
                            Views
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {formatCompactNumber(video.view_count)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase text-slate-400 dark:text-slate-500">
                            Likes
                          </span>
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            {formatCompactNumber(video.like_count)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase text-slate-400 dark:text-slate-500">
                            Comments
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {formatCompactNumber(video.comment_count)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase text-slate-400 dark:text-slate-500">
                            Shares
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {formatCompactNumber(video.share_count)}
                          </span>
                        </div>
                      </div>

                      {video.share_url && (
                        <div className="mt-3 pt-2 text-center">
                          <a
                            href={video.share_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                          >
                            <span>Watch on TikTok</span>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
