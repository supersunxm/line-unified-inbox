import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { syncConnectedLineOaMetadata } from "./sync-connected-line-oa";

function fixture() {
  const account = {
    id: "oa-1",
    encryptedChannelSecret: "secret-ciphertext",
    encryptedChannelAccessToken: "token-ciphertext",
    webhookKey: "stable-webhook-key",
    store: {
      id: "store-1",
      code: "22535",
      name: "Old Store",
      region: "Old",
      area: "Old",
      storeMasterId: "new-master",
    },
  };
  const master = {
    id: "new-master",
    externalStoreId: "22535",
    storeName: "Corrected Store",
    accountName: "Corrected Account",
    lineId: "@correct",
    lineOaLink: "https://lin.ee/correct",
    lineManagerUrl: "https://manager.line.biz/account/correct",
    province: "Lamphun",
    region: "Northern",
    isActive: true,
    updatedAt: new Date(),
  };
  const writes: Array<Record<string, unknown>> = [];
  const prisma = {
    lineOfficialAccount: { findMany: () => Promise.resolve([account]) },
    storeMaster: { findFirst: () => Promise.resolve(master) },
    store: {
      update: ({ data }: { data: Record<string, unknown> }) => {
        writes.push(data);
        return Promise.resolve({});
      },
    },
  } as unknown as PrismaClient;
  return { account, master, writes, prisma };
}

void test("sync refreshes copied metadata without credential or webhook fields", async () => {
  const { account, writes, prisma } = fixture();
  const before = {
    secret: account.encryptedChannelSecret,
    token: account.encryptedChannelAccessToken,
    webhookKey: account.webhookKey,
  };

  assert.deepEqual(await syncConnectedLineOaMetadata(prisma, false), {
    processed: 1,
    updated: 1,
    unchanged: 0,
    missingStoreMaster: 0,
    failed: 0,
  });
  assert.deepEqual(writes[0], {
    storeMasterId: "new-master",
    code: "22535",
    name: "Corrected Store",
    region: "Northern",
    area: "Lamphun",
    provinceSource: "MASTER",
    regionSource: "MASTER",
  });
  assert.deepEqual(
    {
      secret: account.encryptedChannelSecret,
      token: account.encryptedChannelAccessToken,
      webhookKey: account.webhookKey,
    },
    before,
  );
  assert.equal("webhookKey" in writes[0], false);
  assert.equal("encryptedChannelSecret" in writes[0], false);
  assert.equal("encryptedChannelAccessToken" in writes[0], false);
});

void test("sync follows the linked Store Master when Store ID changes in the source sheet", async () => {
  const { account, master, writes, prisma } = fixture();
  account.store.code = "OLD-STORE-ID";
  account.store.name = "OBS Lotus Chum Phae Khonkaen FL.1 By Com7";
  master.externalStoreId = "30538";
  master.storeName = "OBS Central Phitsanulok By Hengcharoen Phitsanulok";
  master.province = "Phitsanulok";
  master.region = "Northern";

  assert.deepEqual(await syncConnectedLineOaMetadata(prisma, false), {
    processed: 1,
    updated: 1,
    unchanged: 0,
    missingStoreMaster: 0,
    failed: 0,
  });
  assert.deepEqual(writes[0], {
    storeMasterId: "new-master",
    code: "30538",
    name: "OBS Central Phitsanulok By Hengcharoen Phitsanulok",
    region: "Northern",
    area: "Phitsanulok",
    provinceSource: "MASTER",
    regionSource: "MASTER",
  });
});

void test("dry run reports the change and writes nothing", async () => {
  const { writes, prisma } = fixture();
  const report = await syncConnectedLineOaMetadata(prisma, true);
  assert.equal(report.updated, 1);
  assert.deepEqual(writes, []);
});

void test("an already synchronized account is unchanged and repeat-safe", async () => {
  const value = fixture();
  value.account.store = {
    id: "store-1",
    code: "22535",
    name: "Corrected Store",
    region: "Northern",
    area: "Lamphun",
    storeMasterId: "new-master",
  };
  assert.deepEqual(await syncConnectedLineOaMetadata(value.prisma, false), {
    processed: 1,
    updated: 0,
    unchanged: 1,
    missingStoreMaster: 0,
    failed: 0,
  });
  assert.deepEqual(value.writes, []);
});
