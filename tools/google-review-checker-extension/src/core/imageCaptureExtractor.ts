/**
 * Parser and resolver for Google Maps image capture timestamps.
 *
 * Source of truth for Google Review KPI audit month:
 * "Image capture: <Month Year>" (e.g. "Image capture: Sep 2026" -> "2026-09")
 *
 * Replaces review creation dates. If metadata cannot be read or is mixed,
 * it fails closed.
 */

export type ImageMonthStatus =
  | "RESOLVED"
  | "MIXED_IMAGE_MONTH"
  | "IMAGE_MONTH_UNKNOWN"
  | "NO_IMAGES";

export interface ImageMonthResolution {
  resolvedMonth: string | null; // Format: "YYYY-MM" or null
  status: ImageMonthStatus;
  rawMonths: (string | null)[];
}

const MONTH_NAMES_MAP: Record<string, string> = {
  // English short & full
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",

  // Thai abbreviated (with and without dot)
  "ม.ค.": "01",
  "ม.ค": "01",
  มค: "01",
  "ก.พ.": "02",
  "ก.พ": "02",
  กพ: "02",
  "มี.ค.": "03",
  "มี.ค": "03",
  มีค: "03",
  "เม.ย.": "04",
  "เม.ย": "04",
  เมย: "04",
  "พ.ค.": "05",
  "พ.ค": "05",
  พค: "05",
  "มิ.ย.": "06",
  "มิ.ย": "06",
  มิย: "06",
  "ก.ค.": "07",
  "ก.ค": "07",
  กค: "07",
  "ส.ค.": "08",
  "ส.ค": "08",
  สค: "08",
  "ก.ย.": "09",
  "ก.ย": "09",
  กย: "09",
  "ต.ค.": "10",
  "ต.ค": "10",
  ตค: "10",
  "พ.ย.": "11",
  "พ.ย": "11",
  พย: "11",
  "ธ.ค.": "12",
  "ธ.ค": "12",
  ธค: "12",

  // Thai full
  มกราคม: "01",
  กุมภาพันธ์: "02",
  มีนาคม: "03",
  เมษายน: "04",
  พฤษภาคม: "05",
  มิถุนายน: "06",
  กรกฎาคม: "07",
  สิงหาคม: "08",
  กันยายน: "09",
  ตุลาคม: "10",
  พฤศจิกายน: "11",
  ธันวาคม: "12",
};

/**
 * Normalizes an English or Thai month name to "01".."12".
 */
export function normalizeMonthNameTo2Digit(rawMonth: string): string | null {
  if (!rawMonth) return null;
  const cleaned = rawMonth.trim().toLowerCase();
  return MONTH_NAMES_MAP[cleaned] || null;
}

/**
 * Normalizes year string to a 4-digit Gregorian year string (e.g. "2026").
 * Supports Thai Buddhist Era conversion (e.g. 2569 -> 2026).
 */
export function normalizeYearStringToGregorian(rawYear: string | number): string | null {
  const y = typeof rawYear === "number" ? rawYear : parseInt(rawYear.trim(), 10);
  if (isNaN(y)) return null;

  if (y >= 2400 && y <= 2700) {
    // Thai Buddhist Era (พ.ศ.)
    return String(y - 543);
  }
  if (y >= 2000 && y <= 2099) {
    return String(y);
  }
  return null;
}

/**
 * Parses image capture metadata string from Google Maps UI.
 *
 * Supported formats:
 * - "Image capture: Sep 2026" -> "2026-09"
 * - "Image capture: September 2026 © 2026 Google" -> "2026-09"
 * - "ถ่ายภาพเมื่อ: ก.ย. 2026" -> "2026-09"
 * - "ถ่ายภาพเมื่อ: กันยายน 2569" -> "2026-09"
 * - "ถ่ายเมื่อ ก.ย. 2026" -> "2026-09"
 * - "บันทึกภาพเมื่อ: ก.ย. 2026" -> "2026-09"
 */
