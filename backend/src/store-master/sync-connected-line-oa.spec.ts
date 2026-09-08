import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { syncConnectedLineOaMetadata } from "./sync-connected-line-oa";

function fixture() {
  const masters = [
    {
      id: "master-12140",
      externalStoreId: "12140",
      storeName: "OBS Central Nakhon Si Thammarat FL.2 By Inter Computer & IT",
      accountName: "OPPO Central Nakhon.",
      normalizedAccountName: "oppocentralnakhon",
      lineId: "@tay5614g",
      province: "Nakhon Si Thammarat",
      region: "Southern",
      isActive: true,
      updatedAt: new Date(),
    },
    {
      id: "master-22057",
      externalStoreId: "22057",
      storeName: "OBS The Mall Korat By 8 Global Corporation",
      accountName: "OPPO The Mall Korat",
      normalizedAccountName: "oppothemallkorat",
      lineId: "@korat",
      province: "Nakhon Ratchasima",
      region: "Northeastern",
      isActive: true,
      updatedAt: new Date(),
    },
    {
      id: "master-23590",
      externalStoreId: "23590",
      storeName: "OBS Big C Suwinthawong FL.2 By Phechduang",
      accountName: "OPPO BC Suwinthawong",
      normalizedAccountName: "oppobcsuwinthawong",
      lineId: "@333yzqqa",
      province: "Bangkok",
      region: "Central",
      isActive: true,
      updatedAt: new Date(),
    },
  ];

  const stores = [
    {
      id: "store-12140",
      code: "12140",
      name: "OBS The Mall Korat By 8 Global Corporation",
      region: "Northeastern",
      area: "Nakhon Si Thammarat",
      storeMasterId: "master-12140",
      storeMaster: {
        id: "master-12140",
        externalStoreId: "12140",
        storeName: masters[0].storeName,
        region: masters[0].region,
        province: masters[0].province,
        isActive: true,
      },
    },
    {
      id: "store-22057",
      code: "22057",
      name: masters[1].storeName,
      region: masters[1].region,
      area: masters[1].province,
      storeMasterId: "master-22057",
      storeMaster: {
        id: "master-22057",
        externalStoreId: "22057",
        storeName: masters[1].storeName,
        region: masters[1].region,
        province: masters[1].province,
        isActive: true,
      },
    },
    {
      id: "store-23590",
      code: "23590",
      name: "OBS Central Nakhon Si Thammarat FL.2 By Inter Computer & IT",
      region: "Southern",
      area: "Bangkok",
      storeMasterId: "master-23590",
      storeMaster: {
        id: "master-23590",
        externalStoreId: "23590",
        storeName: masters[2].storeName,
        region: masters[2].region,
        province: masters[2].province,
        isActive: true,
      },
    },
  ];

  const accounts = [
    {
      id: "oa-12140",
      name: "OPPO Central Nakhon.",
      basicId: "@tay5614g",
      store: {
        id: "store-12140",
        code: "12140",
        name: stores[0].name,
        region: stores[0].region,
        area: stores[0].area,
        storeMasterId: "master-12140",
        storeMaster: { externalStoreId: "12140" },
      },
    },
    {
      id: "oa-23590",
      name: "OPPO BC Suwinthawong",
      basicId: "@333yzqqa",
      store: {
        id: "store-23590",
        code: "23590",
        name: stores[2].name,
        region: stores[2].region,
        area: stores[2].area,
        storeMasterId: "master-23590",
        storeMaster: { externalStoreId: "23590" },
      },
    },
  ];

  const storeWrites: Array<{ id: string; data: Record<string, unknown> }> = [];
  const accountWrites: Array<Record<string, unknown>> = [];
  const conversationWrites: Array<Record<string, unknown>> = [];

  const prisma = {
    storeMaster: {
      findMany: ({ where }: { where: Record<string, unknown> }) => {
        if (where.externalStoreId) {
          return Promise.resolve(masters.filter((m) => m.externalStoreId === where.externalStoreId));
        }
        const lineId = (where.lineId as { equals?: string } | undefined)?.equals;
        if (lineId) return Promise.resolve(masters.filter((m) => m.lineId.toLowerCase() === lineId.toLowerCase()));
        if (where.normalizedAccountName) {
          return Promise.resolve(masters.filter((m) => m.normalizedAccountName === where.normalizedAccountName));
        }
        return Promise.resolve([]);
      },
      findFirst: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          masters.find((m) =>
            (where.id ? m.id === where.id : true) &&
            (where.externalStoreId ? m.externalStoreId === where.externalStoreId : true),
          ) ?? null,
        ),
    },
    store: {
      findMany: () => Promise.resolve(stores),
      findUnique: ({ where }: { where: { code?: string } }) =>
        Promise.resolve(stores.find((s) => s.code === where.code) ?? null),
      findFirst: ({ where }: { where: { OR?: Array<Record<string, unknown>> } }) =>
        Promise.resolve(
          stores.find((store) =>
            (where.OR ?? []).some(
              (candidate) => candidate.storeMasterId === store.storeMasterId || candidate.code === store.code,
            ),
          ) ?? null,
        ),
      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        storeWrites.push({ id: where.id, data });
        return Promise.resolve({});
      },
    },
    lineOfficialAccount: {
      findMany: () => Promise.resolve(accounts),
      update: ({ data }: { data: Record<string, unknown> }) => {
        accountWrites.push(data);
        return Promise.resolve({});
      },
    },
    conversation: {
      updateMany: ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        conversationWrites.push({ where, data });
        return Promise.resolve({ count: 1 });
      },
    },
  } as unknown as PrismaClient;

  return { masters, stores, accounts, storeWrites, accountWrites, conversationWrites, prisma };
}

