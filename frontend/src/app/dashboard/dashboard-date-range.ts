export type DashboardPeriod = "today" | "7d" | "30d";

export type DashboardDateRange = {
  dateFrom: string;
  dateTo: string;
};

const BANGKOK_TIME_ZONE = "Asia/Bangkok";

export function getBangkokIsoDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function shiftIsoDate(isoDate: string, offsetDays: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return date.toISOString().slice(0, 10);
}

export function rangeForPreset(period: DashboardPeriod, today = getBangkokIsoDate()): DashboardDateRange {
  if (period === "7d") return { dateFrom: shiftIsoDate(today, -6), dateTo: today };
  if (period === "30d") return { dateFrom: shiftIsoDate(today, -29), dateTo: today };
  return { dateFrom: today, dateTo: today };
}

export function periodForRange(range: DashboardDateRange): DashboardPeriod {
  const start = new Date(`${range.dateFrom}T00:00:00Z`).getTime();
  const end = new Date(`${range.dateTo}T00:00:00Z`).getTime();
  const days = Math.round((end - start) / 86_400_000) + 1;
  if (days === 1) return "today";
  if (days === 7) return "7d";
  return "30d";
}
