// Month-close rules. Pure: node --test imports them directly.

import { CHAT_REPLY_STATUS_COVERAGE_MONTH } from "../chat-period";

/** A month closes automatically at 00:00 Asia/Bangkok on day (1 + grace) of the next month. */
export const MONTH_CLOSE_GRACE_DAYS = 1;
/** A system close that runs more than this long after its due time is flagged as a backfill ("ปิดย้อนหลัง"). */
export const BACKFILL_AFTER_MS = 24 * 60 * 60 * 1000;
/** What the snapshot numbers mean; bump when a definition changes. */
export const MONTH_CLOSE_DEFINITION_VERSION = "v2-month-1: chats=bm-reply-status-summary(month)+effectiveSummaryCounts; rate24=replyAnalytics(CHAT_FIRST_REPLY) within24h/total";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonth(value: string): boolean {
  return MONTH.test(value);
}

export function nextMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function bangkokMonth(at: Date): string {
  return new Date(at.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 7);
}

/** When `month` is due to close: 00:00 Bangkok on day (1 + MONTH_CLOSE_GRACE_DAYS) of the next month. */
export function closeDueAt(month: string, graceDays = MONTH_CLOSE_GRACE_DAYS): Date {
  const [year, monthNumber] = nextMonth(month).split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1 + graceDays) - BANGKOK_OFFSET_MS);
}

/** First and last Bangkok day of a month (replyAnalytics dateFrom/dateTo). */
export function monthDays(month: string): { dateFrom: string; dateTo: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { dateFrom: `${month}-01`, dateTo: `${month}-${String(last).padStart(2, "0")}` };
}

/** Months due for an automatic first close at `now`: coverage month onward, due time passed. Oldest first. */
export function monthsDueForClose(now: Date, firstMonth = CHAT_REPLY_STATUS_COVERAGE_MONTH): string[] {
  const months: string[] = [];
  for (let month = firstMonth; closeDueAt(month).getTime() <= now.getTime(); month = nextMonth(month)) months.push(month);
  return months;
}

/** A month can be closed (by anyone) only once it has ended in Bangkok time. */
export function monthHasEnded(month: string, now: Date): boolean {
  return bangkokMonth(now) > month;
}

export function isBackfill(dueAt: Date, closedAt: Date): boolean {
  return closedAt.getTime() - dueAt.getTime() > BACKFILL_AFTER_MS;
}
