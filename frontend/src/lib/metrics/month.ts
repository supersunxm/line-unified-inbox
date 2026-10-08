import { languageLocale, type AppLanguage } from "../../app/language-utils.ts";
import { v2Text } from "./translations.ts";

// Month windows for v2's monthly views. Pure: node --test imports it directly.
//
// A month is a Bangkok calendar month (UTC+7, no DST), the same window /chats and the
// backend's resolveChatMonthRange use. The selectable months are /chats's own
// (chat-period.ts): from the reply-status coverage month to the current Bangkok month.
//
// Comparison rule:
// - a closed month is compared with the whole previous month;
// - the current month is month-to-date (day 1 → now) and is compared with the previous
//   month over the same number of days (1–7 Oct vs 1–7 Sep), never with a whole month.
//   Chat counts cut the previous month at the same elapsed time (day 7 14:30 → 7 Sep
//   14:30); the 24-hour rate endpoint takes whole Bangkok days, so it uses days 1–D.

import { CHAT_REPLY_STATUS_COVERAGE_MONTH, getCurrentBangkokMonth, isSelectableChatPeriod } from "../../app/chat-period.ts";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const THAI_MONTHS_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** The first month whose chats carry a reply status (/chats's coverage month). */
export const FIRST_V2_MONTH = CHAT_REPLY_STATUS_COVERAGE_MONTH;

function parts(month: string): { year: number; monthIndex: number } {
  const [year, monthNumber] = month.split("-").map(Number);
  return { year, monthIndex: monthNumber - 1 };
}

/** Bangkok midnight of the 1st of the month, as epoch ms. */
export function monthStartMs(month: string): number {
  const { year, monthIndex } = parts(month);
  return Date.UTC(year, monthIndex, 1) - BANGKOK_OFFSET_MS;
}

export function shiftMonth(month: string, delta: number): string {
  const { year, monthIndex } = parts(month);
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const { year, monthIndex } = parts(month);
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function dateKey(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** The current Bangkok month (YYYY-MM). */
export function currentMonth(now: number = Date.now()): string {
  return getCurrentBangkokMonth(new Date(now));
}

/**
 * ?month=YYYY-MM → a month v2 can show: one /chats can select (coverage month to the
 * current month). Anything else (missing, "all", malformed, future) → the current month.
 */
export function parseV2Month(value: string | null | undefined, now: number = Date.now()): string {
  if (value && value !== "all" && isSelectableChatPeriod(value, new Date(now))) return value;
  return currentMonth(now);
}

/** Months a v2 selector offers, newest first (the /chats list without "ทั้งหมด"). */
export function selectableMonths(now: number = Date.now()): string[] {
  const months: string[] = [];
  for (let month = currentMonth(now); month >= FIRST_V2_MONTH; month = shiftMonth(month, -1)) months.push(month);
  return months;
}

export type MonthPeriod = {
  month: string;
  /** Inclusive start, epoch ms (Bangkok midnight of day 1). */
  startMs: number;
  /** Exclusive end for chat counts: month end for a whole month, a time cut for month-to-date. */
  endMs: number;
  /** Bangkok dates for the 24-hour rate endpoint (inclusive). */
  dateFrom: string;
  dateTo: string;
  /** Days 1..lastDay are covered. */
  lastDay: number;
  /** True when the period is the whole calendar month. */
  wholeMonth: boolean;
};

export type MonthWindow = {
  current: MonthPeriod;
  previous: MonthPeriod;
  /** The selected month is still running (month-to-date). */
  inProgress: boolean;
  /** The previous month is before /chats's reply-status coverage: its numbers are not collected. */
  previousCollected: boolean;
};

function wholeMonth(month: string): MonthPeriod {
  const lastDay = daysInMonth(month);
  return {
    month,
    startMs: monthStartMs(month),
    endMs: monthStartMs(shiftMonth(month, 1)),
    dateFrom: dateKey(month, 1),
    dateTo: dateKey(month, lastDay),
    lastDay,
    wholeMonth: true,
  };
}

/**
 * The selected period and the one it is compared with.
 * Closed month: whole month vs whole previous month.
 * Current month: day 1 → now vs the previous month's day 1 → the same elapsed time
 * (capped at that month's end when it is shorter).
 */
export function monthWindow(month: string, now: number = Date.now()): MonthWindow {
  const previousMonth = shiftMonth(month, -1);
  const previousCollected = previousMonth >= FIRST_V2_MONTH;
  if (month !== currentMonth(now)) {
    return { current: wholeMonth(month), previous: wholeMonth(previousMonth), inProgress: false, previousCollected };
  }
  const startMs = monthStartMs(month);
  const elapsedMs = Math.max(0, now - startMs);
  const today = Math.min(daysInMonth(month), Math.floor(elapsedMs / DAY_MS) + 1);
  const previousStart = monthStartMs(previousMonth);
  const previousEnd = monthStartMs(month);
  const previousDays = daysInMonth(previousMonth);
  const previousLastDay = Math.min(today, previousDays);
  return {
    current: {
      month,
      startMs,
      endMs: now,
      dateFrom: dateKey(month, 1),
      dateTo: dateKey(month, today),
      lastDay: today,
      wholeMonth: false,
    },
    previous: {
      month: previousMonth,
      startMs: previousStart,
      endMs: Math.min(previousEnd, previousStart + elapsedMs),
      dateFrom: dateKey(previousMonth, 1),
      dateTo: dateKey(previousMonth, previousLastDay),
      lastDay: previousLastDay,
      wholeMonth: previousLastDay === previousDays && previousStart + elapsedMs >= previousEnd,
    },
    inProgress: true,
    previousCollected,
  };
}

/** "ต.ค. 2026" (Gregorian year, as /chats's month selector shows it). */
export function monthShortLabel(month: string, language: AppLanguage = "th"): string {
  const { year, monthIndex } = parts(month);
  if (language === "th") return `${THAI_MONTHS_SHORT[monthIndex]} ${year}`;
  return new Intl.DateTimeFormat(languageLocale(language), { month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(monthStartMs(month)));
}

/** "ตุลาคม 2026". */
export function monthLongLabel(month: string, language: AppLanguage = "th"): string {
  const { year, monthIndex } = parts(month);
  if (language === "th") return `${THAI_MONTHS_LONG[monthIndex]} ${year}`;
  return new Intl.DateTimeFormat(languageLocale(language), { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(monthStartMs(month)));
}

/** "1–7 ต.ค. 2026", or "ทั้งเดือน ก.ย. 2026" for a whole month. */
export function periodLabel(period: MonthPeriod, language: AppLanguage = "th"): string {
  const t = v2Text(language);
  const month = monthShortLabel(period.month, language);
  if (period.wholeMonth) return t("wholeMonth", { month });
  return t("period", { days: period.lastDay === 1 ? "1" : `1–${period.lastDay}`, month });
}

/** "1–8 ต.ค." / "Oct 1–8" / "10月1–8日": the days of a period without the year (Home's header). */
export function periodDaysLabel(period: MonthPeriod, language: AppLanguage = "th"): string {
  const { monthIndex } = parts(period.month);
  const days = period.lastDay === 1 ? "1" : `1–${period.lastDay}`;
  if (language === "th") return `${days} ${THAI_MONTHS_SHORT[monthIndex]}`;
  if (language === "zh") return `${monthIndex + 1}月${days}日`;
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, monthIndex, 15)));
  return `${month} ${days}`;
}

/** "1–7 ต.ค. 2026 เทียบ 1–7 ก.ย. 2026" — every number states its period with this. */
export function comparisonLabel(window: MonthWindow, language: AppLanguage = "th"): string {
  return v2Text(language)("comparison", { current: periodLabel(window.current, language), previous: periodLabel(window.previous, language) });
}

/** "เดือนนี้ยังไม่ปิด (ถึงวันที่ 7)" / "ปิดเดือนแล้ว". */
export function monthStatusLabel(window: MonthWindow, language: AppLanguage = "th"): string {
  return window.inProgress ? v2Text(language)("openMonth", { day: window.current.lastDay }) : v2Text(language)("closedMonth");
}

/**
 * The months of a trend ending at `month`: up to `count`, never before the first v2 month.
 * Oldest first.
 */
export function trendMonths(month: string, count = 6): string[] {
  const months: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const candidate = shiftMonth(month, -index);
    if (candidate >= FIRST_V2_MONTH) months.push(candidate);
  }
  return months;
}

/** Bangkok YYYY-MM-DD of an instant. */
export function bangkokDay(at: number | string): string {
  const ms = typeof at === "number" ? at : Date.parse(at);
  return new Date(ms + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Every Bangkok date key of a period, day 1 first. */
export function periodDays(period: MonthPeriod): string[] {
  return Array.from({ length: period.lastDay }, (_, index) => dateKey(period.month, index + 1));
}
