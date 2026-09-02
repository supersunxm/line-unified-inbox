import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { syncConnectedLineOaMetadata } from "./sync-connected-line-oa";

function fixture() {
  const chumPhaeMaster = {
    id: "master-17469",
    externalStoreId: "17469",
    storeName: "OBS Lotus Chum Phae Khonkaen FL.1 By Com7",
    accountName: "OPPOLotusChumphaeBS",
    normalizedAccountName: "oppolotuschumphaebs",
    lineId: "@975tvkio",
    lineOaLink: "https://lin.ee/KwBZatG",
    lineManagerUrl: "https://chat.line.biz/account/@975tvkio",
    province: "Khon Kaen",
    region: "Northeastern",
    isActive: true,
    updatedAt: new Date(),
  };
  const phitsanulokMaster = {
    id: "master-30538",
    externalStoreId: "30538",
    storeName: "OBS Central Phitsanulok By Hengcharoen Phitsanulok",
    accountName: "OPPO Phitsanulok",
    normalizedAccountName: "oppophitsanulok",
    lineId: "@nux7670t",
    lineOaLink: "https://lin.ee/Q22BCVx",
    lineManagerUrl: "https://chat.line.biz/account/@nux7670t",
    province: "Phitsanulok",
    region: "Northern",
    isActive: true,
    updatedAt: new Date(),
  };
  const account = {
    id: "oa-chum-phae",
    name: "OPPOLotusChumphaeBS",
    basicId: "@975tvkio",
    encryptedChannelSecret: "secret-ciphertext",
    encryptedChannelAccessToken: "token-ciphertext",
    webhookKey: "stable-webhook-key",
    store: {
      id: "store-30538",
      code: "30538",
      name: phitsanulokMaster.storeName,
      region: phitsanulokMaster.region,
      area: phitsanulokMaster.province,
      storeMasterId: phitsanulokMaster.id,
    },
  };
  const chumPhaeStore = {
    id: "store-17469",
    code: "17469",
    name: chumPhaeMaster.storeName,
    region: chumPhaeMaster.region,
    area: chumPhaeMaster.province,
    storeMasterId: chumPhaeMaster.id,
  };
  const stores = [account.store, chumPhaeStore];
  const storeWrites: Array<{ id: string; data: Record<string, unknown> }> = [];
  const accountWrites: Array<Record<string, unknown>> = [];
  const conversationWrites: Array<Record<string, unknown>> = [];

  const prisma = {
    lineOfficialAccount: {
      findMany: () => Promise.resolve([account]),
      update: ({ data }: { data: Record<string, unknown> }) => {
        accountWrites.push(data);
        return Promise.resolve({});
      },
    },
    storeMaster: {
      findMany: ({ where }: { where: Record<string, unknown> }) => {
        const lineId = (where.lineId as { equals?: string } | undefined)?.equals;
        if (lineId) {
          return Promise.resolve(
            [chumPhaeMaster, phitsanulokMaster].filter(
              (master) => master.lineId.toLocaleLowerCase() === lineId.toLocaleLowerCase(),
            ),
          );
        }
        const normalizedAccountName = where.normalizedAccountName;
        return Promise.resolve(
          [chumPhaeMaster, phitsanulokMaster].filter(
            (master) => master.normalizedAccountName === normalizedAccountName,
          ),
        );
      },
      findFirst: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          [chumPhaeMaster, phitsanulokMaster].find(
            (master) =>
              master.id === where.id || master.externalStoreId === where.externalStoreId,
          ) ?? null,
        ),
    },
    store: {
      findFirst: ({ where }: { where: { OR?: Array<Record<string, unknown>> } }) =>
        Promise.resolve(
          stores.find((store) =>
            (where.OR ?? []).some(
              (candidate) =>
                candidate.storeMasterId === store.storeMasterId || candidate.code === store.code,
            ),
          ) ?? null,
        ),
      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        storeWrites.push({ id: where.id, data });
        return Promise.resolve({});
      },
      create: ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "created-store",
          code: (data.code as string | null) ?? null,
          name: data.name as string,
          region: (data.region as string | null) ?? null,
          area: (data.area as string | null) ?? null,
          storeMasterId: data.storeMasterId as string,
        }),
    },
    conversation: {
      updateMany: ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        conversationWrites.push({ where, data });
        return Promise.resolve({ count: 1 });
      },
    },
  } as unknown as PrismaClient;

  return {
    account,
    chumPhaeMaster,
    phitsanulokMaster,
    chumPhaeStore,
    stores,
    storeWrites,
    accountWrites,
    conversationWrites,
    prisma,
  };
}

