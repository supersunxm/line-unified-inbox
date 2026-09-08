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

/**
 * Reconcile Store metadata using Store.code as the canonical Store ID.
 *
 * If Store.code exists, it always wins over an existing StoreMaster relation.
 * The relation may be stale; the Store ID must never be rewritten to match it.
 * Only legacy Stores without a Store ID may recover identity from StoreMaster.
 */
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
      const currentStoreId = store.code?.trim() || null;
      let master: Pick<StoreMaster, "id" | "externalStoreId" | "storeName" | "region" | "province"> | null = null;

      // Canonical rule: an existing Store ID wins over every other identifier.
      if (currentStoreId) {
        master = await uniqueMasterByExternalStoreId(prisma, currentStoreId);
        if (!master) {
          report.missingStoreMaster++;
          continue;
        }
      } else if (store.storeMaster?.isActive) {
        master = store.storeMaster;
      }
      if (!master) continue;

      const canonicalStoreId = master.externalStoreId?.trim() || null;
      if (!canonicalStoreId) continue;

      // Never alter an established Store ID to follow a stale relation.
      // Filling an empty legacy Store.code is allowed only when the canonical ID is free.
      let nextCode = currentStoreId;
      if (!nextCode) {
        const occupied = await prisma.store.findUnique({
          where: { code: canonicalStoreId },
          select: { id: true },
        });
        if (occupied && occupied.id !== store.id) {
          report.storeIdConflicts++;
          continue;
        }
        nextCode = canonicalStoreId;
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
      const currentStoreId = account.store.code?.trim() || null;
      const linkedMasterStoreId = account.store.storeMaster?.externalStoreId?.trim() || null;
      const hasCanonicalStoreIdentity = Boolean(currentStoreId);

      let master: StoreMaster | null = null;

      // Same invariant as Store reconciliation: Store ID wins over stale relation.
      if (currentStoreId) {
        master = await uniqueMasterByExternalStoreId(prisma, currentStoreId);
      } else if (account.store.storeMasterId) {
        master = await prisma.storeMaster.findFirst({
          where: { id: account.store.storeMasterId, isActive: true },
        });
      }
      if (!master && !currentStoreId && linkedMasterStoreId) {
        master = await uniqueMasterByExternalStoreId(prisma, linkedMasterStoreId);
      }

      // LINE identity is a final legacy recovery path only when Store ID is absent.
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

      // Established Store ID never changes. Empty legacy code may be filled.
      const targetCode = targetStore.code?.trim() || masterCode;
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
        if (!targetStore.code && targetCode) {
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
