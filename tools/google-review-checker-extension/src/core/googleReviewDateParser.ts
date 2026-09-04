/**
 * Parses Google Maps relative date strings (in English and Thai) or explicit dates
 * into an estimated month representation `YYYY-MM`.
 *
 * If the date cannot be determined with confidence, returns `null` (UNKNOWN_DATE)
 * so that the review is safely NOT counted as Qualified.
 *
 * EDITED REVIEW POLICY:
 * If a review is marked "Edited X ago" ("แก้ไขเมื่อ X ที่แล้ว"), the original publication date
 * cannot be determined reliably from Google Maps. Because the monthly KPI requires reviews
 * CREATED during the target month, edited reviews without an explicit original date must
 * fail closed as ORIGINAL_DATE_UNKNOWN and NOT qualify.
 */

export type DateParseStatus = "VALID" | "EDITED_ORIGINAL_UNKNOWN" | "UNKNOWN_DATE";

export type GoogleReviewDateResult = {
  month: string | null;
  isEdited: boolean;
  status: DateParseStatus;
};

export function isEditedReviewDateText(text: string): boolean {
  return (
    text.includes("edited") ||
    text.includes("แก้ไขเมื่อ") ||
    text.includes("แก้ไข")
  );
}

export function parseGoogleReviewDate(
  rawDateText?: string | null,
  referenceDate: Date = new Date(),
): GoogleReviewDateResult {
  if (!rawDateText || typeof rawDateText !== "string") {
    return { month: null, isEdited: false, status: "UNKNOWN_DATE" };
  }

  const text = rawDateText.trim().toLowerCase();
  if (!text) {
    return { month: null, isEdited: false, status: "UNKNOWN_DATE" };
  }

  const isEdited = isEditedReviewDateText(text);

  // If the review is edited, check if an explicit original date is present.
  // Google Maps standard "Edited 4 weeks ago" does not reveal the original date.
  if (isEdited) {
    // Check if an explicit original date is mentioned after a delimiter (e.g. "Edited · Aug 15, 2026")
    const explicitDateMatch = text.match(/\b(original|เดิม|โพสต์เมื่อ)\s*:\s*(\d{4}-\d{2})/i);
    if (explicitDateMatch) {
      return { month: explicitDateMatch[2], isEdited: true, status: "VALID" };
    }

    // Fail closed: Do NOT guess original creation date of edited reviews
    return {
      month: null,
      isEdited: true,
      status: "EDITED_ORIGINAL_UNKNOWN",
    };
  }

  const month = parseUneditedDateToMonth(text, referenceDate);
  return {
    month,
    isEdited: false,
    status: month ? "VALID" : "UNKNOWN_DATE",
  };
}

export function parseGoogleReviewDateToMonth(
  rawDateText?: string | null,
  referenceDate: Date = new Date(),
): string | null {
  return parseGoogleReviewDate(rawDateText, referenceDate).month;
}

