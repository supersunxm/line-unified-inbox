/**
 * Period rules for message search. Reuses the shared date-range utilities; adds only the
 * future-date rule. Asia/Bangkok calendar semantics throughout.
 */
import { matchesPreset, PERIOD_PRESETS, presetRange, type PeriodRange } from "../../date-range/period-range.ts";
import {
  formatDateDisplay,
  getBkkDateStr,
  getInclusiveCalendarDays,
  validateDateRange,
} from "../../../app/follower-insights/follower-insights-utils.ts";
import type { AppLanguage } from "../../../app/language-utils.ts";
import { messageSearchCopy } from "./message-search-copy.ts";
import { MESSAGE_SEARCH_DEFAULT_PRESET_DAYS, MESSAGE_SEARCH_MAX_DAYS } from "./message-search-config.ts";

export type MessageSearchPeriod = PeriodRange;

/** Bangkok calendar date (YYYY-MM-DD) for the instant `now`. */
export function bangkokTodayIso(now: Date = new Date()): string {
  return getBkkDateStr(now);
}

export function defaultMessageSearchPeriod(todayIso: string): MessageSearchPeriod {
  return presetRange(MESSAGE_SEARCH_DEFAULT_PRESET_DAYS, todayIso);
}

/** The preset (7, 14, or 30 days) that exactly matches the period, or null for a custom period. */
export function activeMessageSearchPreset(period: MessageSearchPeriod, todayIso: string): number | null {
  for (const days of PERIOD_PRESETS) {
    if (matchesPreset(period, days, todayIso)) return days;
  }
  return null;
}

export function messageSearchPeriodDays(period: MessageSearchPeriod): number {
  return getInclusiveCalendarDays(period.dateFrom, period.dateTo);
}

export function isSameMessageSearchPeriod(a: MessageSearchPeriod, b: MessageSearchPeriod): boolean {
  return a.dateFrom === b.dateFrom && a.dateTo === b.dateTo;
}

/** True only for real calendar dates in YYYY-MM-DD form (rejects 2026-02-31, which would otherwise roll over). */
export function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return utc.toISOString().slice(0, 10) === value;
}

/**
 * Validates an inclusive Bangkok period. Returns the localized error, or null when valid.
 * Enforces: real calendar dates, end not before start, at most 90 calendar days, no future dates.
 */
export function validateMessageSearchPeriod(
  period: MessageSearchPeriod,
  todayIso: string,
  language: AppLanguage = "th",
): string | null {
  const copy = messageSearchCopy(language);
  if (!isRealCalendarDate(period.dateFrom) || !isRealCalendarDate(period.dateTo)) return copy.invalidDate;
  if (period.dateTo > todayIso) return copy.futureDate;
  const shared = validateDateRange(period.dateFrom, period.dateTo, language);
  if (!shared.valid) {
    const days = messageSearchPeriodDays(period);
    return days > MESSAGE_SEARCH_MAX_DAYS ? copy.periodTooLong : copy.periodReversed;
  }
  return null;
}

export function formatMessageSearchPeriod(period: MessageSearchPeriod, language: AppLanguage = "th"): string {
  return `${formatDateDisplay(period.dateFrom, language)} – ${formatDateDisplay(period.dateTo, language)}`;
}
