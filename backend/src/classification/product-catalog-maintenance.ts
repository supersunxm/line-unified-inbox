import { PrismaClient, ProductAliasSource } from "@prisma/client";
import { CatalogEntry, PRODUCT_CATALOG, synchronizableCatalogAliases, validateProductCatalog } from "./product-catalog";
import { compactProductText } from "./product-normalization";

export async function seedProductCatalog(prisma: PrismaClient, entries: CatalogEntry[] = PRODUCT_CATALOG): Promise<void> {
  const errors = validateProductCatalog(entries); if (errors.length) throw new Error(errors.join("\n"));
  const desiredAliases = new Map<string, { entry: CatalogEntry; alias: string; language?: string }>();
  for (const entry of entries) {
    for (const { alias, language } of synchronizableCatalogAliases(entry)) {
      desiredAliases.set(compactProductText(alias), { entry, alias, language });
    }
  }
  const existingAliases = await prisma.productAlias.findMany({
    where: { normalizedAlias: { in: [...desiredAliases.keys()] } },
  });
  const ownershipConflict = existingAliases.find(({ source }) => source !== ProductAliasSource.CATALOG);
  if (ownershipConflict) {
    throw new Error(`Product alias ownership conflict for normalized key: ${ownershipConflict.normalizedAlias}`);
  }
  const existingByKey = new Map(existingAliases.map((alias) => [alias.normalizedAlias, alias]));
  const modelsByName = new Map<string, string>();
  for (const entry of entries) {
    const family = await prisma.productSeries.upsert({ where: { name: entry.family }, update: { productGroup: entry.group, isActive: true }, create: { name: entry.family, productGroup: entry.group } });
    const model = await prisma.productModel.upsert({ where: { name: entry.model }, update: { productSeriesId: family.id, classificationLevel: entry.level, priority: entry.priority, isActive: true }, create: { name: entry.model, productSeriesId: family.id, classificationLevel: entry.level, priority: entry.priority } });
    modelsByName.set(entry.model, model.id);
  }
  for (const [normalizedAlias, { entry, alias, language }] of desiredAliases) {
    const productModelId = modelsByName.get(entry.model);
    if (!productModelId) throw new Error(`Catalog model was not synchronized: ${entry.model}`);
    const existing = existingByKey.get(normalizedAlias);
    if (existing) {
      await prisma.productAlias.update({ where: { id: existing.id }, data: { productModelId, alias, language, isActive: true } });
    } else {
      await prisma.productAlias.create({ data: { productModelId, alias, normalizedAlias, language, source: ProductAliasSource.CATALOG } });
    }
  }
  await prisma.productAlias.updateMany({
    where: { source: ProductAliasSource.CATALOG, normalizedAlias: { notIn: [...desiredAliases.keys()] } },
    data: { isActive: false },
  });
}
