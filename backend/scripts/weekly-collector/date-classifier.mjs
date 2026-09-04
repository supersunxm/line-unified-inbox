import { isEditedReviewDateText } from "../../../tools/google-review-checker-extension/src/core/googleReviewDateParser.ts";

const REFERENCE_DATE = new Date("2026-09-04T12:00:00+07:00");

/**
 * Classifies relative date text for Week 2 audit.
 * Target Week: 2026-09-02 00:00:00+07:00 to 2026-09-09 00:00:00+07:00 exclusive.
 * Anchored to Reference Date: 2026-09-04 Asia/Bangkok
 *
 * Current runtime is Sep 4:
 * - "today", hours ago, minutes ago -> Sep 4 (2026-09-04) [OPEN]
 * - "yesterday", "1 day ago" -> Sep 3 (2026-09-03) [CLOSED]
 * - "2 days ago" -> Sep 2 (2026-09-02) [CLOSED]
 * - "3 days ago" (Sep 1) or older -> definitively before 2026-09-02 -> STOP
 */
export function classifyWeek2Date(rawDateText, ref = REFERENCE_DATE) {
  if (!rawDateText || typeof rawDateText !== "string") {
    return { type: "UNKNOWN" };
  }
  const text = rawDateText.trim().toLowerCase();

  // Check if edited
  if (isEditedReviewDateText(text)) {
    return { type: "EDITED" };
  }

  // 1. Hours / minutes / today -> Sep 4 (2026-09-04) -> Week 2 Candidate
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
    return { type: "WEEK2_CANDIDATE", exactDate: "2026-09-04", days: 0 };
  }

  // 2. Yesterday -> Sep 3 (2026-09-03) -> Week 2 Candidate
  if (text.includes("yesterday") || text.includes("เมื่อวาน")) {
    return { type: "WEEK2_CANDIDATE", exactDate: "2026-09-03", days: 1 };
  }

  // 3. Days ago: "X days ago" / "X วันที่แล้ว"
  const daysMatch = text.match(/(\d+)\s*(day|days|วัน)/) || (text.includes("a day ago") ? [null, "1"] : null);
  if (daysMatch) {
    const days = parseInt(daysMatch[1] ?? "1", 10);
    const d = new Date(ref);
    d.setDate(d.getDate() - days);
    const dateStr = d.toISOString().slice(0, 10);

    // If 1 day ago (2026-09-03) or 2 days ago (2026-09-02) -> Week 2 Candidate
    if (dateStr >= "2026-09-02" && dateStr < "2026-09-09") {
      return { type: "WEEK2_CANDIDATE", exactDate: dateStr, days };
    }

    // If 3 days ago (2026-09-01) or older -> definitively before Sep 2 -> STOP
    if (dateStr < "2026-09-02") {
      return { type: "OLDER_THAN_WEEK2", exactDate: dateStr, days };
    }

    // (If in future > Sep 4, though impossible with days ago)
    return { type: "FUTURE_OR_NEWER", exactDate: dateStr, days };
  }

  // 4. Weeks ago, Months ago, Years ago -> all >= 7 days ago -> definitively before Sep 2 -> STOP
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
