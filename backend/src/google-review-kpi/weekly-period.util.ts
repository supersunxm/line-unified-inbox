/**
 * Google Review Weekly KPI - Period Generation & Timezone Utilities
 *
 * Rules:
 * - Timezone: Asia/Bangkok (UTC+7)
 * - Week 1: 2026-08-26T00:00:00+07:00 to 2026-09-02T00:00:00+07:00 exclusive
 *   Display: 第一周 สัปดาห์ที่ 1 (26.08-02.09.2026)
 * - Week 2: 2026-09-02T00:00:00+07:00 to 2026-09-09T00:00:00+07:00 exclusive
 *   Display: 第二周 สัปดาห์ที่ 2 (02-09.09.2026)
 * - 7-day intervals continue deterministically.
 */

export const BANGKOK_TZ = "Asia/Bangkok";
export const WEEK_1_START_ISO = "2026-08-26T00:00:00+07:00";
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const CHINESE_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

export function toChineseNumeral(num: number): string {
  if (num <= 10) return CHINESE_DIGITS[num] ?? String(num);
  if (num < 20) return `十${CHINESE_DIGITS[num % 10]}`;
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return `${CHINESE_DIGITS[tens]}十${ones === 0 ? "" : CHINESE_DIGITS[ones]}`;
  }
  return String(num);
}

export interface WeeklyPeriodDefinition {
  weekNumber: number;
  labelZh: string;
  labelTh: string;
  label: string;
  startDate: Date;
  endDate: Date;
  status: "OPEN" | "CLOSED";
  freezeDeadline: Date;
}

/**
 * Formats date components in Asia/Bangkok
 */
export function getBangkokDateParts(date: Date): { year: number; month: number; day: number; dateStr: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.format(date).split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return {
    year,
    month,
    day,
    dateStr: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/**
 * Formats week range label e.g. "26.08-02.09.2026" or "02-09.09.2026"
 */
export function formatWeekDateRangeLabel(start: Date, end: Date): string {
  const startParts = getBangkokDateParts(start);
  const endParts = getBangkokDateParts(end);

  const startDay = String(startParts.day).padStart(2, "0");
  const startMonth = String(startParts.month).padStart(2, "0");
  const endDay = String(endParts.day).padStart(2, "0");
  const endMonth = String(endParts.month).padStart(2, "0");
  const endYear = String(endParts.year);

  if (startParts.year !== endParts.year) {
    return `${startDay}.${startMonth}.${startParts.year}-${endDay}.${endMonth}.${endYear}`;
  }
  if (startParts.month !== endParts.month) {
    return `${startDay}.${startMonth}-${endDay}.${endMonth}.${endYear}`;
  }
  return `${startDay}-${endDay}.${endMonth}.${endYear}`;
}

/**
 * Builds weekly period definition for a 1-indexed weekNumber.
 */
export function getWeeklyPeriod(weekNumber: number, referenceDate: Date = new Date()): WeeklyPeriodDefinition {
  if (weekNumber < 1) {
    throw new Error(`Invalid weekNumber ${weekNumber}. Week number must be >= 1.`);
  }

  const week1StartUtc = new Date(WEEK_1_START_ISO).getTime();
  const startUtc = week1StartUtc + (weekNumber - 1) * WEEK_MS;
  const endUtc = startUtc + WEEK_MS;

  const startDate = new Date(startUtc);
  const endDate = new Date(endUtc);

  // Freeze deadline is 23:59:59.999 Bangkok time of the final day (endUtc - 1ms)
  const freezeDeadline = new Date(endUtc);

  const labelZh = `第${toChineseNumeral(weekNumber)}周`;
  const labelTh = `สัปดาห์ที่ ${weekNumber}`;
  const rangeStr = formatWeekDateRangeLabel(startDate, endDate);
  const label = `${labelZh} ${labelTh} (${rangeStr})`;

  const status = referenceDate >= freezeDeadline ? "CLOSED" : "OPEN";

  return {
    weekNumber,
    labelZh,
    labelTh,
    label,
    startDate,
    endDate,
    status,
    freezeDeadline,
  };
}

/**
 * Generates an array of weekly periods from Week 1 up to count (default 10 or current week).
 */
export function generateWeeklyPeriods(count = 10, referenceDate: Date = new Date()): WeeklyPeriodDefinition[] {
  const periods: WeeklyPeriodDefinition[] = [];
  for (let i = 1; i <= count; i++) {
    periods.push(getWeeklyPeriod(i, referenceDate));
  }
  return periods;
}

/**
 * Resolves the active week number for a given timestamp.
 */
export function resolveWeekNumber(date: Date = new Date()): number {
  const week1StartUtc = new Date(WEEK_1_START_ISO).getTime();
  const diff = date.getTime() - week1StartUtc;
  if (diff < 0) return 1;
  return Math.floor(diff / WEEK_MS) + 1;
}
