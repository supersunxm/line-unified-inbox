"use client";

import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/shell";
import { useAppLanguage } from "../language";
import type { TikTokPublicDashboardStore, TikTokPublicHistoryPoint } from "./tiktok-public-api";

type Props = { store: TikTokPublicDashboardStore; history: TikTokPublicHistoryPoint[] };

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
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
  const { language } = useAppLanguage();
  const locale = language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-US";
  const labels = language === "th" ? {
    back: "กลับ TikTok Analytics",
    followers: "Followers",
    following: "Following",
    likes: "Total Likes",
    videos: "Videos",
    today: "วันนี้",
    seven: "7 วัน",
    thirty: "30 วัน",
    history: "Follower History · 30 วัน",
    updated: "อัปเดตล่าสุด",
    open: "เปิด TikTok Profile",
  } : {
    back: "Back to TikTok Analytics",
    followers: "Followers",
    following: "Following",
    likes: "Total Likes",
    videos: "Videos",
    today: "Today",
    seven: "7 days",
    thirty: "30 days",
    history: "Follower History · 30 days",
    updated: "Last updated",
    open: "Open TikTok Profile",
  };

  const growthText = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${formatNumber(value, locale)}`;

  return (
    <PageContainer variant="wide">
      <Link href="/tiktok" className="text-sm font-semibold text-[var(--app-accent)] hover:underline">← {labels.back}</Link>
      <PageHeader title={store.storeName} description={`@${store.username}${store.region ? ` · ${store.region}` : ""}${store.province ? ` · ${store.province}` : ""}`} />

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]">{store.avatarUrl ? <img src={store.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xl font-bold">T</div>}</div>
          <div><div className="text-lg font-bold">{store.displayName || store.accountName}</div><div className="mt-1 text-sm text-[var(--app-text-secondary)]">{store.bioDescription || `@${store.username}`}</div><div className="mt-1 text-xs text-[var(--app-text-tertiary)]">{labels.updated}: {new Date(store.lastFetchedAt).toLocaleString(locale)}</div></div>
        </div>
        <a href={store.profileUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--app-accent)] px-4 text-sm font-semibold text-white">{labels.open}</a>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[[labels.followers, store.followerCount], [labels.following, store.followingCount], [labels.likes, store.likesCount], [labels.videos, store.videoCount]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5"><div className="text-xs text-[var(--app-text-tertiary)]">{label}</div><div className="mt-2 text-2xl font-bold">{formatNumber(Number(value), locale)}</div></div>)}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[[labels.today, store.growth.daily.absolute, store.growth.daily.percent], [labels.seven, store.growth.sevenDay.absolute, store.growth.sevenDay.percent], [labels.thirty, store.growth.thirtyDay.absolute, store.growth.thirtyDay.percent]].map(([label, absolute, percent]) => <div key={String(label)} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5"><div className="text-xs text-[var(--app-text-tertiary)]">{label}</div><div className="mt-2 text-xl font-bold">{growthText(absolute as number | null)}</div><div className="mt-1 text-xs text-[var(--app-text-secondary)]">{percent === null ? "—" : `${Number(percent).toFixed(2)}%`}</div></div>)}
      </section>

      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)]">
        <div className="mb-4 flex items-baseline justify-between"><h2 className="font-semibold">{labels.history}</h2>{history.length > 0 && <span className="text-xs text-[var(--app-text-tertiary)]">{history[0].metricDate} → {history[history.length - 1].metricDate}</span>}</div>
        <Sparkline points={history} />
      </section>
    </PageContainer>
  );
}
