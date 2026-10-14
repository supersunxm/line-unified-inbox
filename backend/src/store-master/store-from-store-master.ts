import { Prisma } from "@prisma/client";

export type StoreMasterStoreSource = {
  id: string;
  storeName: string;
  externalStoreId: string | null;
  region: string | null;
  province: string | null;
};

function storeDataFromMaster(master: StoreMasterStoreSource) {
  return {
    name: master.storeName,
    code: master.externalStoreId,
    region: master.region,
    area: master.province,
    storeMasterId: master.id,
    provinceSource: "MASTER" as const,
    regionSource: master.region ? "MASTER" as const : "PROVINCE_MAPPING" as const,
  };
}

/**
 * Creates the Store for a Store Master record (or reuses the already-linked Store) and
 * re-applies the canonical Store Master identity to it. Shared by LINE OA onboarding and
 * the handover importer so both paths create Stores identically.
 */
export async function upsertStoreFromStoreMaster(
  tx: Prisma.TransactionClient,
  master: StoreMasterStoreSource,
  existingStoreId: string | null,
): Promise<string> {
  const data = storeDataFromMaster(master);
  const storeId = existingStoreId ?? (await tx.store.create({ data })).id;
  await tx.store.update({
    where: { id: storeId },
    data: { ...data, isActive: true, archivedAt: null },
  });
  return storeId;
}
