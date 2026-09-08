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

async function uniqueMasterByExternalStoreId(
  prisma: PrismaClient,
  externalStoreId: string | null,
): Promise<StoreMaster | null> {
  const storeId = externalStoreId?.trim();
  if (!storeId) return null;
  const matches = await prisma.storeMaster.findMany({
    where: {
      isActive: true,
      externalStoreId: storeId,
    },
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

/**
 * Store ID is the canonical branch identity.
 *
 * This pass repairs Store metadata from the Store Master row already identified by
 * the branch's canonical Store ID / StoreMaster relation. LINE Basic ID and account
 * name are deliberately NOT used here, because they may change or be duplicated and
 * must never move a physical branch to another Store ID.
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
      let master = store.storeMaster?.isActive ? store.storeMaster : null;
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
          // Never silently swap/overwrite Store IDs. Surface the conflict and leave
          // the identifier untouched for explicit investigation.
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

  // Repair every Store first so every downstream lookup/export that reads Store
  // metadata sees the Store Master values for that exact Store ID.
  await reconcileStoreMetadataByStoreId(prisma, dryRun, report);

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
          storeMaster: {
            select: { externalStoreId: true },
          },
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

      // Store ID / existing StoreMaster relation is authoritative. LINE identity is
      // only a recovery fallback for legacy records that have no Store ID at all.
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

      const hasCanonicalStoreIdentity = Boolean(
        account.store.storeMasterId || linkedMasterStoreId || currentCode,
      );

      if (!master && !hasCanonicalStoreIdentity) {
        master = await uniqueMasterByLineIdentity(prisma, account.basicId);
        if (!master) master = await uniqueMasterByAccountName(prisma, account.name);
      }

      if (!master) {
        report.missingStoreMaster++;
        continue;
      }

      const masterCode = master.externalStoreId?.trim() || null;
      const region = master.region;
      const area = master.province;

      // Once a Store ID exists, never move the OA to another branch based on LINE
      // Basic ID or account name. Keep the current physical Store and refresh metadata.
      let targetStore = account.store;
      if (!hasCanonicalStoreIdentity && masterCode) {
        const recoveredTarget = await prisma.store.findFirst({
          where: {
            archivedAt: null,
            OR: [
              { storeMasterId: master.id },
              { code: masterCode },
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
        if (recoveredTarget) targetStore = recoveredTarget;
      }

      const targetCode = masterCode || targetStore.code?.trim() || null;
      const storeMetadataChanged =
        targetStore.storeMasterId !== master.id ||
        targetStore.code !== targetCode ||
        targetStore.name !== master.storeName ||
        targetStore.region !== region ||
        targetStore.area !== area;
      const accountNeedsRebind = !hasCanonicalStoreIdentity && targetStore.id !== account.store.id;

      if (!storeMetadataChanged && !accountNeedsRebind) {
        report.unchanged++;
        continue;
      }

      report.updated++;
      if (dryRun) continue;

      if (storeMetadataChanged) {
        // Guard against an accidental Store ID collision. The identifier must never
        // be overwritten or swapped silently.
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
