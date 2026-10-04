// Bangkok date ranges for the 24-hour reply-rate calls. Same windows as the existing
// 24H Response Rate page (rangeForPreset("7d"): the last 7 days including today).

export type DateRange = { dateFrom: string; dateTo: string };

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** YYYY-MM-DD in Asia/Bangkok (UTC+7, no DST). */
export function bangkokDateKey(at: Date | number = Date.now()): string {
  const ms = at instanceof Date ? at.getTime() : at;
  return new Date(ms + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function lastSevenDays(today: string): DateRange {
  return { dateFrom: shiftDateKey(today, -6), dateTo: today };
}

export function previousSevenDays(today: string): DateRange {
  return { dateFrom: shiftDateKey(today, -13), dateTo: shiftDateKey(today, -7) };
}

/** The seven single-day ranges of lastSevenDays, oldest first. */
export function sevenSingleDays(today: string): DateRange[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftDateKey(today, index - 6);
    return { dateFrom: day, dateTo: day };
  });
}

const THAI_WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/** Short Thai weekday for a YYYY-MM-DD key, e.g. "พฤ.". */
export function thaiWeekday(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return THAI_WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}
