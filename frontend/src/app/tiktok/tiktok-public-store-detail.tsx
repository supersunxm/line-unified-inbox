"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PageContainer, PageHeader } from "@/components/shell";
import { useAppLanguage } from "../language";
import type { TikTokPublicDashboardStore, TikTokPublicHistoryPoint } from "./tiktok-public-api";

type Props = { store: TikTokPublicDashboardStore; history: TikTokPublicHistoryPoint[] };

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function shiftMetricDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatMetricDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function Sparkline({ points }: { points: TikTokPublicHistoryPoint[] }) {
  if (points.length < 2) return <div className="flex h-56 items-center justify-center text-sm text-[var(--app-text-tertiary)]">Need at least 2 daily snapshots to draw history</div>;
  const values = points.map((point) => point.followerCount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 90 - ((point.followerCount - min) / span) * 80;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="h-56 w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label="Follower history chart">
        <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" className="text-[var(--app-accent)]" />
      </svg>
    </div>
  );
}

export function TikTokPublicStoreDetail({ store, history }: Props) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const { language } = useAppLanguage();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };
  const locale = language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-US";
  const labels = language === "th" ? {
    back: "กลับ TikTok Analytics",
    followers: "Followers",
    following: "Following",
    likes: "Total Likes",
    videos: "Videos",
    oneDay: "การเติบโต 1 วัน",
    seven: "การเติบโต 7 วัน",
    thirty: "การเติบโต 30 วัน",
    history: "ประวัติผู้ติดตาม · Daily Snapshots",
    snapshot: "Snapshot ล่าสุด",
    updated: "ดึงข้อมูลล่าสุด",
    noBaseline: "ยังไม่มี Snapshot สำหรับวันที่เปรียบเทียบ",
    open: "เปิด TikTok Profile",
  } : {
    back: "Back to TikTok Analytics",
    followers: "Followers",
    following: "Following",
    likes: "Total Likes",
    videos: "Videos",
    oneDay: "1 Day Growth",
    seven: "7 Day Growth",
    thirty: "30 Day Growth",
    history: "Follower History · Daily Snapshots",
    snapshot: "Latest snapshot",
    updated: "Last collected",
    noBaseline: "No snapshot exists for the comparison date yet",
    open: "Open TikTok Profile",
  };

  const growthText = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${formatNumber(value, locale)}`;
  const latestMetricDate = store.latestMetricDate;
  const growthCards = [
    { label: labels.oneDay, days: 1, value: store.growth.daily },
    { label: labels.seven, days: 7, value: store.growth.sevenDay },
    { label: labels.thirty, days: 30, value: store.growth.thirtyDay },
  ];

  return (
    <PageContainer variant="wide">
      <div className="flex items-center justify-between">
        <Link href="/tiktok" className="text-sm font-semibold text-[var(--app-accent)] hover:underline">← {labels.back}</Link>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-secondary)] transition hover:bg-[var(--app-surface-subtle)] disabled:opacity-50"
          aria-label="Refresh data"
        >
          <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      <PageHeader title={store.storeName} description={`@${store.username}${store.region ? ` · ${store.region}` : ""}${store.province ? ` · ${store.province}` : ""}`} />

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]">{store.avatarUrl ? <img src={store.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xl font-bold">T</div>}</div>
          <div>
            <div className="text-lg font-bold">{store.displayName || store.accountName}</div>
            <div className="mt-1 text-sm text-[var(--app-text-secondary)]">{store.bioDescription || `@${store.username}`}</div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--app-text-tertiary)]">
              <span>{labels.snapshot}: {latestMetricDate ? formatMetricDate(latestMetricDate, locale) : "—"}</span>
              <span>{labels.updated}: {new Date(store.lastFetchedAt).toLocaleString(locale)}</span>
            </div>
          </div>
        </div>
        <a href={store.profileUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--app-accent)] px-4 text-sm font-semibold text-white">{labels.open}</a>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[[labels.followers, store.followerCount], [labels.following, store.followingCount], [labels.likes, store.likesCount], [labels.videos, store.videoCount]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5"><div className="text-xs text-[var(--app-text-tertiary)]">{label}</div><div className="mt-2 text-2xl font-bold">{formatNumber(Number(value), locale)}</div></div>)}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {growthCards.map(({ label, days, value }) => {
          const baselineDate = latestMetricDate ? shiftMetricDate(latestMetricDate, -days) : null;
          const comparison = latestMetricDate && baselineDate
            ? `${formatMetricDate(latestMetricDate, locale)} vs ${formatMetricDate(baselineDate, locale)}`
            : null;
          return (
            <div key={label} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
              <div className="text-xs font-semibold text-[var(--app-text-tertiary)]">{label}</div>
              <div className="mt-2 text-2xl font-bold">{growthText(value.absolute)}</div>
              <div className="mt-1 text-xs text-[var(--app-text-secondary)]">
                {value.absolute === null
                  ? labels.noBaseline
                  : value.percent === null
                    ? "—%"
                    : `${value.percent > 0 ? "+" : ""}${value.percent.toFixed(2)}%`}
              </div>
              {comparison && <div className="mt-2 text-xs text-[var(--app-text-tertiary)]">{comparison}</div>}
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)]">
        <div className="mb-4 flex items-baseline justify-between"><h2 className="font-semibold">{labels.history}</h2>{history.length > 0 && <span className="text-xs text-[var(--app-text-tertiary)]">{history[0].metricDate} → {history[history.length - 1].metricDate}</span>}</div>
        <Sparkline points={history} />
      </section>
    </PageContainer>
  );
}
