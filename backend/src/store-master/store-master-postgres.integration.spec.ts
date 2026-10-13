import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { StoreMasterService } from "./store-master.service";
import { createStoreMasterCsvSnapshot } from "./store-master-source";
import { acquireStoreMasterApplyLock } from "./store-master-transaction";
import { syncConnectedLineOaMetadata } from "./sync-connected-line-oa";
import type { PrismaService } from "../prisma.service";

const header = "STORE ID,STORE NAME,ACCOUNT NAME,Line OA Link,Line ID,URLS,Province / จังหวัด,Region / ภูมิภาค,Status";
const storeMasterTestDatabaseUrl = process.env.STORE_MASTER_TEST_DATABASE_URL?.trim();
if (!storeMasterTestDatabaseUrl) throw new Error("STORE_MASTER_TEST_DATABASE_URL must point to an isolated Store Master CI database");
const storeMasterTestDatabase = new URL(storeMasterTestDatabaseUrl);
const storeMasterTestDatabaseName = decodeURIComponent(storeMasterTestDatabase.pathname.slice(1));
if (
  (storeMasterTestDatabase.protocol !== "postgresql:" && storeMasterTestDatabase.protocol !== "postgres:") ||
  !["localhost", "127.0.0.1", "::1", "[::1]", "postgres"].includes(storeMasterTestDatabase.hostname) ||
  storeMasterTestDatabase.username !== "ci" ||
  !/^store_master_ci_[0-9]+$/u.test(storeMasterTestDatabaseName)
) {
  throw new Error("Store Master PostgreSQL tests require a dedicated local CI database");
}
const storeMasterTestPrismaOptions = { datasources: { db: { url: storeMasterTestDatabaseUrl } } };
const dbA = new PrismaClient(storeMasterTestPrismaOptions);
const dbB = new PrismaClient(storeMasterTestPrismaOptions);
const services = [
  new StoreMasterService(dbA as unknown as PrismaService),
  new StoreMasterService(dbB as unknown as PrismaService),
];
const baseId = `9${Date.now().toString().slice(-8)}`;
const ids = Array.from({ length: 8 }, (_, index) => `${baseId}${index}`);
const storeIds: string[] = [];
const webhookKeys: string[] = [];
const conversationIds: string[] = [];
const customerIds: string[] = [];
const backfillJobIds: string[] = [];
const nicknameJobIds: string[] = [];
const triggerName = "codex_store_master_reconcile_failure";
const functionName = "codex_store_master_reconcile_failure_fn";
const conversationTriggerName = "codex_store_master_conversation_failure";
const conversationFunctionName = "codex_store_master_conversation_failure_fn";

function snapshot(id: string, name: string, status = "ACTIVE") {
  const csv = `${header}\n${id},${name},Account ${id},https://lin.ee/${id},@${id},https://manager.line.biz/account/${id},Bangkok,Central,${status}`;
  return createStoreMasterCsvSnapshot(
    Buffer.from(csv, "utf8"),
    "https://docs.google.com/spreadsheets/d/codex-test/export?format=csv&gid=0",
    new Date("2026-10-12T00:00:00.000Z"),
  );
}

async function createMaster(id: string, name: string, isActive = true) {
  return dbA.storeMaster.create({
    data: {
      externalStoreId: id,
      storeName: name,
      accountName: `Account ${id}`,
      normalizedAccountName: `account${id}`,
      lineOaLink: `https://lin.ee/${id}`,
      lineId: `@${id}`,
      lineManagerUrl: `https://manager.line.biz/account/${id}`,
      province: "Bangkok",
      region: "Central",
      source: "GOOGLE_SHEET",
      sourceRowNumber: 2,
      dataQualityStatus: "COMPLETE",
      isActive,
    },
  });
}

