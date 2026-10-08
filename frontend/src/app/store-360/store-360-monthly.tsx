"use client";

// Store 360: one store's month. The scorecard uses the SAME functions and rows as the Dashboard and
// Home (lib/metrics, docs/metrics-registry.md); per-store extras (daily, followers, Google Review,
// customer-name tags) come from existing endpoints through the metrics layer's shared cache.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAppLanguage } from "@/app/language";
import { languageLocale, type AppLanguage } from "@/app/language-utils";
import { FollowerChart, shortDate } from "@/components/metrics/follower-chart";
import { HowCounted, TargetText } from "@/components/metrics/kpi-ui";
import { MetricsMonthSelect } from "@/components/metrics/month-select";
import { DeltaValue, StateValue } from "@/components/metrics/value-ui";
import { AppShell } from "@/components/shell";
import { SearchInput } from "@/components/ui";
import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/authorization";
import { KPI_TARGETS, RATE24_TARGET } from "@/lib/metrics/kpi";
import { chatsHref, kpiReportHref, store360Href } from "@/lib/metrics/links";
import { monthShortLabel, parseV2Month, periodLabel } from "@/lib/metrics/month";
import { buildReportSummary } from "@/lib/metrics/report-summary";
import { dailyBreakdown, storeCounts, storesToWatch, type StoreMetricsRow } from "@/lib/metrics/store-model";
import { customerTagMix, rate24Rank, readLastStore, showCustomerVoice, storeToOpen, tagValueLabel, writeLastStore, type CountItem } from "@/lib/metrics/store-view";
import { tagCoverageView } from "@/lib/metrics/tag-coverage";
import { thaiLocationLabel } from "@/lib/metrics/thai-geo";
import { v2Text } from "@/lib/metrics/translations";
import { useMonthlyFollowers } from "@/lib/metrics/use-monthly-followers";
import { useMonthlyMetrics, useMonthlyTrend, useStoreDailyRateSource, useStoreMonthChats, type MonthlyMetrics } from "@/lib/metrics/use-monthly-metrics";
import { Store360ExportControl } from "./store-360-export-control";
import { useCustomerVoiceShare, useStoreFollowerDays, useStoreLatestChat } from "@/lib/metrics/use-store-month";
import { countState, MIN_RATE_SAMPLE, rateState, type ValueState } from "@/lib/metrics/value-state";

const card = "rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)]";
const linkButton = "inline-flex h-9 items-center rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-medium text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40";