void test("sync rebinds OPPOLotusChumphaeBS away from the unconnectable 30538 store", async () => {
  const value = fixture();
  const before = {
    secret: value.account.encryptedChannelSecret,
    token: value.account.encryptedChannelAccessToken,
    webhookKey: value.account.webhookKey,
  };

  assert.deepEqual(await syncConnectedLineOaMetadata(value.prisma, false), {
    processed: 1,
    updated: 1,
    unchanged: 0,
    missingStoreMaster: 0,
    failed: 0,
  });
  assert.deepEqual(value.accountWrites, [{ storeId: "store-17469" }]);
  assert.deepEqual(value.conversationWrites, [
    {
      where: { lineOfficialAccountId: "oa-chum-phae" },
      data: { storeId: "store-17469" },
    },
  ]);
  assert.deepEqual(value.storeWrites, []);
  assert.deepEqual(
    {
      secret: value.account.encryptedChannelSecret,
      token: value.account.encryptedChannelAccessToken,
      webhookKey: value.account.webhookKey,
    },
    before,
  );
});

void test("sync refreshes metadata in place when the OA already belongs to the correct store", async () => {
  const value = fixture();
  value.account.store = {
    id: value.chumPhaeStore.id,
    code: value.chumPhaeStore.code,
    name: "Old Chum Phae Name",
    region: "Old",
    area: "Old",
    storeMasterId: value.chumPhaeMaster.id,
  };
  value.stores.splice(0, value.stores.length, value.account.store);

  assert.deepEqual(await syncConnectedLineOaMetadata(value.prisma, false), {
    processed: 1,
    updated: 1,
    unchanged: 0,
    missingStoreMaster: 0,
    failed: 0,
  });
  assert.deepEqual(value.storeWrites, [
    {
      id: "store-17469",
      data: {
        storeMasterId: "master-17469",
        code: "17469",
        name: "OBS Lotus Chum Phae Khonkaen FL.1 By Com7",
        region: "Northeastern",
        area: "Khon Kaen",
        provinceSource: "MASTER",
        regionSource: "MASTER",
      },
    },
  ]);
  assert.deepEqual(value.accountWrites, []);
});

void test("dry run reports a wrong OA-to-store binding without writing", async () => {
  const value = fixture();
  const report = await syncConnectedLineOaMetadata(value.prisma, true);
  assert.equal(report.updated, 1);
  assert.deepEqual(value.storeWrites, []);
  assert.deepEqual(value.accountWrites, []);
  assert.deepEqual(value.conversationWrites, []);
});

void test("an already synchronized account is unchanged and repeat-safe", async () => {
  const value = fixture();
  value.account.store = { ...value.chumPhaeStore };
  value.stores.splice(0, value.stores.length, value.account.store);

  assert.deepEqual(await syncConnectedLineOaMetadata(value.prisma, false), {
    processed: 1,
    updated: 0,
    unchanged: 1,
    missingStoreMaster: 0,
    failed: 0,
  });
  assert.deepEqual(value.storeWrites, []);
  assert.deepEqual(value.accountWrites, []);
  assert.deepEqual(value.conversationWrites, []);
});