void test("repairs store name/region/province by Store ID without changing Store ID", async () => {
  const value = fixture();
  const report = await syncConnectedLineOaMetadata(value.prisma, false);

  assert.equal(report.storeMetadataUpdated, 2);
  assert.equal(report.storeIdConflicts, 0);
  assert.deepEqual(
    value.storeWrites.filter((write) => ["store-12140", "store-23590"].includes(write.id)),
    [
      {
        id: "store-12140",
        data: {
          storeMasterId: "master-12140",
          code: "12140",
          name: "OBS Central Nakhon Si Thammarat FL.2 By Inter Computer & IT",
          region: "Southern",
          area: "Nakhon Si Thammarat",
          provinceSource: "MASTER",
          regionSource: "MASTER",
        },
      },
      {
        id: "store-23590",
        data: {
          storeMasterId: "master-23590",
          code: "23590",
          name: "OBS Big C Suwinthawong FL.2 By Phechduang",
          region: "Central",
          area: "Bangkok",
          provinceSource: "MASTER",
          regionSource: "MASTER",
        },
      },
    ],
  );
  assert.deepEqual(value.accountWrites, []);
  assert.deepEqual(value.conversationWrites, []);
});

void test("LINE identity can never move an OA away from an established Store ID", async () => {
  const value = fixture();
  value.accounts[0].name = "OPPO The Mall Korat";
  value.accounts[0].basicId = "@korat";

  await syncConnectedLineOaMetadata(value.prisma, false);

  assert.deepEqual(value.accountWrites, []);
  assert.deepEqual(value.conversationWrites, []);
  const writesFor12140 = value.storeWrites.filter((write) => write.id === "store-12140");
  assert.ok(writesFor12140.length >= 1);
  assert.equal(writesFor12140[0].data.code, "12140");
  assert.equal(writesFor12140[0].data.storeMasterId, "master-12140");
});

void test("dry run reports metadata repairs without changing any data", async () => {
  const value = fixture();
  const report = await syncConnectedLineOaMetadata(value.prisma, true);

  assert.equal(report.storeMetadataUpdated, 2);
  assert.deepEqual(value.storeWrites, []);
  assert.deepEqual(value.accountWrites, []);
  assert.deepEqual(value.conversationWrites, []);
});
