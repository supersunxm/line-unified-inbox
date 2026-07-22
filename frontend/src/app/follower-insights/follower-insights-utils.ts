import type { ByStoreAccountRow, SummaryDailyRow } from "@/types/api";

export function getBkkDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatBkkDateTime(d: string | Date | null): string {
  if (!d) return "—";
  const dateObj = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", {
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

export function formatDateDisplay(isoStr: string): string {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-").map((n) => parseInt(n, 10));
  if (isNaN(y) || isNaN(m) || isNaN(d)) return isoStr;
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
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

export function validateDateRange(dateFrom: string, dateTo: string): { valid: boolean; error: string | null } {
  if (!dateFrom || !dateTo) {
    return { valid: false, error: "Please select both start and end dates." };
  }
  const days = getInclusiveCalendarDays(dateFrom, dateTo);
  if (days <= 0) {
    return { valid: false, error: "End date cannot be earlier than start date." };
  }
  if (days > 90) {
    return { valid: false, error: "Date range cannot exceed 90 calendar days." };
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

export function exportStoreCsv(data: ByStoreAccountRow[], dateFrom: string, dateTo: string) {
  const headers = [
    "Store",
    "LINE OA",
    "Followers",
    "Start Followers",
    "Period Increase",
    "Targeted Reach",
    "Blocks",
    "Status",
    "Last Fetched",
  ];

  const rows = data.map((r) => [
    escapeCsvCell(r.storeName),
    escapeCsvCell(r.accountName),
    escapeCsvCell(r.followers),
    escapeCsvCell(r.startFollowers),
    escapeCsvCell(r.periodIncrease),
    escapeCsvCell(r.targetedReaches),
    escapeCsvCell(r.blocks),
    escapeCsvCell(r.status),
    escapeCsvCell(r.fetchedAt ? formatBkkDateTime(r.fetchedAt) : null),
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
