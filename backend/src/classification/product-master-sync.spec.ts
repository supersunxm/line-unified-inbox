import assert from "node:assert/strict";
import test from "node:test";
import { ProductGroup } from "@prisma/client";
import {
  applyProductMasterPlan,
  buildProductMasterPlan,
  canonicalizeProductMasterRows,
  normalizeProductMasterName,
  ProductMasterExistingModel,
  ProductMasterExistingSeries,
  ProductMasterRow,
  productMasterVariantKey,
} from "./product-master-sync";

const series: ProductMasterExistingSeries[] = [
  { name: "Find Series", productGroup: ProductGroup.SMARTPHONE, isActive: true },
  { name: "Reno Series", productGroup: ProductGroup.SMARTPHONE, isActive: true },
  { name: "A Series", productGroup: ProductGroup.SMARTPHONE, isActive: true },
  { name: "OPPO Pad Series", productGroup: ProductGroup.TABLET, isActive: true },
  { name: "OPPO Enco Series", productGroup: ProductGroup.AUDIO, isActive: true },
  { name: "OPPO Watch Series", productGroup: ProductGroup.WEARABLE, isActive: true },
  { name: "Accessories", productGroup: ProductGroup.ACCESSORIES, isActive: true },
  { name: "Cases", productGroup: ProductGroup.ACCESSORIES, isActive: true },
  { name: "Charging", productGroup: ProductGroup.ACCESSORIES, isActive: true },
];

const row = (name: string, category = "Phone", sourceRowNumber = 2, ram: string | null = null, rom: string | null = null, color: string | null = null): ProductMasterRow => ({ name, category, ram, rom, color, sourceRowNumber });
const existing = (name: string, seriesName: string, productGroup: ProductGroup, overrides: Partial<ProductMasterExistingModel> = {}): ProductMasterExistingModel => ({
  id: `id-${normalizeProductMasterName(name)}`,
  name,
  isActive: true,
  classificationLevel: "MODEL",
  productSeries: { name: seriesName, productGroup, isActive: true },
  variants: [],
  ...overrides,
});

function createApplyState(initial: ProductMasterExistingModel[]) {
  const models = initial.map((model) => ({ ...model }));
  const prisma = {
    $transaction: async (callback: (tx: typeof prisma) => Promise<void>) => callback(prisma),
    productSeries: {
      findUnique: async ({ where: { name } }: { where: { name: string } }) => series.find((item) => item.name === name) ? { id: name } : null,
    },
    productModel: {
      create: async ({ data }: { data: { name: string; productSeriesId: string; classificationLevel: string; isActive: boolean } }) => {
        const created = existing(data.name, data.productSeriesId, ProductGroup.SMARTPHONE, { id: `created-${models.length}` });
        models.push(created);
        return created;
      },
      update: async ({ where: { id }, data }: { where: { id: string }; data: { productSeriesId: string; classificationLevel: string; isActive: boolean } }) => {
        const current = models.find((item) => item.id === id);
        if (!current) throw new Error(`Missing model ${id}`);
        current.isActive = data.isActive;
        current.classificationLevel = data.classificationLevel;
        current.productSeries = { ...current.productSeries, name: data.productSeriesId };
        return current;
      },
    },
    productVariant: {
      upsert: async ({ where, create, update }: any) => {
        const model = models.find((item) => item.id === where.productModelId_variantKey.productModelId);
        if (!model) throw new Error("Missing model for variant");
        model.variants ??= [];
        const existingVariant = model.variants.find((item) => item.variantKey === where.productModelId_variantKey.variantKey);
        if (existingVariant) Object.assign(existingVariant, update);
        else model.variants.push({ id: `variant-${model.variants.length}`, ...create });
        return existingVariant ?? model.variants.at(-1);
      },
    },
  };
  return { prisma, models };
}

void test("variant rows normalize to one canonical model", () => {
  const result = canonicalizeProductMasterRows([
    row(" OPPO Find N6 ", "Phone", 2),
    row("OPPO  Find N6", "Phone", 3),
  ]);
  assert.equal(result.ambiguous.length, 0);
  assert.deepEqual(result.canonical.map(({ name }) => name), ["OPPO Find N6"]);
});

