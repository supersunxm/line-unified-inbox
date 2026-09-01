"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageContainer, PageHeader, FilterBar } from "@/components/shell";
import { Badge, Button, Card, MetricCard, SearchInput } from "@/components/ui";
import { LanguageControl, useAppLanguage } from "../language";
import { getTikTokLocale, getTikTokOverviewText } from "./tiktok-overview-translations";
import type {
  TikTokAccountListItem,
  TikTokAccountMetricsGrowthSummary,
  TikTokBulkMetricsSummaryResponse,
  TikTokGrowthPeriod,
  TikTokHistoricalMetricsData,
  TikTokStoreData,
} from "./tiktok-types";

interface TikTokOverviewViewProps {
  accounts?: TikTokAccountListItem[];
  singleAccountData?: TikTokStoreData | null;
  historicalMetrics?: TikTokHistoricalMetricsData | null;
  bulkMetricsSummary?: TikTokBulkMetricsSummaryResponse | null;
  data?: TikTokStoreData | null;
}

const DEMO_PREVIEW_GROWTH = {
  today: { followers: 18, following: 1, likes: 697, videos: 0 },
  sevenDays: { followers: 132, following: 6, likes: 1821, videos: 4 },
  thirtyDays: { followers: 562, following: 14, likes: 4213, videos: 9 },
};

function formatNumber(value: number | null | undefined, locale: string): string {
  return new Intl.NumberFormat(locale).format(value ?? 0);
}

function formatCompactNumber(value: number | null | undefined): string {
  const amount = value ?? 0;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(amount);
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deltaPresentation(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) {
    return { text: "--", className: "text-[var(--app-text-tertiary)] font-medium" };
  }
  const formatted = new Intl.NumberFormat(locale).format(value);
  if (value > 0) return { text: `+${formatted}`, className: "text-[var(--app-success)] font-semibold" };
  if (value < 0) return { text: formatted, className: "text-[var(--app-danger)] font-semibold" };
  return { text: "0", className: "text-[var(--app-text-secondary)] font-medium" };
}

function growthPresentation(value: number | null | undefined, periodLabel: string, locale: string) {
  const delta = deltaPresentation(value, locale);
  if (value === null || value === undefined) return delta;
  if (value > 0) return { ...delta, text: `${delta.text} ▲ ${periodLabel}` };
  if (value < 0) return { ...delta, text: `${delta.text} ▼ ${periodLabel}` };
  return { ...delta, text: `0 ${periodLabel}` };
}

