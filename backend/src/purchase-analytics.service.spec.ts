import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { PurchaseAnalyticsService } from "./purchase-analytics.service";

const baseRow = {
  id: "conversation-1",
  purchaseRecordedAt: new Date("2026-08-10T10:00:00.000Z"),
  sourceChannels: ["STORE"],
  isInstallment: true,
  store: { id: "store-1", name: "Central", code: "C01" },
  purchaseRecordedBy: { id: "bm-1", displayName: "BM One" },
  products: [
    {
      source: "MANUAL",
      productModel: { id: "model-1", name: "OPPO Find", productSeries: { name: "Find" } },
      productVariant: { id: "variant-1", ram: "12GB", rom: "256GB", color: "Black" },
    },
    {
      source: "RULE",
      productModel: { id: "model-rule", name: "Rule suggestion", productSeries: { name: "Rule" } },
      productVariant: null,
    },
  ],
};

function createService(rows: unknown[], stores: string[] | null = null) {
  let lastWhere: Record<string, unknown> | undefined;
  const prisma = { conversation: { findMany: async (args: { where: Record<string, unknown> }) => { lastWhere = args.where; return rows; } } };
  const storeAccess = { accessibleStoreIds: async () => stores };
  return { service: new PurchaseAnalyticsService(prisma as never, storeAccess as never), where: () => lastWhere };
}

test("purchase analytics includes MANUAL data and excludes RULE products", async () => {
  const result = await createService([baseRow]).service.get({ id: "admin", role: "ADMIN" } as never);
  assert.equal(result.overview.verifiedPurchaseRecords, 1);
  assert.equal(result.overview.recordedProducts, 1);
  assert.deepEqual(result.products.map((item) => item.name), ["OPPO Find"]);
  assert.deepEqual(result.colors, [{ label: "Black", count: 1 }]);
  assert.deepEqual(result.channels, [{ label: "STORE", count: 1 }]);
  assert.deepEqual(result.paymentMethods, [{ label: "INSTALLMENT", count: 1 }]);
});

test("purchase analytics applies date filters to verified records", async () => {
  const fake = createService([baseRow]);
  await fake.service.get({ id: "admin", role: "ADMIN" } as never, { from: "2026-08-11", to: "2026-08-12" });
  const filter = fake.where()?.purchaseRecordedAt as { gte: Date; lt: Date };
  assert.equal(filter.gte.toISOString(), "2026-08-10T17:00:00.000Z");
  assert.equal(filter.lt.toISOString(), "2026-08-12T17:00:00.000Z");
});

test("store users cannot request another store's analytics", async () => {
  const service = createService([], ["store-1"]).service;
  await assert.rejects(
    () => service.get({ id: "bm-1", role: "VIEWER" } as never, { storeId: "store-2" }),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test("empty purchase scope returns safe empty analytics", async () => {
  const result = await createService([], ["store-1"]).service.get({ id: "bm-1", role: "VIEWER" } as never);
  assert.equal(result.overview.verifiedPurchaseRecords, 0);
  assert.deepEqual(result.products, []);
  assert.deepEqual(result.recordingActivity, []);
});

test("legacy purchase snapshots without provenance are excluded", async () => {
  const legacy = { ...baseRow, id: "legacy", purchaseRecordedAt: null, purchaseRecordedBy: null };
  const result = await createService([legacy]).service.get({ id: "admin", role: "ADMIN" } as never);
  assert.equal(result.overview.verifiedPurchaseRecords, 0);
  assert.deepEqual(result.products, []);
});
