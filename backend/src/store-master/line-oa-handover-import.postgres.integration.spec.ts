import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import type { PrismaService } from "../prisma.service";
import { LineOfficialAccountsService } from "../line-official-accounts/line-official-accounts.service";
import {
  activateHandoverAccounts,
  applyHandoverPlan,
  buildHandoverPlan,
  findActivationTargets,
  HANDOVER_CSV_HEADERS,
  loadHandoverSnapshot,
  parseHandoverCsv,
  webhookKeysetSha256,
} from "../line-official-accounts/line-oa-handover-import";

// Runs inside the isolated Store Master CI database created by scripts/test-store-master-postgres.cjs.
const testDatabaseUrl = process.env.STORE_MASTER_TEST_DATABASE_URL?.trim();
if (!testDatabaseUrl) throw new Error("STORE_MASTER_TEST_DATABASE_URL must point to an isolated Store Master CI database");
const testDatabase = new URL(testDatabaseUrl);
if (
  (testDatabase.protocol !== "postgresql:" && testDatabase.protocol !== "postgres:") ||
  !["localhost", "127.0.0.1", "::1", "[::1]", "postgres"].includes(testDatabase.hostname) ||
  testDatabase.username !== "ci" ||
  !/^store_master_ci_[0-9]+$/u.test(decodeURIComponent(testDatabase.pathname.slice(1)))
) {
  throw new Error("LINE OA handover PostgreSQL tests require a dedicated local CI database");
}

process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
process.env.PUBLIC_WEBHOOK_BASE_URL = "https://inbox.example.test";
const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
const encryption = new CredentialEncryptionService();
encryption.onModuleInit();
const service = new LineOfficialAccountsService(prisma as unknown as PrismaService, encryption);
const HOST = "inbox.example.test";
const none = { updateLines: new Set<number>(), allowClosedStoreCodes: new Set<string>() };

function key(seed: string) {
  return `${seed}${"k".repeat(32)}`.slice(0, 32);
}

async function master(code: string, isActive = true) {
  return prisma.storeMaster.create({
    data: {
      externalStoreId: code, storeName: `Store ${code}`, accountName: `Account ${code}`, normalizedAccountName: `account${code}`,
      lineId: `@${code}`, province: "Bangkok", region: "Central", source: "GOOGLE_SHEET", sourceRowNumber: Number(code.slice(-3)),
      dataQualityStatus: "COMPLETE", isActive,
    },
  });
}

async function restored(code: string, webhookKey: string) {
  const record = await master(code);
  const store = await prisma.store.create({ data: { code, name: `Store ${code}`, region: "Central", area: "Bangkok", storeMasterId: record.id } });
  return prisma.lineOfficialAccount.create({
    data: {
      webhookKey, name: `Restored ${code}`, basicId: `@${code}`, accountType: "STORE", storeId: store.id, isActive: true,
      encryptedChannelSecret: encryption.encrypt(`old-secret-${code}`), encryptedChannelAccessToken: encryption.encrypt(`old-token-${code}`),
    },
  });
}

function handoverCsv(rows: Array<{ store: string; key: string }>) {
  return [HANDOVER_CSV_HEADERS.join(","), ...rows.map((row) => [
    row.store, `Store ${row.store}`, `OA ${row.store}`, `'@${row.store}`, "", `secret-${row.store}-abcdefgh`, `token-${row.store}-abcdefghijkl`,
    `https://${HOST}/webhook/${row.key}`, "CONNECTED", "Enabled", "COMPLETE",
  ].join(","))].join("\n");
}

async function plan(text: string, options = none) {
  const { rows, issues } = parseHandoverCsv(text, HOST);
  const snapshot = await loadHandoverSnapshot(prisma);
  return { rows, issues, snapshot, plan: buildHandoverPlan(rows, issues, snapshot, options) };
}

const TEST_STORE_CODES = ["910001", "910002", "910003", "910004", "910005", "920001", "920002"];

test.after(async () => {
  // The Store Master CI database is shared with the other Store Master suites; remove every row this file created.
  try {
    await prisma.lineOfficialAccount.deleteMany({ where: { store: { code: { in: TEST_STORE_CODES } } } });
    await prisma.store.deleteMany({ where: { code: { in: TEST_STORE_CODES } } });
    await prisma.storeMaster.deleteMany({ where: { externalStoreId: { in: TEST_STORE_CODES } } });
  } finally {
    await prisma.$disconnect();
  }
});

