import { LineAccountType } from "@prisma/client";
import type { PrismaService } from "../prisma.service";
import { selectLineChatStoreOa } from "./line-chat-store-oa-selector";

export type MirrorFleetExclusionReason =
  | "ARCHIVED_INELIGIBLE"
  | "INACTIVE_INELIGIBLE"
  | "MAPPING_AMBIGUOUS"
  | "CONFIGURATION_ERROR";

export type MirrorFleetScope = {
  configuredStoreCodes: string[];
  eligibleStoreCodes: string[];
  eligibleOaIds: string[];
  unconfiguredActiveStoreCodes: string[];
  disabledOaIds: string[];
  exclusions: Array<{
    storeCode: string;
    reason: MirrorFleetExclusionReason;
    storeIds: string[];
    oaIds: string[];
  }>;
};

/** Resolve configured codes against current Store/OA ownership; names are not identity evidence. */
export async function resolveConfiguredMirrorFleetScope(
  prisma: Pick<PrismaService, "store">,
  configuredStoreCodes: readonly string[],
): Promise<MirrorFleetScope> {
  const codes = [...new Set(configuredStoreCodes.map((code) => code.trim()).filter(Boolean))];
  const stores = await prisma.store.findMany({
    where: {
      OR: [
        { code: { in: codes } },
        { storeMaster: { externalStoreId: { in: codes } } },
        {
          isActive: true,
          archivedAt: null,
          lineOfficialAccounts: {
            some: { accountType: LineAccountType.STORE, isActive: true, archivedAt: null },
          },
        },
      ],
    },
    select: {
      id: true,
      code: true,
      isActive: true,
      archivedAt: true,
      storeMaster: {
        select: {
          externalStoreId: true,
          accountName: true,
          normalizedAccountName: true,
          lineId: true,
        },
      },
      lineOfficialAccounts: {
        where: { accountType: LineAccountType.STORE },
        select: { id: true, name: true, basicId: true, isActive: true, archivedAt: true },
      },
    },
  });

  const eligibleStoreCodes: string[] = [];
  const eligibleOaIds: string[] = [];
  const disabledOaIds = new Set<string>();
  const exclusions: MirrorFleetScope["exclusions"] = [];
  const configuredCodeSet = new Set(codes);

  for (const storeCode of codes) {
    const matches = stores.filter((store) =>
      store.code === storeCode || store.storeMaster?.externalStoreId === storeCode,
    );
    const storeIds = [...new Set(matches.map((store) => store.id))];
    if (matches.length !== 1) {
      exclusions.push({
        storeCode,
        reason: matches.length > 1 ? "MAPPING_AMBIGUOUS" : "CONFIGURATION_ERROR",
        storeIds,
        oaIds: matches.flatMap((store) => store.lineOfficialAccounts.map((oa) => oa.id)),
      });
      continue;
    }

    const store = matches[0];
    const storeOas = store.lineOfficialAccounts;
    for (const oa of storeOas) {
      if (!oa.isActive || oa.archivedAt) disabledOaIds.add(oa.id);
    }

    if (store.archivedAt) {
      disabledOaIdsForStore(disabledOaIds, storeOas.map((oa) => oa.id));
      exclusions.push({ storeCode, reason: "ARCHIVED_INELIGIBLE", storeIds, oaIds: storeOas.map((oa) => oa.id) });
      continue;
    }
    if (!store.isActive) {
      disabledOaIdsForStore(disabledOaIds, storeOas.map((oa) => oa.id));
      exclusions.push({ storeCode, reason: "INACTIVE_INELIGIBLE", storeIds, oaIds: storeOas.map((oa) => oa.id) });
      continue;
    }

    const activeOas = storeOas.filter((oa) => oa.isActive && !oa.archivedAt);
    const selection = selectLineChatStoreOa(store.storeMaster, activeOas);
    if (!selection.ok) {
      exclusions.push({
        storeCode,
        reason: selection.reason === "NO_ACTIVE_OA" ? "INACTIVE_INELIGIBLE" : "MAPPING_AMBIGUOUS",
        storeIds,
        oaIds: activeOas.map((oa) => oa.id),
      });
      continue;
    }

    eligibleStoreCodes.push(storeCode);
    eligibleOaIds.push(selection.oaId);
  }

  const unconfiguredActiveStoreCodes: string[] = [];
  const activeStores = stores.filter((store) => store.isActive && !store.archivedAt);
  for (const store of activeStores) {
    const identities = [store.code?.trim(), store.storeMaster?.externalStoreId?.trim()]
      .filter((value): value is string => Boolean(value));
    if (identities.some((value) => configuredCodeSet.has(value))) continue;
    const storeCode = identities[0] ?? `UNCONFIGURED_STORE:${store.id}`;
    const activeOas = store.lineOfficialAccounts.filter((oa) => oa.isActive && !oa.archivedAt);
    const selection = selectLineChatStoreOa(store.storeMaster, activeOas);
    const oaIds = selection.ok ? [selection.oaId] : activeOas.map((oa) => oa.id);
    unconfiguredActiveStoreCodes.push(storeCode);
    exclusions.push({
      storeCode,
      reason: selection.ok ? "CONFIGURATION_ERROR" : "MAPPING_AMBIGUOUS",
      storeIds: [store.id],
      oaIds,
    });
  }

  return {
    configuredStoreCodes: codes,
    eligibleStoreCodes,
    eligibleOaIds,
    unconfiguredActiveStoreCodes,
    disabledOaIds: [...disabledOaIds],
    exclusions,
  };
}

function disabledOaIdsForStore(target: Set<string>, oaIds: readonly string[]): void {
  for (const oaId of oaIds) target.add(oaId);
}
