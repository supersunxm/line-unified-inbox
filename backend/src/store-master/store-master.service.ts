import { Injectable } from "@nestjs/common";
import { StoreMasterDataQualityStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { isValidManagerUrl, normalizeSearchText, parseStoreMasterCsv, regionFromProvince, similarity } from "./store-master.utils";

@Injectable()
export class StoreMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async importCsv(csv: string, source = "GOOGLE_SHEET") {
    const parsed = parseStoreMasterCsv(csv);
    const existingMasters = await this.prisma.storeMaster.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    const masterByExternalId = new Map<string, typeof existingMasters[0]>();
    const masterBySourceRow = new Map<number, typeof existingMasters[0]>();
    for (const m of existingMasters) {
      if (m.externalStoreId && !masterByExternalId.has(m.externalStoreId)) masterByExternalId.set(m.externalStoreId, m);
      if (m.sourceRowNumber && !masterBySourceRow.has(m.sourceRowNumber)) masterBySourceRow.set(m.sourceRowNumber, m);
    }
    const duplicateNames = new Set(parsed.map((row) => row.normalizedAccountName).filter((name, index, all) => name && name !== "ref" && all.indexOf(name) !== index));
    await this.prisma.$transaction(async (tx) => {
      for (const row of parsed) {
        const { sourceRowNumber, ...values } = row;
        const stableId = row.externalStoreId ? masterByExternalId.get(row.externalStoreId)?.id : null;
        const existingRow = stableId ? masterByExternalId.get(row.externalStoreId!) : masterBySourceRow.get(sourceRowNumber);

        let storeName = row.storeName;
        let accountName = row.accountName;
        let normalizedAccountName = row.normalizedAccountName;

        if ((storeName === "#REF!" || !storeName) && existingRow?.storeName && existingRow.storeName !== "#REF!") {
          storeName = existingRow.storeName;
        }
        if ((accountName === "#REF!" || !accountName)) {
          if (existingRow?.accountName && existingRow.accountName !== "#REF!") {
            accountName = existingRow.accountName;
            normalizedAccountName = existingRow.normalizedAccountName;
          } else if (storeName && storeName !== "#REF!") {
            accountName = storeName;
            normalizedAccountName = normalizeSearchText(storeName);
          }
        }

        const incomplete = !storeName || storeName === "#REF!" || !accountName || accountName === "#REF!";
        const dataQualityStatus = incomplete ? "INCOMPLETE" : !row.externalStoreId ? "MISSING_STORE_ID" : !isValidManagerUrl(row.lineManagerUrl) ? "INVALID_MANAGER_URL" : duplicateNames.has(normalizedAccountName) ? "DUPLICATE_ACCOUNT_NAME" : "COMPLETE";

        const data = { ...values, storeName, accountName, normalizedAccountName, region: row.region ?? regionFromProvince(row.province), dataQualityStatus: dataQualityStatus as StoreMasterDataQualityStatus, isActive: true, sourceUpdatedAt: new Date() };

        if (stableId) { await tx.storeMaster.update({ where: { id: stableId }, data }); continue; }
        await tx.storeMaster.upsert({ where: { source_sourceRowNumber: { source, sourceRowNumber } }, create: { ...data, source, sourceRowNumber }, update: data });
      }
    }, { maxWait: 15000, timeout: 60000 });
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
