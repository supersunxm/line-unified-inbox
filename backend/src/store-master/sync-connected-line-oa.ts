import { PrismaClient, StoreMaster } from "@prisma/client";
import { normalizeSearchText } from "./store-master.utils";

export type StoreMasterSyncReport = {
  processed: number;
  updated: number;
  unchanged: number;
  missingStoreMaster: number;
  failed: number;
};

async function uniqueMasterByLineIdentity(
  prisma: PrismaClient,
  basicId: string | null,
): Promise<StoreMaster | null> {
  const lineId = basicId?.trim();
  if (!lineId) return null;
  const matches = await prisma.storeMaster.findMany({
    where: {
      isActive: true,
      lineId: { equals: lineId, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    take: 2,
  });
  return matches.length === 1 ? matches[0] : null;
}

async function uniqueMasterByAccountName(
  prisma: PrismaClient,
  accountName: string,
): Promise<StoreMaster | null> {
  const normalized = normalizeSearchText(accountName);
  if (!normalized) return null;
  const matches = await prisma.storeMaster.findMany({
    where: { isActive: true, normalizedAccountName: normalized },
    orderBy: { updatedAt: "desc" },
    take: 2,
  });
  return matches.length === 1 ? matches[0] : null;
}

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
      name: true,
      basicId: true,
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

      // The LINE OA itself is the strongest identity. A store relationship can be wrong,
      // while the OA Basic ID / account name still identifies the real Store Master row.
      let master = await uniqueMasterByLineIdentity(prisma, account.basicId);
      if (!master) master = await uniqueMasterByAccountName(prisma, account.name);

      // Preserve legacy behavior when LINE identity is unavailable or ambiguous.
      if (!master && account.store.storeMasterId) {
        master = await prisma.storeMaster.findFirst({
          where: { id: account.store.storeMasterId, isActive: true },
        });
      }
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

      const masterCode = master.externalStoreId?.trim() || null;
      const region = master.region;
      const area = master.province;

      // Prefer the existing Store row already linked to this Store Master / Store ID.
      // This lets an OA that was attached to the wrong store be moved without mutating
      // that wrong store into a different physical branch.
      let targetStore = await prisma.store.findFirst({
        where: {
          archivedAt: null,
          OR: [
            { storeMasterId: master.id },
            ...(masterCode ? [{ code: masterCode }] : []),
          ],
        },
        select: {
          id: true,
          code: true,
          name: true,
          region: true,
          area: true,
          storeMasterId: true,
        },
      });

      if (!targetStore) {
        const currentCanBeRelinked =
          !account.store.storeMasterId || account.store.storeMasterId === master.id;
        if (currentCanBeRelinked) {
          targetStore = account.store;
        } else if (!dryRun) {
          targetStore = await prisma.store.create({
            data: {
              storeMasterId: master.id,
              code: masterCode,
              name: master.storeName,
              region,
              area,
              provinceSource: "MASTER",
              regionSource: region ? "MASTER" : "PROVINCE_MAPPING",
            },
            select: {
              id: true,
              code: true,
              name: true,
              region: true,
              area: true,
              storeMasterId: true,
            },
          });
        } else {
          report.updated++;
          continue;
        }
      }

      // If the source row is temporarily missing Store ID, preserve the ID already held
      // by the correct target store instead of copying an ID from a wrongly linked store.
      const targetCode =
        masterCode || targetStore.code?.trim() ||
        (targetStore.id === account.store.id ? currentCode : null);
      const storeMetadataChanged =
        targetStore.storeMasterId !== master.id ||
        targetStore.code !== targetCode ||
        targetStore.name !== master.storeName ||
        targetStore.region !== region ||
        targetStore.area !== area;
      const accountNeedsRebind = targetStore.id !== account.store.id;

      if (!storeMetadataChanged && !accountNeedsRebind) {
        report.unchanged++;
        continue;
      }

      report.updated++;
      if (dryRun) continue;

      if (storeMetadataChanged) {
        await prisma.store.update({
          where: { id: targetStore.id },
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

      if (accountNeedsRebind) {
        await prisma.lineOfficialAccount.update({
          where: { id: account.id },
          data: { storeId: targetStore.id },
        });
        await prisma.conversation.updateMany({
          where: { lineOfficialAccountId: account.id },
          data: { storeId: targetStore.id },
        });
      }
    } catch {
      report.failed++;
    }
  }

  return report;
}