async function createStoreAndOa(id: string, masterId: string, name: string) {
  const store = await dbA.store.create({
    data: { code: id, name, region: "Central", area: "Bangkok", storeMasterId: masterId },
  });
  storeIds.push(store.id);
  const webhookKey = `codex-store-master-${id}`;
  webhookKeys.push(webhookKey);
  const account = await dbA.lineOfficialAccount.create({
    data: { webhookKey, name: `Test OA ${id}`, basicId: `@${id}`, accountType: "STORE", storeId: store.id },
  });
  return { store, account };
}

async function createConversation(accountId: string, storeId: string, name: string) {
  const customer = await dbA.customer.create({ data: { displayName: name } });
  customerIds.push(customer.id);
  const conversation = await dbA.conversation.create({
    data: { customerId: customer.id, storeId, lineOfficialAccountId: accountId, latestMessageAt: new Date() },
  });
  conversationIds.push(conversation.id);
  return conversation;
}

async function applyWith(service: StoreMasterService, source: ReturnType<typeof snapshot>) {
  return service.syncFromGoogleSheet(source, { apply: true, expectedSha256: source.sha256 });
}

void test("Store Master transaction, rollback, locks, concurrency, and cleanup against real PostgreSQL", async () => {
  await dbA.$connect();
  await dbB.$connect();
  try {
    await assert.rejects(
      dbA.$transaction(async (tx) => {
        await tx.storeMaster.create({
          data: {
            externalStoreId: ids[0],
            storeName: "Rollback only",
            accountName: `Account ${ids[0]}`,
            normalizedAccountName: `account${ids[0]}`,
            source: "GOOGLE_SHEET",
            sourceRowNumber: 2,
            dataQualityStatus: "COMPLETE",
          },
        });
        throw new Error("EXPECTED_TRANSACTION_ROLLBACK");
      }),
      /EXPECTED_TRANSACTION_ROLLBACK/,
    );
    assert.equal(await dbA.storeMaster.count({ where: { externalStoreId: ids[0] } }), 0);

    const duplicateA = await createMaster(ids[1], "Duplicate A", false);
    const duplicateB = await createMaster(ids[1], "Duplicate B", false);
    await assert.rejects(applyWith(services[0], snapshot(ids[1], "Incoming duplicate")), /identity conflicts: 1/);
    const duplicateRows = await dbA.storeMaster.findMany({
      where: { externalStoreId: ids[1] },
      select: { id: true, storeName: true },
      orderBy: { storeName: "asc" },
    });
    assert.deepEqual(duplicateRows.map(({ id, storeName }) => ({ id, storeName })), [
      { id: duplicateA.id, storeName: "Duplicate A" },
      { id: duplicateB.id, storeName: "Duplicate B" },
    ]);

    const lifecycleMaster = await createMaster(ids[2], "Before lifecycle");
    const lifecycle = await createStoreAndOa(ids[2], lifecycleMaster.id, "Before lifecycle");
    const lifecycleConversation = await createConversation(lifecycle.account.id, lifecycle.store.id, "Lifecycle rollback conversation");
    const backfill = await dbA.lineOaBackfillJob.create({
      data: { lineOaId: lifecycle.account.id, dateFrom: "2026-10-01", dateTo: "2026-10-02" },
    });
    backfillJobIds.push(backfill.id);
    const nicknameJob = await dbA.lineChatNicknameSyncJob.create({
      data: { conversationId: lifecycleConversation.id, lineOfficialAccountId: lifecycle.account.id, nickname: "Lifecycle rollback queue" },
    });
    nicknameJobIds.push(nicknameJob.id);
    await assert.rejects(
      applyWith(services[0], snapshot(ids[2], "Before lifecycle", "CLOSED")),
      /approved change set/,
    );
    const lifecycleAfter = await dbA.storeMaster.findUniqueOrThrow({ where: { id: lifecycleMaster.id } });
    const storeAfter = await dbA.store.findUniqueOrThrow({ where: { id: lifecycle.store.id } });
    const oaAfter = await dbA.lineOfficialAccount.findUniqueOrThrow({ where: { id: lifecycle.account.id } });
    assert.equal(lifecycleAfter.isActive, true);
    assert.equal(storeAfter.isActive, true);
    assert.equal(storeAfter.archivedAt, null);
    assert.equal(oaAfter.isActive, true);
    assert.equal(oaAfter.archivedAt, null);
    assert.equal((await dbA.conversation.findUniqueOrThrow({ where: { id: lifecycleConversation.id } })).storeId, lifecycle.store.id);
    assert.equal((await dbA.lineOaBackfillJob.findUniqueOrThrow({ where: { id: backfill.id } })).status, "QUEUED");
    assert.equal((await dbA.lineChatNicknameSyncJob.findUniqueOrThrow({ where: { id: nicknameJob.id } })).status, "PENDING");

    const reconciliationMaster = await createMaster(ids[3], "Before reconciliation");
    const reconciliation = await createStoreAndOa(ids[3], reconciliationMaster.id, "Before reconciliation");
    await dbA.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'EXPECTED_RECONCILIATION_FAILURE'; RETURN NEW; END; $$`);
    await dbA.$executeRawUnsafe(`CREATE TRIGGER ${triggerName} BEFORE UPDATE ON "Store" FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
    await assert.rejects(
      applyWith(services[0], snapshot(ids[3], "After reconciliation")),
    );
    await dbA.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON "Store"`);
    await dbA.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    assert.equal((await dbA.storeMaster.findUniqueOrThrow({ where: { id: reconciliationMaster.id } })).storeName, "Before reconciliation");
    assert.equal((await dbA.store.findUniqueOrThrow({ where: { id: reconciliation.store.id } })).name, "Before reconciliation");
    assert.equal((await dbA.lineOfficialAccount.findUniqueOrThrow({ where: { id: reconciliation.account.id } })).storeId, reconciliation.store.id);

    const conversationMaster = await createMaster(ids[7], "Conversation reassignment target");
    const targetStore = await dbA.store.create({
      data: { code: ids[7], name: "Conversation reassignment target", region: "Central", area: "Bangkok", storeMasterId: conversationMaster.id },
    });
    storeIds.push(targetStore.id);
    const legacyStore = await dbA.store.create({ data: { name: "Legacy unassigned store" } });
    storeIds.push(legacyStore.id);
    const conversationOa = await dbA.lineOfficialAccount.create({
      data: { webhookKey: `codex-store-master-${ids[7]}`, name: "Conversation rollback OA", basicId: `@${ids[7]}`, accountType: "STORE", storeId: legacyStore.id },
    });
    webhookKeys.push(`codex-store-master-${ids[7]}`);
    const reassignedConversation = await createConversation(conversationOa.id, legacyStore.id, "Conversation reassignment rollback");
    const planned = await syncConnectedLineOaMetadata(dbA, true);
    assert.equal(planned.changeSet.filter(({ kind }) => kind === "CONVERSATION_REASSIGNMENT").length, 1);
    await dbA.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION ${conversationFunctionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'EXPECTED_CONVERSATION_REASSIGNMENT_FAILURE'; RETURN NEW; END; $$`);
    await dbA.$executeRawUnsafe(`CREATE TRIGGER ${conversationTriggerName} AFTER UPDATE OF "storeId" ON "Conversation" FOR EACH ROW WHEN (OLD."storeId" IS DISTINCT FROM NEW."storeId") EXECUTE FUNCTION ${conversationFunctionName}()`);
    const reassignmentSnapshot = snapshot(ids[7], "Conversation reassignment target");
    await assert.rejects(
      services[0].syncFromGoogleSheet(reassignmentSnapshot, {
        apply: true,
        expectedSha256: reassignmentSnapshot.sha256,
        approvedChangeSet: planned.changeSet,
      }),
    );
    await dbA.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${conversationTriggerName} ON "Conversation"`);
    await dbA.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${conversationFunctionName}()`);
    assert.equal((await dbA.lineOfficialAccount.findUniqueOrThrow({ where: { id: conversationOa.id } })).storeId, legacyStore.id);
    assert.equal((await dbA.conversation.findUniqueOrThrow({ where: { id: reassignedConversation.id } })).storeId, legacyStore.id);
    await dbA.conversation.deleteMany({ where: { id: reassignedConversation.id } });
    await dbA.customer.deleteMany({ where: { id: reassignedConversation.customerId } });
    await dbA.lineOfficialAccount.deleteMany({ where: { id: conversationOa.id } });
    await dbA.store.deleteMany({ where: { id: { in: [legacyStore.id, targetStore.id] } } });
    await dbA.storeMaster.deleteMany({ where: { id: conversationMaster.id } });

    let firstAcquired!: () => void;
    let releaseFirst!: () => void;
    const firstLockAcquired = new Promise<void>((resolve) => { firstAcquired = resolve; });
    const releaseGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const firstLock = dbA.$transaction(async (tx) => {
      await acquireStoreMasterApplyLock(tx);
      firstAcquired();
      await releaseGate;
    }, { timeout: 15000 });
    await firstLockAcquired;
    let secondAcquired = false;
    const secondLock = dbB.$transaction(async (tx) => {
      await acquireStoreMasterApplyLock(tx);
      secondAcquired = true;
    }, { timeout: 15000 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(secondAcquired, false);
    releaseFirst();
    await Promise.all([firstLock, secondLock]);
    assert.equal(secondAcquired, true);

    const concurrentA = await createMaster(ids[4], "Writer A before");
    const concurrentB = await createMaster(ids[5], "Writer B before");
    const concurrentResults = await Promise.allSettled([
      applyWith(services[0], snapshot(ids[4], "Writer A after")),
      applyWith(services[1], snapshot(ids[5], "Writer B after")),
    ]);
    assert.ok(
      concurrentResults.some((result) => result.status === "fulfilled"),
      `Concurrent apply failures: ${concurrentResults.map((result) => result.status === "rejected" ? `${(result.reason as { code?: string }).code ?? "unknown"}: ${(result.reason as Error).message}` : "fulfilled").join(" | ")}`,
    );
    const concurrentRows = await dbA.storeMaster.findMany({
      where: { id: { in: [concurrentA.id, concurrentB.id] } },
      select: { externalStoreId: true, storeName: true },
    });
    assert.equal(concurrentRows.length, 2);
    assert.ok(concurrentRows.every((row) =>
      (row.externalStoreId === ids[4] && ["Writer A before", "Writer A after"].includes(row.storeName)) ||
      (row.externalStoreId === ids[5] && ["Writer B before", "Writer B after"].includes(row.storeName))
    ));

    const serialMaster = await createMaster(ids[6], "Serializable before");
    let readers = 0;
    let releaseReaders!: () => void;
    const bothRead = new Promise<void>((resolve) => { releaseReaders = resolve; });
    const serialWriter = (client: PrismaClient, name: string) => client.$transaction(async (tx) => {
      const row = await tx.storeMaster.findUniqueOrThrow({ where: { id: serialMaster.id } });
      readers += 1;
      if (readers === 2) releaseReaders();
      await bothRead;
      await tx.storeMaster.update({ where: { id: row.id }, data: { storeName: name } });
    }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 });
    const serialResults = await Promise.allSettled([
      serialWriter(dbA, "Serializable A"),
      serialWriter(dbB, "Serializable B"),
    ]);
    assert.equal(serialResults.filter((result) => result.status === "fulfilled").length, 1);
    const serialFailure = serialResults.find((result) => result.status === "rejected");
    assert.ok(serialFailure && serialFailure.status === "rejected");
    assert.equal((serialFailure.reason as { code?: string }).code, "P2034");
    assert.ok(["Serializable A", "Serializable B"].includes(
      (await dbA.storeMaster.findUniqueOrThrow({ where: { id: serialMaster.id } })).storeName,
    ));
  } finally {
    await dbA.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON "Store"`).catch(() => undefined);
    await dbA.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${functionName}()`).catch(() => undefined);
    await dbA.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${conversationTriggerName} ON "Conversation"`).catch(() => undefined);
    await dbA.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${conversationFunctionName}()`).catch(() => undefined);
    if (conversationIds.length > 0) await dbA.conversation.deleteMany({ where: { id: { in: conversationIds } } });
    if (customerIds.length > 0) await dbA.customer.deleteMany({ where: { id: { in: customerIds } } });
    if (backfillJobIds.length > 0) await dbA.lineOaBackfillJob.deleteMany({ where: { id: { in: backfillJobIds } } });
    if (nicknameJobIds.length > 0) await dbA.lineChatNicknameSyncJob.deleteMany({ where: { id: { in: nicknameJobIds } } });
    const stores = await dbA.store.findMany({ where: { code: { in: ids } }, select: { id: true } });
    const allStoreIds = [...new Set([...storeIds, ...stores.map(({ id }) => id)])];
    if (allStoreIds.length > 0) await dbA.lineOfficialAccount.deleteMany({ where: { storeId: { in: allStoreIds } } });
    if (allStoreIds.length > 0) await dbA.store.deleteMany({ where: { id: { in: allStoreIds } } });
    await dbA.storeMaster.deleteMany({ where: { externalStoreId: { in: ids } } });
    assert.equal(await dbA.storeMaster.count({ where: { externalStoreId: { in: ids } } }), 0);
    assert.equal(await dbA.lineOfficialAccount.count({ where: { webhookKey: { in: webhookKeys } } }), 0);
    assert.equal(await dbA.store.count({ where: { code: { in: ids } } }), 0);
    console.log("STORE_MASTER_DB_CLEANUP=PASS");
    await Promise.all([dbA.$disconnect(), dbB.$disconnect()]);
  }
});


