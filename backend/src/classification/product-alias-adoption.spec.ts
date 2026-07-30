import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ProductAliasSource, PrismaClient } from "@prisma/client";
import { adoptProductAliasOwnership, ProductAliasAdoptionEntry } from "./product-alias-adoption";

const manifest = JSON.parse(
  readFileSync("scripts/data/product-alias-adoption-phase1.json", "utf8"),
) as ProductAliasAdoptionEntry[];
const excludedIds = new Set([
  "4891de32-a853-4712-b14a-aac1221fd649",
  "981bc496-dda7-49ac-bf70-309d926017c2",
  "1458fd6c-e23b-4f67-9634-cb57b154cc31",
  "0d4b767e-e4d0-45d7-b98c-e8fab527a4d0",
  "b5d07378-2dbe-4dca-9012-38af6ecab3ae",
  "d985fc9a-477b-489e-a842-f0df60dd6209",
  "c9bcc06e-3453-4f5b-a34b-15c7a24481b0",
  "4c534861-46ee-42a9-9c6e-0e65acc19aea",
  "b6683262-bb91-4152-88bb-bdea8a8d84fd",
  "6c592d80-b47d-4b8a-8503-be6d11193b52",
]);

function createAdoptionMock(source: ProductAliasSource = ProductAliasSource.MANUAL, maximumUpdates = Number.POSITIVE_INFINITY) {
  const rows = manifest.map((entry) => ({
    id: entry.id,
    normalizedAlias: entry.normalizedAlias,
    isActive: true,
    source,
    productModel: { name: entry.modelName },
  }));
  let transactions = 0;
  let updateCalls = 0;
  const productAlias = {
    findMany: () => Promise.resolve(rows),
    updateMany: ({ where, data }: { where: { id: { in: string[] }; source: ProductAliasSource; isActive: boolean }; data: { source: ProductAliasSource } }) => {
      updateCalls++;
      let count = 0;
      for (const row of rows) {
        if (count < maximumUpdates && where.id.in.includes(row.id) && row.source === where.source && row.isActive === where.isActive) {
          row.source = data.source;
          count++;
        }
      }
      return Promise.resolve({ count });
    },
  };
  const prisma = {
    productAlias,
    $transaction: async (callback: (tx: { productAlias: typeof productAlias }) => Promise<number>) => {
      transactions++;
      const snapshot = rows.map((row) => ({ ...row }));
      try {
        return await callback({ productAlias });
      } catch (error) {
        rows.splice(0, rows.length, ...snapshot);
        throw error;
      }
    },
  };
  return {
    prisma: prisma as unknown as PrismaClient,
    rows,
    getTransactions: () => transactions,
    getUpdateCalls: () => updateCalls,
  };
}

void test("reviewed Phase 1 manifest has exactly 75 unique rows and excludes all ten manual aliases", () => {
  assert.equal(manifest.length, 75);
  assert.equal(new Set(manifest.map(({ id }) => id)).size, 75);
  assert.equal(new Set(manifest.map(({ normalizedAlias }) => normalizedAlias)).size, 75);
  for (const id of excludedIds) assert.equal(manifest.some((entry) => entry.id === id), false, id);
});

void test("adoption dry-run preflights all rows without mutation or a transaction", async () => {
  const state = createAdoptionMock();
  const result = await adoptProductAliasOwnership(state.prisma, manifest, true);

  assert.deepEqual(result, { manifestEntries: 75, eligible: 75, updated: 0, alreadyAdopted: 0, dryRun: true });
  assert.equal(state.rows.every(({ source }) => source === ProductAliasSource.MANUAL), true);
  assert.equal(state.getTransactions(), 0);
  assert.equal(state.getUpdateCalls(), 0);
});

void test("one optimistic mismatch aborts every update inside the transaction", async () => {
  const state = createAdoptionMock();
  state.rows[12].productModel.name = "Unexpected model";

  await assert.rejects(adoptProductAliasOwnership(state.prisma, manifest, false), /preflight failed.*model mismatch/);
  assert.equal(state.rows.every(({ source }) => source === ProductAliasSource.MANUAL), true);
  assert.equal(state.getTransactions(), 1);
  assert.equal(state.getUpdateCalls(), 0);
});

void test("successful adoption transactionally updates exactly 75 sources and repeated execution is safe", async () => {
  const state = createAdoptionMock();
  const applied = await adoptProductAliasOwnership(state.prisma, manifest, false);
  assert.deepEqual(applied, { manifestEntries: 75, eligible: 75, updated: 75, alreadyAdopted: 0, dryRun: false });
  assert.equal(state.rows.every(({ source }) => source === ProductAliasSource.CATALOG), true);
  assert.equal(state.getTransactions(), 1);
  assert.equal(state.getUpdateCalls(), 1);

  const repeated = await adoptProductAliasOwnership(state.prisma, manifest, false);
  assert.deepEqual(repeated, { manifestEntries: 75, eligible: 75, updated: 0, alreadyAdopted: 75, dryRun: false });
  assert.equal(state.getTransactions(), 2);
  assert.equal(state.getUpdateCalls(), 1);
});

void test("an incomplete transactional update rolls back every ownership change", async () => {
  const state = createAdoptionMock(ProductAliasSource.MANUAL, 74);

  await assert.rejects(adoptProductAliasOwnership(state.prisma, manifest, false), /update count mismatch/);
  assert.equal(state.rows.every(({ source }) => source === ProductAliasSource.MANUAL), true);
  assert.equal(state.getTransactions(), 1);
  assert.equal(state.getUpdateCalls(), 1);
});
