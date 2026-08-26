import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import { StoreMasterService } from "./store-master.service";

const header =
  "STORE ID,STORE NAME,ACCOUNT NAME,Line OA Link,Line ID,URLS,Province / จังหวัด,Region / ภูมิภาค,TikTok Username,TikTok Profile URL";

void test("re-import updates the stable Store ID and TikTok fields instead of creating a duplicate", async () => {
  const records: Array<Record<string, unknown>> = [];
  const model = {
    findFirst: ({ where }: { where: { externalStoreId: string } }) =>
      Promise.resolve(
        records.find((item) => item.externalStoreId === where.externalStoreId) ?? null
      ),
    update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const record = records.find((item) => item.id === where.id)!;
      Object.assign(record, data);
      return Promise.resolve(record);
    },
    upsert: ({ create }: { create: Record<string, unknown> }) => {
      const record = { id: `master-${records.length + 1}`, createdAt: new Date(), ...create };
      records.push(record);
      return Promise.resolve(record);
    },
    findMany: () => Promise.resolve(records),
  };
  const prisma = {
    storeMaster: model,
    $transaction: (work: (tx: { storeMaster: typeof model }) => Promise<void>) =>
      work({ storeMaster: model }),
  } as unknown as PrismaService;
  const service = new StoreMasterService(prisma);

  await service.importCsv(
    `${header}\n22535,Old Store,Old Account,https://lin.ee/old,@old,https://manager.line.biz/account/old,Lamphun,Northern,@oppo_old,https://www.tiktok.com/@oppo_old`
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].tiktokUsername, "oppo_old");

  await service.importCsv(
    `${header}\n22535,Corrected Store,Corrected Account,https://lin.ee/new,@new,https://manager.line.biz/account/correct,Lamphun,Northern,@oppo_updated,https://www.tiktok.com/@oppo_updated`
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].storeName, "Corrected Store");
  assert.equal(records[0].lineManagerUrl, "https://manager.line.biz/account/correct");
  assert.equal(records[0].tiktokUsername, "oppo_updated");
  assert.equal(records[0].tiktokProfileUrl, "https://www.tiktok.com/@oppo_updated");
});

void test("validation detects missing, duplicate, and mismatched TikTok account entries", async () => {
  const records: Array<Record<string, unknown>> = [];
  const model = {
    update: ({ where, data }: any) => {
      const record = records.find((item) => item.id === where.id)!;
      Object.assign(record, data);
      return Promise.resolve(record);
    },
    upsert: ({ create }: any) => {
      const record = { id: `master-${records.length + 1}`, createdAt: new Date(), ...create };
      records.push(record);
      return Promise.resolve(record);
    },
    findMany: () => Promise.resolve(records),
  };
  const prisma = {
    storeMaster: model,
    $transaction: (work: any) => work({ storeMaster: model }),
  } as unknown as PrismaService;
  const service = new StoreMasterService(prisma);

  const testCsv = `${header}
22535,Store 1,Account 1,https://lin.ee/1,@1,https://manager.line.biz/account/22535,Bangkok,Central,@oppo_dup,https://www.tiktok.com/@oppo_dup
22536,Store 2,Account 2,https://lin.ee/2,@2,https://manager.line.biz/account/22536,Bangkok,Central,@oppo_dup,https://www.tiktok.com/@oppo_dup
22537,Store 3,Account 3,https://lin.ee/3,@3,https://manager.line.biz/account/22537,Bangkok,Central,,
22538,Store 4,Account 4,https://lin.ee/4,@4,https://manager.line.biz/account/22538,Bangkok,Central,@oppo_mismatch,https://www.tiktok.com/@oppo_other`;

  const validation = await service.importCsv(testCsv);
  assert.equal(validation.total, 4);
  assert.equal(validation.duplicateTikTokUsernames, 2, "Should report duplicate username count");
  assert.equal(validation.missingTikTokUsernames, 1, "Should report missing username count");
  assert.equal(validation.mismatchedTikTokUsernames, 1, "Should detect handle mismatch between column I and J");
});

void test("importCsv persists googleMapsUrl and validation counts invalidGoogleMapsUrls and missingGoogleMapsUrls", async () => {
  const records: Array<Record<string, unknown>> = [];
  const model = {
    update: ({ where, data }: any) => {
      const record = records.find((item) => item.id === where.id)!;
      Object.assign(record, data);
      return Promise.resolve(record);
    },
    upsert: ({ create }: any) => {
      const record = { id: `master-${records.length + 1}`, createdAt: new Date(), ...create };
      records.push(record);
      return Promise.resolve(record);
    },
    findMany: () => Promise.resolve(records),
  };
  const prisma = {
    storeMaster: model,
    $transaction: (work: any) => work({ storeMaster: model }),
  } as unknown as PrismaService;
  const service = new StoreMasterService(prisma);

  const fullHeader = `${header},Google Maps links`;
  const csvData = `${fullHeader}
22535,Store 1,Account 1,https://lin.ee/1,@1,https://manager.line.biz/account/22535,Bangkok,Central,,,https://maps.app.goo.gl/valid1?q=rama9
22536,Store 2,Account 2,https://lin.ee/2,@2,https://manager.line.biz/account/22536,Bangkok,Central,,,https://www.google.com/maps/place/OPPO+Central
22537,Store 3,Account 3,https://lin.ee/3,@3,https://manager.line.biz/account/22537,Bangkok,Central,,,http://insecure.maps.google.com/not-https
22538,Store 4,Account 4,https://lin.ee/4,@4,https://manager.line.biz/account/22538,Bangkok,Central,,,`;

  const validation = await service.importCsv(csvData);
  assert.equal(validation.total, 4);
  assert.equal(records[0].googleMapsUrl, "https://maps.app.goo.gl/valid1?q=rama9");
  assert.equal(records[1].googleMapsUrl, "https://www.google.com/maps/place/OPPO+Central");
  assert.equal(records[2].googleMapsUrl, "http://insecure.maps.google.com/not-https");
  assert.equal(records[3].googleMapsUrl, null);

  assert.equal(validation.invalidGoogleMapsUrls, 1, "Should count 1 invalid (insecure) Google Maps URL");
  assert.equal(validation.missingGoogleMapsUrls, 1, "Should count 1 missing Google Maps URL");
});

void test("search exposes googleMapsUrl in suggestions", async () => {
  const records = [
    {
      id: "master-1",
      externalStoreId: "22535",
      storeName: "OPPO Central World",
      accountName: "OPPO Central World",
      normalizedAccountName: "oppocentralworld",
      lineId: "@oppocw",
      lineOaLink: "https://lin.ee/cw",
      lineManagerUrl: "https://manager.line.biz/account/22535",
      tiktokUsername: "oppo_cw",
      tiktokProfileUrl: "https://www.tiktok.com/@oppo_cw",
      googleMapsUrl: "https://maps.app.goo.gl/centralworld",
      province: "Bangkok",
      region: "Central",
      dataQualityStatus: "COMPLETE",
      isActive: true,
      stores: [],
    },
  ];
  const model = {
    findMany: () => Promise.resolve(records),
  };
  const prisma = {
    storeMaster: model,
  } as unknown as PrismaService;
  const service = new StoreMasterService(prisma);

  const results = await service.search("Central World");
  assert.equal(results.length, 1);
  assert.equal(results[0].googleMapsUrl, "https://maps.app.goo.gl/centralworld");
});