function parseUneditedDateToMonth(text: string, referenceDate: Date): string | null {
  const ref = new Date(referenceDate);

  // 1. ISO format (e.g. 2026-08-15 or 2026-08)
  const isoMatch = text.match(/^(\d{4})-(0[1-9]|1[0-2])(-\d{2})?/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  // 2. Today / Yesterday / Hours ago / Minutes ago
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
    return formatYearMonth(ref);
  }

  if (text.includes("yesterday") || text.includes("เมื่อวาน")) {
    const d = new Date(ref);
    d.setDate(d.getDate() - 1);
    return formatYearMonth(d);
  }

  // 3. Days ago
  const daysMatch = text.match(/(\d+)\s*(day|days|วัน)/) || (text.includes("a day ago") ? [null, "1"] : null);
  if (daysMatch) {
    const days = parseInt(daysMatch[1] ?? "1", 10);
    const d = new Date(ref);
    d.setDate(d.getDate() - days);
    return formatYearMonth(d);
  }

  // 4. Weeks ago
  const weeksMatch =
    text.match(/(\d+)\s*(week|weeks|สัปดาห์|อาทิตย์)/) ||
    (text.includes("a week ago") ||
    text.includes("หนึ่งสัปดาห์") ||
    text.includes("สัปดาห์ที่แล้ว") ||
    text.includes("สัปดาห์ที่ผ่านมา") ||
    text.includes("อาทิตย์ที่แล้ว") ||
    text.includes("อาทิตย์ที่ผ่านมา")
      ? [null, "1"]
      : null);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1] ?? "1", 10);
    const d = new Date(ref);
    d.setDate(d.getDate() - weeks * 7);
    return formatYearMonth(d);
  }

  // 5. Months ago
  const monthsMatch =
    text.match(/(\d+)\s*(month|months|เดือน)/) ||
    (text.includes("a month ago") ||
    text.includes("หนึ่งเดือน") ||
    text.includes("เดือนที่แล้ว") ||
    text.includes("เดือนที่ผ่านมา")
      ? [null, "1"]
      : null);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1] ?? "1", 10);
    const d = new Date(ref);
    d.setMonth(d.getMonth() - months);
    return formatYearMonth(d);
  }

  // 6. Years ago
  const yearsMatch =
    text.match(/(\d+)\s*(year|years|ปี)/) ||
    (text.includes("a year ago") ||
    text.includes("หนึ่งปี") ||
    text.includes("ปีที่แล้ว") ||
    text.includes("ปีที่ผ่านมา")
      ? [null, "1"]
      : null);
  if (yearsMatch) {
    const years = parseInt(yearsMatch[1] ?? "1", 10);
    const d = new Date(ref);
    d.setFullYear(d.getFullYear() - years);
    return formatYearMonth(d);
  }

  // 7. Explicit English Month Name (e.g. "August 2026", "Aug 2026", "15 Aug 2026")
  const englishMonths: Record<string, string> = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12",
  };

  for (const [mName, mNum] of Object.entries(englishMonths)) {
    const regex = new RegExp(`\\b${mName}\\b.*?(\\d{4})`, "i");
    const match = text.match(regex);
    if (match) {
      return `${match[1]}-${mNum}`;
    }
  }

  // 8. Explicit Thai Month Name (e.g. "สิงหาคม 2569", "ส.ค. 2026")
  const thaiMonths: Record<string, string> = {
    "ม.ค.": "01", "มกราคม": "01",
    "ก.พ.": "02", "กุมภาพันธ์": "02",
    "มี.ค.": "03", "มีนาคม": "03",
    "เม.ย.": "04", "เมษายน": "04",
    "พ.ค.": "05", "พฤษภาคม": "05",
    "มิ.ย.": "06", "มิถุนายน": "06",
    "ก.ค.": "07", "กรกฎาคม": "07",
    "ส.ค.": "08", "สิงหาคม": "08",
    "ก.ย.": "09", "กันยายน": "09",
    "ต.ค.": "10", "ตุลาคม": "10",
    "พ.ย.": "11", "พฤศจิกายน": "11",
    "ธ.ค.": "12", "ธันวาคม": "12",
  };

  for (const [mName, mNum] of Object.entries(thaiMonths)) {
    if (text.includes(mName)) {
      const yearMatch = text.match(/\b(\d{4})\b/);
      if (yearMatch) {
        let year = parseInt(yearMatch[1], 10);
        // Buddhist year conversion (e.g. 2569 -> 2026)
        if (year > 2400) year -= 543;
        return `${year}-${mNum}`;
      }
      return `${ref.getFullYear()}-${mNum}`;
    }
  }

  return null; // UNKNOWN_DATE
}

function formatYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export type ChronologicalRelation = "NEWER" | "TARGET_OR_OVERLAP" | "OLDER" | "UNKNOWN";

export type ChronologyClassification = {
  rawDateText: string | null;
  isEditedTimestamp: boolean;
  relativeDateRange: RelativeDateRange | null;
  chronologicalRelation: ChronologicalRelation;
  chronologicalBoundaryEligible: boolean;
};

