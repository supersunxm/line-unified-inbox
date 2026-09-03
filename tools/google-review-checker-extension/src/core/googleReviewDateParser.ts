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
    (text.includes("a week ago") || text.includes("หนึ่งสัปดาห์") ? [null, "1"] : null);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1] ?? "1", 10);
    const d = new Date(ref);
    d.setDate(d.getDate() - weeks * 7);
    return formatYearMonth(d);
  }

  // 5. Months ago
  const monthsMatch =
    text.match(/(\d+)\s*(month|months|เดือน)/) ||
    (text.includes("a month ago") || text.includes("หนึ่งเดือน") ? [null, "1"] : null);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1] ?? "1", 10);
    const d = new Date(ref);
    d.setMonth(d.getMonth() - months);
    return formatYearMonth(d);
  }

  // 6. Years ago
  const yearsMatch =
    text.match(/(\d+)\s*(year|years|ปี)/) ||
    (text.includes("a year ago") || text.includes("หนึ่งปี") ? [null, "1"] : null);
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
