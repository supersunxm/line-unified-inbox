import assert from "node:assert/strict";
import test from "node:test";
import { ProductGroup } from "@prisma/client";
import {
  buildProductMasterPlan,
  canonicalizeProductMasterRows,
  ProductMasterExistingSeries,
  ProductMasterRow,
} from "./product-master-sync";

const row = (
  name: string,
  ram: string,
  rom: string,
  color: string,
  sourceRowNumber: number,
): ProductMasterRow => ({
  name,
  category: "Phone",
  ram,
  rom,
  color,
  sourceRowNumber,
});

const series: ProductMasterExistingSeries[] = [
  { name: "A Series", productGroup: ProductGroup.SMARTPHONE, isActive: true },
];

void test("A7 Pro and A7 Pro Max map to A Series with all Product Master variants", () => {
  const rows: ProductMasterRow[] = [
    row("OPPO A7 Pro 5G", "8", "128", "Surfing Blue", 2),
    row("OPPO A7 Pro 5G", "8", "128", "Shine Titanium", 3),
    row("OPPO A7 Pro 5G", "8", "128", "Bloom Pink", 4),
    row("OPPO A7 Pro 5G", "8", "256", "Surfing Blue", 5),
    row("OPPO A7 Pro 5G", "8", "256", "Shine Titanium", 6),
    row("OPPO A7 Pro 5G", "8", "256", "Bloom Pink", 7),
    row("OPPO A7 Pro 5G", "6", "256", "Surfing Blue", 8),
    row("OPPO A7 Pro 5G", "6", "256", "Shine Titanium", 9),
    row("OPPO A7 Pro 5G", "6", "256", "Bloom Pink", 10),
    row("OPPO A7 Pro Max 5G", "8", "128", "Surfing Blue", 11),
    row("OPPO A7 Pro Max 5G", "8", "128", "Lunar Black", 12),
    row("OPPO A7 Pro Max 5G", "8", "256", "Surfing Blue", 13),
    row("OPPO A7 Pro Max 5G", "8", "256", "Lunar Black", 14),
  ];

  const canonicalized = canonicalizeProductMasterRows(rows);
  assert.deepEqual(canonicalized.ambiguous, []);
  assert.equal(canonicalized.canonical.length, 2);
  assert.equal(canonicalized.canonical.find(({ name }) => name === "OPPO A7 Pro 5G")?.seriesName, "A Series");
  assert.equal(canonicalized.canonical.find(({ name }) => name === "OPPO A7 Pro Max 5G")?.seriesName, "A Series");
  assert.equal(canonicalized.canonical.find(({ name }) => name === "OPPO A7 Pro 5G")?.variants.length, 9);
  assert.equal(canonicalized.canonical.find(({ name }) => name === "OPPO A7 Pro Max 5G")?.variants.length, 4);

  const plan = buildProductMasterPlan(rows, [], series);
  assert.deepEqual(plan.ambiguous, []);
  assert.equal(plan.createCount, 2);
  assert.equal(plan.variantCreateCount, 13);
  assert.equal(plan.deleteCount, 0);
});

void test("generic A-series mapping does not classify non-model words", () => {
  const result = canonicalizeProductMasterRows([
    row("OPPO Air Something", "8", "256", "Black", 2),
  ]);
  assert.equal(result.canonical.length, 0);
  assert.equal(result.ambiguous.length, 1);
});
