"use client";

// แดชบอร์ด: the month's two KPIs, followers and the store table. Every number comes from the metrics
// layer (lib/metrics, docs/metrics-registry.md) — the same functions Home and Store 360 use.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { useAppLanguage } from "@/app/language";
import { languageLocale, type AppLanguage } from "@/app/language-utils";
import { HowCounted, TargetText } from "@/components/metrics/kpi-ui";
import { MetricsMonthSelect } from "@/components/metrics/month-select";
import { CountCell, DeltaValue, StateValue } from "@/components/metrics/value-ui";
import { Button, SearchInput, SectionCard, SectionCardSkeleton, Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow, useDeferredLoading } from "@/components/ui";
import { belowTarget24, RATE_BANDS, rateBands, splitByChatData, storesCsv, storesPassing24 } from "@/lib/metrics/dashboard-model";
import { FOLLOWER_MIN_AGE_DAYS, FOLLOWER_MIN_BASE, followerMovers, type StoreFollowerChange } from "@/lib/metrics/followers";
import { store360Href } from "@/lib/metrics/links";
import { KPI_TARGETS, RATE24_TARGET, REPLIED_RATE_TARGET, type KpiKey } from "@/lib/metrics/kpi";
import { monthLongLabel, parseV2Month, periodLabel, THAI_MONTHS_SHORT } from "@/lib/metrics/month";
import { filterStoreRows, sortStoreRows, type StoreMetricsRow } from "@/lib/metrics/store-model";
import { storeScopeText } from "@/lib/metrics/store-scope";
import { thaiLocationLabel, thaiRegion } from "@/lib/metrics/thai-geo";
import { v2Text } from "@/lib/metrics/translations";
import { useMonthlyFollowers, type FollowerTrendPoint } from "@/lib/metrics/use-monthly-followers";
import { useMonthlyMetrics, type MonthlyMetrics, type Source } from "@/lib/metrics/use-monthly-metrics";
import { countState, formatValue, MIN_RATE_SAMPLE, type ValueState } from "@/lib/metrics/value-state";

