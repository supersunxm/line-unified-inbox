import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import { StoreMasterService } from "./store-master.service";

const header = "STORE ID,STORE NAME,ACCOUNT NAME,Line OA Link,Line ID,URLS,Province / จังหวัด,Region / ภูมิภาค";

void test("re-import updates the stable Store ID instead of creating a duplicate", async () => {
  const records: Array<Record<string, unknown>> = [];
  const model = {
    findFirst: ({ where }: { where: { externalStoreId: string } }) => Promise.resolve(records.find((item) => item.externalStoreId === where.externalStoreId) ?? null),
    update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { const record = records.find((item) => item.id === where.id)!; Object.assign(record, data); return Promise.resolve(record); },
    upsert: ({ create }: { create: Record<string, unknown> }) => { const record = { id: `master-${records.length + 1}`, createdAt: new Date(), ...create }; records.push(record); return Promise.resolve(record); },
    findMany: () => Promise.resolve(records),
  };
  const prisma = { storeMaster: model, $transaction: (work: (tx: { storeMaster: typeof model }) => Promise<void>) => work({ storeMaster: model }) } as unknown as PrismaService;
  const service = new StoreMasterService(prisma);
  await service.importCsv(`${header}\n22535,Old Store,Old Account,https://lin.ee/old,@old,https://manager.line.biz/account/old,Lamphun,Northern`);
  await service.importCsv(`${header}\n22535,Corrected Store,Corrected Account,https://lin.ee/new,@new,https://manager.line.biz/account/correct,Lamphun,Northern`);
  assert.equal(records.length, 1); assert.equal(records[0].storeName, "Corrected Store"); assert.equal(records[0].lineManagerUrl, "https://manager.line.biz/account/correct");
});