function storageOrNull(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function Section({ title, meta, children, id }: { title: string; meta?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-base font-semibold text-[var(--app-text-primary)]">{title}</h2>
        {meta && <span className="text-xs text-[var(--app-text-secondary)]">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

/** Searchable store list (the stores in scope), and the stores to check — never an arbitrary store. */
function StorePicker({ data, onPick }: { data: MonthlyMetrics; onPick: (storeId: string) => void }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("th");
    return [...data.storeRows].sort((a, b) => a.storeName.localeCompare(b.storeName, "th")).filter((row) => !needle || row.storeName.toLocaleLowerCase("th").includes(needle));
  }, [data.storeRows, query]);
  const watch = storesToWatch(data.storeRows);
  return (
    <div data-s360-picker className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className={card}>
        <h2 className="text-base font-semibold text-[var(--app-text-primary)]">{t("s360PickerTitle")}</h2>
        <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{t("s360PickerDescription")}</p>
        <div className="mt-3"><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder={t("searchStoreName")} aria-label={t("searchStoreName")} /></div>
        <ul className="mt-2 max-h-80 divide-y divide-[var(--app-border-subtle)] overflow-y-auto overscroll-contain text-sm">
          {data.coreLoading ? <li className="py-2 text-[var(--app-text-secondary)]">{t("loadingEllipsis")}</li> : matches.length === 0 ? <li className="py-2 text-[var(--app-text-secondary)]">{t("s360PickerEmpty")}</li> : matches.map((row) => (
            <li key={row.storeId}>
              <button type="button" onClick={() => onPick(row.storeId)} className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40">
                <span className="min-w-0 truncate text-[var(--app-text-primary)]">{row.storeName}</span>
                <span className="shrink-0 text-xs text-[var(--app-text-secondary)]">{thaiLocationLabel(row.region, row.province) ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className={card}>
        <h2 className="text-base font-semibold text-[var(--app-text-primary)]">{t("storesToWatch")}</h2>
        <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{t("storesToWatchNote", { min: MIN_RATE_SAMPLE })}</p>
        <ul className="mt-2 divide-y divide-[var(--app-border-subtle)] text-sm" data-s360-stores-to-watch>
          {data.coreLoading ? <li className="py-2 text-[var(--app-text-secondary)]">{t("loadingEllipsis")}</li> : watch.length === 0 ? <li className="py-2 text-[var(--app-text-secondary)]">{t("storesToWatchEmpty")}</li> : watch.map((row) => (
            <li key={row.storeId}>
              <button type="button" onClick={() => onPick(row.storeId)} className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left hover:bg-[var(--app-surface-hover)]">
                <span className="min-w-0 truncate font-medium text-[var(--app-text-primary)]">{row.storeName}</span>
                <span className="shrink-0 text-xs text-[var(--app-text-secondary)]">{t("unanswered")} <span className="font-semibold text-[var(--app-text-primary)]"><StateValue state={row.unreplied} /></span> · <StateValue state={row.rate24} format="percent" showN /></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Tile({ label, children, footer, kpi }: { label: string; children: React.ReactNode; footer: React.ReactNode; kpi: string }) {
  return (
    <div data-s360-kpi={kpi} className={`${card} flex min-w-0 flex-col gap-1`}>
      <span className="text-xs font-medium text-[var(--app-text-secondary)]">{label}</span>
      <span className="text-2xl font-semibold tracking-[-0.02em] text-[var(--app-text-primary)]">{children}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--app-text-secondary)]">{footer}</span>
    </div>
  );
}

function Scorecard({ row, data, followerNet }: { row: StoreMetricsRow; data: MonthlyMetrics; followerNet: ValueState }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const rank = rate24Rank(data.storeRows, row.storeId);
  const versus = <span>{t("versusPeriod", { period: periodLabel(data.frame.previous, language) })}</span>;
  return (
    <Section title={t("s360Scorecard")} meta={data.periodText} id="s360-scorecard">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile kpi="replied" label={t("repliedRate")} footer={<>{versus}<DeltaValue state={row.replyRateDelta} kind="points" worseWhen="down" /><TargetText kpi="replied" value={row.replyRate} /></>}>
          <StateValue state={row.replyRate} format="percent" target={KPI_TARGETS.replied ?? undefined} showN />
        </Tile>
        <Tile kpi="rate24" label={t("rate24")} footer={<>{versus}<DeltaValue state={row.rate24Delta} kind="points" worseWhen="down" /><TargetText kpi="rate24" value={row.rate24} /><span data-s360-rank title={t("s360RankNote", { min: MIN_RATE_SAMPLE })}>{rank ? t("s360Rank", { rank: rank.rank, total: rank.total }) : t("s360Unranked", { min: MIN_RATE_SAMPLE })}</span></>}>
          <StateValue state={row.rate24} format="percent" target={RATE24_TARGET ?? undefined} showN />
        </Tile>
        <Tile kpi="unreplied" label={t("unanswered")} footer={<>{versus}<DeltaValue state={row.unrepliedDelta} kind="count" worseWhen="up" /><span>{t("chatsInMonth", { count: formatCount(row.chats, language) })}</span></>}>
          <StateValue state={row.unreplied} />
        </Tile>
        <Tile kpi="followers" label={t("followersNetLabel")} footer={<span>{periodLabel(data.frame.current, language)}</span>}>
          <StateValue state={followerNet} signed />
        </Tile>
      </div>
      <div className="grid gap-2 md:grid-cols-2"><HowCounted kpi="replied" /><HowCounted kpi="rate24" /></div>
      <p className="text-xs text-[var(--app-text-secondary)]">{t("kpiDifference")}</p>
    </Section>
  );
}

function formatCount(state: ValueState, language: AppLanguage): string {
  return "value" in state ? state.value.toLocaleString(languageLocale(language)) : "—";
}

function Trend({ row, data }: { row: StoreMetricsRow; data: MonthlyMetrics }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const storeMonth = useStoreMonthChats(row.storeId, data.month, data.nonce);
  const dailyRates = useStoreDailyRateSource(row.storeId, data.frame, data.nonce);
  const trend = useMonthlyTrend(data.month, data.now, data.nonce, true);
  const rateByDay = new Map((dailyRates.data ?? []).map((day) => [day.date, day]));
  const days = storeMonth.data ? dailyBreakdown(storeMonth.data.items, data.frame.current) : null;
  const max = Math.max(1, ...(days ?? []).map((day) => day.chats));
  const months = (trend.data ?? []).filter((point) => point.month < data.month).map((point) => {
    const counts = point.summary ? storeCounts(point.summary).get(row.storeId) ?? { total: 0, notReplied: 0, replied: 0 } : null;
    const rate = point.rates ? point.rates.stores.find((entry) => entry.storeId === row.storeId) ?? { total: 0, within24h: 0 } : null;
    const status = { error: point.error };
    return {
      month: point.month,
      unreplied: counts ? countState(counts.notReplied) : countState(null, status),
      replyRate: counts ? rateState(counts.replied, counts.total) : countState(null, status),
      rate24: rate ? rateState(rate.within24h, rate.total) : countState(null, status),
    };
  });
  const cell = "whitespace-nowrap px-2 py-1 text-xs";
  return (
    <Section title={t("s360Trend")} id="s360-trend">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className={card}>
          <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">{t("s360Daily")}</h3>
          {!days ? <p className="mt-2 text-xs text-[var(--app-text-secondary)]">{storeMonth.error ? t("unableToLoadDataWithError", { error: storeMonth.error }) : t("loadingEllipsis")}</p> : (
            <div className="mt-2 max-h-96 overflow-y-auto">
              <table data-s360-daily className="w-full text-left">
                <thead className="sticky top-0 bg-[var(--app-surface)] text-[11px] text-[var(--app-text-secondary)]">
                  <tr className="border-b border-[var(--app-border)]">
                    <th scope="col" className={`${cell} font-medium`}>{t("date")}</th>
                    <th scope="col" className={`${cell} w-full font-medium`}><span className="sr-only">{t("chartDescription")}</span></th>
                    <th scope="col" className={`${cell} text-right font-medium`}>{t("chats")}</th>
                    <th scope="col" className={`${cell} text-right font-medium`}>{t("unanswered")}</th>
                    <th scope="col" className={`${cell} text-right font-medium`}>{t("rate24Label")}</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => {
                    const rate = rateByDay.get(day.day);
                    return (
                      <tr key={day.day}>
                        <th scope="row" className={`${cell} font-normal tabular-nums text-[var(--app-text-secondary)]`}>{Number(day.day.slice(8))}</th>
                        <td className={cell} aria-hidden="true">
                          <span className="flex h-2.5 overflow-hidden rounded-sm bg-[var(--app-surface-subtle)]">
                            <span className="bg-[var(--app-accent)]" style={{ width: `${((day.chats - day.unreplied) / max) * 100}%` }} />
                            <span className="bg-[var(--app-danger)]" style={{ width: `${(day.unreplied / max) * 100}%` }} />
                          </span>
                        </td>
                        <td className={`${cell} text-right tabular-nums`}>{day.chats}</td>
                        <td className={`${cell} text-right tabular-nums`}>{day.unreplied}</td>
                        <td className={`${cell} text-right tabular-nums text-[var(--app-text-secondary)]`}>{dailyRates.data ? (rate ? `${rate.within24h}/${rate.total}` : "—") : dailyRates.error ? "!" : "…"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-[var(--app-text-secondary)]">{t("s360DailyNote")}</p>
        </div>
        <div className={card}>
          <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">{t("s360PreviousMonths")}</h3>
          {!trend.data ? <p className="mt-2 text-xs text-[var(--app-text-secondary)]">{trend.error ? t("unableToLoadDataWithError", { error: trend.error }) : t("loadingEllipsis")}</p> : months.length === 0 ? <p className="mt-2 text-xs text-[var(--app-text-secondary)]">{t("responseStatusCoverage", { month: monthShortLabel("2026-09", language), count: 1 })}</p> : (
            <table data-s360-months className="mt-2 w-full text-left">
              <thead className="text-[11px] text-[var(--app-text-secondary)]">
                <tr className="border-b border-[var(--app-border)]">
                  <th scope="col" className={`${cell} font-medium`}>{t("monthColumn")}</th>
                  <th scope="col" className={`${cell} text-right font-medium`}>{t("unanswered")}</th>
                  <th scope="col" className={`${cell} text-right font-medium`}>{t("repliedRate")}</th>
                  <th scope="col" className={`${cell} text-right font-medium`}>{t("rate24Label")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border-subtle)]">
                {months.map((point) => (
                  <tr key={point.month}>
                    <th scope="row" className={`${cell} font-medium`}>{monthShortLabel(point.month, language)}</th>
                    <td className={`${cell} text-right`}><StateValue state={point.unreplied} /></td>
                    <td className={`${cell} text-right`}><StateValue state={point.replyRate} format="percent" /></td>
                    <td className={`${cell} text-right`}><StateValue state={point.rate24} format="percent" target={RATE24_TARGET ?? undefined} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Section>
  );
}

function Followers({ storeId, data, followers }: { storeId: string; data: MonthlyMetrics; followers: ReturnType<typeof useMonthlyFollowers> }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const locale = languageLocale(language);
  const days = followers.days;
  const series = useStoreFollowerDays(storeId, days ? { dateFrom: data.frame.current.dateFrom, dateTo: days.target } : null, data.nonce);
  const change = followers.byStore.data?.get(storeId) ?? null;
  const points = (series.data ?? []).filter((day) => day.followers !== null).map((day) => ({ date: day.date, followers: day.followers as number }));
  const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString(locale)}`;
  return (
    <Section title={t("s360FollowersStore")} id="s360-followers">
      <div className={`${card} space-y-3`}>
        {!days ? <p className="text-sm text-[var(--app-text-secondary)]">{t("followersNoSnapshot")}</p> : !followers.byStore.data ? (
          <p className="text-sm text-[var(--app-text-secondary)]">{followers.byStore.error ? t("sourceFailed", { what: t("whatFollowers"), error: followers.byStore.error }) : t("loadingEllipsis")}</p>
        ) : !change ? (
          <p data-s360-followers-empty className="text-sm text-[var(--app-text-secondary)]">{t("s360FollowersNoData")}</p>
        ) : (
          <dl data-s360-followers className="grid grid-cols-3 gap-3">
            <div><dt className="text-xs text-[var(--app-text-secondary)]">{t("followersAdded")}</dt><dd className="text-xl font-semibold tabular-nums">{signed(change.adds)}</dd></div>
            <div><dt className="text-xs text-[var(--app-text-secondary)]">{t("followersBlocked")}</dt><dd className="text-xl font-semibold tabular-nums">{signed(-change.blocks)}</dd></div>
            <div><dt className="text-xs text-[var(--app-text-secondary)]">{t("followersNet")}</dt><dd className="text-xl font-semibold tabular-nums">{signed(change.net)}</dd></div>
          </dl>
        )}
        {days && <p className="text-xs text-[var(--app-text-secondary)]">{t("followersRange", { baseline: shortDate(days.baseline, language), target: shortDate(days.target, language) })}</p>}
        {points.length > 1 && <FollowerChart points={points} title={t("followersDaily")} />}
      </div>
    </Section>
  );
}

function GoogleReview({ storeId, data }: { storeId: string; data: MonthlyMetrics }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const result = data.google.data?.find((store) => store.id === storeId)?.kpiResult ?? null;
  return (
    <Section title={t("s360GoogleReview")} id="s360-review">
      <div data-s360-review className={card}>
        {!data.google.data ? <p className="text-sm text-[var(--app-text-secondary)]">{data.google.error ? t("unableToLoadDataWithError", { error: data.google.error }) : t("loadingEllipsis")}</p>
          : !result ? <p className="text-sm text-[var(--app-text-secondary)]">{t("reviewNotChecked")}</p>
            : <p className="text-sm"><span className="font-semibold tabular-nums">{t("s360ReviewResult", { count: result.qualifiedReviews, target: result.targetQualifiedReviews })}</span> <span className={result.isPassed ? "text-[var(--app-text-secondary)]" : "text-[var(--app-danger)]"}>· {result.isPassed ? t("targetMetShort") : t("targetBelowShort")}</span></p>}
      </div>
    </Section>
  );
}

function CountList({ title, items, language }: { title: string; items: CountItem[]; language: AppLanguage }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1 text-xs font-semibold text-[var(--app-text-primary)]">{title}</h3>
      {items.length === 0 ? <p className="text-xs text-[var(--app-text-secondary)]">—</p> : (
        <ol className="space-y-0.5 text-xs">
          {items.map((item) => <li key={item.key} className="flex justify-between gap-2"><span className="truncate">{tagValueLabel(item.key, language)}</span><span className="tabular-nums text-[var(--app-text-secondary)]">{item.count.toLocaleString(languageLocale(language))}</span></li>)}
        </ol>
      )}
    </div>
  );
}

function CustomerTags({ storeId, data }: { storeId: string; data: MonthlyMetrics }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const storeMonth = useStoreMonthChats(storeId, data.month, data.nonce);
  const coverage = tagCoverageView(data.tagCoverageByStore.get(storeId));
  const mix = storeMonth.data ? customerTagMix(storeMonth.data.items) : null;
  const locale = languageLocale(language);
  return (
    <Section title={t("s360Tags")} id="s360-tags">
      <div data-s360-tags className={`${card} space-y-3`}>
        <p className="text-xs font-semibold text-[var(--app-warning)]">{t("s360TagsDisclaimer")}</p>
        <p className="text-sm text-[var(--app-text-primary)]">
          {!coverage ? (data.tagCoverage.error ? t("unableToLoadTagsWithError", { error: data.tagCoverage.error }) : t("loadingEllipsis"))
            : coverage.kind === "no-chats" ? t("tagNoChats")
              : coverage.kind === "unread" ? `${t("s360NamesRead", { read: 0, total: coverage.total.toLocaleString(locale) })} · ${t("tagUnread")}`
                : <>{t("s360NamesRead", { read: coverage.read.toLocaleString(locale), total: coverage.total.toLocaleString(locale) })} · {t("s360TagCoverage", { value: "" })}<StateValue state={coverage.tagged} format="percent" /></>}
        </p>
        {!mix ? <p className="text-xs text-[var(--app-text-secondary)]">{storeMonth.error ? t("unableToLoadDataWithError", { error: storeMonth.error }) : t("loadingEllipsis")}</p>
          : mix.tagged === 0 ? <p className="text-xs text-[var(--app-text-secondary)]">{t("s360NoTags")}</p> : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <CountList title={t("s360TopProducts")} items={mix.products} language={language} />
                <CountList title={t("s360SourceMix")} items={mix.sources} language={language} />
                <CountList title={t("s360FinanceMix")} items={mix.finance} language={language} />
              </div>
              <p className="text-xs text-[var(--app-text-secondary)]">{t("s360TagsCounted", { count: mix.chats.toLocaleString(locale) })}{storeMonth.data?.truncated ? ` · ${t("latestChatsTruncated", { shown: mix.chats.toLocaleString(locale), total: storeMonth.data.total.toLocaleString(locale) })}` : ""}</p>
            </>
          )}
      </div>
    </Section>
  );
}

function Actions({ row, data }: { row: StoreMetricsRow; data: MonthlyMetrics }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  const copy = async () => {
    const text = buildReportSummary({ monthLabel: monthShortLabel(data.month, language), periodText: data.periodText, scopeLabel: t("s360StoreScope", { store: row.storeName }), totals: row, stores: [row], inProgress: data.frame.inProgress, language });
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  };
  return (
    <Section title={t("s360Actions")} id="s360-actions">
      <div data-s360-actions className="flex flex-wrap items-center gap-2">
        <Link href={chatsHref({ storeId: row.storeId, month: data.month })} className={linkButton}>{t("s360ActionChats")}</Link>
        <Link href={kpiReportHref(data.month, row.storeId)} target="_blank" className={linkButton}>{t("s360ActionReport")} ↗</Link>
        <button type="button" onClick={() => void copy()} className={linkButton} data-s360-copy>{t("s360ActionCopy")}</button>
        <Store360ExportControl stores={data.storeRows.map((entry) => ({ id: entry.storeId, name: entry.storeName, code: null }))} selectedStoreId={row.storeId} startDate={data.frame.current.dateFrom} endDate={data.frame.current.dateTo} language={language} />
        {copied && <span role="status" className="text-xs text-[var(--app-text-secondary)]">{copied === "ok" ? t("s360Copied") : t("s360CopyFailed")}</span>}
      </div>
    </Section>
  );
}

function StoreMonthView({ storeId, row, data }: { storeId: string; row: StoreMetricsRow | null; data: MonthlyMetrics }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const latest = useStoreLatestChat(storeId, data.nonce);
  const followers = useMonthlyFollowers({ current: data.frame.current, previous: null, nonce: data.nonce, now: data.now, parts: { byStore: true } });
  const noChatData = latest.data !== null && latest.data.total === 0;
  const storeMonth = useStoreMonthChats(noChatData ? null : storeId, data.month, data.nonce);
  const voice = useCustomerVoiceShare(noChatData ? null : storeId, { from: data.frame.current.dateFrom, to: data.frame.current.dateTo }, data.nonce);
  const change = followers.byStore.data?.get(storeId);
  const followerNet: ValueState = !followers.days ? { kind: "not-collected" } : followers.byStore.data ? (change ? countState(change.net) : { kind: "not-collected" }) : followers.byStore.error ? { kind: "failed", error: followers.byStore.error } : { kind: "loading" };
  const location = row ? thaiLocationLabel(row.region, row.province) : null;
  const managerUrl = storeMonth.data?.managerUrl ?? null;
  const coverageChip = latest.data ? (latest.data.total === 0 || !latest.data.latestMessageAt ? t("s360CoverageNone") : t("s360CoverageUpTo", { date: shortDate(new Date(Date.parse(latest.data.latestMessageAt) + 7 * 3600_000).toISOString().slice(0, 10), language) })) : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {location && <span className="text-[var(--app-text-secondary)]">{location}</span>}
        {managerUrl && <a href={managerUrl} target="_blank" rel="noreferrer" className="rounded-full border border-[var(--app-border)] px-2.5 py-0.5 font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]">{t("s360LineOa")}</a>}
        {coverageChip && <span data-s360-coverage className={`rounded-full px-2.5 py-0.5 font-medium ${noChatData ? "bg-[var(--app-warning-soft)] text-[var(--app-text-primary)]" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)]"}`}>{coverageChip}</span>}
      </div>
      {noChatData ? (
        <div data-s360-no-chat-data role="status" className={`${card} border-[var(--app-warning)]/40`}>
          <p className="text-base font-semibold text-[var(--app-text-primary)]">{t("s360NoChatData")}</p>
          <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{t("s360NoChatDataNote")} <Link href="/operations/line-chat-health" className="text-[var(--app-accent)] hover:underline">{t("dataHealthLink")}</Link></p>
        </div>
      ) : row ? (
        <>
          {row.chats.kind === "true-zero" && <p data-s360-no-chats-month className="text-sm text-[var(--app-text-secondary)]">{t("s360NoChatsThisMonth")}</p>}
          <Scorecard row={row} data={data} followerNet={followerNet} />
          <Trend row={row} data={data} />
        </>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <Followers storeId={storeId} data={data} followers={followers} />
        <GoogleReview storeId={storeId} data={data} />
      </div>
      {!noChatData && row && (
        <>
          <CustomerTags storeId={storeId} data={data} />
          <Actions row={row} data={data} />
          {showCustomerVoice(voice.data) && (
            <p data-s360-customer-voice><Link href={`/store-360/customer-voice?${new URLSearchParams({ storeId, from: data.frame.current.dateFrom, to: data.frame.current.dateTo }).toString()}`} className="text-sm text-[var(--app-accent)] hover:underline">{t("s360CustomerVoiceLink")}</Link></p>
          )}
        </>
      )}
    </>
  );
}

export function Store360Monthly() {
  const { language, setLanguage } = useAppLanguage();
  const t = v2Text(language);
  const router = useRouter();
  const params = useSearchParams();
  const month = parseV2Month(params.get("month"));
  const storeId = params.get("storeId");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [picking, setPicking] = useState(false);
  const [searchText, setSearchText] = useState("");
  const data = useMonthlyMetrics(month, { google: true, tagCoverage: true, enabled: Boolean(authUser) });
  const row = storeId ? data.storeRows.find((entry) => entry.storeId === storeId) ?? null : null;
  const scopeKnown = Boolean(data.stores.data && data.current.data);

  useEffect(() => {
    let cancelled = false;
    void api.me().then((user) => { if (!cancelled) setAuthUser(user as AuthUser); }).catch(() => { if (!cancelled) router.replace("/login"); });
    return () => { cancelled = true; };
  }, [router]);

  // /store-360 without a store: the last viewed store when it is still in scope; else the picker.
  useEffect(() => {
    if (storeId || !scopeKnown) return;
    const target = storeToOpen(readLastStore(storageOrNull()), data.storeRows);
    if (target) router.replace(store360Href(target, month));
  }, [data.storeRows, month, router, scopeKnown, storeId]);

  useEffect(() => {
    if (row) writeLastStore(storageOrNull(), row.storeId);
  }, [row]);

  const pick = useCallback((next: string) => {
    setPicking(false);
    router.push(store360Href(next, month));
  }, [month, router]);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    router.replace("/login");
  }, [router]);

  if (!authUser) return <main className="store360-workspace flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">{t("s360Loading")}</main>;

  const notInScope = Boolean(storeId && scopeKnown && !row);
  const showPicker = !storeId || picking || notInScope;
  const title = row?.storeName ?? (storeId ? data.stores.data?.find((store) => store.id === storeId)?.name : null) ?? t("s360Title");

  return (
    <AppShell currentSection="store-360" authUser={authUser} text={{ appName: "OPPO LINE OA Monitor" }} language={language} changeLanguage={setLanguage} searchText={searchText} setSearchText={setSearchText} logout={logout} showGlobalHeader={false} isLoading={data.coreLoading} apiError={data.current.error} loadApplicationData={data.refresh}>
      <main data-store360-monthly data-legacy-i18n-skip className="store360-workspace min-w-0 flex-1 bg-[var(--app-bg)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px] space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--app-accent)]">{t("s360Title")}</p>
              <h1 className="mt-1 truncate text-2xl font-bold tracking-[-0.02em] text-[var(--app-text-primary)]">{title}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <MetricsMonthSelect month={month} />
              {storeId && !notInScope && <button type="button" onClick={() => setPicking((value) => !value)} className={linkButton} aria-expanded={picking}>{t("s360ChangeStore")}</button>}
            </div>
          </header>
          {notInScope && <p role="status" className="rounded-[var(--app-radius-md)] border border-[var(--app-warning)]/30 bg-[var(--app-warning-soft)] px-3 py-2 text-sm text-[var(--app-text-primary)]">{t("s360NotInScope")}</p>}
          {showPicker && <StorePicker data={data} onPick={pick} />}
          {storeId && !notInScope && <StoreMonthView key={storeId} storeId={storeId} row={row} data={data} />}
        </div>
      </main>
    </AppShell>
  );
}
