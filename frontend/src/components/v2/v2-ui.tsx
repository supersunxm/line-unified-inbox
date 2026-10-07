"use client";

import { useAppLanguage } from "@/app/language";
import { languageLocale, type AppLanguage } from "@/app/language-utils";
import { v2Text } from "@/lib/v2/v2-translations";

import React from "react";
import { FOLLOW_UP_THRESHOLD_MINUTES, formatSentAt, formatWaitMinutes, waitSpansClosedHours } from "@/lib/v2/business-hours";
import { thaiWeekday } from "@/lib/v2/date-ranges";
import { formatValue, numericValue, valueReason, type ValueState } from "@/lib/v2/value-state";

export const NO_DATA_TEXT = "ยังไม่มีข้อมูลนี้";

/** "ส่งเมื่อ เมื่อวาน 20:30 · นับเฉพาะเวลาเปิดร้าน" when business time differs from real time, else "ส่งเมื่อ …". */
export function waitNote(waitingSince: string, now: number, language: AppLanguage = "th"): string {
  return v2Text(language)(waitSpansClosedHours(waitingSince, now) ? "sentBusiness" : "sentAt", { date: formatSentAt(waitingSince, now, language) });
}

/**
 * Business-hours wait. Full: the real send time on a second line when it differs.
 * Compact (tables): the duration only, with the send time and the note in a tooltip.
 */
export function WaitLabel({ businessMinutes, waitingSince, now, compact = false }: { businessMinutes: number | null; waitingSince: string | null; now: number; compact?: boolean }) {
  const { language } = useAppLanguage();
  if (businessMinutes === null || !waitingSince) return <span className="text-[var(--app-text-tertiary)]">—</span>;
  const urgent = businessMinutes >= FOLLOW_UP_THRESHOLD_MINUTES;
  const differs = waitSpansClosedHours(waitingSince, now);
  const duration = <span className={`whitespace-nowrap font-semibold tabular-nums ${urgent ? "text-[var(--app-danger)]" : "text-[var(--app-text-primary)]"}`}>{formatWaitMinutes(businessMinutes, language)}</span>;
  if (compact) return <span title={waitNote(waitingSince, now, language)} data-v2-wait-note={waitNote(waitingSince, now, language)}>{duration}</span>;
  return (
    <span className="inline-flex flex-col">
      {duration}
      {differs && <span className="text-xs text-[var(--app-text-secondary)]">{waitNote(waitingSince, now, language)}</span>}
    </span>
  );
}

export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${rate.toFixed(1)}%`;
}

/** "+1.2" / "−3.4" percentage points vs the previous week. */
export function RateDelta({ delta }: { delta: number | null }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  if (delta === null) return <span className="text-xs text-[var(--app-text-tertiary)]">{t("noPreviousWeek")}</span>;
  if (delta === 0) return <span className="text-xs text-[var(--app-text-secondary)]">{t("unchanged")}</span>;
  const down = delta < 0;
  return (
    <span className={`text-xs font-medium tabular-nums ${down ? "text-[var(--app-danger)]" : "text-[var(--app-success)]"}`}>
      {t("points", { value: `${down ? "−" : "+"}${Math.abs(delta).toFixed(1)}` })}
    </span>
  );
}

/** Seven tiny bars of the daily 24-hour rate; a dash where a day had no chats. */
export function MiniTrend({ values, loading }: { values: Array<number | null>; loading?: boolean }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  if (loading && values.length === 0) return <span className="inline-block h-5 w-[70px] rounded bg-[var(--app-surface-subtle)]" aria-hidden="true" />;
  if (values.length === 0) return <span className="text-xs text-[var(--app-text-tertiary)]">—</span>;
  const label = values.map((value) => (value === null ? t("noChats") : `${value.toFixed(0)}%`)).join(", ");
  return (
    <span className="inline-flex h-6 items-end gap-[3px]" role="img" aria-label={t("dailyRate", { values: label })}>
      {values.map((value, index) => (
        <span
          key={index}
          className={`w-[7px] rounded-sm ${value === null ? "bg-[var(--app-border)]" : "bg-[var(--app-accent)]"}`}
          style={{ height: value === null ? 2 : `${Math.max(8, value)}%` }}
        />
      ))}
    </span>
  );
}

/** 7-day bar chart of the daily 24-hour rate with the target line. */
export function DailyRateBars({ days, values, target, loading }: { days: string[]; values: Array<number | null>; target: number; loading: boolean }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  if (loading && values.length === 0) return <div className="h-36 rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)]" aria-hidden="true" />;
  if (values.length === 0) return <p className="text-sm text-[var(--app-text-secondary)]">{t("noDataYet")}</p>;
  return (
    <div>
      <div className="relative flex h-32 items-end gap-2 border-b border-[var(--app-border)]">
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--app-text-tertiary)]" style={{ bottom: `${target}%` }} aria-hidden="true" />
        {values.map((value, index) => (
          <div key={days[index]} className="flex h-full flex-1 flex-col items-center justify-end" title={`${days[index]}: ${formatRate(value)}`}>
            <span className="mb-1 text-[11px] tabular-nums text-[var(--app-text-secondary)]">{value === null ? "—" : value.toFixed(0)}</span>
            <div className={`w-full max-w-7 rounded-t ${value === null ? "bg-[var(--app-border)]" : value < target ? "bg-[var(--app-warning)]" : "bg-[var(--app-accent)]"}`} style={{ height: value === null ? 2 : `${Math.max(2, value)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {days.map((day) => <div key={day} className="flex-1 text-center text-[11px] text-[var(--app-text-tertiary)]">{thaiWeekday(day, language)}</div>)}
      </div>
      <p className="mt-2 text-xs text-[var(--app-text-secondary)]">{t("chartTarget", { target })}</p>
    </div>
  );
}

