import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { StoreMasterService } from "./store-master.service";
import type { StoreMasterCsvSnapshot } from "./store-master-source";

const header = "STORE ID,STORE NAME,ACCOUNT NAME,Line OA Link,Line ID,URLS,Province / จังหวัด,Region / ภูมิภาค,Status";
const activeCsv = `${header}\n100,Store 100,Account 100,https://lin.ee/100,@100,https://manager.line.biz/account/100,Bangkok,Central,ACTIVE`;

type MasterRecord = {
  id: string;
  externalStoreId: string | null;
  storeName: string;
  accountName: string;
  normalizedAccountName: string;
  lineOaLink: string | null;
  lineId: string | null;
  lineManagerUrl: string | null;
  tiktokUsername: string | null;
  tiktokProfileUrl: string | null;
  googleMapsUrl: string | null;
  googleMapsName: string | null;
  province: string | null;
  region: string | null;
  source: string;
  sourceRowNumber: number;
  dataQualityStatus: string;
  isActive: boolean;
};

type TestAccount = {
  id: string;
  name: string;
  basicId: string | null;
  store: {
    id: string;
    code: string | null;
    name: string;
    region: string | null;
    area: string | null;
    storeMasterId: string | null;
    storeMaster: { externalStoreId: string | null } | null;
  } | null;
};

type TestState = { masters: MasterRecord[]; accounts: TestAccount[] };
type MasterWhere = {
  source?: string;
  isActive?: boolean;
  externalStoreId?: string | null;
  lineId?: { equals: string; mode?: string };
  normalizedAccountName?: string;
};

function testHarness(seed: Partial<TestState> = {}, lockResultRows = [{ lockResultIsNull: false }]) {
  let state: TestState = {
    masters: seed.masters?.map((item) => structuredClone(item)) ?? [],
    accounts: seed.accounts?.map((item) => structuredClone(item)) ?? [],
  };
  let transactionCount = 0;
  let advisoryLockCount = 0;

  const createClient = (readState: () => TestState) => ({
    $queryRaw: () => { advisoryLockCount += 1; return Promise.resolve(lockResultRows); },
    storeMaster: {
      findMany: ({ where = {} }: { where?: MasterWhere } = {}) => Promise.resolve(
        readState().masters.filter((item) =>
          (!where.source || item.source === where.source) &&
          (where.isActive === undefined || item.isActive === where.isActive) &&
          (where.externalStoreId === undefined || item.externalStoreId === where.externalStoreId) &&
          (!where.lineId || item.lineId?.toLocaleLowerCase() === where.lineId.equals.toLocaleLowerCase()) &&
          (!where.normalizedAccountName || item.normalizedAccountName === where.normalizedAccountName)
        ),
      ),
      create: ({ data }: { data: object }) => {
        const item = { id: `master-${readState().masters.length + 1}`, ...data } as MasterRecord;
        readState().masters.push(item);
        return Promise.resolve(item);
      },
      updateMany: ({ where, data }: { where: { id?: string; externalStoreId?: string | null }; data: object }) => {
        const item = readState().masters.find((candidate) =>
          (where.id === undefined || candidate.id === where.id) &&
          (where.externalStoreId === undefined || candidate.externalStoreId === where.externalStoreId)
        );
        if (!item) return Promise.resolve({ count: 0 });
        Object.assign(item, data);
        return Promise.resolve({ count: 1 });
      },
    },
    store: {
      findMany: () => Promise.resolve([]),
      findUnique: () => Promise.resolve(null),
      findFirst: () => Promise.resolve(null),
      update: () => Promise.resolve({}),
    },
    lineOfficialAccount: { findMany: () => Promise.resolve(readState().accounts), update: () => Promise.resolve({}) },
    conversation: { updateMany: () => Promise.resolve({ count: 0 }) },
  });

  const prisma = {
    ...createClient(() => state),
    $transaction: async <T>(work: (tx: ReturnType<typeof createClient>) => Promise<T>) => {
      transactionCount += 1;
      const transactionState = structuredClone(state);
      const result = await work(createClient(() => transactionState));
      state = transactionState;
      return result;
    },
  } as unknown as PrismaService;

  return {
    prisma,
    readState: () => state,
    transactionCount: () => transactionCount,
    advisoryLockCount: () => advisoryLockCount,
  };
}

function sourceSnapshot(csv = activeCsv): StoreMasterCsvSnapshot {
  const bytes = new TextEncoder().encode(csv);
  return {
    csv,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sourceUrl: "https://docs.google.com/spreadsheets/d/sheet_id/export?format=csv&gid=0",
    fetchedAt: "2026-10-12T00:00:00.000Z",
  };
}

