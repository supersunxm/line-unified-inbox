import { ProductGroup, PrismaClient } from "@prisma/client";
import { parseCsv } from "../store-master/store-master.utils";

export type ProductMasterRow = {
  name: string;
  category: string;
  ram: string | null;
  rom: string | null;
  color: string | null;
  sourceRowNumber: number;
};

export type ProductMasterVariant = {
  variantKey: string;
  ram: string | null;
  rom: string | null;
  color: string | null;
};

export type ProductMasterCanonical = {
  name: string;
  normalizedName: string;
  category: string;
  productGroup: ProductGroup;
  seriesName: string;
  variants: ProductMasterVariant[];
};

export type ProductMasterExistingVariant = ProductMasterVariant & {
  id: string;
  isActive: boolean;
};

export type ProductMasterExistingModel = {
  id: string;
  name: string;
  isActive: boolean;
  classificationLevel: string;
  productSeries: {
    name: string;
    productGroup: ProductGroup;
    isActive: boolean;
  };
  variants?: ProductMasterExistingVariant[];
};

export type ProductMasterExistingSeries = {
  name: string;
  productGroup: ProductGroup;
  isActive: boolean;
};

export type ProductMasterPlanItem = {
  action: "CREATE" | "UPDATE" | "REACTIVATE" | "UNCHANGED";
  canonical: ProductMasterCanonical;
  existingId?: string;
  reason?: string;
};

export type ProductMasterPlan = {
  sourceRows: number;
  uniqueProductNames: number;
  categories: string[];
  items: ProductMasterPlanItem[];
  extraModels: string[];
  ambiguous: string[];
  createCount: number;
  updateCount: number;
  reactivateCount: number;
  unchangedCount: number;
  skippedCount: number;
  deleteCount: 0;
  variantCreateCount: number;
  variantReactivateCount: number;
  variantUnchangedCount: number;
};

const categoryGroups: Record<string, ProductGroup> = {
  PHONE: ProductGroup.SMARTPHONE,
  TABLET: ProductGroup.TABLET,
  EARBUDS: ProductGroup.AUDIO,
  SMARTWATCH: ProductGroup.WEARABLE,
  ACCESSORY: ProductGroup.ACCESSORIES,
};

const accessorySeries = new Map<string, string>([
  ["oppo bubble", "Accessories"],
  ["oppo find x9 ultra hasselblad earth explorer kit", "Accessories"],
  ["oppo supervooc 80w power adapter", "Charging"],
  ["oppo magnetic cable usb-a to type-c dl160 1m", "Charging"],
  ["oppo vooc cable usb-c to usb-c 8a dl149", "Charging"],
  ["oppo usb-a to type-c cable 8a 1m dl129", "Charging"],
  ["oppo find x9 ultra magnetic protective case", "Cases"],
]);

export function normalizeProductMasterName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function normalizeCategory(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleUpperCase();
}