export function classifyChronologicalRelation(
  rawDateText?: string | null,
  targetMonth?: string | null,
  referenceDate: Date = new Date(),
): ChronologyClassification {
  if (!rawDateText || typeof rawDateText !== "string" || !rawDateText.trim()) {
    return {
      rawDateText: rawDateText ?? null,
      isEditedTimestamp: false,
      relativeDateRange: null,
      chronologicalRelation: "UNKNOWN",
      chronologicalBoundaryEligible: false,
    };
  }

  const text = rawDateText.trim().toLowerCase();
  const isEdited = isEditedReviewDateText(text);
  const range = estimateRelativeDateRange(text, referenceDate);

  if (isEdited) {
    // Edited reviews: Do NOT establish a defensible feed stop boundary!
    // Google Maps edited relative timestamps indicate when the edit happened, not original creation.
    return {
      rawDateText,
      isEditedTimestamp: true,
      relativeDateRange: range,
      chronologicalRelation: range ? (range.startMonth > (targetMonth || "") ? "NEWER" : "TARGET_OR_OVERLAP") : "UNKNOWN",
      chronologicalBoundaryEligible: false,
    };
  }

  if (!range || !targetMonth) {
    return {
      rawDateText,
      isEditedTimestamp: false,
      relativeDateRange: range,
      chronologicalRelation: "UNKNOWN",
      chronologicalBoundaryEligible: false,
    };
  }

  // If the earliest possible date (startMonth) is strictly newer than targetMonth:
  if (range.startMonth > targetMonth) {
    return {
      rawDateText,
      isEditedTimestamp: false,
      relativeDateRange: range,
      chronologicalRelation: "NEWER",
      chronologicalBoundaryEligible: false,
    };
  }

  // If the latest possible date (endMonth) is strictly older than targetMonth:
  // e.g. targetMonth = "2026-09", range.endMonth = "2026-08" (e.g. "1 เดือนที่แล้ว" / "1 month ago" on Sep 4)
  if (range.endMonth < targetMonth) {
    return {
      rawDateText,
      isEditedTimestamp: false,
      relativeDateRange: range,
      chronologicalRelation: "OLDER",
      chronologicalBoundaryEligible: true,
    };
  }

  // Otherwise, the date range touches or overlaps the target month
  return {
    rawDateText,
    isEditedTimestamp: false,
    relativeDateRange: range,
    chronologicalRelation: "TARGET_OR_OVERLAP",
    chronologicalBoundaryEligible: false,
  };
}

export type RelativeDateRange = {
  startDate: Date;
  endDate: Date;
  startMonth: string;
  endMonth: string;
  isEdited: boolean;
  isAmbiguous: boolean;
};

/**
 * Estimates the calendar date range for a Google Maps relative timestamp
 * anchored to the provided referenceDate (browser date).
 *
 * NOTE: This is strictly for navigation optimization (fast-skipping reviews)
 * and MUST NOT determine KPI qualification.
 */
