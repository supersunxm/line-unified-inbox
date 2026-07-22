import { BadRequestException } from "@nestjs/common";

function validateCalendarDate(year: number, month: number, day: number): void {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new BadRequestException(`Invalid calendar date: ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new BadRequestException(`Invalid calendar date: ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
}

export function getTodayBangkokDateString(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export function formatToIsoDate(input?: string | Date | null): string {
  if (!input) return getTodayBangkokDateString();
  if (input instanceof Date) {
    const y = input.getUTCFullYear();
    const m = String(input.getUTCMonth() + 1).padStart(2, "0");
    const d = String(input.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = input.trim();
  let iso: string;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    iso = str;
  } else if (/^\d{8}$/.test(str)) {
    iso = `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  } else {
    throw new BadRequestException(`Invalid date format: ${input}. Expected YYYY-MM-DD or YYYYMMDD.`);
  }
  const [yStr, mStr, dStr] = iso.split("-");
  validateCalendarDate(parseInt(yStr, 10), parseInt(mStr, 10), parseInt(dStr, 10));
  return iso;
}

export function formatToLineApiDate(input?: string | Date | null): string {
  const iso = formatToIsoDate(input);
  return iso.replace(/-/g, "");
}

export function toUtcDateForDb(input: string | Date): Date {
  const iso = formatToIsoDate(input);
  const [yearStr, monthStr, dayStr] = iso.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function formatDbDateToIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getDateRangeArray(dateFromStr: string, dateToStr: string): string[] {
  const fromIso = formatToIsoDate(dateFromStr);
  const toIso = formatToIsoDate(dateToStr);

  const startUtc = toUtcDateForDb(fromIso);
  const endUtc = toUtcDateForDb(toIso);

  if (endUtc.getTime() < startUtc.getTime()) {
    throw new BadRequestException(`dateTo (${toIso}) cannot be earlier than dateFrom (${fromIso})`);
  }

  const result: string[] = [];
  const current = new Date(startUtc.getTime());
  while (current.getTime() <= endUtc.getTime()) {
    result.push(formatDbDateToIso(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  if (result.length > 90) {
    throw new BadRequestException(`Date range span (${result.length} days) exceeds maximum limit of 90 days inclusive`);
  }

  return result;
}