function normalizeVariantValue(value: string | null | undefined): string | null {
  const normalized = value?.normalize("NFKC").trim().replace(/\s+/gu, " ") ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function productMasterVariantKey(ram: string | null, rom: string | null, color: string | null): string {
  return [ram, rom, color].map((value) => normalizeVariantValue(value)?.toLocaleLowerCase() ?? "").join("\u001f");
}

function seriesForProduct(name: string, category: string): string | undefined {
  const normalizedName = normalizeProductMasterName(name);
  if (category === "PHONE") {
    if (normalizedName.startsWith("oppo find ")) return "Find Series";
    if (normalizedName.startsWith("oppo reno")) return "Reno Series";
    if (normalizedName.startsWith("oppo a6")) return "A Series";
    return undefined;
  }
  if (category === "TABLET") return "OPPO Pad Series";
  if (category === "EARBUDS") return "OPPO Enco Series";
  if (category === "SMARTWATCH") return "OPPO Watch Series";
  if (category === "ACCESSORY") return accessorySeries.get(normalizedName);
  return undefined;
}

export function parseProductMasterCsv(csv: string): ProductMasterRow[] {
  const [rawHeaders, ...rawRows] = parseCsv(csv);
  const headers = (rawHeaders ?? []).map((header) =>
    header.replace(/^\uFEFF/u, "").normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase(),
  );
  const nameIndex = headers.indexOf("product name");
  const categoryIndex = headers.indexOf("catagories");
  if (nameIndex < 0 || categoryIndex < 0) {
    throw new Error("Product Master CSV must contain PRODUCT NAME and CATAGORIES headers");
  }
  return rawRows
    .map((row, index) => ({
      name: row[nameIndex]?.trim() ?? "",
      category: row[categoryIndex]?.trim() ?? "",
      ram: normalizeVariantValue(row[headers.indexOf("ram")] ?? null),
      rom: normalizeVariantValue(row[headers.indexOf("rom")] ?? null),
      color: normalizeVariantValue(row[headers.indexOf("color")] ?? null),
      sourceRowNumber: index + 2,
    }))
    .filter(({ name }) => name.length > 0);
}

export function canonicalizeProductMasterRows(rows: ProductMasterRow[]): {
  canonical: ProductMasterCanonical[];
  ambiguous: string[];
} {
  const byName = new Map<string, ProductMasterCanonical>();
  const ambiguous: string[] = [];
  for (const row of rows) {
    const name = row.name.normalize("NFKC").trim().replace(/\s+/gu, " ");
    const normalizedName = normalizeProductMasterName(name);
    const normalizedCategory = normalizeCategory(row.category);
    const productGroup = categoryGroups[normalizedCategory];
    const seriesName = productGroup ? seriesForProduct(name, normalizedCategory) : undefined;
    if (!productGroup || !seriesName) {
      ambiguous.push(`Row ${row.sourceRowNumber}: ${name || "(blank)"} (${row.category || "missing category"})`);
      continue;
    }
    const variant = {
      variantKey: productMasterVariantKey(row.ram, row.rom, row.color),
      ram: row.ram,
      rom: row.rom,
      color: row.color,
    } satisfies ProductMasterVariant;
    const candidate: ProductMasterCanonical = {
      name,
      normalizedName,
      category: normalizedCategory,
      productGroup,
      seriesName,
      variants: [variant],
    };
    const existing = byName.get(normalizedName);
    if (existing && (existing.category !== candidate.category || existing.seriesName !== candidate.seriesName)) {
      ambiguous.push(`Conflicting category/series for ${name}`);
      continue;
    }
    if (!existing) byName.set(normalizedName, candidate);
    else if (!existing.variants.some(({ variantKey }) => variantKey === variant.variantKey)) existing.variants.push(variant);
  }
  return { canonical: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)), ambiguous };
}

export function buildProductMasterPlan(
  rows: ProductMasterRow[],
  existingModels: ProductMasterExistingModel[],
  existingSeries: ProductMasterExistingSeries[],
): ProductMasterPlan {
  const { canonical, ambiguous } = canonicalizeProductMasterRows(rows);
  const seriesByName = new Map(existingSeries.map((series) => [normalizeProductMasterName(series.name), series]));
  const modelByName = new Map<string, ProductMasterExistingModel>();
  for (const model of existingModels) {
    const key = normalizeProductMasterName(model.name);
    if (modelByName.has(key)) ambiguous.push(`Duplicate existing normalized model name: ${model.name}`);
    else modelByName.set(key, model);
  }

  const items: ProductMasterPlanItem[] = [];
  for (const item of canonical) {
    const series = seriesByName.get(normalizeProductMasterName(item.seriesName));
    if (!series || !series.isActive || series.productGroup !== item.productGroup) {
      ambiguous.push(`Missing or incompatible ProductSeries: ${item.seriesName} for ${item.name}`);
      continue;
    }
    const existing = modelByName.get(item.normalizedName);
    if (!existing) {
      items.push({ action: "CREATE", canonical: item, reason: "Missing canonical ProductModel" });
      continue;
    }
    const needsUpdate =
      !existing.isActive ||
      existing.classificationLevel !== "MODEL" ||
      normalizeProductMasterName(existing.productSeries.name) !== normalizeProductMasterName(item.seriesName) ||
      existing.productSeries.productGroup !== item.productGroup;
    if (!needsUpdate) {
      items.push({ action: "UNCHANGED", canonical: item, existingId: existing.id });
    } else if (!existing.isActive) {
      items.push({ action: "REACTIVATE", canonical: item, existingId: existing.id, reason: "Authoritative model is inactive" });
    } else {
      items.push({ action: "UPDATE", canonical: item, existingId: existing.id, reason: "Canonical series or classification metadata differs" });
    }
  }

  const sourceNames = new Set(canonical.map((item) => item.normalizedName));
  const extraModels = existingModels
    .filter((model) => !sourceNames.has(normalizeProductMasterName(model.name)))
    .map((model) => model.name)
    .sort((a, b) => a.localeCompare(b));
  const variantCreateCount = items.reduce((sum, item) => {
    const existing = existingModels.find(({ id }) => id === item.existingId);
    const existingKeys = new Set((existing?.variants ?? []).map(({ variantKey }) => variantKey));
    return sum + item.canonical.variants.filter(({ variantKey }) => !existingKeys.has(variantKey)).length;
  }, 0);
  const variantReactivateCount = items.reduce((sum, item) => {
    const existing = existingModels.find(({ id }) => id === item.existingId);
    const existingByKey = new Map((existing?.variants ?? []).map((variant) => [variant.variantKey, variant]));
    return sum + item.canonical.variants.filter(({ variantKey }) => existingByKey.get(variantKey)?.isActive === false).length;
  }, 0);
  const variantUnchangedCount = items.reduce((sum, item) => {
    const existing = existingModels.find(({ id }) => id === item.existingId);
    const existingKeys = new Set((existing?.variants ?? []).map(({ variantKey }) => variantKey));
    return sum + item.canonical.variants.filter(({ variantKey }) => existingKeys.has(variantKey)).length;
  }, 0);
  return {
    sourceRows: rows.length,
    uniqueProductNames: canonical.length,
    categories: [...new Set(canonical.map((item) => item.category))].sort(),
    items,
    extraModels,
    ambiguous,
    createCount: items.filter(({ action }) => action === "CREATE").length,
    updateCount: items.filter(({ action }) => action === "UPDATE").length,
    reactivateCount: items.filter(({ action }) => action === "REACTIVATE").length,
    unchangedCount: items.filter(({ action }) => action === "UNCHANGED").length,
    skippedCount: ambiguous.length,
    deleteCount: 0,
    variantCreateCount,
    variantReactivateCount,
    variantUnchangedCount,
  };
}