export function estimateRelativeDateRange(
  rawDateText?: string | null,
  referenceDate: Date = new Date(),
): RelativeDateRange | null {
  if (!rawDateText || typeof rawDateText !== "string") return null;
  const text = rawDateText.trim().toLowerCase();
  if (!text) return null;

  const isEdited = isEditedReviewDateText(text);
  const ref = new Date(referenceDate);

  // Today / Yesterday / Hours / Minutes
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
    const start = new Date(ref);
    start.setHours(0, 0, 0, 0);
    const end = new Date(ref);
    return {
      startDate: start,
      endDate: end,
      startMonth: formatYearMonth(start),
      endMonth: formatYearMonth(end),
      isEdited,
      isAmbiguous: false,
    };
  }

  if (text.includes("yesterday") || text.includes("เมื่อวาน")) {
    const d = new Date(ref);
    d.setDate(d.getDate() - 1);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return {
      startDate: start,
      endDate: end,
      startMonth: formatYearMonth(start),
      endMonth: formatYearMonth(end),
      isEdited,
      isAmbiguous: false,
    };
  }

  // Days ago: "X days ago" / "X วันที่แล้ว"
  const daysMatch = text.match(/(\d+)\s*(day|days|วัน)/) || (text.includes("a day ago") ? [null, "1"] : null);
  if (daysMatch) {
    const days = parseInt(daysMatch[1] ?? "1", 10);
    // Google Maps "X days ago": posted X days ago (e.g. 3 days ago from Sep 4 is Sep 1)
    const start = new Date(ref);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const end = new Date(ref);
    end.setDate(end.getDate() - days);
    end.setHours(23, 59, 59, 999);
    return {
      startDate: start,
      endDate: end,
      startMonth: formatYearMonth(start),
      endMonth: formatYearMonth(end),
      isEdited,
      isAmbiguous: false,
    };
  }

  // Weeks ago: "X weeks ago" / "X สัปดาห์ที่แล้ว"
  const weeksMatch =
    text.match(/(\d+)\s*(week|weeks|สัปดาห์|อาทิตย์)/) ||
    (text.includes("a week ago") ||
    text.includes("หนึ่งสัปดาห์") ||
    text.includes("สัปดาห์ที่แล้ว") ||
    text.includes("สัปดาห์ที่ผ่านมา") ||
    text.includes("อาทิตย์ที่แล้ว") ||
    text.includes("อาทิตย์ที่ผ่านมา")
      ? [null, "1"]
      : null);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1] ?? "1", 10);
    // Google Maps "1 week ago" typically spans 7 to 13 days ago; "2 weeks ago" 14 to 20 days ago, etc.
    const end = new Date(ref);
    end.setDate(end.getDate() - weeks * 7);
    const start = new Date(ref);
    start.setDate(start.getDate() - (weeks * 7 + 6));
    return {
      startDate: start,
      endDate: end,
      startMonth: formatYearMonth(start),
      endMonth: formatYearMonth(end),
      isEdited,
      isAmbiguous: false,
    };
  }

  // Months ago: "X months ago" / "X เดือนที่แล้ว"
  const monthsMatch =
    text.match(/(\d+)\s*(month|months|เดือน)/) ||
    (text.includes("a month ago") ||
    text.includes("หนึ่งเดือน") ||
    text.includes("เดือนที่แล้ว") ||
    text.includes("เดือนที่ผ่านมา")
      ? [null, "1"]
      : null);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1] ?? "1", 10);
    // "a month ago" / "1 month ago" typically spans 30 to 59 days ago
    const end = new Date(ref);
    end.setMonth(end.getMonth() - months);
    const start = new Date(ref);
    start.setMonth(start.getMonth() - (months + 1));
    return {
      startDate: start,
      endDate: end,
      startMonth: formatYearMonth(start),
      endMonth: formatYearMonth(end),
      isEdited,
      isAmbiguous: true,
    };
  }

  // Fallback to parsed month if single exact month is known
  const singleMonth = parseGoogleReviewDateToMonth(rawDateText, referenceDate);
  if (singleMonth) {
    const [y, m] = singleMonth.split("-").map((s) => parseInt(s, 10));
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return {
      startDate: start,
      endDate: end,
      startMonth: singleMonth,
      endMonth: singleMonth,
      isEdited,
      isAmbiguous: false,
    };
  }

  return null;
}

/**
 * Determines whether a relative timestamp proves that the review was definitely
 * created in a month NEWER than targetMonth, allowing photo viewer fast-skip.
 *
 * Example: Auditing August 2026 on September 4:
 * "12 hours ago" -> startMonth="2026-09", endMonth="2026-09" -> definitely newer than "2026-08" -> TRUE.
 * "3 days ago" -> startMonth="2026-09", endMonth="2026-09" -> definitely newer -> TRUE.
 * "1 week ago" -> startMonth="2026-08", endMonth="2026-08" -> NOT newer -> FALSE.
 */
export function isDefinitelyNewerThanMonth(
  rawDateText?: string | null,
  targetMonth?: string | null,
  referenceDate: Date = new Date(),
): boolean {
  if (!rawDateText || !targetMonth) return false;
  const range = estimateRelativeDateRange(rawDateText, referenceDate);
  if (!range) return false;

  // If the earliest possible date (startMonth) is strictly greater than targetMonth,
  // then the review could not possibly have been created in targetMonth or older.
  return range.startMonth > targetMonth;
}
