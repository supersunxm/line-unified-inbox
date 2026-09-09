import { isEditedReviewDateText } from "../../../tools/google-review-checker-extension/src/core/googleReviewDateParser.ts";

export const WEEK_1_START = "2026-08-26";
export const WEEK_2_START = "2026-09-03";
export const WEEK_2_END_EXCLUSIVE = "2026-09-10";

export const WEEK_1_START_ISO = "2026-08-26T00:00:00+07:00";
export const WEEK_2_START_ISO = "2026-09-03T00:00:00+07:00";
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Resolves the week number for a given calendar date string YYYY-MM-DD or Date object.
 * Week 1: before 2026-09-03T00:00:00+07:00
 * Week 2: 2026-09-03 to 2026-09-10
 * Week N: 7 days cadence from Week 2
 */
export function resolveWeekNumberFromDate(dateOrStr) {
  let time;
  if (typeof dateOrStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateOrStr)) {
    time = new Date(`${dateOrStr}T12:00:00+07:00`).getTime();
  } else if (dateOrStr instanceof Date) {
    time = dateOrStr.getTime();
  } else {
    time = new Date(dateOrStr).getTime();
  }

  const week2StartUtc = new Date(WEEK_2_START_ISO).getTime();
  if (time < week2StartUtc) {
    return 1;
  }
  return Math.floor((time - week2StartUtc) / WEEK_MS) + 2;
}

/**
 * Returns the start and exclusive end dates for a given week number (YYYY-MM-DD in Bangkok).
 */
export function getWeekDateBoundaries(weekNumber) {
  if (weekNumber === 1) {
    return {
      startDate: WEEK_1_START,
      endDateExclusive: WEEK_2_START,
      startIso: WEEK_1_START_ISO,
      endIso: WEEK_2_START_ISO,
    };
  }
  const week2StartUtc = new Date(WEEK_2_START_ISO).getTime();
  const startUtc = week2StartUtc + (weekNumber - 2) * WEEK_MS;
  const endUtc = startUtc + WEEK_MS;
  return {
    startDate: getBangkokDateString(new Date(startUtc)),
    endDateExclusive: getBangkokDateString(new Date(endUtc)),
    startIso: new Date(startUtc).toISOString(),
    endIso: new Date(endUtc).toISOString(),
  };
}

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
 * Resolves the exact Bangkok date string (YYYY-MM-DD) from relative review text and reference.
 */
export function parseReviewDate(rawDateText, ref = new Date()) {
  if (!rawDateText || typeof rawDateText !== "string") {
    return { type: "UNKNOWN" };
  }
  const text = rawDateText.trim().toLowerCase();

  if (isEditedReviewDateText(text)) {
    return { type: "EDITED" };
  }

  const currentBangkokDate = getBangkokDateString(ref);

  // 1. Hours / minutes / seconds / today
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
    let targetDate = currentBangkokDate;
    const hoursMatch = text.match(/(\d+)\s*(hour|hours|ชั่วโมง)/);
    const minutesMatch = text.match(/(\d+)\s*(minute|minutes|นาที)/);

    if (hoursMatch || minutesMatch) {
      let targetDateObj;
      if (ref instanceof Date) {
        targetDateObj = new Date(ref.getTime());
      } else if (typeof ref === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ref)) {
        targetDateObj = new Date(ref + "T23:59:59+07:00");
      } else {
        targetDateObj = new Date(ref);
      }

      if (hoursMatch) {
        const hours = parseInt(hoursMatch[1], 10);
        targetDateObj.setHours(targetDateObj.getHours() - hours);
      } else if (minutesMatch) {
        const mins = parseInt(minutesMatch[1], 10);
        targetDateObj.setMinutes(targetDateObj.getMinutes() - mins);
      }

      targetDate = getBangkokDateString(targetDateObj);
    }
    return { type: "VALID", exactDate: targetDate, days: 0 };
  }

  // 2. Yesterday -> current Bangkok date - 1 day
  if (text.includes("yesterday") || text.includes("เมื่อวาน")) {
    const targetDate = offsetBangkokDate(currentBangkokDate, -1);
    return { type: "VALID", exactDate: targetDate, days: 1 };
  }

  // 3. Days ago
  const daysMatch = text.match(/(\d+)\s*(day|days|วัน)/) || (text.includes("a day ago") ? [null, "1"] : null);
  if (daysMatch) {
    const days = parseInt(daysMatch[1] ?? "1", 10);
    const targetDate = offsetBangkokDate(currentBangkokDate, -days);
    return { type: "VALID", exactDate: targetDate, days };
  }

  // 4. Weeks, months, years ago -> definitively older than 7 days
  if (
    text.includes("week") ||
    text.includes("สัปดาห์") ||
    text.includes("อาทิตย์") ||
    text.includes("month") ||
    text.includes("เดือน") ||
    text.includes("year") ||
    text.includes("ปี")
  ) {
    return { type: "OLDER_THAN_7_DAYS" };
  }

  return { type: "UNKNOWN" };
}

/**
 * Classifies relative date text dynamically against a target week number.
 * Default targetWeek is dynamically resolved from current Bangkok date if not supplied.
 */
export function classifyDateForWeek(rawDateText, targetWeekNumber, ref = new Date()) {
  const parsed = parseReviewDate(rawDateText, ref);
  if (parsed.type === "EDITED") return { type: "EDITED" };
  if (parsed.type === "UNKNOWN") return { type: "UNKNOWN" };

  const bounds = getWeekDateBoundaries(targetWeekNumber);

  if (parsed.type === "OLDER_THAN_7_DAYS") {
    return { type: "OLDER_THAN_TARGET_WEEK" };
  }

  const exactDate = parsed.exactDate;
  if (exactDate < bounds.startDate) {
    return { type: "OLDER_THAN_TARGET_WEEK", exactDate, days: parsed.days };
  }
  if (exactDate >= bounds.endDateExclusive) {
    return { type: "FUTURE_OR_NEWER", exactDate, days: parsed.days };
  }
  return { type: "TARGET_WEEK_CANDIDATE", exactDate, days: parsed.days, weekNumber: targetWeekNumber };
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

  // 1. Hours / minutes / seconds / today -> reference Bangkok date with hour/minute adjustment if applicable
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
    let targetDate = currentBangkokDate;
    const hoursMatch = text.match(/(\d+)\s*(hour|hours|ชั่วโมง)/);
    const minutesMatch = text.match(/(\d+)\s*(minute|minutes|นาที)/);

    if (hoursMatch || minutesMatch) {
      let targetDateObj;
      if (ref instanceof Date) {
        targetDateObj = new Date(ref.getTime());
      } else if (typeof ref === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ref)) {
        targetDateObj = new Date(ref + "T23:59:59+07:00");
      } else {
        targetDateObj = new Date(ref);
      }

      if (hoursMatch) {
        const hours = parseInt(hoursMatch[1], 10);
        targetDateObj.setHours(targetDateObj.getHours() - hours);
      } else if (minutesMatch) {
        const mins = parseInt(minutesMatch[1], 10);
        targetDateObj.setMinutes(targetDateObj.getMinutes() - mins);
      }

      targetDate = getBangkokDateString(targetDateObj);
    }

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
