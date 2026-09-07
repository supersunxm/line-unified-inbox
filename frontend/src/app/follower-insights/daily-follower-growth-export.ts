import type { ByStoreAccountRow } from "@/types/api";
import { api } from "@/lib/api";
import type { Language } from "./follower-insights-translations";

export type DailyGrowthStoreRow = {
  lineOaId: string;
  storeLabel: string;
  storeName: string;
  accountName: string;
  values: Record<string, number | null>;
};

export type DailyGrowthMatrix = {
  dates: string[];
  stores: DailyGrowthStoreRow[];
};

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addIsoDays(value: string, days: number) {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}

export function enumerateIsoDates(dateFrom: string, dateTo: string) {
  const result: string[] = [];
  let cursor = dateFrom;
  while (cursor <= dateTo) {
    result.push(cursor);
    cursor = addIsoDays(cursor, 1);
  }
  return result;
}

function storeLabel(row: ByStoreAccountRow) {
  const id = row.masterStoreId || row.externalStoreId || row.storeId || "";
  return [id, row.storeName].filter(Boolean).join(" ").trim();
}

export function buildDailyGrowthMatrix(
  snapshotsByDate: Record<string, ByStoreAccountRow[]>,
  dateFrom: string,
  dateTo: string,
  selectedLineOaIds: string[] = [],
): DailyGrowthMatrix {
  const dates = enumerateIsoDates(dateFrom, dateTo);
  const baselineDate = addIsoDays(dateFrom, -1);
  const selected = new Set(selectedLineOaIds);
  const metadata = new Map<string, ByStoreAccountRow>();

  for (const rows of Object.values(snapshotsByDate)) {
    for (const row of rows) {
      if (!row.lineOaId) continue;
      if (selected.size > 0 && !selected.has(row.lineOaId)) continue;
      if (!metadata.has(row.lineOaId)) metadata.set(row.lineOaId, row);
    }
  }

  const stores = Array.from(metadata.values())
    .sort((a, b) => {
      const aId = a.masterStoreId || a.externalStoreId || a.storeId || "";
      const bId = b.masterStoreId || b.externalStoreId || b.storeId || "";
      return aId.localeCompare(bId, undefined, { numeric: true }) || a.storeName.localeCompare(b.storeName);
    })
    .map<DailyGrowthStoreRow>((meta) => {
      const values: Record<string, number | null> = {};
      for (const date of dates) {
        const previousDate = date === dateFrom ? baselineDate : addIsoDays(date, -1);
        const current = snapshotsByDate[date]?.find((row) => row.lineOaId === meta.lineOaId);
        const previous = snapshotsByDate[previousDate]?.find((row) => row.lineOaId === meta.lineOaId);
        const currentFollowers = current?.followers;
        const previousFollowers = previous?.followers;
        values[date] =
          typeof currentFollowers === "number" && typeof previousFollowers === "number"
            ? currentFollowers - previousFollowers
            : null;
      }
      return {
        lineOaId: meta.lineOaId,
        storeLabel: storeLabel(meta),
        storeName: meta.storeName,
        accountName: meta.accountName,
        values,
      };
    });

  return { dates, stores };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      output[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}

function formatHeaderDate(value: string, language: Language) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(language === "th" ? "th-TH-u-ca-gregory" : language === "zh" ? "zh-CN" : "en-GB", {
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export async function downloadDailyFollowerGrowthWorkbook(options: {
  dateFrom: string;
  dateTo: string;
  selectedLineOaIds?: string[];
  language?: Language;
}) {
  const language = options.language ?? "en";
  const dates = enumerateIsoDates(options.dateFrom, options.dateTo);
  const fetchDates = [addIsoDays(options.dateFrom, -1), ...dates];

  const fetched = await mapWithConcurrency(fetchDates, 6, async (date) => ({
    date,
    rows: await api.followerInsightsByStore(date, date),
  }));
  const snapshotsByDate = Object.fromEntries(fetched.map((item) => [item.date, item.rows]));
  const matrix = buildDailyGrowthMatrix(
    snapshotsByDate,
    options.dateFrom,
    options.dateTo,
    options.selectedLineOaIds ?? [],
  );

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LINE OA Follower Insights";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(language === "th" ? "ผู้ติดตาม LINE OA" : "LINE OA Daily Growth", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 2 }],
  });

  sheet.mergeCells(1, 1, 2, 1);
  sheet.getCell(1, 1).value = language === "th" ? "สาขา" : language === "zh" ? "门店" : "Store";
  matrix.dates.forEach((date, index) => {
    const column = index + 2;
    sheet.getCell(1, column).value = formatHeaderDate(date, language);
    sheet.getCell(2, column).value = "LINE OA";
  });

  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F8A3B" } } as const;
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" } };
  for (let column = 1; column <= matrix.dates.length + 1; column += 1) {
    for (let row = 1; row <= 2; row += 1) {
      const cell = sheet.getCell(row, column);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
    }
  }

  matrix.stores.forEach((store, rowIndex) => {
    const row = rowIndex + 3;
    sheet.getCell(row, 1).value = store.storeLabel || store.storeName;
    sheet.getCell(row, 1).alignment = { vertical: "middle", horizontal: "left" };
    matrix.dates.forEach((date, dateIndex) => {
      const cell = sheet.getCell(row, dateIndex + 2);
      cell.value = store.values[date];
      cell.alignment = { vertical: "middle", horizontal: "center" };
      if (store.values[date] === null) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
      }
    });
  });

  sheet.getColumn(1).width = 44;
  for (let column = 2; column <= matrix.dates.length + 1; column += 1) sheet.getColumn(column).width = 11;
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: matrix.dates.length + 1 } };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `LINE_OA_Daily_Growth_${options.dateFrom}_to_${options.dateTo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { stores: matrix.stores.length, dates: matrix.dates.length };
}
