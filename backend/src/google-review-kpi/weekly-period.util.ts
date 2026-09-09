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
export const WEEK_2_START_ISO = "2026-09-03T00:00:00+07:00";
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
 * Formats week range label e.g. "26.08-02.09.2026" or "03-09.09.2026"
 * Note: endExclusive is the exclusive upper boundary. The displayed end date is endExclusive - 1 calendar day.
 */
export function formatWeekDateRangeLabel(start: Date, endExclusive: Date): string {
  const startParts = getBangkokDateParts(start);
  // Displayed end date must be endExclusive - 1 calendar day (subtract 1000ms from midnight boundary)
  const endInclusiveDate = new Date(endExclusive.getTime() - 1000);
  const endParts = getBangkokDateParts(endInclusiveDate);

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
 * Calendar:
 * - Week 1: 2026-08-26T00:00:00+07:00 to 2026-09-03T00:00:00+07:00 exclusive (display: 26.08-02.09.2026)
 * - Week 2: 2026-09-03T00:00:00+07:00 to 2026-09-10T00:00:00+07:00 exclusive (display: 03-09.09.2026)
 * - Week 3+: Exactly 7 calendar days cadence from Week 2 start.
 */
export function getWeeklyPeriod(weekNumber: number, referenceDate: Date = new Date()): WeeklyPeriodDefinition {
  if (weekNumber < 1) {
    throw new Error(`Invalid weekNumber ${weekNumber}. Week number must be >= 1.`);
  }

  let startDate: Date;
  let endDate: Date;

  if (weekNumber === 1) {
    startDate = new Date(WEEK_1_START_ISO);
    endDate = new Date(WEEK_2_START_ISO);
  } else {
    const week2StartUtc = new Date(WEEK_2_START_ISO).getTime();
    const startUtc = week2StartUtc + (weekNumber - 2) * WEEK_MS;
    const endUtc = startUtc + WEEK_MS;
    startDate = new Date(startUtc);
    endDate = new Date(endUtc);
  }

  // Freeze deadline is 23:59:59.999 Bangkok time of the final day (endUtc - 1ms)
  const freezeDeadline = new Date(endDate.getTime());

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
 * - date < 2026-09-03T00:00:00+07:00 => Week 1
 * - from Sep 3 onward: floor((date - Sep3 start) / 7 days) + 2
 */
export function resolveWeekNumber(date: Date = new Date()): number {
  const week2StartUtc = new Date(WEEK_2_START_ISO).getTime();
  const time = date.getTime();
  if (time < week2StartUtc) {
    return 1;
  }
  return Math.floor((time - week2StartUtc) / WEEK_MS) + 2;
}
