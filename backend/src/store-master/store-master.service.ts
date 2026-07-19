import { Injectable } from "@nestjs/common";
import { StoreMasterDataQualityStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { isValidManagerUrl, normalizeSearchText, parseStoreMasterCsv, regionFromProvince, similarity } from "./store-master.utils";

@Injectable()
export class StoreMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async importCsv(csv: string, source = "GOOGLE_SHEET") {
    const parsed = parseStoreMasterCsv(csv);
    const duplicateNames = new Set(parsed.map((row) => row.normalizedAccountName).filter((name, index, all) => name && all.indexOf(name) !== index));
    await this.prisma.$transaction(parsed.map((row) => this.prisma.storeMaster.upsert({
      where: { source_sourceRowNumber: { source, sourceRowNumber: row.sourceRowNumber } },
      create: { ...row, source, region: row.region ?? regionFromProvince(row.province), dataQualityStatus: duplicateNames.has(row.normalizedAccountName) && row.dataQualityStatus === "COMPLETE" ? "DUPLICATE_ACCOUNT_NAME" : row.dataQualityStatus },
      update: { ...row, region: row.region ?? regionFromProvince(row.province), dataQualityStatus: duplicateNames.has(row.normalizedAccountName) && row.dataQualityStatus === "COMPLETE" ? "DUPLICATE_ACCOUNT_NAME" : row.dataQualityStatus, isActive: true, sourceUpdatedAt: new Date() },
    })));
    return this.validate();
  }

  async importFromConfiguredSource(csvPath?: string) {
    let csv: string;
    if (csvPath) { const { readFile } = await import("node:fs/promises"); csv = await readFile(csvPath, "utf8"); }
    else {
      const configured = process.env.STORE_MASTER_GOOGLE_SHEET_URL?.trim();
      if (!configured) throw new Error("Set STORE_MASTER_GOOGLE_SHEET_URL or provide a CSV file path");
      const match = configured.match(/\/spreadsheets\/d\/([^/]+)/u); if (!match) throw new Error("Invalid Google Sheets URL");
      const response = await fetch(`https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`); if (!response.ok) throw new Error(`Google Sheets export failed (${response.status})`); csv = await response.text();
    }
    return this.importCsv(csv);
  }

  async search(query: string, limit = 10) {
    const q = query.trim(); if (!q) return [];
    const normalized = normalizeSearchText(q);
    const candidates = await this.prisma.storeMaster.findMany({ where: { isActive: true, OR: [
      { accountName: { contains: q, mode: "insensitive" } }, { storeName: { contains: q, mode: "insensitive" } },
      { lineId: { contains: q, mode: "insensitive" } }, { province: { contains: q, mode: "insensitive" } }, { region: { contains: q, mode: "insensitive" } },
      { normalizedAccountName: { contains: normalized } },
    ] }, include: { stores: { select: { id: true, name: true } } }, take: 100 });
    if (candidates.length < limit) {
      const fuzzyPool = await this.prisma.storeMaster.findMany({ where: { isActive: true }, include: { stores: { select: { id: true, name: true } } }, take: 1000 });
      for (const item of fuzzyPool) if (!candidates.some(({ id }) => id === item.id) && similarity(normalized, item.normalizedAccountName) >= 0.52) candidates.push(item);
    }
    return candidates.map((item) => {
      const score = item.accountName.toLocaleLowerCase() === q.toLocaleLowerCase() ? 1 : item.normalizedAccountName === normalized ? 0.98 : item.normalizedAccountName.includes(normalized) ? 0.92 : similarity(normalized, item.normalizedAccountName);
      const reason = score === 1 ? "EXACT_ACCOUNT_NAME" : score >= 0.98 ? "NORMALIZED_ACCOUNT_NAME" : score >= 0.9 ? "PARTIAL_ACCOUNT_NAME" : "FUZZY_SUGGESTION";
      return { id: item.id, accountName: item.accountName, storeName: item.storeName, externalStoreId: item.externalStoreId, province: item.province, region: item.region, lineId: item.lineId, lineOaLink: item.lineOaLink, lineManagerUrl: isValidManagerUrl(item.lineManagerUrl) ? item.lineManagerUrl : null, matchScore: Number(score.toFixed(3)), matchReason: reason, dataQualityStatus: item.dataQualityStatus, existingStore: item.stores[0] ?? null };
    }).sort((a, b) => b.matchScore - a.matchScore || a.accountName.localeCompare(b.accountName)).slice(0, Math.min(Math.max(limit, 1), 50));
  }

  async validate() {
    const items = await this.prisma.storeMaster.findMany({ where: { isActive: true } });
    const duplicate = (values: Array<string | null>) => { const counts = new Map<string, number>(); for (const value of values.filter((v): v is string => Boolean(v))) counts.set(value, (counts.get(value) ?? 0) + 1); return [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0); };
    const byStatus = (status: StoreMasterDataQualityStatus) => items.filter((item) => item.dataQualityStatus === status).length;
    return { total: items.length, complete: byStatus("COMPLETE"), missingStoreId: items.filter((item) => !item.externalStoreId).length, invalidManagerUrls: items.filter((item) => Boolean(item.lineManagerUrl) && !isValidManagerUrl(item.lineManagerUrl)).length, duplicateAccountNames: duplicate(items.map((item) => item.normalizedAccountName)), missingProvince: items.filter((item) => !item.province).length, missingRegion: items.filter((item) => !item.region).length, duplicateLineIds: duplicate(items.map((item) => item.lineId)), duplicateExternalStoreIds: duplicate(items.map((item) => item.externalStoreId)), incomplete: items.filter((item) => item.dataQualityStatus !== "COMPLETE").length };
  }
}