export function TikTokOverviewView({
  accounts = [],
  singleAccountData,
  historicalMetrics,
  bulkMetricsSummary,
  data,
}: TikTokOverviewViewProps) {
  const { language } = useAppLanguage();
  const t = getTikTokOverviewText(language);
  const locale = getTikTokLocale(language);
  const effectiveData = singleAccountData || data || null;
  const totalAccounts = accounts.length;
  const [growthPeriod, setGrowthPeriod] = useState<TikTokGrowthPeriod>("sevenDays");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [selectedProvince, setSelectedProvince] = useState("ALL");
  const [sortOption, setSortOption] = useState("storeNameAsc");

  const growthMap = useMemo(() => {
    const map = new Map<string, { today: TikTokAccountMetricsGrowthSummary; sevenDays: TikTokAccountMetricsGrowthSummary; thirtyDays: TikTokAccountMetricsGrowthSummary }>();
    for (const item of bulkMetricsSummary?.accounts ?? []) map.set(item.accountId, item.growth);
    return map;
  }, [bulkMetricsSummary]);

  const growthFor = (account: TikTokAccountListItem, period: TikTokGrowthPeriod): TikTokAccountMetricsGrowthSummary => {
    if (account.connectionStatus === "DEMO PREVIEW" || account.id === "demo-preview-mega-bangna") return DEMO_PREVIEW_GROWTH[period];
    return growthMap.get(account.id)?.[period] ?? { followers: null, following: null, likes: null, videos: null };
  };

  const regionOptions = useMemo(
    () => [...new Set(accounts.map((account) => account.storeMaster?.region?.trim()).filter((value): value is string => Boolean(value)))].sort(),
    [accounts],
  );
  const provinceOptions = useMemo(
    () => [...new Set(accounts.map((account) => account.storeMaster?.province?.trim()).filter((value): value is string => Boolean(value)))].sort(),
    [accounts],
  );

  const visibleAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = accounts.filter((account) => {
      if (selectedRegion !== "ALL" && account.storeMaster?.region !== selectedRegion) return false;
      if (selectedProvince !== "ALL" && account.storeMaster?.province !== selectedProvince) return false;
      if (!query) return true;
      return [account.storeMaster?.storeName, account.storeMaster?.accountName, account.displayName, account.username]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });

    return [...filtered].sort((a, b) => {
      const nameA = a.storeMaster?.storeName || a.displayName || "";
      const nameB = b.storeMaster?.storeName || b.displayName || "";
      if (sortOption === "followersDesc") return (b.followerCount || 0) - (a.followerCount || 0);
      if (sortOption === "followerGrowthDesc") return (growthFor(b, growthPeriod).followers ?? Number.NEGATIVE_INFINITY) - (growthFor(a, growthPeriod).followers ?? Number.NEGATIVE_INFINITY);
      if (sortOption === "likesDesc") return (b.likesCount || 0) - (a.likesCount || 0);
      if (sortOption === "videosDesc") return (b.videoCountRecorded ?? b.videoCount ?? 0) - (a.videoCountRecorded ?? a.videoCount ?? 0);
      return nameA.localeCompare(nameB);
    });
  }, [accounts, growthMap, growthPeriod, searchQuery, selectedProvince, selectedRegion, sortOption]);

  const periodLabel = growthPeriod === "today" ? t.today : growthPeriod === "sevenDays" ? t.sevenDays : t.thirtyDays;
  const hasActiveFilter = Boolean(searchQuery.trim() || selectedRegion !== "ALL" || selectedProvince !== "ALL");
  const statusBadge = (status: string) => {
    if (status === "CONNECTED") return <Badge size="sm" variant="success">{t.connected}</Badge>;
    if (status === "EXPIRED") return <Badge size="sm" variant="warning">{t.expired}</Badge>;
    return <Badge size="sm" variant="neutral">{status}</Badge>;
  };

  if (totalAccounts === 0 && !effectiveData) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-4xl space-y-6">
          <PageHeader
            tag={t.monitorTag}
            title={t.storeAccountsTitle}
            description={t.storeAccountsDescription}
            actions={<div className="flex items-center gap-2"><LanguageControl /><Link href="/tiktok/dashboard"><Button variant="secondary" size="sm">{t.dashboard}</Button></Link><Link href="/tiktok/connect"><Button variant="primary" size="sm">{t.connectTikTok}</Button></Link></div>}
          />
          <Card className="space-y-4 p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--app-radius-lg)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </div>
            <div className="space-y-1"><h1 className="text-xl font-bold text-[var(--app-text-primary)]">{t.noAccountTitle}</h1><p className="mx-auto max-w-md text-xs leading-relaxed text-[var(--app-text-secondary)]">{t.noAccountDescription}</p></div>
            <div className="flex justify-center pt-2"><Link href="/tiktok/connect"><Button variant="primary" size="md">{t.connectTikTokAccount}</Button></Link></div>
          </Card>
        </div>
      </PageContainer>
    );
  }

  if (totalAccounts > 1) {
    const totals = accounts.reduce((sum, account) => ({
      followers: sum.followers + (account.followerCount || 0),
      likes: sum.likes + (account.likesCount || 0),
      videos: sum.videos + (account.videoCountRecorded ?? account.videoCount ?? 0),
    }), { followers: 0, likes: 0, videos: 0 });

    return (
      <PageContainer>
        <div className="mx-auto max-w-7xl space-y-6">
          <PageHeader
            tag={t.overviewTag}
            title={t.connectedStoreAccounts}
            description={t.connectedStoreDescription}
            actions={<div className="flex flex-wrap items-center gap-2"><LanguageControl /><Link href="/tiktok/dashboard"><Button variant="secondary" size="sm">{t.openDashboard}</Button></Link><Link href="/tiktok/connect"><Button variant="primary" size="sm">{t.connectTikTokAccount}</Button></Link></div>}
          />

          <FilterBar>
            <div className="flex w-full flex-wrap items-center gap-3">
              <div className="flex items-center rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] p-0.5">
                {(["today", "sevenDays", "thirtyDays"] as TikTokGrowthPeriod[]).map((period) => (
                  <button key={period} type="button" onClick={() => setGrowthPeriod(period)} className={`rounded-[calc(var(--app-radius-sm)-2px)] px-2.5 py-1 text-xs font-semibold transition-colors ${growthPeriod === period ? "bg-[var(--app-accent)] text-white" : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"}`}>
                    {period === "today" ? t.today : period === "sevenDays" ? t.sevenDays : t.thirtyDays}
                  </button>
                ))}
              </div>
              <SearchInput value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t.searchPlaceholder} className="h-8 min-w-[240px] flex-1" />
              {regionOptions.length > 0 && <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)} className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)]"><option value="ALL">{t.allRegions}</option>{regionOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select>}
              {provinceOptions.length > 0 && <select value={selectedProvince} onChange={(event) => setSelectedProvince(event.target.value)} className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)]"><option value="ALL">{t.allProvinces}</option>{provinceOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select>}
              <select value={sortOption} onChange={(event) => setSortOption(event.target.value)} className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)]">
                <option value="storeNameAsc">{t.sortStoreName}</option><option value="followersDesc">{t.sortFollowers}</option><option value="followerGrowthDesc">{t.sortFollowerGrowth}</option><option value="likesDesc">{t.sortLikes}</option><option value="videosDesc">{t.sortVideos}</option>
              </select>
              {hasActiveFilter && <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setSelectedRegion("ALL"); setSelectedProvince("ALL"); }}>{t.clearFilters}</Button>}
            </div>
          </FilterBar>

          <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <MetricCard label={t.connectedAccounts} value={totalAccounts} tone="default" />
            <MetricCard label={t.totalFollowers} value={formatNumber(totals.followers, locale)} tone="accent" />
            <MetricCard label={t.totalLikes} value={formatNumber(totals.likes, locale)} tone="default" />
            <MetricCard label={t.totalPublicVideos} value={formatNumber(totals.videos, locale)} tone="info" />
          </section>

          {visibleAccounts.length === 0 ? (
            <Card className="p-10 text-center"><h2 className="font-bold">{t.noStores}</h2><p className="mt-1 text-xs text-[var(--app-text-secondary)]">{t.noStoresDescription}</p></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleAccounts.map((account) => {
                const growth = growthFor(account, growthPeriod);
                const followerGrowth = growthPresentation(growth.followers, periodLabel, locale);
                const likeGrowth = growthPresentation(growth.likes, periodLabel, locale);
                const videoGrowth = growthPresentation(growth.videos, periodLabel, locale);
                const name = account.storeMaster?.storeName || account.displayName || t.tiktokStoreAccount;
                return (
                  <Card key={account.id} className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {account.avatarUrl ? <img src={account.avatarUrl} alt={account.displayName || t.tiktokStoreAccount} className="h-12 w-12 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] object-cover" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--app-radius-lg)] bg-[var(--app-accent-soft)] text-lg font-bold text-[var(--app-accent)]">{name[0]?.toUpperCase()}</div>}
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5"><h3 className="truncate text-sm font-bold text-[var(--app-text-primary)]">{name}</h3>{statusBadge(account.connectionStatus || "CONNECTED")}</div>
                          {account.username && <p className="truncate font-mono text-xs text-[var(--app-accent)]">@{account.username}</p>}
                          <p className="text-[11px] text-[var(--app-text-tertiary)]">{t.storeBinding}: {account.storeMaster ? `${account.storeMaster.storeName} (${account.storeMaster.province || "—"})` : t.storeNotLinked}</p>
                        </div>
                      </div>
                      <Link href={`/tiktok/dashboard/${account.id}`}><Button variant="secondary" size="sm">{t.openDashboard}</Button></Link>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-t border-[var(--app-border-subtle)] pt-3 text-center">
                      {[
                        [t.followers, account.followerCount, followerGrowth],
                        [t.totalLikes, account.likesCount, likeGrowth],
                        [t.videos, account.videoCountRecorded ?? account.videoCount, videoGrowth],
                      ].map(([label, value, growthItem]) => {
                        const presentation = growthItem as ReturnType<typeof growthPresentation>;
                        return <div key={String(label)}><p className="text-[10px] font-semibold uppercase text-[var(--app-text-tertiary)]">{String(label)}</p><p className="mt-0.5 text-sm font-bold text-[var(--app-text-primary)]">{formatCompactNumber(value as number)}</p><span className={`block text-[10px] ${presentation.className}`}>{presentation.text}</span></div>;
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageContainer>
    );
  }

  const profile = effectiveData?.profile || {
    display_name: accounts[0]?.displayName || t.tiktokStoreAccount,
    username: accounts[0]?.username || null,
    avatar_url: accounts[0]?.avatarUrl || null,
    avatar_url_100: null,
    avatar_large_url: null,
    bio_description: accounts[0]?.bioDescription || null,
    profile_deep_link: null,
    profile_web_link: null,
    is_verified: accounts[0]?.isVerified || false,
    follower_count: accounts[0]?.followerCount || 0,
    following_count: accounts[0]?.followingCount || 0,
    likes_count: accounts[0]?.likesCount || 0,
    video_count: accounts[0]?.videoCount || 0,
  };
  const storeMaster = effectiveData?.storeMaster || accounts[0]?.storeMaster || null;
  const videos = effectiveData?.videos || [];
  const updatedAt = effectiveData?.updatedAt || accounts[0]?.lastSyncedAt || null;
  const dashboardLink = accounts[0]?.id ? `/tiktok/dashboard/${accounts[0].id}` : "/tiktok/dashboard";
  const profileUrl = profile.profile_web_link || (profile.username ? `https://www.tiktok.com/@${profile.username}` : null);
  const avatarSrc = profile.avatar_large_url || profile.avatar_url_100 || profile.avatar_url;

  return (
    <PageContainer>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader tag={t.accountOverviewTag} title={profile.display_name || t.tiktokStoreAccount} description={t.accountDescription} actions={<div className="flex flex-wrap items-center gap-2"><LanguageControl /><Link href={dashboardLink}><Button variant="primary" size="sm">{t.openDashboard}</Button></Link>{profileUrl && <a href={profileUrl} target="_blank" rel="noopener noreferrer"><Button variant="secondary" size="sm">{t.viewOnTikTok}</Button></a>}</div>} />

        <Card className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              {avatarSrc ? <img src={avatarSrc} alt={profile.display_name || t.tiktokStoreAccount} className="h-20 w-20 rounded-[var(--app-radius-xl)] border border-[var(--app-border)] object-cover shadow-[var(--app-shadow-card)]" /> : <div className="flex h-20 w-20 items-center justify-center rounded-[var(--app-radius-xl)] bg-[var(--app-accent-soft)] text-2xl font-bold text-[var(--app-accent)] shadow-[var(--app-shadow-card)]">{(profile.display_name || "T")[0].toUpperCase()}</div>}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold tracking-tight text-[var(--app-text-primary)]">{profile.display_name || t.tiktokStoreAccount}</h1>{profile.is_verified && <span title={t.verifiedAccount} className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--app-accent)] text-[10px] text-white">✓</span>}{statusBadge("CONNECTED")}</div>
                {profile.username && <p className="font-mono text-xs font-medium text-[var(--app-accent)]">@{profile.username}</p>}
                <div className="pt-1">{storeMaster ? <div className="inline-flex items-center gap-1.5 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 py-1 text-xs text-[var(--app-text-primary)]"><span className="font-semibold">{storeMaster.storeName}</span>{storeMaster.province && <><span className="text-[var(--app-text-tertiary)]">·</span><span className="text-[var(--app-text-secondary)]">{storeMaster.province}</span></>}</div> : <div className="inline-flex items-center gap-1.5 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 py-1 text-xs text-[var(--app-text-secondary)]">{t.storeNotLinked}</div>}</div>
                {profile.bio_description && <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--app-text-secondary)]">{profile.bio_description}</p>}
              </div>
            </div>
            <span className="font-mono text-[11px] text-[var(--app-text-tertiary)]">{t.lastSynced}: {formatDate(updatedAt, locale)}</span>
          </div>
        </Card>

        <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <Card className="flex flex-col justify-between p-4">
            <div><p className="text-xs font-medium uppercase text-[var(--app-text-secondary)]">{t.followers}</p><p className="mt-2 text-2xl font-bold text-[var(--app-text-primary)]">{formatNumber(profile.follower_count, locale)}</p><p className="text-[11px] text-[var(--app-text-tertiary)]">{t.followersTotal(formatCompactNumber(profile.follower_count))}</p></div>
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-2.5 dark:border-slate-800/80">
              {[
                [t.today, historicalMetrics?.summary?.dailyFollowerGrowth],
                [t.sevenDays, historicalMetrics?.summary?.sevenDayFollowerGrowth],
                [t.thirtyDays, historicalMetrics?.summary?.thirtyDayFollowerGrowth],
              ].map(([label, value]) => { const delta = deltaPresentation(value as number | null | undefined, locale); return <div key={String(label)} className="flex items-center justify-between text-[11px]"><span className="text-[var(--app-text-secondary)]">{String(label)}</span><span className={delta.className}>{delta.text}</span></div>; })}
            </div>
          </Card>
          <MetricCard label={t.following} value={formatNumber(profile.following_count, locale)} subtext={t.accountsFollowed} tone="default" />
          <MetricCard label={t.totalLikes} value={formatNumber(profile.likes_count, locale)} subtext={t.likesTotal(formatCompactNumber(profile.likes_count))} tone="accent" />
          <MetricCard label={t.totalPublicVideos} value={formatNumber(profile.video_count, locale)} subtext={t.videosSynced(videos.length)} tone="info" />
        </section>

        <Card className="flex flex-col gap-4 border-[var(--app-accent)]/30 bg-gradient-to-r from-[var(--app-accent-soft)]/30 to-transparent p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1"><h2 className="text-base font-bold text-[var(--app-text-primary)]">{t.performanceTitle}</h2><p className="text-xs text-[var(--app-text-secondary)]">{t.performanceDescription}</p></div>
          <Link href={dashboardLink}><Button variant="primary" size="md">{t.openPerformanceDashboard}</Button></Link>
        </Card>
      </div>
    </PageContainer>
  );
}
