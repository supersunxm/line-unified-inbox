import type { FriendSourceLink } from "@/types/api";
import { getFriendSourceLinksText, type Language } from "./friend-source-links-translations.ts";
import { formatConversionRate } from "./friend-source-links-utils.ts";

export type StoreDistributionRow = {
  storeName: string;
  storeCode: string;
  lineOaName: string;
  basicId: string;
  qrLink: string;
  tiktokLink: string;
  facebookLink: string;
  instagramLink: string;
  activeSourcesCount: number;
  totalClicks: number;
  identifiedVisits: number;
  confirmedAdds: number;
  conversionRate: string;
  generatedAt: string;
};

export type LinkDetailRow = {
  storeName: string;
  storeCode: string;
  lineOaName: string;
  source: string;
  shortUrl: string;
  clicks: number;
  identifiedVisits: number;
  confirmedAdds: number;
  conversionRate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Deduplicates links by link ID.
 */
export function deduplicateLinks(links: FriendSourceLink[]): FriendSourceLink[] {
  const seen = new Set<string>();
  const result: FriendSourceLink[] = [];
  for (const link of links) {
    if (!link.id || seen.has(link.id)) continue;
    seen.add(link.id);
    result.push(link);
  }
  return result;
}

/**
 * Formats a date value into yyyy-mm-dd hh:mm string.
 */
export function formatDateForExcel(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Generates export filename with current date: friend-source-links-YYYY-MM-DD.xlsx
 */
export function buildExportFilename(overrideDateStr?: string): string {
  if (overrideDateStr) {
    return `friend-source-links-${overrideDateStr}.xlsx`;
  }
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `friend-source-links-${yyyy}-${mm}-${dd}.xlsx`;
}

/**
 * Pivots individual source links into one summary row per store / LINE OA for Sheet 1.
 */
export function pivotLinksByStore(links: FriendSourceLink[]): StoreDistributionRow[] {
  const cleanLinks = deduplicateLinks(links);
  const map = new Map<
    string,
    {
      storeName: string;
      storeCode: string;
      lineOaName: string;
      basicId: string;
      qrLink: string;
      tiktokLink: string;
      facebookLink: string;
      instagramLink: string;
      activeSourcesCount: number;
      totalClicks: number;
      identifiedVisits: number;
      confirmedAdds: number;
      earliestCreatedAt: Date | null;
    }
  >();

  for (const link of cleanLinks) {
    const key = link.lineOaId || `${link.storeId}:${link.lineOaName}`;
    let item = map.get(key);
    if (!item) {
      item = {
        storeName: link.storeName ?? "",
        storeCode: link.storeCode ?? "",
        lineOaName: link.lineOaName ?? "",
        basicId: link.lineOaId ? (link.storeCode ? `@${link.storeCode}` : "") : "",
        qrLink: "",
        tiktokLink: "",
        facebookLink: "",
        instagramLink: "",
        activeSourcesCount: 0,
        totalClicks: 0,
        identifiedVisits: 0,
        confirmedAdds: 0,
        earliestCreatedAt: null,
      };
      map.set(key, item);
    }

    if (link.storeName) item.storeName = link.storeName;
    if (link.storeCode) item.storeCode = link.storeCode;
    if (link.lineOaName) item.lineOaName = link.lineOaName;

    // Source link mapping
    if (link.source === "STORE_QR") item.qrLink = link.shortUrl;
    else if (link.source === "TIKTOK") item.tiktokLink = link.shortUrl;
    else if (link.source === "FACEBOOK") item.facebookLink = link.shortUrl;
    else if (link.source === "INSTAGRAM") item.instagramLink = link.shortUrl;

    if (link.isActive) {
      item.activeSourcesCount += 1;
    }

    item.totalClicks += link.clickCount || 0;
    item.identifiedVisits += link.identifiedVisits || 0;
    item.confirmedAdds += link.confirmedAdds || 0;

    if (link.createdAt) {
      const dt = new Date(link.createdAt);
      if (!isNaN(dt.getTime())) {
        if (!item.earliestCreatedAt || dt < item.earliestCreatedAt) {
          item.earliestCreatedAt = dt;
        }
      }
    }
  }

  // Convert to array and sort by Store Name asc, then LINE OA Name asc
  const rows: StoreDistributionRow[] = Array.from(map.values()).map((item) => {
    const rate = formatConversionRate(item.totalClicks > 0 ? item.confirmedAdds / item.totalClicks : 0);
    return {
      storeName: item.storeName,
      storeCode: item.storeCode,
      lineOaName: item.lineOaName,
      basicId: item.basicId,
      qrLink: item.qrLink,
      tiktokLink: item.tiktokLink,
      facebookLink: item.facebookLink,
      instagramLink: item.instagramLink,
      activeSourcesCount: item.activeSourcesCount,
      totalClicks: item.totalClicks,
      identifiedVisits: item.identifiedVisits,
      confirmedAdds: item.confirmedAdds,
      conversionRate: rate,
      generatedAt: formatDateForExcel(item.earliestCreatedAt),
    };
  });

  rows.sort((a, b) => {
    const storeCmp = a.storeName.localeCompare(b.storeName);
    if (storeCmp !== 0) return storeCmp;
    return a.lineOaName.localeCompare(b.lineOaName);
  });

  return rows;
}

/**
 * Maps links for Sheet 2: Link Details.
 */
export function prepareLinkDetailsRows(
  links: FriendSourceLink[],
  language: Language
): LinkDetailRow[] {
  const t = getFriendSourceLinksText(language);
  const cleanLinks = deduplicateLinks(links);

  const sourceLabels: Record<string, string> = {
    STORE_QR: t.sourceStoreQr,
    TIKTOK: t.sourceTikTok,
    FACEBOOK: t.sourceFacebook,
    INSTAGRAM: t.sourceInstagram,
  };

  return cleanLinks.map((link) => {
    const clicks = link.clickCount || 0;
    const confirmed = link.confirmedAdds || 0;
    const rate = link.conversionRate != null ? formatConversionRate(link.conversionRate) : formatConversionRate(clicks > 0 ? confirmed / clicks : 0);
    return {
      storeName: link.storeName ?? "",
      storeCode: link.storeCode ?? "",
      lineOaName: link.lineOaName ?? "",
      source: sourceLabels[link.source] ?? link.source,
      shortUrl: link.shortUrl,
      clicks,
      identifiedVisits: link.identifiedVisits || 0,
      confirmedAdds: confirmed,
      conversionRate: rate,
      status: link.isActive ? t.statusActive : t.statusInactive,
      createdAt: formatDateForExcel(link.createdAt),
      updatedAt: formatDateForExcel(link.updatedAt),
    };
  });
}

/**
 * Dynamically imports ExcelJS and creates a professional formatted .xlsx Workbook buffer.
 */
export async function createExcelWorkbookBuffer(
  links: FriendSourceLink[],
  language: Language
): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const t = getFriendSourceLinksText(language);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OPPO LINE OA Monitor";
  workbook.created = new Date();

  // Header Style Definition
  const headerFill: import("exceljs").Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // Dark Slate 800
  };
  const headerFont: Partial<import("exceljs").Font> = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  const thinBorder: Partial<import("exceljs").Borders> = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };
  const hyperlinkFont: Partial<import("exceljs").Font> = {
    name: "Calibri",
    size: 11,
    color: { argb: "FF2563EB" },
    underline: true,
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Sheet 1: Store Distribution
  // ──────────────────────────────────────────────────────────────────────────
  const sheet1 = workbook.addWorksheet("Store Distribution", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  });

  const distHeaders = [
    t.excelStoreName,
    t.excelStoreCode,
    t.excelLineOaName,
    t.excelBasicId,
    t.excelStoreQrLink,
    t.excelTikTokLink,
    t.excelFacebookLink,
    t.excelInstagramLink,
    t.excelActiveSources,
    t.excelTotalClicks,
    t.excelIdentifiedVisits,
    t.excelConfirmedAdds,
    t.excelConversionRate,
    t.excelGeneratedAt,
  ];

  sheet1.columns = [
    { header: distHeaders[0], key: "storeName", width: 26 },
    { header: distHeaders[1], key: "storeCode", width: 14 },
    { header: distHeaders[2], key: "lineOaName", width: 24 },
    { header: distHeaders[3], key: "basicId", width: 16 },
    { header: distHeaders[4], key: "qrLink", width: 36 },
    { header: distHeaders[5], key: "tiktokLink", width: 36 },
    { header: distHeaders[6], key: "facebookLink", width: 36 },
    { header: distHeaders[7], key: "instagramLink", width: 36 },
    { header: distHeaders[8], key: "activeSourcesCount", width: 16 },
    { header: distHeaders[9], key: "totalClicks", width: 14 },
    { header: distHeaders[10], key: "identifiedVisits", width: 16 },
    { header: distHeaders[11], key: "confirmedAdds", width: 16 },
    { header: distHeaders[12], key: "conversionRate", width: 18 },
    { header: distHeaders[13], key: "generatedAt", width: 18 },
  ];

  // Apply header styling
  const row1 = sheet1.getRow(1);
  row1.height = 26;
  row1.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  const pivotedRows = pivotLinksByStore(links);
  pivotedRows.forEach((item) => {
    const row = sheet1.addRow({
      storeName: item.storeName,
      storeCode: item.storeCode,
      lineOaName: item.lineOaName,
      basicId: item.basicId,
      activeSourcesCount: item.activeSourcesCount,
      totalClicks: item.totalClicks,
      identifiedVisits: item.identifiedVisits,
      confirmedAdds: item.confirmedAdds,
      conversionRate: item.conversionRate,
      generatedAt: item.generatedAt,
    });

    // Helper for adding hyperlink cell
    const setLinkCell = (colIdx: number, url: string) => {
      if (url) {
        const cell = row.getCell(colIdx);
        cell.value = { text: url, hyperlink: url };
        cell.font = hyperlinkFont;
        cell.alignment = { wrapText: true, vertical: "middle" };
      }
    };

    setLinkCell(5, item.qrLink);
    setLinkCell(6, item.tiktokLink);
    setLinkCell(7, item.facebookLink);
    setLinkCell(8, item.instagramLink);

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      if (!cell.alignment) {
        cell.alignment = { vertical: "middle" };
      }
    });
  });

  if (pivotedRows.length > 0) {
    sheet1.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: pivotedRows.length + 1, column: 14 },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sheet 2: Link Details
  // ──────────────────────────────────────────────────────────────────────────
  const sheet2 = workbook.addWorksheet("Link Details", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  });

  const detailHeaders = [
    t.excelStoreName,
    t.excelStoreCode,
    t.excelLineOaName,
    t.excelSource,
    t.excelShortLink,
    t.excelClicks,
    t.excelIdentifiedVisits,
    t.excelConfirmedAdds,
    t.excelConversionRate,
    t.excelStatus,
    t.excelCreatedAt,
    t.excelUpdatedAt,
  ];

  sheet2.columns = [
    { header: detailHeaders[0], key: "storeName", width: 26 },
    { header: detailHeaders[1], key: "storeCode", width: 14 },
    { header: detailHeaders[2], key: "lineOaName", width: 24 },
    { header: detailHeaders[3], key: "source", width: 16 },
    { header: detailHeaders[4], key: "shortUrl", width: 38 },
    { header: detailHeaders[5], key: "clicks", width: 12 },
    { header: detailHeaders[6], key: "identifiedVisits", width: 16 },
    { header: detailHeaders[7], key: "confirmedAdds", width: 16 },
    { header: detailHeaders[8], key: "conversionRate", width: 16 },
    { header: detailHeaders[9], key: "status", width: 14 },
    { header: detailHeaders[10], key: "createdAt", width: 18 },
    { header: detailHeaders[11], key: "updatedAt", width: 18 },
  ];

  const sheet2Row1 = sheet2.getRow(1);
  sheet2Row1.height = 26;
  sheet2Row1.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  const detailRows = prepareLinkDetailsRows(links, language);
  detailRows.forEach((item) => {
    const row = sheet2.addRow({
      storeName: item.storeName,
      storeCode: item.storeCode,
      lineOaName: item.lineOaName,
      source: item.source,
      clicks: item.clicks,
      identifiedVisits: item.identifiedVisits,
      confirmedAdds: item.confirmedAdds,
      conversionRate: item.conversionRate,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });

    const urlCell = row.getCell(5);
    urlCell.value = { text: item.shortUrl, hyperlink: item.shortUrl };
    urlCell.font = hyperlinkFont;
    urlCell.alignment = { wrapText: true, vertical: "middle" };

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      if (!cell.alignment) {
        cell.alignment = { vertical: "middle" };
      }
    });
  });

  if (detailRows.length > 0) {
    sheet2.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: detailRows.length + 1, column: 12 },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sheet 3: Instructions
  // ──────────────────────────────────────────────────────────────────────────
  const sheet3 = workbook.addWorksheet("Instructions");
  sheet3.columns = [
    { key: "item", width: 28 },
    { key: "description", width: 80 },
  ];

  const instTitleRow = sheet3.addRow([t.excelInstTitle, ""]);
  instTitleRow.height = 28;
  const titleCell = instTitleRow.getCell(1);
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF1E293B" } };

  sheet3.addRow(["", ""]); // Blank line

  const instructionsList = [
    [t.excelInstQrTitle, t.excelInstQrDesc],
    [t.excelInstTiktokTitle, t.excelInstTiktokDesc],
    [t.excelInstFbTitle, t.excelInstFbDesc],
    [t.excelInstIgTitle, t.excelInstIgDesc],
    [t.excelInstRuleTitle, t.excelInstRuleDesc],
    [t.excelInstNoMixTitle, t.excelInstNoMixDesc],
    [t.excelInstTrackingTitle, t.excelInstTrackingDesc],
    [t.excelInstLiffTitle, t.excelInstLiffDesc],
  ];

  instructionsList.forEach(([item, desc]) => {
    const row = sheet3.addRow({ item, description: desc });
    row.height = 24;
    const c1 = row.getCell(1);
    const c2 = row.getCell(2);
    c1.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF334155" } };
    c2.font = { name: "Calibri", size: 11, color: { argb: "FF475569" } };
    c1.alignment = { vertical: "middle" };
    c2.alignment = { vertical: "middle", wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

/**
 * Triggers a browser file download using Blob & object URL.
 */
export function triggerBrowserDownload(data: Uint8Array | ArrayBuffer | BlobPart, filename: string): void {
  const blob = new Blob([data as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
