function formatBangkokDate(date: Date, locale: string): string {
  if (locale.startsWith("th")) {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month} ${parts.year}`;
}

function formatBangkokDateTime(date: Date, locale: string): string {
  if (locale.startsWith("th")) {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }
  const dateStr = formatBangkokDate(date, locale);
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(timeFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${dateStr}, ${parts.hour}:${parts.minute}`;
}

/**
 * Formats TikTok public analytics timestamp semantics.
 * Clearly separates the business snapshot date (metricDate) from the collection/updated timestamp (lastUpdatedAt).
 */
export function formatDashboardTimestamp(
  metricDate: string | null | undefined,
  lastUpdatedAt: string | null | undefined,
  locale: string,
  language: string,
): string | null {
  const parts: string[] = [];

  if (metricDate) {
    const formattedMetricDate = formatBangkokDate(new Date(metricDate.slice(0, 10) + "T00:00:00.000Z"), locale);
    const dataPrefix = language === "th" ? "ข้อมูล ณ วันที่" : language === "zh" ? "数据日期" : "Data for";
    parts.push(`${dataPrefix} ${formattedMetricDate}`);
  }

  if (lastUpdatedAt) {
    const formattedUpdated = formatBangkokDateTime(new Date(lastUpdatedAt), locale);
    const updatedPrefix = language === "th" ? "อัปเดต" : language === "zh" ? "更新于" : "Updated";
    parts.push(`${updatedPrefix} ${formattedUpdated}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