void test("handover import creates only new disabled OAs, applies the named update and leaves restored rows untouched", async () => {
  const present = await restored("910001", key("present"));
  const rotated = await restored("910002", key("oldkey"));
  await master("910003");
  await master("910004", false);
  const text = handoverCsv([
    { store: "910001", key: key("present") },
    { store: "910002", key: key("newkey") },
    { store: "910003", key: key("create3") },
    { store: "910004", key: key("create4") },
    { store: "910005", key: key("nomaster") },
  ]);
  const options = { updateLines: new Set([3]), allowClosedStoreCodes: new Set(["910004"]) };
  const oaCountBefore = await prisma.lineOfficialAccount.count();
  const prepared = await plan(text, options);
  assert.deepEqual(prepared.plan.summary, { PRESENT: 1, CREATE: 2, UPDATE_EXISTING: 1, SKIP_NO_STORE_MASTER: 1, CONFLICT: 0 });
  const keyset = webhookKeysetSha256(prepared.snapshot.oas);

  await assert.rejects(
    applyHandoverPlan({ prisma, service, encryption, rows: prepared.rows, issues: prepared.issues, options: { ...options, expectedPlanSha256: "0".repeat(64), expectedExistingKeysetSha256: keyset } }),
    /--expected-plan-sha256/u,
  );
  assert.equal(await prisma.lineOfficialAccount.count(), oaCountBefore);

  const result = await applyHandoverPlan({
    prisma, service, encryption, rows: prepared.rows, issues: prepared.issues,
    options: { ...options, expectedPlanSha256: prepared.plan.planSha256, expectedExistingKeysetSha256: keyset },
  });
  assert.equal(result.created.length, 2);
  assert.equal(result.updated.length, 1);
  assert.deepEqual(result.skipped.map((item) => item.reason).sort(), ["PRESENT", "SKIP_NO_STORE_MASTER"]);
  assert.equal(JSON.stringify(result).includes("secret-910003-abcdefgh"), false);
  assert.equal(JSON.stringify(result).includes(key("create3")), false);

  for (const code of ["910003", "910004"]) {
    const account = await prisma.lineOfficialAccount.findFirstOrThrow({ where: { store: { code } }, include: { store: true } });
    assert.equal(account.isActive, false);
    assert.equal(account.connectionStatus, "DISABLED");
    assert.equal(account.webhookKey, key(`create${code.slice(-1)}`));
    assert.equal(encryption.decrypt(account.encryptedChannelSecret ?? ""), `secret-${code}-abcdefgh`);
    assert.equal(encryption.decrypt(account.encryptedChannelAccessToken ?? ""), `token-${code}-abcdefghijkl`);
    assert.equal(account.store?.name, `Store ${code}`);
    assert.equal(account.store?.provinceSource, "MASTER");
  }
  assert.equal(await prisma.store.count({ where: { code: "910005" } }), 0);

  const untouched = await prisma.lineOfficialAccount.findUniqueOrThrow({ where: { id: present.id } });
  assert.deepEqual(untouched, present);
  const updated = await prisma.lineOfficialAccount.findUniqueOrThrow({ where: { id: rotated.id } });
  assert.equal(updated.webhookKey, key("newkey"));
  assert.equal(encryption.decrypt(updated.encryptedChannelSecret ?? ""), "secret-910002-abcdefgh");
  assert.equal(updated.storeId, rotated.storeId);
  assert.equal(updated.isActive, true);

  await assert.rejects(
    applyHandoverPlan({ prisma, service, encryption, rows: prepared.rows, issues: prepared.issues, options: { ...options, expectedPlanSha256: prepared.plan.planSha256, expectedExistingKeysetSha256: keyset } }),
    /keyset does not match/u,
  );

  const targets = await findActivationTargets(prisma, prepared.rows, { storeCodes: new Set(["910003"]) });
  assert.deepEqual(targets.map((target) => target.storeCode), ["910003"]);
  const activation = await activateHandoverAccounts(service, targets);
  assert.equal(activation.failed, null);
  const active = await prisma.lineOfficialAccount.findFirstOrThrow({ where: { store: { code: "910003" } } });
  assert.equal(active.isActive, true);
  assert.equal(active.connectionStatus, "READY");
  assert.equal((await findActivationTargets(prisma, prepared.rows, { allImported: true })).length, 1);
});

void test("a change to a protected existing OA during import rolls back every write", async () => {
  const protectedOa = await restored("920001", key("guarded"));
  await master("920002");
  const text = handoverCsv([{ store: "920001", key: key("guarded") }, { store: "920002", key: key("guardnew") }]);
  const prepared = await plan(text);
  const before = await prisma.lineOfficialAccount.count();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION codex_handover_guard_fn() RETURNS trigger AS $$
    BEGIN UPDATE "LineOfficialAccount" SET name = 'tampered' WHERE id = '${protectedOa.id}'; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER codex_handover_guard AFTER INSERT ON "LineOfficialAccount" FOR EACH ROW EXECUTE FUNCTION codex_handover_guard_fn()`);
  try {
    await assert.rejects(
      applyHandoverPlan({
        prisma, service, encryption, rows: prepared.rows, issues: prepared.issues,
        options: { ...none, expectedPlanSha256: prepared.plan.planSha256, expectedExistingKeysetSha256: webhookKeysetSha256(prepared.snapshot.oas) },
      }),
      /Protected existing LINE OAs or Stores changed/u,
    );
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER codex_handover_guard ON "LineOfficialAccount"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION codex_handover_guard_fn()`);
  }
  assert.equal(await prisma.lineOfficialAccount.count(), before);
  assert.equal(await prisma.store.count({ where: { code: "920002" } }), 0);
  assert.equal((await prisma.lineOfficialAccount.findUniqueOrThrow({ where: { id: protectedOa.id } })).name, "Restored 920001");
});
