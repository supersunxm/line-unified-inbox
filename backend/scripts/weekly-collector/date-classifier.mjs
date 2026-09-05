import { isEditedReviewDateText } from "../../../tools/google-review-checker-extension/src/core/googleReviewDateParser.ts";

export const WEEK_2_START = "2026-09-02";
export const WEEK_2_END_EXCLUSIVE = "2026-09-09";

/**
 * Formats a Date or returns the date string directly in Asia/Bangkok YYYY-MM-DD.
 */
export function getBangkokDateString(date = new Date()) {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const targetDate = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(targetDate);
}

/**
 * Safely offsets a YYYY-MM-DD calendar date string by a number of days without timezone drift.
 */
export function offsetBangkokDate(baseDateStr, dayOffset) {
  const [year, month, day] = baseDateStr.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day + dayOffset, 12, 0, 0));
  return utcDate.toISOString().slice(0, 10);
}

/**
 * Classifies relative date text for Week 2 audit and continuous discovery.
 * Target Week: 2026-09-02 to 2026-09-09 exclusive.
 *
 * Dynamically resolves reference date:
 * - Production default: current Asia/Bangkok calendar date (new Date())
 * - Injected ref: supports Date object or YYYY-MM-DD string for deterministic testing
 *
 * Rules:
 * - today / hours ago / minutes ago / seconds ago -> reference Bangkok date
 * - yesterday / 1 day ago -> reference Bangkok date - 1 day
 * - N days ago -> reference Bangkok date - N days
 * - dates >= 2026-09-02 and < 2026-09-09 -> WEEK2_CANDIDATE
 * - dates < 2026-09-02 -> OLDER_THAN_WEEK2 (halts store scan)
 * - dates >= 2026-09-09 -> FUTURE_OR_NEWER (does not qualify for Week 2)
 * - weeks / months / years ago -> all >= 7 days ago -> definitively before Sep 2 -> OLDER_THAN_WEEK2
 */
export function classifyWeek2Date(rawDateText, ref = new Date()) {
  if (!rawDateText || typeof rawDateText !== "string") {
    return { type: "UNKNOWN" };
  }
  const text = rawDateText.trim().toLowerCase();

  // Check if edited
  if (isEditedReviewDateText(text)) {
    return { type: "EDITED" };
  }

  const currentBangkokDate = getBangkokDateString(ref);

  // 1. Hours / minutes / seconds / today -> current Bangkok date
  if (
    text.includes("hour") ||
    text.includes("minute") ||
    text.includes("second") ||
    text.includes("today") ||
    text.includes("ชั่วโมง") ||
    text.includes("นาที") ||
    text.includes("วินาที") ||
    text.includes("วันนี้")
  ) {
    const targetDate = currentBangkokDate;
    if (targetDate >= WEEK_2_START && targetDate < WEEK_2_END_EXCLUSIVE) {
      return { type: "WEEK2_CANDIDATE", exactDate: targetDate, days: 0 };
    }
    if (targetDate < WEEK_2_START) {
      return { type: "OLDER_THAN_WEEK2", exactDate: targetDate, days: 0 };
    }
    return { type: "FUTURE_OR_NEWER", exactDate: targetDate, days: 0 };
  }

  // 2. Yesterday -> current Bangkok date - 1 day
  if (text.includes("yesterday") || text.includes("เมื่อวาน")) {
    const targetDate = offsetBangkokDate(currentBangkokDate, -1);
    if (targetDate >= WEEK_2_START && targetDate < WEEK_2_END_EXCLUSIVE) {
      return { type: "WEEK2_CANDIDATE", exactDate: targetDate, days: 1 };
    }
    if (targetDate < WEEK_2_START) {
      return { type: "OLDER_THAN_WEEK2", exactDate: targetDate, days: 1 };
    }
    return { type: "FUTURE_OR_NEWER", exactDate: targetDate, days: 1 };
  }

  // 3. Days ago: "X days ago" / "X วันที่แล้ว"
  const daysMatch = text.match(/(\d+)\s*(day|days|วัน)/) || (text.includes("a day ago") ? [null, "1"] : null);
  if (daysMatch) {
    const days = parseInt(daysMatch[1] ?? "1", 10);
    const targetDate = offsetBangkokDate(currentBangkokDate, -days);

    if (targetDate >= WEEK_2_START && targetDate < WEEK_2_END_EXCLUSIVE) {
      return { type: "WEEK2_CANDIDATE", exactDate: targetDate, days };
    }
    if (targetDate < WEEK_2_START) {
      return { type: "OLDER_THAN_WEEK2", exactDate: targetDate, days };
    }
    return { type: "FUTURE_OR_NEWER", exactDate: targetDate, days };
  }

  // 4. Weeks ago, Months ago, Years ago -> all >= 7 days ago -> definitively before Sep 2 for Week 2
  if (
    text.includes("week") ||
    text.includes("สัปดาห์") ||
    text.includes("อาทิตย์") ||
    text.includes("month") ||
    text.includes("เดือน") ||
    text.includes("year") ||
    text.includes("ปี")
  ) {
    return { type: "OLDER_THAN_WEEK2" };
  }

  return { type: "UNKNOWN" };
}
