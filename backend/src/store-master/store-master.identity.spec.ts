import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import { StoreMasterService } from "./store-master.service";
import { StoreLifecycleService } from "./store-lifecycle.service";

const header = "STORE ID,STORE NAME,ACCOUNT NAME,Line OA Link,Line ID,URLS,Province / จังหวัด,Region / ภูมิภาค,Status";
const row = (id: string, name: string, account: string, lineId: string, status = "ACTIVE") =>
  `${id},${name},${account},https://lin.ee/${id},${lineId},https://manager.line.biz/account/${lineId},Khon Kaen,Northeastern,${status}`;

function harness(seed: Array<Record<string, unknown>> = [], operationalStores: Array<Record<string, unknown>> = []) {
  const records = seed.map((record) => ({ ...record }));
  let nextId = records.length + 1;
  const storeMaster = {
    findMany: ({ where }: { where?: { source?: string; isActive?: boolean } } = {}) => Promise.resolve(records.filter((record) =>
      (!where?.source || record.source === where.source) &&
      (where?.isActive === undefined || record.isActive === where.isActive)
    )),
    create: ({ data }: { data: Record<string, unknown> }) => {
      const created = { id: `master-${nextId++}`, createdAt: new Date(), updatedAt: new Date(), ...data };
      records.push(created);
      return Promise.resolve(created);
    },
    updateMany: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const found = records.find(({ id }) => id === where.id);
      if (!found) throw new Error("missing fake master");
      Object.assign(found, data);
      return Promise.resolve({ count: 1 });
    },
  };
  const store = { findMany: () => Promise.resolve(operationalStores) };
  const prisma = {
    storeMaster,
    store,
    $transaction: (work: (tx: { storeMaster: typeof storeMaster }) => Promise<void>) => work({ storeMaster }),
  } as unknown as PrismaService;
  const lifecycleCalls = { closed: [] as string[], reopened: [] as string[] };
  const lifecycle = {
    closeStoreFromMaster: async (_client: unknown, identity: { externalStoreId: string }) => { lifecycleCalls.closed.push(identity.externalStoreId); },
    reopenStoreFromMaster: async (_client: unknown, identity: { externalStoreId: string }) => { lifecycleCalls.reopened.push(identity.externalStoreId); },
  } as unknown as StoreLifecycleService;
  return { records, service: new StoreMasterService(prisma, lifecycle), operationalStores, lifecycleCalls };
}

const existing = (id: string, externalStoreId: string, sourceRowNumber: number, isActive = true) => ({
  id, externalStoreId, storeName: `Store ${externalStoreId}`, accountName: `Account ${externalStoreId}`,
  normalizedAccountName: `account${externalStoreId}`, lineOaLink: `https://lin.ee/${externalStoreId}`,
  lineId: `@${externalStoreId}`, lineManagerUrl: `https://manager.line.biz/account/@${externalStoreId}`,
  tiktokUsername: null, tiktokProfileUrl: null, googleMapsUrl: null, province: "Khon Kaen",
  region: "Northeastern", dashboardTier: null, kpiPlan: null, dashboardArea: null, bmName: null,
  source: "GOOGLE_SHEET", sourceRowNumber, sourceUpdatedAt: new Date("2026-01-01T00:00:00Z"),
  dataQualityStatus: "COMPLETE", isActive, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"),
});

void test("reordering rows preserves StoreMaster identity and refreshes sourceRowNumber", async () => {
  const h = harness([existing("master-a", "100", 2), existing("master-b", "200", 3)]);
  await h.service.importCsv(`${header}\n${row("200", "Store 200", "Account 200", "@200")}\n${row("100", "Store 100", "Account 100", "@100")}`);
  assert.equal(h.records.find(({ id }) => id === "master-a")?.sourceRowNumber, 3);
  assert.equal(h.records.find(({ id }) => id === "master-b")?.sourceRowNumber, 2);
  assert.equal(h.records.length, 2);
});

void test("new Store in a historically occupied row creates a new identity", async () => {
  const h = harness([existing("master-old", "100", 2)]);
  const preview = await h.service.previewCsv(`${header}\n${row("17469", "Chum Phae", "OPPOLotusChumphaeBS", "@975tvkio")}`);
  assert.equal(preview.summary.creates, 1);
  assert.equal(preview.summary.oldRowOverwriteRisks, 1);
  await h.service.importCsv(`${header}\n${row("17469", "Chum Phae", "OPPOLotusChumphaeBS", "@975tvkio")}`);
  assert.equal(h.records.find(({ id }) => id === "master-old")?.externalStoreId, "100");
  assert.ok(h.records.some(({ externalStoreId }) => externalStoreId === "17469"));
});

void test("duplicate source Store IDs fail closed before mutation", async () => {
  const h = harness();
  await assert.rejects(h.service.importCsv(`${header}\n${row("100", "A", "A", "@a")}\n${row("100", "B", "B", "@b")}`), /duplicate Store ID/);
  assert.equal(h.records.length, 0);
});

void test("CLOSED and reopened rows only toggle StoreMaster activity", async () => {
  const operational = [{ id: "store-31749", code: "31749", name: "Central Park", isActive: true, archivedAt: null, lineOfficialAccounts: [{ id: "oa" }], _count: { conversations: 4 } }];
  const h = harness([existing("master-31749", "31749", 2)], operational);
  const closedCsv = `${header}\n${row("31749", "Central Park", "Central Park", "@31749", "CLOSED")}`;
  const preview = await h.service.previewCsv(closedCsv);
  assert.equal(preview.summary.deactivations, 1);
  assert.equal(preview.summary.closedStoreOperationalReview, 1);
  await h.service.importCsv(closedCsv);
  assert.equal(h.records[0].isActive, false);
  assert.deepEqual(h.lifecycleCalls.closed, ["31749"]);
  await h.service.importCsv(closedCsv);
  assert.deepEqual(h.lifecycleCalls.closed, ["31749", "31749"], "repeated CLOSED sync must re-run the idempotent lifecycle");
  await h.service.importCsv(`${header}\n${row("31749", "Central Park", "Central Park", "@31749", "ACTIVE")}`);
  assert.equal(h.records[0].isActive, true);
  assert.deepEqual(h.lifecycleCalls.reopened, ["31749"]);
});

void test("incomplete new row with a Store ID is created safely", async () => {
  const h = harness();
  await h.service.importCsv(`${header}\n27258,Incomplete Store,,,,,Bangkok,Central,ACTIVE`);
  assert.equal(h.records.length, 1);
  assert.equal(h.records[0].externalStoreId, "27258");
  assert.notEqual(h.records[0].dataQualityStatus, "COMPLETE");
});

void test("17469 identity survives arbitrary reorder and later insertion", async () => {
  const h = harness();
  await h.service.importCsv(`${header}\n${row("17469", "Chum Phae", "OPPOLotusChumphaeBS", "@975tvkio")}\n${row("30538", "Phitsanulok", "OPPO Phitsanulok", "@nux7670t")}`);
  const identity = h.records.find(({ externalStoreId }) => externalStoreId === "17469")?.id;
  await h.service.importCsv(`${header}\n${row("99999", "Inserted", "Inserted", "@inserted")}\n${row("30538", "Phitsanulok", "OPPO Phitsanulok", "@nux7670t")}\n${row("17469", "Chum Phae", "OPPOLotusChumphaeBS", "@975tvkio")}`);
  assert.equal(h.records.find(({ externalStoreId }) => externalStoreId === "17469")?.id, identity);
  assert.equal(h.records.length, 3);
});
