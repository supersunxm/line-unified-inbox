"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageContainer, PageHeader, FilterBar } from "@/components/shell";
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
  SearchInput,
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
  data?: TikTokStoreData | null; // For backwards compatibility
}

const DEMO_PREVIEW_GROWTH = {
  today: {
    followers: 18,
    following: 1,
    likes: 697,
    videos: 0,
  },
  sevenDays: {
    followers: 132,
    following: 6,
    likes: 1821,
    videos: 4,
  },
  thirtyDays: {
    followers: 562,
    following: 14,
    likes: 4213,
    videos: 9,
  },
};

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

function getPeriodChipSuffix(period: TikTokGrowthPeriod): string {
  switch (period) {
    case "today":
      return "Today";
    case "sevenDays":
      return "7D";
    case "thirtyDays":
      return "30D";
  }
}

function formatGrowthChip(
  value: number | null | undefined,
  periodLabel: string
): { text: string; className: string } {
  if (value === null || value === undefined) {
    return {
      text: `--`,
      className: "text-[var(--app-text-tertiary)] font-medium",
    };
  }

  if (value > 0) {
    return {
      text: `+${new Intl.NumberFormat("en-US").format(value)} ▲ ${periodLabel}`,
      className: "text-[var(--app-success)] font-semibold",
    };
  }

  if (value < 0) {
    return {
      text: `${new Intl.NumberFormat("en-US").format(value)} ▼ ${periodLabel}`,
      className: "text-[var(--app-danger)] font-semibold",
    };
  }

  return {
    text: `0 ${periodLabel}`,
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

function renderStatusBadge(status: string) {
  if (status === "CONNECTED") {
    return (
      <Badge size="sm" variant="success">
        Connected
      </Badge>
    );
  }
  if (status === "EXPIRED") {
    return (
      <Badge size="sm" variant="warning">
        Expired
      </Badge>
    );
  }
  return (
    <Badge size="sm" variant="neutral">
      {status}
    </Badge>
  );
}

export function TikTokOverviewView({
  accounts = [],
  singleAccountData,
  historicalMetrics,
  bulkMetricsSummary,
  data,
}: TikTokOverviewViewProps) {
  const effectiveData = singleAccountData || data || null;
  const totalAccounts = accounts.length;

  const [growthPeriod, setGrowthPeriod] = useState<TikTokGrowthPeriod>("sevenDays");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [selectedProvince, setSelectedProvince] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [sortOption, setSortOption] = useState<string>("storeNameAsc");

  const metricsSummaryMap = useMemo(() => {
    const map = new Map<
      string,
      {
        today: TikTokAccountMetricsGrowthSummary;
        sevenDays: TikTokAccountMetricsGrowthSummary;
        thirtyDays: TikTokAccountMetricsGrowthSummary;
      }
    >();
    if (bulkMetricsSummary?.accounts) {
      for (const item of bulkMetricsSummary.accounts) {
        map.set(item.accountId, item.growth);
      }
    }
    return map;
  }, [bulkMetricsSummary]);

  const getAccountGrowthValues = (
    account: TikTokAccountListItem,
    period: TikTokGrowthPeriod
  ): TikTokAccountMetricsGrowthSummary => {
    if (
      account.connectionStatus === "DEMO PREVIEW" ||
      account.id === "demo-preview-mega-bangna"
    ) {
      return DEMO_PREVIEW_GROWTH[period];
    }
    const growth = metricsSummaryMap.get(account.id);
    if (growth && growth[period]) {
      return growth[period];
    }
    return {
      followers: null,
      following: null,
      likes: null,
      videos: null,
    };
  };

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const acc of accounts) {
      if (acc.storeMaster?.region) {
        set.add(acc.storeMaster.region.trim());
      }
    }
    return Array.from(set).sort();
  }, [accounts]);

  const provinceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const acc of accounts) {
      if (acc.storeMaster?.province) {
        set.add(acc.storeMaster.province.trim());
      }
    }
    return Array.from(set).sort();
  }, [accounts]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const acc of accounts) {
      if (acc.connectionStatus) {
        set.add(acc.connectionStatus.trim());
      }
    }
    return Array.from(set).sort();
  }, [accounts]);

  const sortedAndFilteredAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = accounts.filter((acc) => {
      if (query) {
        const storeName = acc.storeMaster?.storeName?.toLowerCase() || "";
        const accountName = acc.storeMaster?.accountName?.toLowerCase() || "";
        const displayName = acc.displayName?.toLowerCase() || "";
        const username = acc.username?.toLowerCase() || "";
        if (
          !storeName.includes(query) &&
          !accountName.includes(query) &&
          !displayName.includes(query) &&
          !username.includes(query)
        ) {
          return false;
        }
      }

      if (selectedRegion !== "ALL") {
        if ((acc.storeMaster?.region || "") !== selectedRegion) {
          return false;
        }
      }

      if (selectedProvince !== "ALL") {
        if ((acc.storeMaster?.province || "") !== selectedProvince) {
          return false;
        }
      }

      if (selectedStatus !== "ALL") {
        if (acc.connectionStatus !== selectedStatus) {
          return false;
        }
      }

      return true;
    });

    const compareGrowth = (
      aValue: number | null | undefined,
      bValue: number | null | undefined,
      isAscending: boolean
    ) => {
      const aHasVal = aValue !== null && aValue !== undefined;
      const bHasVal = bValue !== null && bValue !== undefined;

      if (!aHasVal && !bHasVal) return 0;
      if (!aHasVal) return 1;
      if (!bHasVal) return -1;

      return isAscending ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
    };

    return [...filtered].sort((a, b) => {
      const nameA = a.storeMaster?.storeName || a.displayName || "";
      const nameB = b.storeMaster?.storeName || b.displayName || "";

      switch (sortOption) {
        case "storeNameAsc":
          return nameA.localeCompare(nameB);
        case "storeNameDesc":
          return nameB.localeCompare(nameA);

        case "followersDesc":
          return (b.followerCount || 0) - (a.followerCount || 0);
        case "followersAsc":
          return (a.followerCount || 0) - (b.followerCount || 0);

        case "followerGrowthDesc": {
          const gA = getAccountGrowthValues(a, growthPeriod).followers;
          const gB = getAccountGrowthValues(b, growthPeriod).followers;
          const diff = compareGrowth(gA, gB, false);
          return diff !== 0 ? diff : nameA.localeCompare(nameB);
        }
        case "followerGrowthAsc": {
          const gA = getAccountGrowthValues(a, growthPeriod).followers;
          const gB = getAccountGrowthValues(b, growthPeriod).followers;
          const diff = compareGrowth(gA, gB, true);
          return diff !== 0 ? diff : nameA.localeCompare(nameB);
        }

        case "likesDesc":
          return (b.likesCount || 0) - (a.likesCount || 0);
        case "likesAsc":
          return (a.likesCount || 0) - (b.likesCount || 0);

        case "likeGrowthDesc": {
          const gA = getAccountGrowthValues(a, growthPeriod).likes;
          const gB = getAccountGrowthValues(b, growthPeriod).likes;
          const diff = compareGrowth(gA, gB, false);
          return diff !== 0 ? diff : nameA.localeCompare(nameB);
        }
        case "likeGrowthAsc": {
          const gA = getAccountGrowthValues(a, growthPeriod).likes;
          const gB = getAccountGrowthValues(b, growthPeriod).likes;
          const diff = compareGrowth(gA, gB, true);
          return diff !== 0 ? diff : nameA.localeCompare(nameB);
        }

        case "videosDesc":
          return (
            (b.videoCountRecorded ?? b.videoCount ?? 0) -
            (a.videoCountRecorded ?? a.videoCount ?? 0)
          );
        case "videosAsc":
          return (
            (a.videoCountRecorded ?? a.videoCount ?? 0) -
            (b.videoCountRecorded ?? b.videoCount ?? 0)
          );

        case "videoGrowthDesc": {
          const gA = getAccountGrowthValues(a, growthPeriod).videos;
          const gB = getAccountGrowthValues(b, growthPeriod).videos;
          const diff = compareGrowth(gA, gB, false);
          return diff !== 0 ? diff : nameA.localeCompare(nameB);
        }
        case "videoGrowthAsc": {
          const gA = getAccountGrowthValues(a, growthPeriod).videos;
          const gB = getAccountGrowthValues(b, growthPeriod).videos;
          const diff = compareGrowth(gA, gB, true);
          return diff !== 0 ? diff : nameA.localeCompare(nameB);
        }

        default:
          return nameA.localeCompare(nameB);
      }
    });
  }, [
    accounts,
    searchQuery,
    selectedRegion,
    selectedProvince,
    selectedStatus,
    sortOption,
    growthPeriod,
    metricsSummaryMap,
  ]);

  const hasActiveFilter =
    searchQuery.trim().length > 0 ||
    selectedRegion !== "ALL" ||
    selectedProvince !== "ALL" ||
    selectedStatus !== "ALL";

  // 1. Empty State (0 accounts connected)
  if (totalAccounts === 0 && !effectiveData) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-4xl space-y-6">
          <PageHeader
            tag="OPPO Retail TikTok Monitor"
            title="TikTok Store Accounts"
            description="Authorized TikTok store account profile, metrics, and module overview."
            actions={
              <div className="flex items-center gap-2">
                <Link href="/tiktok/dashboard">
                  <Button variant="secondary" size="sm">Dashboard</Button>
                </Link>
                <Link href="/tiktok/connect">
                  <Button variant="primary" size="sm">Connect TikTok</Button>
                </Link>
              </div>
            }
          />
          <Card className="p-10 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--app-radius-lg)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-[var(--app-text-primary)]">
                No TikTok Account Connected Yet
              </h1>
              <p className="mx-auto max-w-md text-xs text-[var(--app-text-secondary)] leading-relaxed">
                Connect your authorized TikTok retail account to enable real-time audience metrics, engagement insights, and video performance monitoring.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <Link href="/tiktok/connect">
                <Button variant="primary" size="md">
                  Connect TikTok Account
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </PageContainer>
    );
  }

  // 2. Multi-Account Grid State (2+ accounts exist)
  if (totalAccounts > 1) {
    const periodSuffix = getPeriodChipSuffix(growthPeriod);

    return (
      <PageContainer>
        <div className="mx-auto max-w-7xl space-y-6">
          <PageHeader
            tag="OPPO Retail TikTok Monitor · Store Accounts Overview"
            title="Connected Store Accounts"
            description="Overview and comparative performance of authorized TikTok retail store accounts."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/tiktok/dashboard">
                  <Button variant="secondary" size="sm">
                    Open Dashboard
                  </Button>
                </Link>
                <Link href="/tiktok/connect">
                  <Button variant="primary" size="sm">
                    Connect TikTok Account
                  </Button>
                </Link>
              </div>
            }
          />

          <FilterBar>
            <div className="flex flex-wrap items-center gap-3 w-full">
              {/* Growth Period Switcher */}
              <div className="flex items-center rounded-[var(--app-radius-sm)] border border-[var(--app-border)] p-0.5 bg-[var(--app-surface)]">
                <button
                  type="button"
                  onClick={() => setGrowthPeriod("today")}
                  className={`rounded-[calc(var(--app-radius-sm)-2px)] px-2.5 py-1 text-xs font-semibold transition-colors ${
                    growthPeriod === "today"
                      ? "bg-[var(--app-accent)] text-white"
                      : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setGrowthPeriod("sevenDays")}
                  className={`rounded-[calc(var(--app-radius-sm)-2px)] px-2.5 py-1 text-xs font-semibold transition-colors ${
                    growthPeriod === "sevenDays"
                      ? "bg-[var(--app-accent)] text-white"
                      : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
                  }`}
                >
                  7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setGrowthPeriod("thirtyDays")}
                  className={`rounded-[calc(var(--app-radius-sm)-2px)] px-2.5 py-1 text-xs font-semibold transition-colors ${
                    growthPeriod === "thirtyDays"
                      ? "bg-[var(--app-accent)] text-white"
                      : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
                  }`}
                >
                  30 Days
                </button>
              </div>

              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search store name, username, or display name…"
                className="h-8 min-w-[240px] flex-1"
              />

              {regionOptions.length > 0 && (
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                >
                  <option value="ALL">All Regions</option>
                  {regionOptions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}

              {provinceOptions.length > 0 && (
                <select
                  value={selectedProvince}
                  onChange={(e) => setSelectedProvince(e.target.value)}
                  className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                >
                  <option value="ALL">All Provinces</option>
                  {provinceOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}

              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
              >
                <option value="storeNameAsc">Store Name (A-Z)</option>
                <option value="followersDesc">Followers (High to Low)</option>
                <option value="followerGrowthDesc">Follower Growth (Highest)</option>
                <option value="likesDesc">Total Likes (High to Low)</option>
                <option value="videosDesc">Videos (High to Low)</option>
              </select>

              {hasActiveFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedRegion("ALL");
                    setSelectedProvince("ALL");
                    setSelectedStatus("ALL");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </FilterBar>

          {/* Aggregate KPI Overview */}
          <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <MetricCard
              label="Connected Accounts"
              value={totalAccounts}
              tone="default"
            />
            <MetricCard
              label="Total Followers"
              value={formatNumber(
                accounts.reduce((sum, a) => sum + (a.followerCount || 0), 0)
              )}
              tone="accent"
            />
            <MetricCard
              label="Total Likes"
              value={formatNumber(
                accounts.reduce((sum, a) => sum + (a.likesCount || 0), 0)
              )}
              tone="default"
            />
            <MetricCard
              label="Total Public Videos"
              value={formatNumber(
                accounts.reduce(
                  (sum, a) => sum + (a.videoCountRecorded ?? a.videoCount ?? 0),
                  0
                )
              )}
              tone="info"
            />
          </section>

          {/* Multi-Store Account Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {sortedAndFilteredAccounts.map((account) => {
              const growth = getAccountGrowthValues(account, growthPeriod);
              const fGrowth = formatGrowthChip(growth.followers, periodSuffix);
              const lGrowth = formatGrowthChip(growth.likes, periodSuffix);
              const vGrowth = formatGrowthChip(growth.videos, periodSuffix);

              return (
                <Card key={account.id} className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {account.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={account.avatarUrl}
                          alt={account.displayName || "TikTok Store"}
                          className="h-12 w-12 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--app-radius-lg)] bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold text-lg">
                          {(account.displayName || "T")[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-sm text-[var(--app-text-primary)] truncate">
                            {account.storeMaster?.storeName || account.displayName || "TikTok Account"}
                          </h3>
                          {renderStatusBadge(account.connectionStatus || "CONNECTED")}
                        </div>
                        {account.username && (
                          <p className="text-xs font-mono text-[var(--app-accent)] truncate">
                            @{account.username}
                          </p>
                        )}
                        <p className="text-[11px] text-[var(--app-text-tertiary)]">
                          Store Binding: {account.storeMaster ? `${account.storeMaster.storeName} (${account.storeMaster.province || "—"})` : "Store not linked yet"}
                        </p>
                      </div>
                    </div>

                    <Link href={`/tiktok/dashboard/${account.id}`}>
                      <Button variant="secondary" size="sm">
                        Open Dashboard
                      </Button>
                    </Link>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-[var(--app-border-subtle)] pt-3 text-center">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-[var(--app-text-tertiary)]">Followers</p>
                      <p className="mt-0.5 text-sm font-bold text-[var(--app-text-primary)]">{formatNumber(account.followerCount)}</p>
                      <span className={`text-[10px] block ${fGrowth.className}`}>{fGrowth.text}</span>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-[var(--app-text-tertiary)]">Total Likes</p>
                      <p className="mt-0.5 text-sm font-bold text-[var(--app-text-primary)]">{formatCompactNumber(account.likesCount)}</p>
                      <span className={`text-[10px] block ${lGrowth.className}`}>{lGrowth.text}</span>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-[var(--app-text-tertiary)]">Videos</p>
                      <p className="mt-0.5 text-sm font-bold text-[var(--app-text-primary)]">{formatNumber(account.videoCountRecorded ?? account.videoCount)}</p>
                      <span className={`text-[10px] block ${vGrowth.className}`}>{vGrowth.text}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </PageContainer>
    );
  }

  // 3. Single Account Overview
  const profile = effectiveData?.profile || {
    display_name: accounts[0]?.displayName || "TikTok Store Account",
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
        <PageHeader
          tag="OPPO Retail TikTok Monitor · Account Overview"
          title={profile.display_name || "TikTok Store Account"}
          description="Authorized TikTok retail store account profile and audience overview."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link href={dashboardLink}>
                <Button variant="primary" size="sm">
                  Open Dashboard
                </Button>
              </Link>
              {profileUrl && (
                <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm">
                    View on TikTok
                  </Button>
                </a>
              )}
            </div>
          }
        />

        {/* Profile Card */}
        <Card className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt={profile.display_name || "TikTok Profile"}
                  className="h-20 w-20 rounded-[var(--app-radius-xl)] border border-[var(--app-border)] object-cover shadow-[var(--app-shadow-card)]"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-[var(--app-radius-xl)] bg-[var(--app-accent-soft)] font-bold text-2xl text-[var(--app-accent)] shadow-[var(--app-shadow-card)]">
                  {(profile.display_name || "T")[0].toUpperCase()}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-[var(--app-text-primary)]">
                    {profile.display_name || "TikTok Store Account"}
                  </h1>
                  {profile.is_verified && (
                    <span title="Verified Account" className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--app-accent)] text-white text-[10px]">
                      ✓
                    </span>
                  )}
                  {renderStatusBadge("CONNECTED")}
                </div>

                {profile.username && (
                  <p className="text-xs font-mono font-medium text-[var(--app-accent)]">
                    @{profile.username}
                  </p>
                )}

                <div className="pt-1">
                  {storeMaster ? (
                    <div className="inline-flex items-center gap-1.5 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 py-1 text-xs text-[var(--app-text-primary)]">
                      <span className="font-semibold">{storeMaster.storeName}</span>
                      {storeMaster.province && (
                        <>
                          <span className="text-[var(--app-text-tertiary)]">·</span>
                          <span className="text-[var(--app-text-secondary)]">{storeMaster.province}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 py-1 text-xs text-[var(--app-text-secondary)]">
                      <span>Store not linked yet</span>
                    </div>
                  )}
                </div>

                {profile.bio_description && (
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--app-text-secondary)]">
                    {profile.bio_description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 text-right">
              <span className="text-[11px] text-[var(--app-text-tertiary)] font-mono">
                Last synced: {formatDate(updatedAt)}
              </span>
            </div>
          </div>
        </Card>

        {/* Quick Audience Overview Grid */}
        <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <Card className="p-4 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--app-text-secondary)] uppercase">Followers</p>
              <p className="mt-2 text-2xl font-bold text-[var(--app-text-primary)]">
                {formatNumber(profile.follower_count)}
              </p>
              <p className="text-[11px] text-[var(--app-text-tertiary)]">
                {formatCompactNumber(profile.follower_count)} total followers
              </p>
            </div>
            {/* Growth delta breakdown: Today, 7D, 30D */}
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-2.5 dark:border-slate-800/80">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--app-text-secondary)]">Today</span>
                {(() => {
                  const d = formatDelta(historicalMetrics?.summary?.dailyFollowerGrowth);
                  return <span className={d.className}>{d.text}</span>;
                })()}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--app-text-secondary)]">7 Days</span>
                {(() => {
                  const d = formatDelta(historicalMetrics?.summary?.sevenDayFollowerGrowth);
                  return <span className={d.className}>{d.text}</span>;
                })()}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--app-text-secondary)]">30 Days</span>
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
            subtext="Accounts followed"
            tone="default"
          />

          <MetricCard
            label="Total Likes"
            value={formatNumber(profile.likes_count)}
            subtext={`${formatCompactNumber(profile.likes_count)} total likes`}
            tone="accent"
          />

          <MetricCard
            label="Public Videos"
            value={formatNumber(profile.video_count)}
            subtext={`${videos.length} videos synced to database`}
            tone="info"
          />
        </section>

        {/* Dashboard Entry CTA Banner */}
        <Card className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-[var(--app-accent-soft)]/30 to-transparent border-[var(--app-accent)]/30">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[var(--app-text-primary)]">
              Explore Store Video Performance &amp; Engagement
            </h2>
            <p className="text-xs text-[var(--app-text-secondary)]">
              View total video views, top performing content, comment breakdown, and share ratios.
            </p>
          </div>
          <Link href={dashboardLink}>
            <Button variant="primary" size="md">
              Open Performance Dashboard
            </Button>
          </Link>
        </Card>
      </div>
    </PageContainer>
  );
}
