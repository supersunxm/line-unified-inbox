import { PrismaClient } from "@prisma/client";

export type StoreMasterSyncReport = { processed: number; updated: number; unchanged: number; missingStoreMaster: number; failed: number };

export async function syncConnectedLineOaMetadata(prisma: PrismaClient, dryRun: boolean): Promise<StoreMasterSyncReport> {
  const report: StoreMasterSyncReport = { processed: 0, updated: 0, unchanged: 0, missingStoreMaster: 0, failed: 0 };
  const accounts = await prisma.lineOfficialAccount.findMany({ where: { archivedAt: null, accountType: "STORE", storeId: { not: null } }, select: { id: true, store: { select: { id: true, code: true, name: true, region: true, area: true, storeMasterId: true } } } });
  for (const account of accounts) {
    if (!account.store) continue;
    report.processed++;
    try {
      const stableStoreId = account.store.code?.trim();
      if (!stableStoreId) { report.missingStoreMaster++; continue; }
      const master = await prisma.storeMaster.findFirst({ where: { externalStoreId: stableStoreId, isActive: true }, orderBy: { updatedAt: "desc" } });
      if (!master) { report.missingStoreMaster++; continue; }
      const region = master.region; const area = master.province;
      const changed = account.store.storeMasterId !== master.id || account.store.name !== master.storeName || account.store.region !== region || account.store.area !== area;
      if (!changed) { report.unchanged++; continue; }
      report.updated++;
      if (!dryRun) await prisma.store.update({ where: { id: account.store.id }, data: { storeMasterId: master.id, name: master.storeName, region, area, provinceSource: "MASTER", regionSource: region ? "MASTER" : "PROVINCE_MAPPING" } });
    } catch { report.failed++; }
  }
  return report;
}
