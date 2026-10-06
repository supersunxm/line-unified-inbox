import { ProductAliasSource } from "@prisma/client";
import {
  automaticCatalogAliases,
  catalogAliasSafety,
  catalogAliasValue,
  PRODUCT_CATALOG,
  storedProductAliasSafety,
} from "../classification/product-catalog";
import { compactProductText, normalizeProductText } from "../classification/product-normalization";
import {
  createNicknameProductResolver,
  type ParserV3Product,
  type ParserV3ProductAliasSafety,
} from "./nickname-parser-v3.contract";

const AUTO_SAFE = new Set<ParserV3ProductAliasSafety>(["SAFE_EXACT", "SAFE_COMPACT"]);

export type NicknameParserV3Model = { id: string; name: string; classificationLevel: string };
export type NicknameParserV3Alias = {
  alias: string;
  source: string;
  productModel: { id: string; name: string; isActive: boolean };
};

/** The single production resolver policy used by simulation and application. */
export function buildNicknameV3ProductResolver(
  models: readonly NicknameParserV3Model[],
  aliases: readonly NicknameParserV3Alias[],
) {
  const aliasesById = new Map<string, ParserV3Product["aliases"]>();
  const aliasAudit = {
    activeAliasRows: aliases.length,
    catalogAliases: 0,
    manualAliasesExcluded: 0,
    otherSourceAliasesExcluded: 0,
    aliasesOnInactiveModelsExcluded: 0,
    catalogSafeExact: 0,
    catalogSafeCompact: 0,
    catalogReviewRequired: 0,
    catalogBlocked: 0,
    activeCodeCatalogApprovedAliases: 0,
    exactNormalizedCollisionKeys: 0,
    compactNormalizedCollisionKeys: 0,
  };
  const activeModelsById = new Map(models.map((model) => [model.id, model]));

  for (const row of aliases) {
    if (!row.productModel.isActive) {
      aliasAudit.aliasesOnInactiveModelsExcluded++;
      continue;
    }
    if (row.source === ProductAliasSource.MANUAL) {
      aliasAudit.manualAliasesExcluded++;
      continue;
    }
    if (row.source !== ProductAliasSource.CATALOG) {
      aliasAudit.otherSourceAliasesExcluded++;
      continue;
    }
    aliasAudit.catalogAliases++;
    const safety = storedProductAliasSafety(row.productModel.name, row.alias, ProductAliasSource.CATALOG);
    if (safety === "SAFE_EXACT") aliasAudit.catalogSafeExact++;
    else if (safety === "SAFE_COMPACT") aliasAudit.catalogSafeCompact++;
    else if (safety === "BLOCKED") aliasAudit.catalogBlocked++;
    else aliasAudit.catalogReviewRequired++;
    if (AUTO_SAFE.has(safety)) {
      aliasesById.set(row.productModel.id, [
        ...(aliasesById.get(row.productModel.id) ?? []),
        { alias: row.alias, safety },
      ]);
    }
  }

  for (const model of models) {
    const entry = PRODUCT_CATALOG.find((candidate) => candidate.model === model.name);
    if (!entry) continue;
    const aliasesForModel = aliasesById.get(model.id) ?? [];
    const codeAliases = automaticCatalogAliases(entry).map((alias) => ({
      alias: catalogAliasValue(alias),
      safety: catalogAliasSafety(alias),
    }));
    aliasAudit.activeCodeCatalogApprovedAliases += codeAliases.length;
    aliasesById.set(model.id, [...aliasesForModel, ...codeAliases]);
  }

  const productCandidates: ParserV3Product[] = models.map((model) => ({
    id: model.id,
    name: model.name,
    active: true,
    aliases: aliasesById.get(model.id) ?? [],
  }));
  const exactOwners = new Map<string, Set<string>>();
  const compactOwners = new Map<string, Set<string>>();
  const addOwner = (owners: Map<string, Set<string>>, key: string, modelId: string) => {
    if (!key) return;
    const ids = owners.get(key) ?? new Set<string>();
    ids.add(modelId);
    owners.set(key, ids);
  };
  for (const product of productCandidates) {
    addOwner(exactOwners, normalizeProductText(product.name), product.id);
    for (const alias of product.aliases) {
      if (!AUTO_SAFE.has(alias.safety)) continue;
      addOwner(exactOwners, normalizeProductText(alias.alias), product.id);
      if (alias.safety === "SAFE_COMPACT") addOwner(compactOwners, compactProductText(alias.alias), product.id);
    }
  }
  aliasAudit.exactNormalizedCollisionKeys = [...exactOwners.values()].filter((owners) => owners.size > 1).length;
  aliasAudit.compactNormalizedCollisionKeys = [...compactOwners.values()].filter((owners) => owners.size > 1).length;

  return {
    productCandidates,
    aliasAudit,
    activeModelsById,
    resolveProduct: createNicknameProductResolver(productCandidates),
  };
}
