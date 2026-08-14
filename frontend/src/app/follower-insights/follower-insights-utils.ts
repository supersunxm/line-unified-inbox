import type { ByStoreAccountRow, SummaryDailyRow } from "@/types/api";

export type Language = "th" | "en" | "zh";

export function getBkkDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatBkkDateTime(d: string | Date | null, locale: Language = "en"): string {
  if (!d) return "—";
  const dateObj = typeof d === "string" ? new Date(d) : d;
  const intlLocale = locale === "th" ? "th-TH-u-ca-gregory" : locale === "zh" ? "zh-CN" : "en-CA";
  return new Intl.DateTimeFormat(intlLocale, {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(dateObj)
    .replace(",", "");
}

export function formatDateDisplay(isoStr: string, locale: Language = "en"): string {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-").map((n) => parseInt(n, 10));
  if (isNaN(y) || isNaN(m) || isNaN(d)) return isoStr;
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const intlLocale = locale === "th" ? "th-TH-u-ca-gregory" : locale === "zh" ? "zh-CN" : "en-US";
  return new Intl.DateTimeFormat(intlLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateObj);
}

/**
 * Pure ISO calendar-day inclusive count helper.
 * Parses YYYY-MM-DD as UTC calendar dates to avoid DST or local time zone ambiguity.
 * Returns negative or 0 if dateTo is earlier than dateFrom.
 */
export function getInclusiveCalendarDays(dateFrom: string, dateTo: string): number {
  if (!dateFrom || !dateTo) return 0;
  const [y1, m1, d1] = dateFrom.split("-").map((n) => parseInt(n, 10));
  const [y2, m2, d2] = dateTo.split("-").map((n) => parseInt(n, 10));
  if (isNaN(y1) || isNaN(m1) || isNaN(d1) || isNaN(y2) || isNaN(m2) || isNaN(d2)) return 0;

  const utcStart = Date.UTC(y1, m1 - 1, d1);
  const utcEnd = Date.UTC(y2, m2 - 1, d2);

  if (utcEnd < utcStart) {
    return 0; // Reversed dates
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((utcEnd - utcStart) / msPerDay) + 1;
}

export function validateDateRange(
  dateFrom: string,
  dateTo: string,
  language: Language = "en"
): { valid: boolean; error: string | null } {
  if (!dateFrom || !dateTo) {
    return {
      valid: false,
      error:
        language === "th"
          ? "วันสิ้นสุดต้องไม่มาก่อนวันเริ่มต้น"
          : language === "zh"
          ? "结束日期不能早于开始日期。"
          : "End date cannot be earlier than start date.",
    };
  }
  const days = getInclusiveCalendarDays(dateFrom, dateTo);
  if (days <= 0) {
    return {
      valid: false,
      error:
        language === "th"
          ? "วันสิ้นสุดต้องไม่มาก่อนวันเริ่มต้น"
          : language === "zh"
          ? "结束日期不能早于开始日期。"
          : "End date cannot be earlier than start date.",
    };
  }
  if (days > 90) {
    return {
      valid: false,
      error:
        language === "th"
          ? "ช่วงวันที่ต้องไม่เกิน 90 วัน"
          : language === "zh"
          ? "日期范围不能超过 90 天。"
          : "Date range cannot exceed 90 days.",
    };
  }
  return { valid: true, error: null };
}

export interface DataCoverageResult {
  totalCalendarDays: number;
  usableDays: number;
  coveragePct: number;
  hasMissingDates: boolean;
}

export function calculateCoverage(
  summaryData: SummaryDailyRow[],
  dateFrom: string,
  dateTo: string
): DataCoverageResult {
  const totalCalendarDays = getInclusiveCalendarDays(dateFrom, dateTo);

  // Usable day requires actual summary data (followers is not null and accountsReady > 0)
  const usableDays = summaryData.filter(
    (d) => d.followers !== null && d.followers !== undefined && (d.accountsReady ?? 0) > 0
  ).length;

  const coveragePct =
    totalCalendarDays > 0 ? Math.min(100, Math.round((usableDays / totalCalendarDays) * 100)) : 0;

  const hasMissingDates = coveragePct < 100 || usableDays < totalCalendarDays;

  return { totalCalendarDays, usableDays, coveragePct, hasMissingDates };
}

/**
 * Escapes a single CSV cell according to RFC 4180 rules.
 * Handles null/undefined (returns empty string), commas, quotes, line breaks, and Thai characters.
 */
export function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportStoreCsv(
  data: ByStoreAccountRow[],
  dateFrom: string,
  dateTo: string,
  language: Language = "en"
) {
  const headers =
    language === "th"
      ? ["รหัสสาขา (Store ID)", "ร้านค้า", "LINE OA", "ผู้ติดตาม", "ผู้ติดตามวันเริ่มต้น", "เพิ่มขึ้นในช่วงเวลา", "ผู้รับข้อความที่เข้าถึงได้", "จำนวนบล็อก", "สถานะ", "ดึงข้อมูลล่าสุด"]
      : language === "zh"
      ? ["门店编号 (Store ID)", "门店", "LINE OA", "关注者", "起始关注者", "期间增加", "目标覆盖人数", "屏蔽数", "状态", "最新拉取"]
      : ["Store ID", "Store", "LINE OA", "Followers", "Start Followers", "Period Increase", "Targeted Reach", "Blocks", "Status", "Last Fetched"];

  const formatStatusCell = (status: string) => {
    if (status === "ready") return language === "th" ? "พร้อม" : language === "zh" ? "就绪" : "Ready";
    if (status === "partial") return language === "th" ? "ข้อมูลบางส่วน" : language === "zh" ? "部分" : "Partial";
    if (status === "missing") return language === "th" ? "ไม่มีข้อมูล" : language === "zh" ? "缺失" : "Missing";
    if (status === "missing-baseline") return language === "th" ? "ไม่มีข้อมูลวันเริ่มต้น" : language === "zh" ? "缺少基线数据" : "Missing baseline";
    return status;
  };

  const rows = data.map((r) => [
    escapeCsvCell(r.masterStoreId ?? r.externalStoreId ?? ""),
    escapeCsvCell(r.storeName),
    escapeCsvCell(r.accountName),
    escapeCsvCell(r.followers),
    escapeCsvCell(r.startFollowers),
    escapeCsvCell(r.periodIncrease),
    escapeCsvCell(r.targetedReaches),
    escapeCsvCell(r.blocks),
    escapeCsvCell(formatStatusCell(r.status)),
    escapeCsvCell(r.fetchedAt ? formatBkkDateTime(r.fetchedAt, language) : null),
  ]);

  const csvString = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");

  // Include UTF-8 BOM (\uFEFF) for Thai character support in Excel
  const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `follower_insights_${dateFrom}_to_${dateTo}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Pure pagination helper to compute page bounds and safe page numbers.
 */
export function calculatePaginationBounds(totalItems: number, currentPage: number, pageSize = 10) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startRecord = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endRecord = Math.min(totalItems, safePage * pageSize);
  return { totalPages, safePage, startRecord, endRecord };
}
