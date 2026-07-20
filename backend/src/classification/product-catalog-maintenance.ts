import { PrismaClient } from "@prisma/client";
import { PRODUCT_CATALOG, validateProductCatalog } from "./product-catalog";
import { compactProductText } from "./product-normalization";

export async function seedProductCatalog(prisma: PrismaClient): Promise<void> {
  const errors = validateProductCatalog(); if (errors.length) throw new Error(errors.join("\n"));
  for (const entry of PRODUCT_CATALOG) {
    const family = await prisma.productSeries.upsert({ where: { name: entry.family }, update: { productGroup: entry.group, isActive: true }, create: { name: entry.family, productGroup: entry.group } });
    const model = await prisma.productModel.upsert({ where: { name: entry.model }, update: { productSeriesId: family.id, classificationLevel: entry.level, priority: entry.priority, isActive: true }, create: { name: entry.model, productSeriesId: family.id, classificationLevel: entry.level, priority: entry.priority } });
    for (const alias of entry.aliases) await prisma.productAlias.upsert({ where: { normalizedAlias: compactProductText(alias) }, update: { productModelId: model.id, alias, isActive: true }, create: { productModelId: model.id, alias, normalizedAlias: compactProductText(alias) } });
  }
}
