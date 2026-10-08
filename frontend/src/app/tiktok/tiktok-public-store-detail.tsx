"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PageContainer } from "@/components/shell";
import { useAppLanguage } from "../language";
import type { TikTokPublicDashboardStore, TikTokPublicHistoryPoint } from "./tiktok-public-api";
import { tiktokStoreDetailText } from "./tiktok-dashboard-i18n";

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

function growthTextClass(value: number | null) {
  if (value === null || value === 0) return "text-[var(--app-text-secondary)]";
  if (value > 0) return "text-emerald-600 dark:text-emerald-300";
  return "text-rose-600 dark:text-rose-300";
}

function FollowerChart({
  points,
  locale,
  emptyLabel,
  chartLabel,
  language,
}: {
  points: TikTokPublicHistoryPoint[];
  locale: string;
  emptyLabel: string;
  chartLabel: string;
  language: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  if (points.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-[var(--app-text-tertiary)]">
        {emptyLabel}
      </div>
    );
  }

  const values = points.map((point) => point.followerCount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = Math.round((min + max) / 2);
  const span = Math.max(max - min, 1);
  const chartTop = 24;
  const chartBottom = 214;
  const chartLeft = 24;
  const chartRight = 976;
  const chartHeight = chartBottom - chartTop;
  const chartWidth = chartRight - chartLeft;

  const coords = points.map((point, index) => {
    const x = points.length === 1
      ? chartLeft
      : chartLeft + (index / (points.length - 1)) * chartWidth;
    const y = chartBottom - ((point.followerCount - min) / span) * chartHeight;
    return [x, y] as const;
  });
  const linePoints = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const areaPoints = `${chartLeft},${chartBottom} ${linePoints} ${chartRight},${chartBottom}`;
  const middleIndex = Math.floor((points.length - 1) / 2);
  const selectedIndex = Math.max(0, points.findIndex((p) => p.metricDate === selectedDate));
  const selected = points[selectedIndex];
  const previous = points[selectedIndex - 1];
  const delta = previous ? selected.followerCount - previous.followerCount : null;
  const consecutive = previous ? shiftMetricDate(previous.metricDate, 1) === selected.metricDate : false;

  return (
    <div>
      <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3">
        <div className="flex h-56 flex-col justify-between py-1 text-right text-[11px] tabular-nums text-[var(--app-text-tertiary)]">
          <span>{compactNumber(max, locale)}</span>
          <span>{compactNumber(mid, locale)}</span>
          <span>{compactNumber(min, locale)}</span>
        </div>
        <div className="relative h-56">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-[var(--app-border-subtle)]" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--app-border-subtle)]" />
          <div className="absolute inset-x-0 bottom-0 border-t border-dashed border-[var(--app-border-subtle)]" />
          <svg
            viewBox="0 0 1000 240"
            preserveAspectRatio="none"
            className="relative z-10 h-full w-full overflow-visible"
            role="img"
            aria-label={chartLabel}
          >
            <defs>
              <linearGradient id="followerArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--app-accent)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--app-accent)" stopOpacity="0.015" />
              </linearGradient>
            </defs>
            <polygon points={areaPoints} fill="url(#followerArea)" />
            <polyline
              points={linePoints}
              fill="none"
              stroke="var(--app-accent)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {coords.map(([x, y], index) => (
            <button key={points[index].metricDate} type="button"
              onClick={() => setSelectedDate(points[index].metricDate)}
              onMouseEnter={() => setSelectedDate(points[index].metricDate)}
              onFocus={() => setSelectedDate(points[index].metricDate)}
              aria-label={`${formatMetricDate(points[index].metricDate, locale)}: ${formatNumber(points[index].followerCount, locale)}`}
              aria-pressed={selected.metricDate === points[index].metricDate}
              style={{ left: `${(x / 1000) * 100}%`, top: `${(y / 240) * 100}%` }}
              className={`absolute z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--app-accent)] bg-[var(--app-surface)] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${selected.metricDate === points[index].metricDate ? "ring-2 ring-[var(--app-accent)]" : ""}`}
            />
          ))}
        </div>
      </div>
      <div className="ml-[60px] mt-2 flex justify-between text-[11px] text-[var(--app-text-tertiary)]">
        <span>{formatShortDate(points[0].metricDate, locale)}</span>
        <span>{formatShortDate(points[middleIndex].metricDate, locale)}</span>
        <span>{formatShortDate(points[points.length - 1].metricDate, locale)}</span>
      </div>
      <div aria-live="polite" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--app-surface-subtle)] px-4 py-3">
        <div>
          <div className="text-xs text-[var(--app-text-secondary)]">{formatMetricDate(selected.metricDate, locale)}</div>
          <div className="text-lg font-black tabular-nums">{formatNumber(selected.followerCount, locale)} <span className="text-xs font-normal">{language === "th" ? "ผู้ติดตาม" : "followers"}</span></div>
        </div>
        <div className="text-right">
          <div className={`font-bold tabular-nums ${growthTextClass(delta)}`}>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${formatNumber(delta, locale)}`}</div>
          <div className="text-xs text-[var(--app-text-tertiary)]">{!previous ? (language === "th" ? "ไม่มี snapshot ก่อนหน้า" : "No previous snapshot") : consecutive ? (language === "th" ? "เทียบวันก่อน" : "Previous day") : (language === "th" ? `ข้ามช่วงข้อมูลจาก ${formatShortDate(previous.metricDate, locale)}` : `Gap since ${formatShortDate(previous.metricDate, locale)}`)}</div>
        </div>
      </div>
    </div>
  );
}

export function TikTokPublicStoreDetail({ store, history }: Props) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("30D");
  const [showDaily, setShowDaily] = useState(false);
  const { language } = useAppLanguage();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const locale = language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-US";
  const labels = tiktokStoreDetailText[language];

  const growthText = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${formatNumber(value, locale)}`;
  const percentText = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  const latestMetricDate = store.latestMetricDate;
  const growthCards = [
    { label: labels.oneDay, days: 1, value: store.growth.daily },
    { label: labels.seven, days: 7, value: store.growth.sevenDay },
    { label: labels.thirty, days: 30, value: store.growth.thirtyDay },
  ];

  const sortedHistory = [...history].sort((a, b) => a.metricDate.localeCompare(b.metricDate));
  const latestHistoryDate = sortedHistory[sortedHistory.length - 1]?.metricDate;
  const cutoff = latestHistoryDate ? shiftMetricDate(latestHistoryDate, historyPeriod === "7D" ? -6 : -29) : null;
  const chartPoints = sortedHistory.filter((p) => !cutoff || p.metricDate >= cutoff);
  const firstPoint = chartPoints[0];
  const lastPoint = chartPoints[chartPoints.length - 1];
  const chartNetGrowth = firstPoint && lastPoint ? lastPoint.followerCount - firstPoint.followerCount : null;
  const dailyDeltas = chartPoints.flatMap((point, i) => {
    const prior = chartPoints[i - 1];
    return prior && shiftMetricDate(prior.metricDate, 1) === point.metricDate
      ? [point.followerCount - prior.followerCount] : [];
  });
  const averageDailyGrowth = dailyDeltas.length ? dailyDeltas.reduce((a, b) => a + b, 0) / dailyDeltas.length : null;

  let bestDailyGrowth: number | null = null;
  let bestDailyDate: string | null = null;
  for (let index = 1; index < chartPoints.length; index += 1) {
    if (shiftMetricDate(chartPoints[index - 1].metricDate, 1) !== chartPoints[index].metricDate) continue;
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
      <div className="space-y-4 pb-10">
        <div className="flex items-center justify-between">
          <Link href="/tiktok" className="text-sm font-semibold text-[var(--app-accent)] hover:underline">← {labels.back}</Link>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-secondary)] transition hover:bg-[var(--app-surface-subtle)] disabled:opacity-50"
            aria-label={labels.refreshData}
          >
            <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <section className="flex flex-col gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-4 shadow-[var(--app-shadow-sm)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]">
              {store.avatarUrl
                ? <img src={store.avatarUrl} alt="" className="h-full w-full object-cover" />
                : <div className="flex h-full items-center justify-center text-base font-bold">T</div>}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-[-0.025em] text-[var(--app-text-primary)]">{store.storeName}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[var(--app-text-secondary)]">
                <span>@{store.username}</span>
                {(store.province || store.region) && (
                  <span>· {[store.province, store.region].filter(Boolean).join(" · ")}</span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--app-text-tertiary)]">
                <span>{labels.snapshot}: {latestMetricDate ? formatMetricDate(latestMetricDate, locale) : "—"}</span>
                <span>{labels.updated}: {new Date(store.lastFetchedAt).toLocaleString(locale)}</span>
              </div>
            </div>
          </div>
          <a href={store.profileUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent)] px-4 text-xs font-bold text-white">
            {labels.open} ↗
          </a>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)]">
          <div className="grid sm:grid-cols-2 xl:grid-cols-[1.25fr_repeat(3,0.82fr)_1.1fr]">
            <div className="border-b border-[var(--app-border-subtle)] p-5 sm:border-r xl:border-b-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">{labels.followers}</div>
              <div className="mt-1 text-3xl font-black tracking-[-0.04em] tabular-nums text-[var(--app-text-primary)]">
                {formatNumber(store.followerCount, locale)}
              </div>
            </div>

            {growthCards.map(({ label, days, value }, index) => {
              const baselineDate = latestMetricDate ? shiftMetricDate(latestMetricDate, -days) : null;
              return (
                <div
                  key={label}
                  className={`border-b border-[var(--app-border-subtle)] p-5 sm:border-r xl:border-b-0 ${
                    index === 2 ? "sm:border-r-0 xl:border-r" : ""
                  }`}
                >
                  <div className="text-[11px] font-semibold text-[var(--app-text-tertiary)]">{label}</div>
                  <div className={`mt-1.5 text-xl font-black tabular-nums ${growthTextClass(value.absolute)}`}>
                    {growthText(value.absolute)}
                  </div>
                  <div className={`mt-0.5 text-xs font-bold tabular-nums ${growthTextClass(value.absolute)}`}>
                    {percentText(value.percent)}
                  </div>
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

            <div className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">{labels.content}</div>
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--app-text-secondary)]">{labels.likes}</span>
                  <span className="font-black tabular-nums text-[var(--app-text-primary)]">{compactNumber(store.likesCount, locale)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--app-text-secondary)]">{labels.videos}</span>
                  <span className="font-black tabular-nums text-[var(--app-text-primary)]">{formatNumber(store.videoCount, locale)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--app-text-secondary)]">{labels.following}</span>
                  <span className="font-black tabular-nums text-[var(--app-text-primary)]">{formatNumber(store.followingCount, locale)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)]">
          <div className="flex flex-col gap-3 border-b border-[var(--app-border-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-base font-bold text-[var(--app-text-primary)]">{labels.history}</h2>
                {chartNetGrowth !== null && (
                  <span className={`text-sm font-black tabular-nums ${growthTextClass(chartNetGrowth)}`}>
                    {growthText(chartNetGrowth)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[var(--app-text-tertiary)]">{labels.historySub}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" aria-expanded={showDaily} onClick={() => setShowDaily(!showDaily)}
                className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-bold">
                {language === "th" ? "รายวัน" : language === "zh" ? "每日" : "Daily"} {showDaily ? "−" : "+"}
              </button>
              <div className="inline-flex w-fit rounded-lg bg-[var(--app-surface-subtle)] p-1">
              {(["7D", "30D"] as HistoryPeriod[]).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setHistoryPeriod(period)}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
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
          </div>

          <div className="px-5 py-5">
            <FollowerChart key={historyPeriod} points={chartPoints} locale={locale} emptyLabel={labels.noHistory} chartLabel={labels.historyChart} language={language} />
          </div>
          {showDaily && (
            <div className="border-t border-[var(--app-border-subtle)] px-5 py-4">
              <h3 className="mb-2 text-sm font-bold">{language === "th" ? "ข้อมูลรายวัน" : language === "zh" ? "每日快照" : "Daily snapshots"}</h3>
              <div className="max-h-80 divide-y divide-[var(--app-border-subtle)] overflow-y-auto">
                {[...chartPoints].reverse().map((point, reverseIndex) => {
                  const index = chartPoints.length - reverseIndex - 1;
                  const prior = chartPoints[index - 1];
                  const diff = prior ? point.followerCount - prior.followerCount : null;
                  const adjacent = prior ? shiftMetricDate(prior.metricDate, 1) === point.metricDate : false;
                  return (
                    <div key={point.metricDate} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <div>
                        <div className="font-semibold">{formatMetricDate(point.metricDate, locale)}</div>
                        <div className="text-xs text-[var(--app-text-tertiary)]">{!prior ? (language === "th" ? "จุดเริ่มต้น" : "First snapshot") : adjacent ? (language === "th" ? "เทียบวันก่อน" : "Previous day") : `${language === "th" ? "ข้อมูลขาดช่วง" : "Missing days"}: ${formatShortDate(prior.metricDate, locale)} → ${formatShortDate(point.metricDate, locale)}`}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold tabular-nums">{formatNumber(point.followerCount, locale)}</div>
                        <div className={`text-xs font-semibold tabular-nums ${growthTextClass(diff)}`}>{diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatNumber(diff, locale)}${adjacent ? "" : language === "th" ? " (ข้ามวัน)" : " (gap)"}`}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid border-t border-[var(--app-border-subtle)] sm:grid-cols-4 sm:divide-x sm:divide-[var(--app-border-subtle)]">
            <div className="border-b border-[var(--app-border-subtle)] px-5 py-3 sm:border-b-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">{labels.growth}</div>
              <div className={`mt-1 text-base font-black tabular-nums ${growthTextClass(chartNetGrowth)}`}>
                {chartNetGrowth === null ? "—" : growthText(chartNetGrowth)}
              </div>
            </div>
            <div className="border-b border-[var(--app-border-subtle)] px-5 py-3 sm:border-b-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">{labels.avgDaily}</div>
              <div className="mt-1 text-base font-black tabular-nums text-[var(--app-text-primary)]">
                {averageDailyGrowth === null ? "—" : `${averageDailyGrowth > 0 ? "+" : ""}${averageDailyGrowth.toFixed(1)}`}
              </div>
            </div>
            <div className="border-b border-[var(--app-border-subtle)] px-5 py-3 sm:border-b-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">{labels.bestDay}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-base font-black tabular-nums text-[var(--app-text-primary)]">
                  {bestDailyGrowth === null ? "—" : growthText(bestDailyGrowth)}
                </span>
                {bestDailyDate && <span className="text-[10px] text-[var(--app-text-tertiary)]">{formatShortDate(bestDailyDate, locale)}</span>}
              </div>
            </div>
            <div className="px-5 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">{labels.range}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-base font-black tabular-nums text-[var(--app-text-primary)]">
                  {followerRange === null ? "—" : formatNumber(followerRange, locale)}
                </span>
                <span className="text-[10px] text-[var(--app-text-tertiary)]">{chartPoints.length} {labels.snapshots}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
