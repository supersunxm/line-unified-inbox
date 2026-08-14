"use client";

import Link from "next/link";
import type { TikTokStoreData } from "./tiktok-types";

interface TikTokOverviewViewProps {
  data: TikTokStoreData | null;
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

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TikTokOverviewView({ data }: TikTokOverviewViewProps) {
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
                  · Module Overview
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/tiktok/dashboard"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Dashboard
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
              Connect your authorized TikTok retail account to enable real-time audience metrics, engagement insights, and video performance monitoring.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/tiktok/connect"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Connect TikTok Account
              </Link>
              <Link
                href="/tiktok/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 2. Connected State
  const { profile, videos, updatedAt, storeMaster } = data;
  const avatarSrc = profile.avatar_large_url || profile.avatar_url || profile.avatar_url_100;
  const profileUrl =
    profile.profile_web_link ||
    (profile.username ? `https://www.tiktok.com/@${profile.username}` : undefined);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-[#0b0d11] dark:text-slate-100">
      {/* Top Navigation Header */}
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
                · Module Overview
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/tiktok/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              <span>Dashboard</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/tiktok/connect"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Reconnect
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        {/* Store Account Banner Card */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#12151c] sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4 sm:gap-5">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt={profile.display_name || "TikTok Profile"}
                  className="h-20 w-20 rounded-2xl border-2 border-emerald-500/20 object-cover shadow-xs dark:border-emerald-500/30 sm:h-24 sm:w-24"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600 font-bold text-2xl text-white shadow-xs sm:h-24 sm:w-24">
                  {(profile.display_name || "T")[0].toUpperCase()}
                </div>
              )}

              <div className="space-y-1.5">
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

                {/* Retail Store Attribution Badge */}
                <div className="pt-1">
                  {storeMaster ? (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
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
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Store not linked yet
                      </span>
                    </div>
                  )}
                </div>

                {profile.bio_description && (
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {profile.bio_description}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 sm:flex-col sm:items-end">
              <Link
                href="/tiktok/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                <span>Open Dashboard</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
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
                Last synced: {formatDate(updatedAt)}
              </span>
            </div>
          </div>
        </section>

        {/* Quick Audience Overview Grid */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Followers</span>
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              {formatNumber(profile.follower_count)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              {formatCompactNumber(profile.follower_count)} total followers
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Following</span>
              <svg className="h-4 w-4 text-sky-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              {formatNumber(profile.following_count)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Accounts followed
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Total Likes</span>
              <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              {formatNumber(profile.likes_count)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              {formatCompactNumber(profile.likes_count)} likes across account
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#12151c]">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Public Videos</span>
              <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              {formatNumber(profile.video_count)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              {videos.length} videos synced to database
            </p>
          </div>
        </section>

        {/* Dashboard Entry CTA Banner */}
        <section className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-6 dark:border-emerald-500/20 dark:from-emerald-950/40 sm:flex-row sm:p-8">
          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">
              Explore Store Video Performance &amp; Engagement
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
              View total video views, top performing content, comment breakdown, and share ratios.
            </p>
          </div>
          <Link
            href="/tiktok/dashboard"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            <span>Open Performance Dashboard</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </section>
      </main>
    </div>
  );
}
