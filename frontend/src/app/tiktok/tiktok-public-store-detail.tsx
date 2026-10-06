"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PageContainer } from "@/components/shell";
import { useAppLanguage } from "../language";
import type { TikTokPublicDashboardStore, TikTokPublicHistoryPoint } from "./tiktok-public-api";

type Props = { store: TikTokPublicDashboardStore; history: TikTokPublicHistoryPoint[] };
type HistoryPeriod = "7D" | "30D";

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function compactNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
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

function formatShortDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function growthTone(value: number | null) {
  if (value === null || value === 0) {
    return "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)]";
  }
  if (value > 0) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  return "bg-rose-500/10 text-rose-600 dark:text-rose-300";
}

function FollowerChart({
  points,
  locale,
  emptyLabel,
}: {
  points: TikTokPublicHistoryPoint[];
  locale: string;
  emptyLabel: string;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--app-text-tertiary)]">
        {emptyLabel}
      </div>
    );
  }

  const values = points.map((point) => point.followerCount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = Math.round((min + max) / 2);
  const span = Math.max(max - min, 1);
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? 4 : 4 + (index / (points.length - 1)) * 92;
    const y = 88 - ((point.followerCount - min) / span) * 72;
    return `${x},${y}`;
  }).join(" ");
  const middleIndex = Math.floor((points.length - 1) / 2);

  return (
    <div>
      <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
        <div className="flex h-64 flex-col justify-between py-2 text-right text-[11px] tabular-nums text-[var(--app-text-tertiary)]">
          <span>{compactNumber(max, locale)}</span>
          <span>{compactNumber(mid, locale)}</span>
          <span>{compactNumber(min, locale)}</span>
        </div>
        <div className="relative h-64 overflow-hidden rounded-2xl bg-[var(--app-surface-subtle)]">
          <div className="absolute inset-x-0 top-[16%] border-t border-dashed border-[var(--app-border-subtle)]" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--app-border-subtle)]" />
          <div className="absolute inset-x-0 bottom-[12%] border-t border-dashed border-[var(--app-border-subtle)]" />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="relative z-10 h-full w-full" role="img" aria-label="Follower history chart">
            <polyline
              points={coords}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              vectorEffect="non-scaling-stroke"
              className="text-[var(--app-accent)]"
            />
            {points.map((point, index) => {
              const [x, y] = coords.split(" ")[index].split(",");
              return (
                <circle
                  key={point.metricDate}
                  cx={x}
                  cy={y}
                  r="1.3"
                  vectorEffect="non-scaling-stroke"
                  className="fill-[var(--app-accent)]"
                />
              );
            })}
          </svg>
        </div>
      </div>
      <div className="ml-[64px] mt-2 flex justify-between text-[11px] text-[var(--app-text-tertiary)]">
        <span>{formatShortDate(points[0].metricDate, locale)}</span>
        <span>{formatShortDate(points[middleIndex].metricDate, locale)}</span>
        <span>{formatShortDate(points[points.length - 1].metricDate, locale)}</span>
      </div>
    </div>
  );
}

