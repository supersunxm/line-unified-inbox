import { PrismaClient, StoreMaster } from "@prisma/client";
import { normalizeSearchText } from "./store-master.utils";

export type StoreMasterSyncReport = {
  processed: number;
  updated: number;
  unchanged: number;
  missingStoreMaster: number;
  failed: number;
  storeMetadataUpdated: number;
  storeIdConflicts: number;
};

type StoreTarget = {
  id: string;
  code: string | null;
  name: string;
  region: string | null;
  area: string | null;
  storeMasterId: string | null;
};

async function uniqueMasterByExternalStoreId(
  prisma: PrismaClient,
  externalStoreId: string | null,
): Promise<StoreMaster | null> {
  const storeId = externalStoreId?.trim();
  if (!storeId) return null;
  const matches = await prisma.storeMaster.findMany({
    where: { isActive: true, externalStoreId: storeId },
    orderBy: { updatedAt: "desc" },
    take: 2,
  });
  return matches.length === 1 ? matches[0] : null;
}

async function uniqueMasterByLineIdentity(
  prisma: PrismaClient,
  basicId: string | null,
): Promise<StoreMaster | null> {
  const lineId = basicId?.trim();
  if (!lineId) return null;
  const matches = await prisma.storeMaster.findMany({
    where: { isActive: true, lineId: { equals: lineId, mode: "insensitive" } },
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

function toTarget(store: StoreTarget): StoreTarget {
  return {
    id: store.id,
    code: store.code,
    name: store.name,
    region: store.region,
    area: store.area,
    storeMasterId: store.storeMasterId,
  };
}

async function reconcileStoreMetadataByStoreId(
  prisma: PrismaClient,
  dryRun: boolean,
  report: StoreMasterSyncReport,
): Promise<void> {
  const stores = await prisma.store.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      region: true,
      area: true,
      storeMasterId: true,
      storeMaster: {
        select: {
          id: true,
          externalStoreId: true,
          storeName: true,
          region: true,
          province: true,
          isActive: true,
        },
      },
    },
  });

  for (const store of stores) {
    try {
      let master: Pick<StoreMaster, "id" | "externalStoreId" | "storeName" | "region" | "province"> | null =
        store.storeMaster?.isActive ? store.storeMaster : null;
      if (!master && store.code?.trim()) {
        master = await uniqueMasterByExternalStoreId(prisma, store.code);
      }
      if (!master) continue;

      const canonicalStoreId = master.externalStoreId?.trim() || null;
      if (!canonicalStoreId) continue;

      let nextCode = store.code?.trim() || null;
      if (nextCode !== canonicalStoreId) {
        const occupied = await prisma.store.findUnique({
          where: { code: canonicalStoreId },
          select: { id: true },
        });
        if (occupied && occupied.id !== store.id) {
          report.storeIdConflicts++;
        } else {
          nextCode = canonicalStoreId;
        }
      }

      const changed =
        store.storeMasterId !== master.id ||
        store.code !== nextCode ||
        store.name !== master.storeName ||
        store.region !== master.region ||
        store.area !== master.province;
      if (!changed) continue;

      report.storeMetadataUpdated++;
      if (dryRun) continue;

      await prisma.store.update({
        where: { id: store.id },
        data: {
          storeMasterId: master.id,
          code: nextCode,
          name: master.storeName,
          region: master.region,
          area: master.province,
          provinceSource: "MASTER",
          regionSource: master.region ? "MASTER" : "PROVINCE_MAPPING",
        },
      });
    } catch {
      report.failed++;
    }
  }
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
    storeMetadataUpdated: 0,
    storeIdConflicts: 0,
  };

  // Store ID is canonical. Repair Store metadata first so all downstream lookups
  // and exports see the Store Master values for that exact branch identifier.
  await reconcileStoreMetadataByStoreId(prisma, dryRun, report);

  const accounts = await prisma.lineOfficialAccount.findMany({
    where: { archivedAt: null, accountType: "STORE", storeId: { not: null } },
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
          storeMaster: { select: { externalStoreId: true } },
        },
      },
    },
  });

  for (const account of accounts) {
    if (!account.store) continue;
    report.processed++;

    try {
      const currentCode = account.store.code?.trim() || null;
      const linkedMasterStoreId = account.store.storeMaster?.externalStoreId?.trim() || null;
      const hasCanonicalStoreIdentity = Boolean(
        account.store.storeMasterId || linkedMasterStoreId || currentCode,
      );

      let master: StoreMaster | null = null;
      if (account.store.storeMasterId) {
        master = await prisma.storeMaster.findFirst({
          where: { id: account.store.storeMasterId, isActive: true },
        });
      }
      if (!master && linkedMasterStoreId) {
        master = await uniqueMasterByExternalStoreId(prisma, linkedMasterStoreId);
      }
      if (!master && currentCode) {
        master = await uniqueMasterByExternalStoreId(prisma, currentCode);
      }

      // LINE identity is only a legacy recovery path when the Store has no Store ID.
      // It can never move an already identified branch to a different Store ID.
      if (!master && !hasCanonicalStoreIdentity) {
        master = await uniqueMasterByLineIdentity(prisma, account.basicId);
        if (!master) master = await uniqueMasterByAccountName(prisma, account.name);
      }
      if (!master) {
        report.missingStoreMaster++;
        continue;
      }

      const masterCode = master.externalStoreId?.trim() || null;
      let targetStore: StoreTarget = toTarget(account.store);
      if (!hasCanonicalStoreIdentity && masterCode) {
        const recovered = await prisma.store.findFirst({
          where: {
            archivedAt: null,
            OR: [{ storeMasterId: master.id }, { code: masterCode }],
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
        if (recovered) targetStore = recovered;
      }

      const targetCode = masterCode || targetStore.code?.trim() || null;
      const metadataChanged =
        targetStore.storeMasterId !== master.id ||
        targetStore.code !== targetCode ||
        targetStore.name !== master.storeName ||
        targetStore.region !== master.region ||
        targetStore.area !== master.province;
      const accountNeedsRebind = !hasCanonicalStoreIdentity && targetStore.id !== account.store.id;

      if (!metadataChanged && !accountNeedsRebind) {
        report.unchanged++;
        continue;
      }

      report.updated++;
      if (dryRun) continue;

      if (metadataChanged) {
        if (targetCode && targetCode !== targetStore.code) {
          const occupied = await prisma.store.findUnique({
            where: { code: targetCode },
            select: { id: true },
          });
          if (occupied && occupied.id !== targetStore.id) {
            report.storeIdConflicts++;
            continue;
          }
        }

        await prisma.store.update({
          where: { id: targetStore.id },
          data: {
            storeMasterId: master.id,
            code: targetCode,
            name: master.storeName,
            region: master.region,
            area: master.province,
            provinceSource: "MASTER",
            regionSource: master.region ? "MASTER" : "PROVINCE_MAPPING",
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