function master(id: string, externalStoreId: string, lineId: string, row: number): MasterRecord {
  return {
    id,
    externalStoreId,
    storeName: `Store ${externalStoreId}`,
    accountName: `Account ${externalStoreId}`,
    normalizedAccountName: `account${externalStoreId}`,
    lineOaLink: `https://lin.ee/${externalStoreId}`,
    lineId,
    lineManagerUrl: `https://manager.line.biz/account/${externalStoreId}`,
    tiktokUsername: null,
    tiktokProfileUrl: null,
    googleMapsUrl: null,
    googleMapsName: null,
    province: "Bangkok",
    region: "Central",
    source: "GOOGLE_SHEET",
    sourceRowNumber: row,
    dataQualityStatus: "COMPLETE",
    isActive: true,
  };
}

void test("default sync uses the supplied snapshot for preview and performs zero writes", async () => {
  const harness = testHarness();
  const service = new StoreMasterService(harness.prisma);
  const seenCsv: string[] = [];
  const previewCsv = service.previewCsv.bind(service);
  service.previewCsv = async (csv, source, client) => {
    seenCsv.push(csv);
    return previewCsv(csv, source, client);
  };
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("unexpected second source fetch");
  };

  try {
    const snapshot = sourceSnapshot();
    const result = await service.syncFromGoogleSheet(snapshot);
    assert.deepEqual(seenCsv, [activeCsv]);
    assert.equal(fetchCount, 0);
    assert.equal(result.mode, "PREVIEW");
    assert.equal(harness.transactionCount(), 0);
    assert.equal(harness.readState().masters.length, 0);
    assert.equal(result.source.sha256, snapshot.sha256);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("identity-conflicted preview reports a block without opening a write transaction", async () => {
  const first = master("master-100-a", "100", "@100", 2);
  const second = master("master-100-b", "100", "@100", 3);
  const harness = testHarness({ masters: [first, second] });
  const before = structuredClone(harness.readState());
  const service = new StoreMasterService(harness.prisma);

  const result = await service.syncFromGoogleSheet(sourceSnapshot());

  assert.equal(result.mode, "PREVIEW");
  assert.equal(result.preview.identityConflicts, 1);
  assert.equal(harness.transactionCount(), 0);
  assert.deepEqual(harness.readState(), before);
});

void test("direct Store Master import service defaults to preview", async () => {
  const harness = testHarness();
  const service = new StoreMasterService(harness.prisma);
  const preview = await service.importCsv(activeCsv);

  assert.equal(preview.summary.creates, 1);
  assert.equal(harness.transactionCount(), 0);
  assert.equal(harness.readState().masters.length, 0);
  await assert.rejects(
    service.importCsv(activeCsv, "GOOGLE_SHEET", { expectedSha256: sourceSnapshot().sha256 }),
    /require apply/,
  );
});

void test("approved source hash permits a clean non-lifecycle import", async () => {
  const harness = testHarness();
  const service = new StoreMasterService(harness.prisma);
  const snapshot = sourceSnapshot();
  const result = await service.syncFromGoogleSheet(snapshot, {
    apply: true,
    expectedSha256: snapshot.sha256,
  });

  assert.equal(result.mode, "APPLIED");
  assert.equal(harness.advisoryLockCount(), 1);
  assert.equal(harness.readState().masters.length, 1);
  assert.equal(harness.readState().masters[0].storeName, "Store 100");
});

void test("an invalid advisory-lock result fails closed before Store Master writes", async () => {
  const harness = testHarness({}, []);
  const service = new StoreMasterService(harness.prisma);
  const snapshot = sourceSnapshot();

  await assert.rejects(
    service.syncFromGoogleSheet(snapshot, { apply: true, expectedSha256: snapshot.sha256 }),
    /advisory lock was not acquired/,
  );
  assert.equal(harness.transactionCount(), 1);
  assert.equal(harness.readState().masters.length, 0);
});

void test("missing or incorrect source approval blocks before a database transaction", async () => {
  for (const expectedSha256 of [undefined, "0".repeat(64)]) {
    const harness = testHarness();
    const service = new StoreMasterService(harness.prisma);
    const snapshot = sourceSnapshot();
    await assert.rejects(
      service.syncFromGoogleSheet(snapshot, { apply: true, expectedSha256 }),
      /requires a valid --expected-sha256|does not match the approved snapshot/,
    );
    assert.equal(harness.transactionCount(), 0);
    assert.equal(harness.readState().masters.length, 0);
  }
});

void test("default execution previews lifecycle changes without performing source or lifecycle writes", async () => {
  const seed = master("master-100", "100", "@100", 2);
  const csv = `${header}\n100,Store 100,Account 100,https://lin.ee/100,@100,https://manager.line.biz/account/100,Bangkok,Central,CLOSED`;
  const harness = testHarness({ masters: [seed] });
  const service = new StoreMasterService(harness.prisma);

  const result = await service.syncFromGoogleSheet(sourceSnapshot(csv));
  assert.equal(result.mode, "PREVIEW");
  assert.equal(result.lifecycleReview[0]?.operation, "CLOSE");
  assert.equal(harness.transactionCount(), 0);
  assert.equal(harness.readState().masters[0].isActive, true);
});

void test("preview lists exact close and reopen lifecycle rows for owner review", async () => {
  const activeMaster = master("master-100", "100", "@100", 2);
  const closedCsv = `${header}\n100,Store 100,Account 100,https://lin.ee/100,@100,https://manager.line.biz/account/100,Bangkok,Central,CLOSED`;
  const harness = testHarness({ masters: [activeMaster] });
  const service = new StoreMasterService(harness.prisma);

  const closePreview = await service.previewCsv(closedCsv);
  assert.deepEqual(closePreview.lifecycleReview, [{
    externalStoreId: "100",
    storeName: "Store 100",
    sourceRowNumber: 2,
    operation: "CLOSE",
    previousStoreMasterActive: true,
    nextStoreMasterActive: false,
  }]);

  harness.readState().masters[0].isActive = false;
  const reopenPreview = await service.previewCsv(activeCsv);
  assert.equal(reopenPreview.lifecycleReview[0]?.operation, "REOPEN");
  assert.equal(reopenPreview.lifecycleReview[0]?.previousStoreMasterActive, false);
});

void test("apply requires the exact source hash and lifecycle change set", async () => {
  const harness = testHarness({ masters: [master("master-100", "100", "@100", 2)] });
  const service = new StoreMasterService(harness.prisma);
  const csv = `${header}\n100,Store 100,Account 100,https://lin.ee/100,@100,https://manager.line.biz/account/100,Bangkok,Central,CLOSED`;

  const snapshot = sourceSnapshot(csv);
  await assert.rejects(
    service.syncFromGoogleSheet(snapshot, { apply: true, expectedSha256: snapshot.sha256 }),
    /do not match the approved change set/,
  );
  assert.equal(harness.readState().masters[0].isActive, true);

  await service.syncFromGoogleSheet(snapshot, {
    apply: true,
    expectedSha256: snapshot.sha256,
    approvedChangeSet: [{ kind: "STORE_LIFECYCLE", storeId: "100", action: "CLOSE" }],
  });
  assert.equal(harness.readState().masters[0].isActive, false);
});

void test("connected OA identity conflict rolls back the Store Master import", async () => {
  const storeMaster = master("master-100", "100", "@100", 2);
  const secondMaster = master("master-200", "200", "@200", 3);
  const account: TestAccount = {
    id: "oa-100",
    name: "Store 100",
    basicId: "@200",
    store: {
      id: "store-100",
      code: "100",
      name: "Store 100",
      region: "Central",
      area: "Bangkok",
      storeMasterId: "master-100",
      storeMaster: { externalStoreId: "100" },
    },
  };
  const harness = testHarness({ masters: [storeMaster, secondMaster], accounts: [account] });
  const service = new StoreMasterService(harness.prisma);
  const conflictingCsv = `${header}\n100,Renamed Store,Account 100,https://lin.ee/100,@100,https://manager.line.biz/account/100,Bangkok,Central,ACTIVE`;

  await assert.rejects(
    service.syncFromGoogleSheet(sourceSnapshot(conflictingCsv), {
      apply: true,
      expectedSha256: sourceSnapshot(conflictingCsv).sha256,
    }),
    /Connected LINE OA reconciliation blocked \(identity conflicts: 1/,
  );
  assert.equal(harness.readState().masters.find((item) => item.id === "master-100")?.storeName, "Store 100");
});

void test("a source digest mismatch stops before opening a database transaction", async () => {
  const harness = testHarness();
  const service = new StoreMasterService(harness.prisma);
  const changedSnapshot = { ...sourceSnapshot(), csv: activeCsv.replace("Store 100", "Changed Store") };

  await assert.rejects(service.syncFromGoogleSheet(changedSnapshot), /does not match its original bytes/);
  assert.equal(harness.transactionCount(), 0);
  assert.equal(harness.readState().masters.length, 0);
});

void test("malformed source headers fail before opening a database transaction", async () => {
  const harness = testHarness();
  const service = new StoreMasterService(harness.prisma);
  const malformed = sourceSnapshot("UNKNOWN COLUMN,STORE NAME\n100,Store 100");

  await assert.rejects(service.syncFromGoogleSheet(malformed), /missing or duplicates required Store Master headers/);
  assert.equal(harness.transactionCount(), 0);
  assert.equal(harness.readState().masters.length, 0);
});
