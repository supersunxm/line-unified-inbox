import { PrismaService } from "../prisma.service";
import { isValidManagerUrl } from "./store-master.utils";

export type ManagerUrlStore = { code: string | null; storeMaster: { lineManagerUrl: string | null } | null };

export async function resolveLineOaManagerUrl(prisma: PrismaService, store: ManagerUrlStore): Promise<string | null> {
  if (store.code) {
    const latest = await prisma.storeMaster.findFirst({ where: { externalStoreId: store.code, isActive: true }, orderBy: { updatedAt: "desc" }, select: { lineManagerUrl: true } });
    if (isValidManagerUrl(latest?.lineManagerUrl ?? null)) return latest!.lineManagerUrl;
  }
  return isValidManagerUrl(store.storeMaster?.lineManagerUrl ?? null) ? store.storeMaster!.lineManagerUrl : null;
}
