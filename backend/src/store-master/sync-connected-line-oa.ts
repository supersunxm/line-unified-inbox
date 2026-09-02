import { PrismaClient } from "@prisma/client";

export type StoreMasterSyncReport = {
  processed: number;
  updated: number;
  unchanged: number;
  missingStoreMaster: number;
  failed: number;
};

export async function syncConnectedLineOaMetadata(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<StoreMasterSyncReport> {
  const report: StoreMasterSyncReport = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    missingStoreMaster: 0,
    failed: 0,
  };

  const accounts = await prisma.lineOfficialAccount.findMany({
    where: {
      archivedAt: null,
      accountType: "STORE",
      storeId: { not: null },
    },
    select: {
      id: true,
      store: {
        select: {
          id: true,
          code: true,
          name: true,
          region: true,
          area: true,
          storeMasterId: true,
        },
      },
    },
  });

  for (const account of accounts) {
    if (!account.store) continue;
    report.processed++;

    try {
      const currentCode = account.store.code?.trim() || null;

      // The Store Master relation is the canonical identity once a store has been linked.
      // A Store ID can be corrected in the source sheet, so using Store.code alone would
      // keep looking up the old Store ID and leave copied metadata stale forever.
      let master = account.store.storeMasterId
        ? await prisma.storeMaster.findFirst({
            where: { id: account.store.storeMasterId, isActive: true },
          })
        : null;

      // Backward-compatible fallback for stores that have not been linked to Store Master yet.
      if (!master && currentCode) {
        master = await prisma.storeMaster.findFirst({
          where: { externalStoreId: currentCode, isActive: true },
          orderBy: { updatedAt: "desc" },
        });
      }

      if (!master) {
        report.missingStoreMaster++;
        continue;
      }

      // Do not erase a previously known Store ID when the source row is temporarily incomplete.
      const targetCode = master.externalStoreId?.trim() || currentCode;
      const region = master.region;
      const area = master.province;
      const changed =
        account.store.storeMasterId !== master.id ||
        account.store.code !== targetCode ||
        account.store.name !== master.storeName ||
        account.store.region !== region ||
        account.store.area !== area;

      if (!changed) {
        report.unchanged++;
        continue;
      }

      report.updated++;
      if (!dryRun) {
        await prisma.store.update({
          where: { id: account.store.id },
          data: {
            storeMasterId: master.id,
            code: targetCode,
            name: master.storeName,
            region,
            area,
            provinceSource: "MASTER",
            regionSource: region ? "MASTER" : "PROVINCE_MAPPING",
          },
        });
      }
    } catch {
      report.failed++;
    }
  }

  return report;
}
