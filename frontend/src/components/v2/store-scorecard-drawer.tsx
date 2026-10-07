"use client";

import Link from "next/link";
import React, { useEffect, useRef } from "react";
import { useAppLanguage } from "@/app/language";
import { languageLocale } from "@/app/language-utils";
import { formatWaitingDuration } from "@/components/shell/store-priority-score";
import { RATE24_TARGET } from "@/lib/v2/kpi";
import { monthShortLabel, periodLabel } from "@/lib/v2/month";
import { chatsHref, reportHref } from "@/lib/v2/month-url";
import { dailyBreakdown, storeCounts, type MonthStoreRow } from "@/lib/v2/monthly-model";
import { thaiLocationLabel } from "@/lib/v2/thai-geo";
import { countState, numericValue, rateState } from "@/lib/v2/value-state";
import { HowCounted, KpiCompareTable } from "./kpi-cards";
import { TagCoverageDetail } from "./tag-coverage";
import { useStoreDailyRates, useStoreMonth, useTrend, useV2Month } from "./v2-month-data";
import { ManagerLink, StateValue } from "./v2-ui";
import { v2Text } from "@/lib/v2/v2-translations";

const cell = "px-3 py-2 text-xs whitespace-nowrap";

function Section({ title, meta, children }: { title: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">{title}</h3>
        {meta && <span className="text-xs text-[var(--app-text-secondary)]">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Trend({ storeId }: { storeId: string }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const trend = useTrend(true);
  if (!trend.data) return <p className="text-xs text-[var(--app-text-secondary)]">{trend.error ? t("unableToLoadDataWithError", { error: trend.error }) : t("loadingEllipsis")}</p>;
  const points = trend.data.map((point) => {
    const counts = point.summary ? storeCounts(point.summary).get(storeId) ?? { total: 0, notReplied: 0, replied: 0 } : null;
    const rate = point.rates ? point.rates.stores.find((entry) => entry.storeId === storeId) ?? { total: 0, within24h: 0 } : null;
    const status = { error: point.error };
    return {
      month: point.month,
      chats: counts ? countState(counts.total) : countState(null, status),
      unreplied: counts ? countState(counts.notReplied) : countState(null, status),
      replyRate: counts ? rateState(counts.replied, counts.total) : countState(null, status),
      rate24: rate ? rateState(rate.within24h, rate.total) : countState(null, status),
    };
  });
  return (
    <>
      <table data-v2-drawer-trend className="w-full text-left">
        <thead className="text-[11px] text-[var(--app-text-secondary)]">
          <tr className="border-b border-[var(--app-border)]">
            <th scope="col" className={`${cell} font-medium`}>{t("monthColumn")}</th>
            <th scope="col" className={`${cell} text-right font-medium`}>{t("chats")}</th>
            <th scope="col" className={`${cell} text-right font-medium`}>{t("unanswered")}</th>
            <th scope="col" className={`${cell} text-right font-medium`}>{t("repliedRate")}</th>
            <th scope="col" className={`${cell} text-right font-medium`}>{t("rate24Label")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--app-border-subtle)]">
          {points.map((point) => (
            <tr key={point.month}>
              <th scope="row" className={`${cell} font-medium`}>{monthShortLabel(point.month, language)}</th>
              <td className={`${cell} text-right`}><StateValue state={point.chats} /></td>
              <td className={`${cell} text-right`}><StateValue state={point.unreplied} /></td>
              <td className={`${cell} text-right`}><StateValue state={point.replyRate} format="percent" /></td>
              <td className={`${cell} text-right`}><StateValue state={point.rate24} format="percent" target={RATE24_TARGET ?? undefined} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {points.length < 6 && <p className="text-xs text-[var(--app-text-secondary)]">{t("responseStatusCoverage", { month: monthShortLabel("2026-09", language), count: points.length })}</p>}
    </>
  );
}

function DailyAndTags({ row }: { row: MonthStoreRow }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const data = useV2Month();
  const storeMonth = useStoreMonth(row.storeId, data.month);
  const dailyRates = useStoreDailyRates(row.storeId);
  if (!storeMonth.data) {
    const text = storeMonth.error ? t("unableToLoadDataWithError", { error: storeMonth.error }) : t("loadingEllipsis");
    return (
      <>
        <Section title={t("daily")}><p className="text-xs text-[var(--app-text-secondary)]">{text}</p></Section>
        <Section title={t("tagCoverage")}><TagCoverageDetail counts={data.tagCoverageByStore.get(row.storeId)} /></Section>
      </>
    );
  }
  const { items, truncated } = storeMonth.data;
  const days = dailyBreakdown(items, data.frame.current);
  const rateByDay = new Map((dailyRates.data ?? []).map((day) => [day.date, day]));
  const max = Math.max(1, ...days.map((day) => day.chats));
  const listed = days.reduce((sum, day) => sum + day.chats, 0);
  const expected = numericValue(row.chats);
  return (
    <>
      <Section title={t("daily")} meta={t("lastMessageDay", { period: periodLabel(data.frame.current, language) })}>
        {truncated && <p className="text-xs text-[var(--app-text-secondary)]">{t("latestChatsTruncated", { shown: items.length.toLocaleString(languageLocale(language)), total: storeMonth.data.total.toLocaleString(languageLocale(language)) })}</p>}
        {!truncated && expected !== null && listed !== expected && <p className="text-xs text-[var(--app-text-secondary)]">{t("dailyCountMismatch", { listed: listed.toLocaleString(languageLocale(language)), expected: expected.toLocaleString(languageLocale(language)) })}</p>}
        <table data-v2-drawer-daily className="w-full text-left">
          <thead className="text-[11px] text-[var(--app-text-secondary)]">
            <tr className="border-b border-[var(--app-border)]">
              <th scope="col" className={`${cell} font-medium`}>{t("date")}</th>
              <th scope="col" className={`${cell} font-medium`}><span className="sr-only">{t("chartDescription")}</span></th>
              <th scope="col" className={`${cell} text-right font-medium`}>{t("chats")}</th>
              <th scope="col" className={`${cell} text-right font-medium`}>{t("unanswered")}</th>
              <th scope="col" className={`${cell} text-right font-medium`} title={t("rate24PerFirstChat")}>{t("rate24Label")}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.day}>
                <th scope="row" className="px-3 py-1 text-xs font-normal tabular-nums text-[var(--app-text-secondary)]">{Number(day.day.slice(8))}</th>
                <td className="w-full px-3 py-1" aria-hidden="true">
                  <span className="flex h-2.5 overflow-hidden rounded-sm bg-[var(--app-surface-subtle)]">
                    <span className="bg-[var(--app-accent)]" style={{ width: `${((day.chats - day.unreplied) / max) * 100}%` }} />
                    <span className="bg-[var(--app-danger)]" style={{ width: `${(day.unreplied / max) * 100}%` }} />
                  </span>
                </td>
                <td className="px-3 py-1 text-right text-xs tabular-nums">{day.chats}</td>
                <td className={`px-3 py-1 text-right text-xs tabular-nums ${day.unreplied > 0 ? "font-semibold text-[var(--app-danger)]" : "text-[var(--app-text-secondary)]"}`}>{day.unreplied}</td>
                <td className="px-3 py-1 text-right text-xs tabular-nums text-[var(--app-text-secondary)]">{dailyRates.data ? (rateByDay.get(day.day) ? `${rateByDay.get(day.day)!.within24h}/${rateByDay.get(day.day)!.total}` : "—") : dailyRates.error ? "!" : "…"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-[var(--app-text-secondary)]">{t("dailyBarsExplanation", { error: dailyRates.error ? t("dailyRateLoadError", { error: dailyRates.error }) : "" })}</p>
      </Section>
      <Section title={t("tagCoverage")} meta={periodLabel(data.frame.current, language)}>
        <TagCoverageDetail counts={data.tagCoverageByStore.get(row.storeId)} />
      </Section>
      <ManagerLink href={storeMonth.data.managerUrl} />
    </>
  );
}

/** Store scorecard: the month's KPIs vs the comparison period and target, trend, daily, tags, links. */
export function StoreScorecardDrawer({ row, onClose }: { row: MonthStoreRow; onClose: () => void }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const data = useV2Month();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, row.storeId]);
  const location = thaiLocationLabel(row.region, row.province);
  const waiting = row.oldestWaitingMinutes ? formatWaitingDuration(row.oldestWaitingMinutes, language) : null;
  const titleId = `v2-drawer-${row.storeId}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} data-v2-scorecard-drawer={row.storeId} className="flex h-full w-full max-w-xl flex-col border-l border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-primary)] shadow-[var(--app-shadow-modal)]">
        <header className="flex items-start gap-3 border-b border-[var(--app-border-subtle)] p-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold">{row.storeName}</h2>
            <p className="text-xs text-[var(--app-text-secondary)]">{[t("partnerNamed", { partner: row.partner }), location].filter(Boolean).join(" · ")}</p>
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{data.periodText}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t("closeStoreDetails")} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-2.5 py-1 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40">{t("close")}</button>
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          <Section title={t("monthlyKpis")}>
            <KpiCompareTable totals={row} frame={data.frame} />
            <p className="text-xs text-[var(--app-text-secondary)]">{t("kpiDifference")}</p>
            <div className="grid grid-cols-2 gap-3"><HowCounted kpi="replied" /><HowCounted kpi="rate24" /></div>
            <p className="text-xs text-[var(--app-text-secondary)]">
              {waiting ? t("longestUnanswered", { duration: waiting }) : numericValue(row.unreplied) === 0 ? t("noUnansweredThisMonth") : null}
            </p>
          </Section>
          <Section title={t("monthlyTrend")} meta={t("upToMonths", { count: 6 })}>
            <Trend storeId={row.storeId} />
          </Section>
          <DailyAndTags row={row} />
          <Section title={t("nextSteps")}>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link href={chatsHref({ storeId: row.storeId, month: data.month })} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1.5 font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]">{t("storeChatsThisMonth")}</Link>
              <Link href={chatsHref({ storeId: row.storeId, month: data.month, unrepliedOnly: true })} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1.5 font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]">{t("unansweredOnly")}</Link>
              <Link href={reportHref({ month: data.month, partner: null, store: row.storeId })} target="_blank" className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1.5 font-medium text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]">{t("storeReport")}</Link>
              <Link href={`/store-360?storeId=${encodeURIComponent(row.storeId)}`} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1.5 font-medium text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]">{t("store360")}</Link>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
