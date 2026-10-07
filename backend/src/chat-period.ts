export const CHAT_REPLY_STATUS_COVERAGE_START = new Date("2026-08-31T17:00:00.000Z");
export const CHAT_REPLY_STATUS_COVERAGE_MONTH = "2026-09";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export type ChatMonthRange = {
  gte: Date;
  lt: Date;
};

export function resolveChatMonthRange(month?: string | null): ChatMonthRange | null {
  if (!month || month === "all") return null;
  const match = MONTH_PATTERN.exec(month);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const nextYear = monthIndex === 11 ? year + 1 : year;
  const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;

  return {
    gte: new Date(Date.UTC(year, monthIndex, 1) - BANGKOK_OFFSET_MS),
    lt: new Date(Date.UTC(nextYear, nextMonthIndex, 1) - BANGKOK_OFFSET_MS),
  };
}

export function isChatReplyStatusCovered(value: Date | null | undefined): boolean {
  return Boolean(value && value.getTime() >= CHAT_REPLY_STATUS_COVERAGE_START.getTime());
}

const DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** The longest from/to range the summary accepts (inclusive days). */
export const CHAT_DATE_RANGE_MAX_DAYS = 92;

/**
 * from/to (YYYY-MM-DD, Asia/Bangkok, both inclusive) → the same latestMessageAt window shape as
 * resolveChatMonthRange: from 00:00 Bangkok to the day after `to` 00:00 Bangkok, exclusive.
 * A from/to covering a whole month equals that month's range. Returns null for invalid input.
 */
export function resolveChatDateRange(from?: string | null, to?: string | null): ChatMonthRange | null {
  if (!from || !to) return null;
  const start = DATE_PATTERN.exec(from);
  const end = DATE_PATTERN.exec(to);
  if (!start || !end) return null;
  const startUtc = Date.UTC(Number(start[1]), Number(start[2]) - 1, Number(start[3]));
  const endUtc = Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]));
  // Reject impossible dates such as 2026-02-31 (Date.UTC would roll them over).
  if (new Date(startUtc).toISOString().slice(0, 10) !== from || new Date(endUtc).toISOString().slice(0, 10) !== to) return null;
  const days = (endUtc - startUtc) / 86_400_000 + 1;
  if (days < 1 || days > CHAT_DATE_RANGE_MAX_DAYS) return null;
  return { gte: new Date(startUtc - BANGKOK_OFFSET_MS), lt: new Date(endUtc + 86_400_000 - BANGKOK_OFFSET_MS) };
}
