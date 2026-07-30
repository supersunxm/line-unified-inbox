import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ProductAliasSource, ProductGroup, PrismaClient } from "@prisma/client";
import { catalogAlias } from "./product-alias";
import { CatalogEntry, PRODUCT_CATALOG } from "./product-catalog";
import { seedProductCatalog } from "./product-catalog-maintenance";
import { ProductAliasAdoptionEntry } from "./product-alias-adoption";

const phase1Manifest = JSON.parse(
  readFileSync("scripts/data/product-alias-adoption-phase1.json", "utf8"),
) as ProductAliasAdoptionEntry[];

type AliasRow = {
  id: string;
  productModelId: string;
  alias: string;
  normalizedAlias: string;
  language?: string;
  isActive: boolean;
  source: ProductAliasSource;
};

function catalogEntry(alias = "test model"): CatalogEntry {
  return {
    group: ProductGroup.SMARTPHONE,
    family: "Test Series",
    model: "OPPO Test Model",
    level: "MODEL",
    priority: 100,
    aliases: [catalogAlias(alias, "SAFE_EXACT")],
  };
}

function createPrismaMock(initialAliases: AliasRow[] = []) {
  const aliases = initialAliases.map((alias) => ({ ...alias }));
  let aliasSequence = aliases.length;
  let deleteCalls = 0;
  const prisma = {
    productSeries: {
      upsert: () => Promise.resolve({ id: "series-id" }),
    },
    productModel: {
      upsert: () => Promise.resolve({ id: "model-id" }),
    },
    productAlias: {
      findMany: ({ where }: { where: { normalizedAlias: { in: string[] } } }) =>
        Promise.resolve(aliases.filter(({ normalizedAlias }) => where.normalizedAlias.in.includes(normalizedAlias))),
      create: ({ data }: { data: Omit<AliasRow, "id" | "isActive"> }) => {
        const row = { ...data, id: `alias-${++aliasSequence}`, isActive: true };
        aliases.push(row);
        return Promise.resolve(row);
      },
      update: ({ where, data }: { where: { id: string }; data: Partial<AliasRow> }) => {
        const row = aliases.find(({ id }) => id === where.id);
        if (!row) throw new Error("Alias not found");
        Object.assign(row, data);
        return Promise.resolve(row);
      },
      updateMany: ({ where, data }: { where: { source: ProductAliasSource; normalizedAlias: { notIn: string[] } }; data: { isActive: boolean } }) => {
        let count = 0;
        for (const row of aliases) {
          if (row.source === where.source && !where.normalizedAlias.notIn.includes(row.normalizedAlias)) {
            row.isActive = data.isActive;
            count++;
          }
        }
        return Promise.resolve({ count });
      },
      delete: () => {
        deleteCalls++;
        throw new Error("Catalog synchronization must not delete aliases");
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, aliases, getDeleteCalls: () => deleteCalls };
}

void test("catalog sync creates CATALOG aliases and is idempotent", async () => {
  const state = createPrismaMock();
  await seedProductCatalog(state.prisma, [catalogEntry()]);
  await seedProductCatalog(state.prisma, [catalogEntry()]);

  assert.equal(state.aliases.length, 1);
  assert.equal(state.aliases[0]?.source, ProductAliasSource.CATALOG);
  assert.equal(state.aliases[0]?.isActive, true);
  assert.equal(state.getDeleteCalls(), 0);
});

void test("catalog reconciliation deactivates stale CATALOG aliases, preserves MANUAL aliases, and restores catalog aliases", async () => {
  const state = createPrismaMock([
    { id: "stale", productModelId: "model-id", alias: "stale alias", normalizedAlias: "stalealias", isActive: true, source: ProductAliasSource.CATALOG },
    { id: "manual", productModelId: "model-id", alias: "operator alias", normalizedAlias: "operatoralias", isActive: true, source: ProductAliasSource.MANUAL },
  ]);

  await seedProductCatalog(state.prisma, [catalogEntry()]);
  assert.equal(state.aliases.find(({ id }) => id === "stale")?.isActive, false);
  assert.equal(state.aliases.find(({ id }) => id === "manual")?.isActive, true);

  await seedProductCatalog(state.prisma, [catalogEntry("stale alias")]);
  assert.equal(state.aliases.find(({ id }) => id === "stale")?.isActive, true);
  assert.equal(state.aliases.find(({ id }) => id === "manual")?.isActive, true);
  assert.equal(state.getDeleteCalls(), 0);
});

void test("catalog synchronization fails before mutation on a same-key MANUAL alias", async () => {
  const state = createPrismaMock([
    { id: "manual", productModelId: "operator-model", alias: "test model", normalizedAlias: "testmodel", isActive: true, source: ProductAliasSource.MANUAL },
  ]);

  await assert.rejects(seedProductCatalog(state.prisma, [catalogEntry()]), /ownership conflict.*testmodel/);
  assert.deepEqual(state.aliases, [
    { id: "manual", productModelId: "operator-model", alias: "test model", normalizedAlias: "testmodel", isActive: true, source: ProductAliasSource.MANUAL },
  ]);
  assert.equal(state.getDeleteCalls(), 0);
});

void test("Phase 1 first sync creates only a6pro5g, preserves ten MANUAL aliases, and is idempotent", async () => {
  const excluded = [
    ["4891de32-a853-4712-b14a-aac1221fd649", "powerbank"],
    ["981bc496-dda7-49ac-bf70-309d926017c2", "reno"],
    ["1458fd6c-e23b-4f67-9634-cb57b154cc31", "smarthome"],
    ["0d4b767e-e4d0-45d7-b98c-e8fab527a4d0", "smarttv"],
    ["b5d07378-2dbe-4dca-9012-38af6ecab3ae", "smartwatch"],
    ["d985fc9a-477b-489e-a842-f0df60dd6209", "กล้องวงจรปิด"],
    ["c9bcc06e-3453-4f5b-a34b-15c7a24481b0", "ทีวี"],
    ["4c534861-46ee-42a9-9c6e-0e65acc19aea", "เราเตอร์"],
    ["b6683262-bb91-4152-88bb-bdea8a8d84fd", "สายtypec"],
    ["6c592d80-b47d-4b8a-8503-be6d11193b52", "คีย์บอร์ดแท็บเล็ต"],
  ] as const;
  const adoptedRows: AliasRow[] = phase1Manifest.map((entry) => ({
    id: entry.id,
    productModelId: `model:${entry.modelName}`,
    alias: entry.normalizedAlias,
    normalizedAlias: entry.normalizedAlias,
    isActive: true,
    source: ProductAliasSource.CATALOG,
  }));
  const manualRows: AliasRow[] = excluded.map(([id, normalizedAlias]) => ({
    id,
    productModelId: "manual-model",
    alias: normalizedAlias,
    normalizedAlias,
    isActive: true,
    source: ProductAliasSource.MANUAL,
  }));
  const state = createPrismaMock([...adoptedRows, ...manualRows]);

  await seedProductCatalog(state.prisma, PRODUCT_CATALOG);
  assert.equal(state.aliases.length, 86);
  assert.equal(state.aliases.find(({ normalizedAlias }) => normalizedAlias === "a6pro5g")?.source, ProductAliasSource.CATALOG);
  assert.equal(manualRows.every(({ id }) => state.aliases.find((row) => row.id === id)?.source === ProductAliasSource.MANUAL), true);
  assert.equal(adoptedRows.every(({ id }) => state.aliases.find((row) => row.id === id)?.isActive), true);
  assert.equal(state.getDeleteCalls(), 0);

  await seedProductCatalog(state.prisma, PRODUCT_CATALOG);
  assert.equal(state.aliases.length, 86);
  assert.equal(state.getDeleteCalls(), 0);
});