/** One-line notice for a source that failed or was cut short. */
export function SourceNotice({ children }: { children: React.ReactNode }) {
  return <div role="status" className="rounded-[var(--app-radius-md)] border border-[var(--app-warning)]/30 bg-[var(--app-warning-soft)] px-3 py-2 text-xs text-[var(--app-text-primary)]">{children}</div>;
}

export function ManagerLink({ href, size = "md" }: { href: string | null; size?: "sm" | "md" }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex shrink-0 items-center gap-1 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}
    >
      {t("managerLink")}
    </a>
  );
}

/**
 * A monthly number from its value state. "—" and muted values always carry their reason:
 * as a tooltip and as screen-reader text. `showN` adds "(n=…)" for rates.
 */
export function StateValue({ state, format = "count", target, showN = false, className = "" }: { state: ValueState; format?: "count" | "percent"; target?: number; showN?: boolean; className?: string }) {
  const { language } = useAppLanguage();
  const formatted = formatValue(state, format, language);
  const value = numericValue(state);
  const belowTarget = target !== undefined && !formatted.muted && value !== null && value < target;
  const n = "n" in state && typeof state.n === "number" ? state.n : null;
  return (
    <span data-v2-value-state={state.kind} title={formatted.reason ?? undefined} className={`whitespace-nowrap tabular-nums ${formatted.muted ? "text-[var(--app-text-secondary)]" : belowTarget ? "text-[var(--app-danger)]" : ""} ${className}`}>
      {formatted.text}
      {showN && n !== null && <span className="ml-1 text-xs font-normal text-[var(--app-text-secondary)]">(n={n.toLocaleString(languageLocale(language))})</span>}
      {formatted.reason && <span className="sr-only"> ({formatted.reason})</span>}
    </span>
  );
}

/**
 * Change vs the comparison period. kind "count": "+3" / "−2", always neutral (counts follow
 * chat volume). kind "points": "+1.2 จุด" / "−3.4 จุด", coloured (a rate: down is worse).
 */
export function DeltaValue({ state, kind, worseWhen }: { state: ValueState; kind: "count" | "points"; worseWhen: "up" | "down" }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const reason = valueReason(state, language);
  const value = numericValue(state);
  if (value === null || state.kind === "loading") {
    return <span data-v2-value-state={state.kind} title={reason ?? undefined} className="whitespace-nowrap text-xs text-[var(--app-text-secondary)]">—{reason && <span className="sr-only"> ({reason})</span>}</span>;
  }
  // Only rate changes (points) carry meaning: a count moves with chat volume, so it stays neutral.
  const muted = kind === "count" || state.kind === "low-sample" || state.kind === "stale";
  const worse = !muted && value !== 0 && (worseWhen === "up" ? value > 0 : value < 0);
  const better = !muted && value !== 0 && !worse;
  const number = `${value > 0 ? "+" : "−"}${kind === "points" ? Math.abs(value).toFixed(1) : Math.abs(value).toLocaleString(languageLocale(language))}`;
  const text = value === 0 ? t("unchanged") : kind === "points" ? t("points", { value: number }) : number;
  return (
    <span data-v2-value-state={state.kind} title={reason ?? undefined} className={`whitespace-nowrap text-xs font-medium tabular-nums ${worse ? "text-[var(--app-danger)]" : better ? "text-[var(--app-accent)] dark:text-[var(--app-success)]" : "text-[var(--app-text-secondary)]"}`}>
      {text}
      {reason && <span className="sr-only"> ({reason})</span>}
    </span>
  );
}

/** A KPI rate in a table: the value (target colour only when a target is set) and its change in points. */
export function RateCell({ value, delta, target, showN = false }: { value: ValueState; delta: ValueState; target: number | null; showN?: boolean }) {
  return (
    <span className="inline-flex flex-col items-end">
      <StateValue state={value} format="percent" target={target ?? undefined} showN={showN} />
      {numericValue(delta) !== null && <DeltaValue state={delta} kind="points" worseWhen="down" />}
    </span>
  );
}

/** A count in a table with its change, both neutral: counts follow chat volume. */
export function CountCell({ value, delta, strong = false }: { value: ValueState; delta?: ValueState; strong?: boolean }) {
  return (
    <span className="inline-flex flex-col items-end">
      <StateValue state={value} className={strong ? "font-semibold" : ""} />
      {delta && numericValue(delta) !== null && <DeltaValue state={delta} kind="count" worseWhen="up" />}
    </span>
  );
}
