export const CHAT_REPLY_STATUS_COVERAGE_START_ISO = "2026-09-01T00:00:00+07:00";
export const CHAT_REPLY_STATUS_COVERAGE_MONTH = "2026-09";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export type ChatPeriod = "all" | string;

export function getCurrentBangkokMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find(({ type }) => type === "year")?.value;
  const month = parts.find(({ type }) => type === "month")?.value;
  return year && month ? `${year}-${month}` : CHAT_REPLY_STATUS_COVERAGE_MONTH;
}

export function isSelectableChatPeriod(value: string | null | undefined, now = new Date()): value is ChatPeriod {
  if (value === "all") return true;
  if (!value || !MONTH_PATTERN.test(value)) return false;
  return value >= CHAT_REPLY_STATUS_COVERAGE_MONTH && value <= getCurrentBangkokMonth(now);
}

export function getChatPeriodOptions(
  language: "th" | "en" | "zh",
  now = new Date(),
): Array<{ value: ChatPeriod; label: string }> {
  const current = getCurrentBangkokMonth(now);
  const [startYear, startMonth] = CHAT_REPLY_STATUS_COVERAGE_MONTH.split("-").map(Number);
  const [currentYear, currentMonth] = current.split("-").map(Number);
  const locale =
    language === "th"
      ? "th-TH-u-ca-gregory"
      : language === "zh"
        ? "zh-CN-u-ca-gregory"
        : "en-US-u-ca-gregory";
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
  const options: Array<{ value: ChatPeriod; label: string }> = [];

  let year = currentYear;
  let month = currentMonth;
  while (year > startYear || (year === startYear && month >= startMonth)) {
    const value = `${year}-${String(month).padStart(2, "0")}`;
    options.push({
      value,
      label: formatter.format(new Date(Date.UTC(year, month - 1, 15, 12))),
    });
    month -= 1;
    if (month === 0) {
      year -= 1;
      month = 12;
    }
  }

  options.push({
    value: "all",
    label: language === "th" ? "ทั้งหมด" : language === "zh" ? "全部" : "All",
  });
  return options;
}

export function isReplyStatusCovered(timestamp: string | Date | null | undefined): boolean {
  if (!timestamp) return false;
  const time = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
  return Number.isFinite(time) && time >= new Date(CHAT_REPLY_STATUS_COVERAGE_START_ISO).getTime();
}