void test("duplicate variant rows become one canonical variant", () => {
  const result = canonicalizeProductMasterRows([
    row("OPPO Find N6", "Phone", 2, "16", "512", "Stellar Titanium"),
    row("OPPO Find N6", "Phone", 3, "16", "512", "Stellar Titanium"),
    row("OPPO Find N6", "Phone", 4, "16", "512", "Blossom Orange"),
  ]);
  assert.equal(result.ambiguous.length, 0);
  assert.deepEqual(result.canonical[0]?.variants.map(({ variantKey }) => variantKey), [
    productMasterVariantKey("16", "512", "Stellar Titanium"),
    productMasterVariantKey("16", "512", "Blossom Orange"),
  ]);
});

void test("Find N6 is planned exactly once and existing models are reused", () => {
  const plan = buildProductMasterPlan(
    [row("OPPO Find N6"), row("OPPO Find N6", "Phone", 3), row("OPPO Find X9", "Phone", 4)],
    [existing("OPPO Find X9", "Find Series", ProductGroup.SMARTPHONE)],
    series,
  );
  assert.equal(plan.createCount, 1);
  assert.equal(plan.unchangedCount, 1);
  assert.equal(plan.items.find(({ canonical }) => canonical.name === "OPPO Find X9")?.existingId, "id-oppo find x9");
  assert.equal(plan.items.filter(({ canonical }) => canonical.name === "OPPO Find N6").length, 1);
});

void test("inactive authoritative models are reactivated without changing their id", () => {
  const inactive = existing("OPPO Find N6", "Find Series", ProductGroup.SMARTPHONE, { isActive: false });
  const plan = buildProductMasterPlan([row("OPPO Find N6")], [inactive], series);
  assert.equal(plan.reactivateCount, 1);
  assert.equal(plan.items[0]?.existingId, inactive.id);
});

void test("missing source models are extra but are never scheduled for deletion", () => {
  const plan = buildProductMasterPlan([row("OPPO Find N6")], [existing("OPPO Legacy", "Find Series", ProductGroup.SMARTPHONE)], series);
  assert.deepEqual(plan.extraModels, ["OPPO Legacy"]);
  assert.equal(plan.deleteCount, 0);
});

void test("unknown categories fail safely before mutation", () => {
  const plan = buildProductMasterPlan([row("OPPO Mystery", "Unknown")], [], series);
  assert.equal(plan.items.length, 0);
  assert.equal(plan.skippedCount, 1);
  assert.match(plan.ambiguous[0] ?? "", /Unknown/);
});

void test("category and series mapping covers the supported Product Master families", () => {
  const plan = buildProductMasterPlan([
    row("OPPO Reno16 5G", "Phone"),
    row("OPPO Pad SE", "Tablet"),
    row("OPPO Enco Air5", "Earbuds"),
    row("OPPO Watch S", "Smartwatch"),
    row("OPPO SUPERVOOC 80W Power Adapter", "Accessory"),
    row("OPPO Find X9 Ultra Magnetic Protective Case", "Accessory"),
  ], [], series);
  assert.equal(plan.ambiguous.length, 0);
  assert.equal(plan.createCount, 6);
});

void test("apply preserves manual relation surfaces and is idempotent", async () => {
  const state = createApplyState([]);
  const rows = [row("OPPO Find N6")];
  const plan = buildProductMasterPlan(rows, state.models, series);
  await applyProductMasterPlan(state.prisma as never, plan);
  const after = state.models.map((model) => ({ ...model, productSeries: { ...model.productSeries, isActive: true } }));
  const second = buildProductMasterPlan(rows, after, series);
  assert.equal(state.models.length, 1);
  assert.equal(second.createCount, 0);
  assert.equal(second.unchangedCount, 1);
  assert.equal(second.deleteCount, 0);
});

void test("variant import is idempotent and creates no duplicate configurations", async () => {
  const state = createApplyState([]);
  const rows = [
    row("OPPO Find N6", "Phone", 2, "16", "512", "Stellar Titanium"),
    row("OPPO Find N6", "Phone", 3, "16", "512", "Stellar Titanium"),
    row("OPPO Find N6", "Phone", 4, "16", "512", "Blossom Orange"),
  ];
  const plan = buildProductMasterPlan(rows, state.models, series);
  await applyProductMasterPlan(state.prisma as never, plan);
  assert.equal(state.models[0]?.variants?.length, 2);
  const second = buildProductMasterPlan(rows, state.models, series);
  assert.equal(second.variantCreateCount, 0);
  assert.equal(second.variantUnchangedCount, 2);
});