void test("retired mobile default denies implicit access and preserves explicit grants on PostgreSQL", async () => {
  const db = new PrismaClient(storeMasterTestPrismaOptions);
  const fixturePrefix = `schema-default-${Date.now()}-${process.pid}`;
  const rollback = new Error("EXPECTED_MOBILE_DEFAULT_TEST_ROLLBACK");
  try {
    await assert.rejects(db.$transaction(async (tx) => {
      const defaults = await tx.$queryRaw<Array<{ column_default: string }>>`
        SELECT column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'canAccessMobile'
      `;
      assert.equal(defaults[0]?.column_default, "false");
      const implicit = await tx.user.create({ data: { username: `${fixturePrefix}-implicit`, email: `${fixturePrefix}-implicit@example.invalid`, normalizedEmail: `${fixturePrefix}-implicit@example.invalid`, displayName: "Implicit test user" } });
      assert.equal(implicit.canAccessMobile, false);
      assert.equal(implicit.canAccessWeb, true);
      const granted = await tx.user.create({ data: { username: `${fixturePrefix}-granted`, email: `${fixturePrefix}-granted@example.invalid`, normalizedEmail: `${fixturePrefix}-granted@example.invalid`, displayName: "Granted test administrator", role: "ADMIN", canAccessMobile: true } });
      const before = await tx.user.findUniqueOrThrow({ where: { id: granted.id } });
      const updated = await tx.user.update({ where: { id: granted.id }, data: { displayName: "Renamed test administrator" } });
      for (const field of ["canAccessMobile", "canAccessWeb", "canAccessHq", "canAccessAllStores", "canManageAccounts", "canReply", "canAccessMainOa", "canManageMainOa", "role"] as const) {
        assert.equal(updated[field], before[field]);
      }
      assert.equal(updated.canAccessMobile, true);
      throw rollback;
    }), (error: unknown) => error === rollback);
    assert.equal(await db.user.count({ where: { username: { startsWith: fixturePrefix } } }), 0);
  } finally {
    await db.$disconnect();
  }
});
