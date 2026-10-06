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
