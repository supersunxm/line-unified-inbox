import { PrismaClient, ProductAliasSource } from "@prisma/client";
import { PRODUCT_CATALOG, synchronizableCatalogAliases } from "./product-catalog";
import { compactProductText } from "./product-normalization";

export type ProductAliasAdoptionEntry = {
  id: string;
  modelName: string;
  normalizedAlias: string;
};

export type ProductAliasAdoptionResult = {
  manifestEntries: number;
  eligible: number;
  updated: number;
  alreadyAdopted: number;
  dryRun: boolean;
};

type AdoptionPrisma = Pick<PrismaClient, "productAlias" | "$transaction">;
type AdoptionReader = Pick<PrismaClient, "productAlias">;

function approvedCatalogOwners(): Map<string, string> {
  const owners = new Map<string, string>();
  for (const entry of PRODUCT_CATALOG) {
    for (const { alias } of synchronizableCatalogAliases(entry)) {
      const key = compactProductText(alias);
      const owner = owners.get(key);
      if (owner && owner !== entry.model) throw new Error(`Catalog ownership conflict for normalized key: ${key}`);
      owners.set(key, entry.model);
    }
  }
  return owners;
}

async function preflightProductAliasOwnership(
  prisma: AdoptionReader,
  manifest: ProductAliasAdoptionEntry[],
  catalogOwners: Map<string, string>,
): Promise<number> {
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const entry of manifest) {
    if (ids.has(entry.id)) throw new Error(`Duplicate manifest alias ID: ${entry.id}`);
    if (keys.has(entry.normalizedAlias)) throw new Error(`Duplicate manifest normalized key: ${entry.normalizedAlias}`);
    ids.add(entry.id);
    keys.add(entry.normalizedAlias);
  }

  const rows = await prisma.productAlias.findMany({
    where: { OR: [{ id: { in: [...ids] } }, { normalizedAlias: { in: [...keys] } }] },
    include: { productModel: { select: { name: true } } },
  });
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const rowsByKey = new Map<string, typeof rows>();
  for (const row of rows) rowsByKey.set(row.normalizedAlias, [...(rowsByKey.get(row.normalizedAlias) ?? []), row]);

  const failures: string[] = [];
  for (const entry of manifest) {
    const row = rowsById.get(entry.id);
    if (!row) { failures.push(`${entry.id}: missing row`); continue; }
    if (row.productModel.name !== entry.modelName) failures.push(`${entry.id}: model mismatch`);
    if (row.normalizedAlias !== entry.normalizedAlias) failures.push(`${entry.id}: normalized key mismatch`);
    if (!row.isActive) failures.push(`${entry.id}: alias is inactive`);
    if (row.source !== ProductAliasSource.MANUAL && row.source !== ProductAliasSource.CATALOG) failures.push(`${entry.id}: invalid source`);
    if (catalogOwners.get(entry.normalizedAlias) !== entry.modelName) failures.push(`${entry.id}: catalog approval mismatch`);
    const keyRows = rowsByKey.get(entry.normalizedAlias) ?? [];
    if (keyRows.length !== 1 || keyRows[0]?.id !== entry.id) failures.push(`${entry.id}: duplicate or cross-model key conflict`);
  }
  const sources = new Set(manifest.map(({ id }) => rowsById.get(id)?.source));
  if (sources.size > 1) failures.push("manifest rows have mixed ownership state");
  if (failures.length) throw new Error(`Product alias adoption preflight failed (${failures.length}): ${failures.join("; ")}`);
  return manifest.filter(({ id }) => rowsById.get(id)?.source === ProductAliasSource.CATALOG).length;
}

export async function adoptProductAliasOwnership(
  prisma: AdoptionPrisma,
  manifest: ProductAliasAdoptionEntry[],
  dryRun: boolean,
): Promise<ProductAliasAdoptionResult> {
  const catalogOwners = approvedCatalogOwners();
  if (dryRun) {
    const alreadyAdopted = await preflightProductAliasOwnership(prisma, manifest, catalogOwners);
    return { manifestEntries: manifest.length, eligible: manifest.length, updated: 0, alreadyAdopted, dryRun };
  }

  const result = await prisma.$transaction(async (tx) => {
    const alreadyAdopted = await preflightProductAliasOwnership(tx, manifest, catalogOwners);
    if (alreadyAdopted === manifest.length) return { updated: 0, alreadyAdopted };
    const result = await tx.productAlias.updateMany({
      where: {
        id: { in: manifest.map(({ id }) => id) },
        source: ProductAliasSource.MANUAL,
        isActive: true,
      },
      data: { source: ProductAliasSource.CATALOG },
    });
    if (result.count !== manifest.length) throw new Error(`Product alias adoption update count mismatch: expected ${manifest.length}, received ${result.count}`);
    return { updated: result.count, alreadyAdopted: 0 };
  });
  return {
    manifestEntries: manifest.length,
    eligible: manifest.length,
    updated: result.updated,
    alreadyAdopted: result.alreadyAdopted,
    dryRun: false,
  };
}