export function parseImageCaptureMonth(text: string | null | undefined): string | null {
  if (!text) return null;

  // 1. English pattern: "Image capture: <Month> <Year>"
  const enMatch = text.match(/image\s+capture\s*[:\-]?\s*([a-zA-Z]+)\s+(\d{4})/i);
  if (enMatch) {
    const month = normalizeMonthNameTo2Digit(enMatch[1]);
    const year = normalizeYearStringToGregorian(enMatch[2]);
    if (month && year) {
      return `${year}-${month}`;
    }
  }

  // 2. Thai pattern: "(เวลาถ่ายภาพ|ถ่ายภาพเมื่อ|ถ่ายเมื่อ|บันทึกภาพเมื่อ|การบันทึกภาพ|รูปภาพ)\s*[:\-]?\s*(<Month>)\s+(<Year>)"
  const thMatch = text.match(/(?:เวลาถ่าย(?:ภาพ)?|ถ่าย(?:ภาพ)?เมื่อ|ถ่ายเมื่อ|บันทึกภาพเมื่อ|การบันทึกภาพ|รูปภาพ)\s*[:\-]?\s*([ก-๙.]+)\s+(\d{4})/);
  if (thMatch) {
    const month = normalizeMonthNameTo2Digit(thMatch[1]);
    const year = normalizeYearStringToGregorian(thMatch[2]);
    if (month && year) {
      return `${year}-${month}`;
    }
  }

  // 3. Fallback standalone capture pattern: "<Month> <Year>" if prefixed with capture/photo context
  if (/capture|photo|image|ถ่าย|รูป/i.test(text)) {
    const standaloneMatch = text.match(/([a-zA-Zก-๙.]+)\s+(\d{4})/);
    if (standaloneMatch) {
      const month = normalizeMonthNameTo2Digit(standaloneMatch[1]);
      const year = normalizeYearStringToGregorian(standaloneMatch[2]);
      if (month && year) {
        return `${year}-${month}`;
      }
    }
  }

  return null;
}

/**
 * Resolves the final Image Capture Month for a review that may have multiple images.
 *
 * Rules:
 * - Empty / No images: NO_IMAGES (null)
 * - Any image timestamp unresolvable: IMAGE_MONTH_UNKNOWN (null) -> Fail closed
 * - Multiple images with different months: MIXED_IMAGE_MONTH (null) -> Fail closed
 * - All images resolve to the exact same month: RESOLVED (YYYY-MM) -> Pass
 */
export function resolveReviewImageMonths(imageMonths: (string | null)[]): ImageMonthResolution {
  if (!imageMonths || imageMonths.length === 0) {
    return {
      resolvedMonth: null,
      status: "NO_IMAGES",
      rawMonths: [],
    };
  }

  // If any photo cannot be resolved, fail closed
  const hasUnknown = imageMonths.some((m) => !m || m === "IMAGE_MONTH_UNKNOWN");
  if (hasUnknown) {
    return {
      resolvedMonth: null,
      status: "IMAGE_MONTH_UNKNOWN",
      rawMonths: imageMonths,
    };
  }

  // Extract distinct valid YYYY-MM months
  const validMonths = imageMonths.filter((m): m is string => Boolean(m));
  const uniqueMonths = Array.from(new Set(validMonths));

  if (uniqueMonths.length > 1) {
    return {
      resolvedMonth: null,
      status: "MIXED_IMAGE_MONTH",
      rawMonths: imageMonths,
    };
  }

  if (uniqueMonths.length === 1) {
    return {
      resolvedMonth: uniqueMonths[0],
      status: "RESOLVED",
      rawMonths: imageMonths,
    };
  }

  return {
    resolvedMonth: null,
    status: "IMAGE_MONTH_UNKNOWN",
    rawMonths: imageMonths,
  };
}