export async function readProductMasterState(prisma: PrismaClient) {
  const [models, series] = await Promise.all([
    prisma.productModel.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        classificationLevel: true,
        productSeries: { select: { name: true, productGroup: true, isActive: true } },
        variants: { select: { id: true, variantKey: true, ram: true, rom: true, color: true, isActive: true } },
      },
    }),
    prisma.productSeries.findMany({ select: { name: true, productGroup: true, isActive: true } }),
  ]);
  return { models, series } satisfies { models: ProductMasterExistingModel[]; series: ProductMasterExistingSeries[] };
}

export async function applyProductMasterPlan(prisma: PrismaClient, plan: ProductMasterPlan): Promise<void> {
  if (plan.ambiguous.length > 0) {
    throw new Error(`Product Master sync has ambiguous rows:\n${plan.ambiguous.join("\n")}`);
  }
  await prisma.$transaction(async (tx) => {
    for (const item of plan.items) {
      const series = await tx.productSeries.findUnique({ where: { name: item.canonical.seriesName }, select: { id: true } });
      if (!series) throw new Error(`ProductSeries not found: ${item.canonical.seriesName}`);
      let productModelId = item.existingId;
      if (item.action === "CREATE") {
        const created = await tx.productModel.create({
          data: {
            name: item.canonical.name,
            productSeriesId: series.id,
            classificationLevel: "MODEL",
            isActive: true,
          },
        });
        productModelId = created.id;
      } else if (item.existingId && item.action !== "UNCHANGED") {
        await tx.productModel.update({
          where: { id: item.existingId },
          data: { productSeriesId: series.id, classificationLevel: "MODEL", isActive: true },
        });
      }
      if (!productModelId) throw new Error(`ProductModel id missing for ${item.canonical.name}`);
      for (const variant of item.canonical.variants) {
        await tx.productVariant.upsert({
          where: { productModelId_variantKey: { productModelId, variantKey: variant.variantKey } },
          create: { productModelId, variantKey: variant.variantKey, ram: variant.ram, rom: variant.rom, color: variant.color, isActive: true },
          update: { ram: variant.ram, rom: variant.rom, color: variant.color, isActive: true },
        });
      }
    }
  }, { maxWait: 15000, timeout: 60000 });
}

export async function fetchProductMasterCsv(sheetId: string, gid = "0"): Promise<string> {
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`);
  if (!response.ok) throw new Error(`Product Master Google Sheet export failed (${response.status})`);
  return response.text();
}
