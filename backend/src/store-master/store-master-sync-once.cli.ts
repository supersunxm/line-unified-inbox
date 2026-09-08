import { PrismaService } from "../prisma.service";
import { StoreMasterService } from "./store-master.service";
import { parseStoreMasterCsv } from "./store-master.utils";

function duplicateValues(values: Array<string | null>): string[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

async function fetchConfiguredMasterCsv(): Promise<string> {
  const configured = process.env.STORE_MASTER_GOOGLE_SHEET_URL?.trim();
  if (!configured) throw new Error("STORE_MASTER_GOOGLE_SHEET_URL is not configured");
  const match = configured.match(/\/spreadsheets\/d\/([^/]+)/u);
  if (!match) throw new Error("Invalid Google Sheets URL");
  const gid = configured.match(/[?&#]gid=(\d+)/u)?.[1];
  const url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Sheets export failed (${response.status})`);
  return response.text();
}

async function main() {
  const csv = await fetchConfiguredMasterCsv();
  const sourceRows = parseStoreMasterCsv(csv);
  if (sourceRows.length === 0) throw new Error("Store Master source is empty");

  const duplicateSourceStoreIds = duplicateValues(sourceRows.map((row) => row.externalStoreId));
  if (duplicateSourceStoreIds.length > 0) {
    throw new Error(
      `Store ID integrity check failed before import: duplicate Store ID(s): ${duplicateSourceStoreIds.join(", ")}`,
    );
  }

  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const activeMasterIds = await prisma.storeMaster.findMany({
      where: { isActive: true, externalStoreId: { not: null } },
      select: { externalStoreId: true },
    });
    const duplicateDbStoreIds = duplicateValues(activeMasterIds.map((row) => row.externalStoreId));
    if (duplicateDbStoreIds.length > 0) {
      throw new Error(
        `Store ID integrity check failed before sync: duplicate active StoreMaster ID(s): ${duplicateDbStoreIds.join(", ")}`,
      );
    }

    const service = new StoreMasterService(prisma);
    const result = await service.syncFromGoogleSheet();

    if (result.validation.duplicateExternalStoreIds > 0) {
      throw new Error(
        `Store ID integrity check failed: source contains ${result.validation.duplicateExternalStoreIds} duplicate Store ID row(s)`,
      );
    }
    if (result.connectedOaSync.storeIdConflicts > 0) {
      throw new Error(
        `Store ID reconciliation stopped with ${result.connectedOaSync.storeIdConflicts} Store ID conflict(s)`,
      );
    }
    if (result.connectedOaSync.failed > 0) {
      throw new Error(
        `Store ID reconciliation had ${result.connectedOaSync.failed} failed record(s)`,
      );
    }

    const stores = await prisma.store.findMany({
      where: { archivedAt: null, isActive: true, storeMasterId: { not: null } },
      select: {
        id: true,
        code: true,
        name: true,
        region: true,
        area: true,
        storeMaster: {
          select: {
            externalStoreId: true,
            storeName: true,
            region: true,
            province: true,
          },
        },
      },
    });

    const mismatches = stores.filter((store) => {
      const master = store.storeMaster;
      if (!master?.externalStoreId) return false;
      return (
        store.code?.trim() !== master.externalStoreId.trim() ||
        store.name !== master.storeName ||
        store.region !== master.region ||
        store.area !== master.province
      );
    });

    if (mismatches.length > 0) {
      throw new Error(
        `Post-sync Store ID verification failed for ${mismatches.length} linked store(s)`,
      );
    }

    console.log(JSON.stringify({
      event: "store_id_canonical_sync_verified",
      sourceRows: sourceRows.length,
      validation: result.validation,
      sync: result.connectedOaSync,
      verifiedLinkedStores: stores.length,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(
    JSON.stringify({
      event: "store_id_canonical_sync_failed",
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