export function TikTokPublicStoreDetail({ store, history }: Props) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("30D");
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
    oneDay: "1 วัน",
    seven: "7 วัน",
    thirty: "30 วัน",
    history: "Follower Growth",
    historySub: "แนวโน้มจำนวนผู้ติดตามจาก Daily Snapshot",
    snapshot: "Snapshot ล่าสุด",
    updated: "ดึงข้อมูลล่าสุด",
    noBaseline: "ยังไม่มีข้อมูลสำหรับเปรียบเทียบ",
    open: "เปิด TikTok Profile",
    contentSnapshot: "Content Snapshot",
    growth: "Follower Growth",
    performance: "Performance",
    avgDaily: "เติบโตเฉลี่ยต่อวัน",
    bestDay: "วันที่เติบโตดีที่สุด",
    range: "ช่วงการเปลี่ยนแปลง",
    snapshots: "Snapshots",
    noHistory: "ต้องมีอย่างน้อย 2 Daily Snapshots เพื่อแสดงกราฟ",
  } : {
    back: "Back to TikTok Analytics",
    followers: "Followers",
    following: "Following",
    likes: "Total Likes",
    videos: "Videos",
    oneDay: "1 day",
    seven: "7 days",
    thirty: "30 days",
    history: "Follower Growth",
    historySub: "Follower trend from daily snapshots",
    snapshot: "Latest snapshot",
    updated: "Last collected",
    noBaseline: "No comparison snapshot yet",
    open: "Open TikTok Profile",
    contentSnapshot: "Content Snapshot",
    growth: "Follower Growth",
    performance: "Performance",
    avgDaily: "Average daily growth",
    bestDay: "Best growth day",
    range: "Follower range",
    snapshots: "Snapshots",
    noHistory: "At least 2 daily snapshots are required to draw history",
  };

  const growthText = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${formatNumber(value, locale)}`;
  const percentText = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  const latestMetricDate = store.latestMetricDate;
  const growthCards = [
    { label: labels.oneDay, days: 1, value: store.growth.daily },
    { label: labels.seven, days: 7, value: store.growth.sevenDay },
    { label: labels.thirty, days: 30, value: store.growth.thirtyDay },
  ];

  const sortedHistory = [...history].sort((a, b) => a.metricDate.localeCompare(b.metricDate));
  const chartPoints = historyPeriod === "7D" ? sortedHistory.slice(-7) : sortedHistory.slice(-30);
  const firstPoint = chartPoints[0];
  const lastPoint = chartPoints[chartPoints.length - 1];
  const chartNetGrowth = firstPoint && lastPoint ? lastPoint.followerCount - firstPoint.followerCount : null;
  const averageDailyGrowth = chartPoints.length > 1 && chartNetGrowth !== null
    ? chartNetGrowth / (chartPoints.length - 1)
    : null;

  let bestDailyGrowth: number | null = null;
  let bestDailyDate: string | null = null;
  for (let index = 1; index < chartPoints.length; index += 1) {
    const delta = chartPoints[index].followerCount - chartPoints[index - 1].followerCount;
    if (bestDailyGrowth === null || delta > bestDailyGrowth) {
      bestDailyGrowth = delta;
      bestDailyDate = chartPoints[index].metricDate;
    }
  }

  const chartValues = chartPoints.map((point) => point.followerCount);
  const followerRange = chartValues.length > 1
    ? Math.max(...chartValues) - Math.min(...chartValues)
    : null;

  return (
    <PageContainer variant="wide" className="bg-slate-50/70 dark:bg-[var(--app-bg)]">
      <div className="space-y-5 pb-10">
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

        <section className="flex flex-col gap-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]">
              {store.avatarUrl
                ? <img src={store.avatarUrl} alt="" className="h-full w-full object-cover" />
                : <div className="flex h-full items-center justify-center text-xl font-bold">T</div>}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black tracking-[-0.03em] text-[var(--app-text-primary)]">{store.storeName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--app-text-secondary)]">
                <span>@{store.username}</span>
                {(store.province || store.region) && (
                  <span>· {[store.province, store.region].filter(Boolean).join(" · ")}</span>
                )}
              </div>
              {(store.displayName || store.bioDescription) && (
                <div className="mt-1.5 truncate text-sm text-[var(--app-text-tertiary)]">
                  {store.bioDescription || store.displayName || store.accountName}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--app-text-tertiary)]">
                <span>{labels.snapshot}: {latestMetricDate ? formatMetricDate(latestMetricDate, locale) : "—"}</span>
                <span>{labels.updated}: {new Date(store.lastFetchedAt).toLocaleString(locale)}</span>
              </div>
            </div>
          </div>
          <a href={store.profileUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent)] px-4 text-sm font-semibold text-white">{labels.open} ↗</a>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)]">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">{labels.followers}</div>
            <div className="mt-2 text-4xl font-black tracking-[-0.045em] tabular-nums text-[var(--app-text-primary)]">
              {formatNumber(store.followerCount, locale)}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {growthCards.map(({ label, days, value }) => {
                const baselineDate = latestMetricDate ? shiftMetricDate(latestMetricDate, -days) : null;
                return (
                  <div key={label} className="rounded-2xl bg-[var(--app-surface-subtle)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--app-text-tertiary)]">{label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${growthTone(value.absolute)}`}>
                        {percentText(value.percent)}
                      </span>
                    </div>
                    <div className="mt-2 text-xl font-black tabular-nums text-[var(--app-text-primary)]">{growthText(value.absolute)}</div>
                    <div className="mt-1 text-[10px] text-[var(--app-text-tertiary)]">
                      {value.absolute === null
                        ? labels.noBaseline
                        : baselineDate && latestMetricDate
                          ? `${formatShortDate(baselineDate, locale)} → ${formatShortDate(latestMetricDate, locale)}`
                          : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)]">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">{labels.contentSnapshot}</div>
            <div className="mt-4 divide-y divide-[var(--app-border-subtle)]">
              {[
                [labels.likes, store.likesCount],
                [labels.videos, store.videoCount],
                [labels.following, store.followingCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="text-sm text-[var(--app-text-secondary)]">{String(label)}</span>
                  <span className="text-lg font-black tabular-nums text-[var(--app-text-primary)]">{formatNumber(Number(value), locale)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--app-text-primary)]">{labels.history}</h2>
              <p className="mt-1 text-xs text-[var(--app-text-tertiary)]">{labels.historySub}</p>
            </div>
            <div className="inline-flex w-fit rounded-xl bg-[var(--app-surface-subtle)] p-1">
              {(["7D", "30D"] as HistoryPeriod[]).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setHistoryPeriod(period)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    historyPeriod === period
                      ? "bg-[var(--app-surface)] text-[var(--app-text-primary)] shadow-sm"
                      : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <FollowerChart points={chartPoints} locale={locale} emptyLabel={labels.noHistory} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-[var(--app-surface-subtle)] p-4">
              <div className="text-xs text-[var(--app-text-tertiary)]">{labels.growth}</div>
              <div className="mt-2 text-xl font-black tabular-nums text-[var(--app-text-primary)]">
                {chartNetGrowth === null ? "—" : growthText(chartNetGrowth)}
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--app-surface-subtle)] p-4">
              <div className="text-xs text-[var(--app-text-tertiary)]">{labels.avgDaily}</div>
              <div className="mt-2 text-xl font-black tabular-nums text-[var(--app-text-primary)]">
                {averageDailyGrowth === null ? "—" : `${averageDailyGrowth > 0 ? "+" : ""}${averageDailyGrowth.toFixed(1)}`}
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--app-surface-subtle)] p-4">
              <div className="text-xs text-[var(--app-text-tertiary)]">{labels.bestDay}</div>
              <div className="mt-2 text-xl font-black tabular-nums text-[var(--app-text-primary)]">
                {bestDailyGrowth === null ? "—" : growthText(bestDailyGrowth)}
              </div>
              {bestDailyDate && <div className="mt-1 text-[10px] text-[var(--app-text-tertiary)]">{formatShortDate(bestDailyDate, locale)}</div>}
            </div>
            <div className="rounded-2xl bg-[var(--app-surface-subtle)] p-4">
              <div className="text-xs text-[var(--app-text-tertiary)]">{labels.range}</div>
              <div className="mt-2 text-xl font-black tabular-nums text-[var(--app-text-primary)]">
                {followerRange === null ? "—" : formatNumber(followerRange, locale)}
              </div>
              <div className="mt-1 text-[10px] text-[var(--app-text-tertiary)]">{chartPoints.length} {labels.snapshots}</div>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
