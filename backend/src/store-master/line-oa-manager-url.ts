import { PrismaService } from "../prisma.service";
import { isValidManagerUrl } from "./store-master.utils";

export type ManagerUrlStore = { code: string | null; storeMaster: { lineManagerUrl: string | null } | null };
export type LatestManagerUrlMap = ReadonlyMap<string, string | null>;

export async function loadLatestManagerUrls(prisma: PrismaService, storeCodes: Iterable<string | null>): Promise<Map<string, string | null>> {
  const codes = [...new Set([...storeCodes].filter((code): code is string => Boolean(code)))];
  if (codes.length === 0) return new Map();
  const rows = await prisma.storeMaster.findMany({
    where: { externalStoreId: { in: codes }, isActive: true },
    orderBy: { updatedAt: "desc" },
    select: { externalStoreId: true, lineManagerUrl: true },
  });
  const latest = new Map<string, string | null>();
  for (const row of rows) {
    if (row.externalStoreId && !latest.has(row.externalStoreId)) latest.set(row.externalStoreId, row.lineManagerUrl);
  }
  return latest;
}

export function resolveLineOaManagerUrl(store: ManagerUrlStore, latestByStoreCode: LatestManagerUrlMap): string | null {
  const latest = store.code ? latestByStoreCode.get(store.code) ?? null : null;
  if (isValidManagerUrl(latest)) return latest;
  return isValidManagerUrl(store.storeMaster?.lineManagerUrl ?? null) ? store.storeMaster!.lineManagerUrl : null;
}
