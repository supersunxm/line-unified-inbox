export type RelativeTimeLanguage = "th" | "en" | "zh";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatRelativeTime(
  timestamp: string | Date | null | undefined,
  language: RelativeTimeLanguage = "th",
  now: Date | number = Date.now(),
): string {
  if (!timestamp) return "-";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const nowTime = now instanceof Date ? now.getTime() : now;
  const timestampTime = date.getTime();
  if (!Number.isFinite(timestampTime) || !Number.isFinite(nowTime)) return "-";

  const elapsed = Math.max(0, nowTime - timestampTime);
  if (elapsed < MINUTE) return language === "th" ? "เมื่อสักครู่" : language === "zh" ? "刚刚" : "Just now";

  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return language === "th" ? `${minutes} นาทีที่แล้ว` : language === "zh" ? `${minutes} 分钟前` : `${minutes} min ago`;
  }

  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    const minutes = Math.floor((elapsed % HOUR) / MINUTE);
    if (language === "th") return `${hours} ชั่วโมง${minutes ? ` ${minutes} นาที` : ""}ที่แล้ว`;
    if (language === "zh") return `${hours} 小时${minutes ? ` ${minutes} 分钟` : ""}前`;
    return `${hours} hr${hours === 1 ? "" : "s"}${minutes ? ` ${minutes} min` : ""} ago`;
  }

  if (elapsed < MONTH) {
    const days = Math.floor(elapsed / DAY);
    return language === "th" ? `${days} วันที่แล้ว` : language === "zh" ? `${days} 天前` : `${days} day${days === 1 ? "" : "s"} ago`;
  }

  if (elapsed < YEAR) {
    const months = Math.floor(elapsed / MONTH);
    return language === "th" ? `${months} เดือนที่แล้ว` : language === "zh" ? `${months} 个月前` : `${months} month${months === 1 ? "" : "s"} ago`;
  }

  const years = Math.floor(elapsed / YEAR);
  return language === "th" ? `${years} ปีที่แล้ว` : language === "zh" ? `${years} 年前` : `${years} year${years === 1 ? "" : "s"} ago`;
}
