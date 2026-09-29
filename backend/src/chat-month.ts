import { BadRequestException } from "@nestjs/common";

export const CHAT_MONTH_TIMEZONE = "Asia/Bangkok";
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const CHAT_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/u;

export type ChatMonthRange = {
  month: string;
  start: Date;
  end: Date;
};

export function parseChatMonth(month: string | null | undefined): ChatMonthRange | null {
  const value = month?.trim();
  if (!value) return null;
  const match = CHAT_MONTH_PATTERN.exec(value);
  if (!match) throw new BadRequestException("month must use YYYY-MM");

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const startUtc = Date.UTC(year, monthNumber - 1, 1) - BANGKOK_OFFSET_MS;
  const endUtc = Date.UTC(year, monthNumber, 1) - BANGKOK_OFFSET_MS;

  return {
    month: value,
    start: new Date(startUtc),
    end: new Date(endUtc),
  };
}

export function chatMonthFromDate(value: Date): string {
  const bangkok = new Date(value.getTime() + BANGKOK_OFFSET_MS);
  return [
    bangkok.getUTCFullYear(),
    String(bangkok.getUTCMonth() + 1).padStart(2, "0"),
  ].join("-");
}