function shortDate(dateKey: string, language: AppLanguage): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (language === "th") return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${year}`;
  return new Intl.DateTimeFormat(languageLocale(language), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function timeOfDay(ms: number, language: AppLanguage): string {
  return new Intl.DateTimeFormat(`${languageLocale(language)}-u-ca-gregory`, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(ms));
}

function SourceError({ errors }: { errors: Array<string | null | undefined> }) {
  const list = errors.filter(Boolean);
  if (list.length === 0) return null;
  return <div role="status" className="rounded-[var(--app-radius-md)] border border-[var(--app-warning)]/30 bg-[var(--app-warning-soft)] px-3 py-2 text-xs text-[var(--app-text-primary)]">{list.join(" · ")}</div>;
}

/** A KPI card: the value with n, its change in points, the target state and the previous period. */
function KpiCard({ kpi, value, previous, delta, data }: { kpi: KpiKey; value: ValueState; previous: ValueState; delta: ValueState; data: MonthlyMetrics }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const previousText = formatValue(previous, "percent", language);
  return (
    <div data-dashboard-kpi={kpi} className="flex flex-col gap-1.5 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">{t(kpi === "replied" ? "repliedRate" : "rate24")}</h3>
        <span className="rounded-full bg-[var(--app-surface-subtle)] px-2 py-0.5 text-[11px] text-[var(--app-text-secondary)]">{periodLabel(data.frame.current, language)}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-semibold"><StateValue state={value} format="percent" target={KPI_TARGETS[kpi] ?? undefined} showN /></span>
        <DeltaValue state={delta} kind="points" worseWhen="down" />
      </div>
      <TargetText kpi={kpi} value={value} />
      <p className="text-xs text-[var(--app-text-secondary)]">
        {t("previousPeriodValue", { period: periodLabel(data.frame.previous, language), value: previousText.reason ? `${previousText.text} (${previousText.reason})` : previousText.text })}
      </p>
    </div>
  );
}

function RepliesSection({ data }: { data: MonthlyMetrics }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const bands = rateBands(data.storeRows);
  const passing = storesPassing24(data.storeRows);
  const locale = languageLocale(language);
  return (
    <section aria-labelledby="dashboard-replies" className="space-y-3">
      <h2 id="dashboard-replies" className="text-base font-semibold text-[var(--app-text-primary)]">{t("sectionReplies")}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <KpiCard kpi="replied" value={data.network.replyRate} previous={data.network.previousReplyRate} delta={data.network.replyRateDelta} data={data} />
        <KpiCard kpi="rate24" value={data.network.rate24} previous={data.network.previousRate24} delta={data.network.rate24Delta} data={data} />
      </div>
      <p data-dashboard-volume className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--app-text-secondary)]">
        <span>{t("chats")} <span className="font-semibold text-[var(--app-text-primary)]"><StateValue state={data.network.chats} /></span></span>
        <span>{t("unanswered")} <span className="font-semibold text-[var(--app-text-primary)]"><StateValue state={data.network.unreplied} /></span> <DeltaValue state={data.network.unrepliedDelta} kind="count" worseWhen="up" /></span>
      </p>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <p data-dashboard-passing className="text-sm font-semibold text-[var(--app-text-primary)]">
            {data.coreLoading || !data.rates.data ? t("loadingEllipsis") : t("storesPassing24", { count: passing.count.toLocaleString(locale), total: passing.total.toLocaleString(locale) })}
          </p>
          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{t("storesPassing24Note", { min: MIN_RATE_SAMPLE })}</p>
        </div>
        <div className="overflow-x-auto rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <table data-dashboard-rate-bands className="w-full text-left text-xs">
            <caption className="mb-2 text-left text-sm font-semibold text-[var(--app-text-primary)]">{t("rateBandsTitle")}</caption>
            <thead className="text-[11px] text-[var(--app-text-secondary)]">
              <tr className="border-b border-[var(--app-border)]">
                {RATE_BANDS.map((band) => <th key={band.key} scope="col" className="px-2 py-1.5 text-right font-medium">{band.label}</th>)}
                <th scope="col" className="px-2 py-1.5 text-right font-medium" title={t("rateBandLowNote", { min: MIN_RATE_SAMPLE })}>{t("rateBandLow")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {RATE_BANDS.map((band) => <td key={band.key} className="px-2 py-1.5 text-right text-base font-semibold tabular-nums">{data.rates.data ? bands[band.key].toLocaleString(locale) : "…"}</td>)}
                <td className="px-2 py-1.5 text-right text-base font-semibold tabular-nums text-[var(--app-text-secondary)]">{data.rates.data ? bands.low.toLocaleString(locale) : "…"}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-[var(--app-text-secondary)]">{t("rateBandLowNote", { min: MIN_RATE_SAMPLE })} · {t("rateBandNoChats", { count: bands.noChats.toLocaleString(locale) })}</p>
        </div>
      </div>
    </section>
  );
}

/** Daily network followers (the existing follower trend), as a small line chart. */
function FollowerChart({ points }: { points: FollowerTrendPoint[] }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  if (points.length < 2) return null;
  const width = 640;
  const height = 140;
  const pad = 8;
  const values = points.map((point) => point.followers);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const xy = points.map((point, index) => [pad + (index / (points.length - 1)) * (width - pad * 2), pad + ((max - point.followers) / range) * (height - pad * 2)] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const locale = languageLocale(language);
  return (
    <figure className="space-y-1">
      <figcaption className="text-xs font-medium text-[var(--app-text-secondary)]">{t("followersDaily")}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label={`${t("followersDaily")}: ${shortDate(points[0].date, language)} ${points[0].followers.toLocaleString(locale)} → ${shortDate(points[points.length - 1].date, language)} ${points[points.length - 1].followers.toLocaleString(locale)}`}>
        <polygon points={`${pad},${height - pad} ${line} ${width - pad},${height - pad}`} fill="var(--app-accent-soft)" />
        <polyline points={line} fill="none" stroke="var(--app-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {xy.map(([x, y], index) => <circle key={points[index].date} cx={x} cy={y} r="2.5" fill="var(--app-accent)" vectorEffect="non-scaling-stroke"><title>{`${shortDate(points[index].date, language)}: ${t("followersPeople", { count: points[index].followers.toLocaleString(locale) })}`}</title></circle>)}
      </svg>
      <div className="flex justify-between text-[11px] text-[var(--app-text-tertiary)]"><span>{shortDate(points[0].date, language)}</span><span>{shortDate(points[points.length - 1].date, language)}</span></div>
    </figure>
  );
}

function MoversList({ title, rows, month }: { title: string; rows: StoreFollowerChange[]; month: string }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const locale = languageLocale(language);
  return (
    <div className="min-w-0">
      <h3 className="mb-1.5 text-xs font-semibold text-[var(--app-text-primary)]">{title}</h3>
      {rows.length === 0 ? <p className="text-xs text-[var(--app-text-secondary)]">{t("noMovers")}</p> : (
        <ol className="divide-y divide-[var(--app-border-subtle)] text-xs">
          {rows.map((row) => (
            <li key={row.storeId} className="flex items-center justify-between gap-3 py-1.5">
              <Link href={store360Href(row.storeId, month)} className="min-w-0 truncate text-[var(--app-text-primary)] hover:text-[var(--app-accent)] hover:underline" title={row.storeName}>{row.storeName}</Link>
              <span className="shrink-0 font-semibold tabular-nums text-[var(--app-text-primary)]">{row.net > 0 ? "+" : "−"}{Math.abs(row.net).toLocaleString(locale)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function FollowersSection({ data, followers }: { data: MonthlyMetrics; followers: ReturnType<typeof useMonthlyFollowers> }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const locale = languageLocale(language);
  const scope = useMemo(() => new Set(data.storeRows.map((row) => row.storeId)), [data.storeRows]);
  const movers = followers.byStore.data ? followerMovers(followers.byStore.data, followers.seen.data, { inScope: data.stores.data ? scope : undefined }) : null;
  const growth = followers.growth.data;
  const number = (value: number | null | undefined, signed = false) => {
    if (value === null || value === undefined) return <span className="text-[var(--app-text-secondary)]">{followers.growth.loading ? "…" : "—"}</span>;
    return <span className="tabular-nums">{signed && value > 0 ? "+" : value < 0 ? "−" : ""}{Math.abs(value).toLocaleString(locale)}</span>;
  };
  return (
    <section aria-labelledby="dashboard-followers" className="space-y-3">
      <h2 id="dashboard-followers" className="text-base font-semibold text-[var(--app-text-primary)]">{t("sectionFollowers")}</h2>
      <div className="space-y-4 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        {!followers.days ? (
          <p data-dashboard-followers-empty className="text-sm text-[var(--app-text-secondary)]">{t("followersNoSnapshot")}</p>
        ) : (
          <>
            <SourceError errors={[followers.growth.error && t("sourceFailed", { what: t("whatFollowers"), error: followers.growth.error })]} />
            <dl data-dashboard-followers className="grid grid-cols-3 gap-3">
              <div><dt className="text-xs text-[var(--app-text-secondary)]">{t("followersAdded")}</dt><dd className="text-xl font-semibold">{number(growth?.added, true)}</dd></div>
              <div><dt className="text-xs text-[var(--app-text-secondary)]">{t("followersBlocked")}</dt><dd className="text-xl font-semibold">{number(growth ? -growth.blocked : null)}</dd></div>
              <div><dt className="text-xs text-[var(--app-text-secondary)]">{t("followersNet")}</dt><dd className="text-xl font-semibold">{number(growth?.net, true)}</dd></div>
            </dl>
            <p className="text-xs text-[var(--app-text-secondary)]">{t("followersRange", { baseline: shortDate(followers.days.baseline, language), target: shortDate(followers.days.target, language) })}</p>
            {movers && (
              <p data-dashboard-follower-contribution className="text-sm text-[var(--app-text-primary)]">
                {t("followerContribution", { gain: movers.gained.total.toLocaleString(locale), gainStores: movers.gained.stores.toLocaleString(locale), loss: movers.lost.total.toLocaleString(locale), lossStores: movers.lost.stores.toLocaleString(locale) })}
                <span className="block text-xs text-[var(--app-text-secondary)]">{t("followerContributionNote")}</span>
              </p>
            )}
            {followers.trend.data && <FollowerChart points={followers.trend.data} />}
            {movers ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <MoversList title={t("topGrowers")} rows={movers.growers} month={data.month} />
                  <MoversList title={t("topDecliners")} rows={movers.decliners} month={data.month} />
                </div>
                <p className="text-xs text-[var(--app-text-secondary)]">{t("moversNote", { min: FOLLOWER_MIN_BASE, days: FOLLOWER_MIN_AGE_DAYS, count: movers.excluded.toLocaleString(locale) })}</p>
              </>
            ) : (
              <p className="text-xs text-[var(--app-text-secondary)]">{followers.byStore.error ? t("sourceFailed", { what: t("whatFollowers"), error: followers.byStore.error }) : t("loadingEllipsis")}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function StoreRow({ row, month, followerNet }: { row: StoreMetricsRow; month: string; followerNet: Source<Map<string, StoreFollowerChange>> }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const location = thaiLocationLabel(row.region, row.province);
  const change = followerNet.data?.get(row.storeId);
  const net: ValueState = followerNet.data ? (change ? countState(change.net) : { kind: "not-collected" }) : followerNet.error ? { kind: "failed", error: followerNet.error } : followerNet.loading ? { kind: "loading" } : { kind: "not-applicable" };
  return (
    <TableRow data-dashboard-store-row={row.storeId}>
      <th scope="row" className="max-w-[18rem] px-4 py-3 text-left text-xs font-normal">
        <Link href={store360Href(row.storeId, month)} aria-label={t("openStore360", { store: row.storeName })} className="block max-w-full truncate text-sm font-medium text-[var(--app-text-primary)] hover:text-[var(--app-accent)] hover:underline" title={row.storeName}>{row.storeName}</Link>
        <span className="block truncate text-[var(--app-text-secondary)]">{location ?? "—"}</span>
      </th>
      <TableCell align="right" numeric><StateValue state={row.chats} /></TableCell>
      <TableCell align="right" numeric><CountCell value={row.unreplied} /></TableCell>
      <TableCell align="right" numeric><StateValue state={row.replyRate} format="percent" target={REPLIED_RATE_TARGET ?? undefined} /></TableCell>
      <TableCell align="right" numeric><StateValue state={row.rate24} format="percent" target={RATE24_TARGET ?? undefined} showN /></TableCell>
      <TableCell align="right" numeric><DeltaValue state={row.rate24Delta} kind="points" worseWhen="down" /></TableCell>
      <TableCell align="right" numeric><DeltaValue state={net} kind="count" worseWhen="down" /></TableCell>
    </TableRow>
  );
}

function StoresSection({ data, followers }: { data: MonthlyMetrics; followers: ReturnType<typeof useMonthlyFollowers> }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [belowOnly, setBelowOnly] = useState(false);
  const showSkeleton = useDeferredLoading(data.coreLoading);
  const regions = useMemo(
    () => [...new Set(data.storeRows.map((row) => row.region).filter((value): value is string => Boolean(value)))].sort((a, b) => (thaiRegion(a) ?? a).localeCompare(thaiRegion(b) ?? b, "th")),
    [data.storeRows],
  );
  const { withData, withoutData } = useMemo(() => splitByChatData(sortStoreRows(filterStoreRows(data.storeRows, { region: region || null, search }), "rate24")), [data.storeRows, region, search]);
  const visible = belowOnly ? withData.filter((row) => belowTarget24(row)) : withData;
  const download = () => {
    const blob = new Blob([storesCsv(sortStoreRows(data.storeRows, "rate24"), followers.byStore.data, language)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stores-${data.month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section id="stores" aria-labelledby="dashboard-stores" className="scroll-mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="dashboard-stores" className="text-base font-semibold text-[var(--app-text-primary)]">{t("sectionStores")}</h2>
        <Button variant="outline" size="sm" onClick={download} disabled={data.coreLoading} data-dashboard-csv>{t("downloadCsv")}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
          {t("region")}
          <select data-dashboard-region value={region} onChange={(event) => setRegion(event.target.value)} className="h-9 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-xs text-[var(--app-text-primary)]">
            <option value="">{t("allRegions")}</option>
            {regions.map((value) => <option key={value} value={value}>{thaiRegion(value) ?? value}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--app-text-primary)]">
          <input type="checkbox" data-dashboard-below-target checked={belowOnly} onChange={(event) => setBelowOnly(event.target.checked)} className="h-4 w-4 accent-[var(--app-accent)]" />
          {t("belowTarget24Toggle")}
        </label>
        <div className="w-full sm:ml-auto sm:w-72">
          <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} placeholder={t("searchStoreName")} />
        </div>
      </div>
      {data.coreLoading ? (showSkeleton ? <SectionCardSkeleton title={t("sectionStores")} lines={10} /> : null) : (
        <SectionCard
          title={t("sectionStores")}
          meta={t("storesTableMeta", { visible: visible.length, total: data.storeRows.length, period: periodLabel(data.frame.current, language) })}
          bodyPadding="none"
          footer={<span className="text-xs text-[var(--app-text-secondary)]">{t("storesTableFooter", { min: MIN_RATE_SAMPLE })}</span>}
        >
          <div className="overflow-x-auto">
            <Table data-dashboard-store-table>
              <caption className="sr-only">{t("sectionStores")} · {data.periodText}</caption>
              <TableHeader>
                <tr>
                  <TableHead scope="col">{t("storeName")} · {t("locationColumn")}</TableHead>
                  <TableHead scope="col" align="right">{t("chats")}</TableHead>
                  <TableHead scope="col" align="right">{t("unanswered")}</TableHead>
                  <TableHead scope="col" align="right">{t("repliedRate")}</TableHead>
                  <TableHead scope="col" align="right">{t("rate24")} (n)</TableHead>
                  <TableHead scope="col" align="right">{t("rate24DeltaColumn")}</TableHead>
                  <TableHead scope="col" align="right">{t("followersNetLabel")}</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? <TableEmptyState colSpan={7} message={t("noStoresForFilter")} /> : visible.map((row) => <StoreRow key={row.storeId} row={row} month={data.month} followerNet={followers.byStore} />)}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}
      {!data.coreLoading && withoutData.length > 0 && (
        <details data-dashboard-no-chat-data className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-xs">
          <summary className="cursor-pointer font-semibold text-[var(--app-text-primary)]">{t("noChatDataStores", { count: withoutData.length })}</summary>
          <p className="mt-1 text-[var(--app-text-secondary)]">{t("noChatDataReason")}</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {withoutData.map((row) => <li key={row.storeId}><Link href={store360Href(row.storeId, data.month)} className="text-[var(--app-text-primary)] hover:text-[var(--app-accent)] hover:underline">{row.storeName}</Link></li>)}
          </ul>
        </details>
      )}
    </section>
  );
}

export function MonthlyDashboard() {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const params = useSearchParams();
  const month = parseV2Month(params.get("month"));
  const data = useMonthlyMetrics(month);
  const followers = useMonthlyFollowers({ current: data.frame.current, previous: null, nonce: data.nonce, now: data.now, parts: { growth: true, trend: true, byStore: true } });

  // /dashboard#stores (Home's "ดูทุกสาขา →") lands on the table once it has rendered.
  useEffect(() => {
    if (data.coreLoading || typeof window === "undefined" || window.location.hash !== "#stores") return;
    document.getElementById("stores")?.scrollIntoView({ block: "start" });
  }, [data.coreLoading]);

  return (
    <div data-monthly-dashboard data-legacy-i18n-skip className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[var(--app-text-primary)] sm:text-2xl">{t("dashboardTitle", { month: monthLongLabel(month, language) })}</h1>
          <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{t("dashboardDescription", { period: data.periodText })}</p>
          <p data-dashboard-data-line className="mt-1 text-xs text-[var(--app-text-secondary)]">
            {[t("dataAsOf", { time: timeOfDay(data.now, language) }), data.stores.data && data.current.data ? storeScopeText(data.coverage, language) : null, data.statusText].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MetricsMonthSelect month={month} />
          <Button variant="outline" size="md" onClick={data.refresh}>{t("refresh")}</Button>
        </div>
      </header>
      <div data-dashboard-how-counted className="grid gap-3 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 md:grid-cols-2">
        <div><span className="text-xs font-semibold">{t("repliedRate")}</span> <span className="text-xs text-[var(--app-text-secondary)]">· {t("noTarget")}</span><HowCounted kpi="replied" /></div>
        <div><span className="text-xs font-semibold">{t("rate24")}</span> <span className="text-xs text-[var(--app-text-secondary)]">· {t("targetWithValue", { value: RATE24_TARGET ?? 0 })}</span><HowCounted kpi="rate24" /></div>
        <p className="text-xs text-[var(--app-text-secondary)] md:col-span-2">{t("kpiDifference")}</p>
      </div>
      <SourceError errors={[
        data.current.error && t("chatCountLabelError", { error: data.current.error }),
        data.rates.error && t("replyWithin24Error", { error: data.rates.error }),
        data.previous.error && t("comparisonPeriodError", { error: data.previous.error }),
        data.closeError && t("closeError", { error: data.closeError }),
      ]} />
      <RepliesSection data={data} />
      <FollowersSection data={data} followers={followers} />
      <StoresSection data={data} followers={followers} />
    </div>
  );
}
