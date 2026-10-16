import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { Prisma, WebhookProcessingStatus } from "@prisma/client";
import { sunnReceiptKey, SunnSecretaryEventReceiptService } from "./sunn-secretary-event-receipt";
import { SunnSecretaryInboundService, SunnSecretaryCommandPreparation } from "./sunn-secretary-inbound.service";
import { SunnSecretaryCredentialsService } from "./sunn-secretary-credentials.service";
import { classifySunnInbound, SUNN_INBOUND_PREFIX, type InboundPlan } from "./sunn-secretary-inbound";
import { PrismaService } from "../../prisma.service";

const bot = "U" + "a".repeat(32);
const secondBot = "U" + "b".repeat(32);

function uniqueViolation(meta?: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    ...(meta ? { meta } : {}),
  });
}

function receiptServiceWithCreate(create: () => Promise<unknown>): SunnSecretaryEventReceiptService {
  const prisma = { webhookEvent: { create } } as unknown as PrismaService;
  return new SunnSecretaryEventReceiptService(prisma);
}

test("deterministic receipt keys keep the v1 namespace and isolate bot and event IDs", () => {
  const key = sunnReceiptKey(bot, "event-1");
  assert.equal(key, "sunn-secretary:v1:a9af6cb01b65fc568e905d491e605ec884ef35461ffb977d0de47b4c0016bebf");
  assert.equal(sunnReceiptKey(bot, "event-1"), key);
  assert.notEqual(sunnReceiptKey(bot, "event-2"), key);
  assert.notEqual(sunnReceiptKey(secondBot, "event-1"), key);
  assert.doesNotThrow(() => sunnReceiptKey("U" + "A".repeat(32), "event-1"));
});

test("runtime identity validation rejects malformed values without leaking TypeErrors", async () => {
  const invalidIdentities: Array<[unknown, unknown]> = [
    [null, "event-1"],
    [42, "event-1"],
    [{ toString: () => bot }, "event-1"],
    ["u" + "a".repeat(32), "event-1"],
    [bot, undefined],
    [bot, null],
    [bot, 42],
    [bot, {}],
    [bot, ""],
    [bot, "x".repeat(257)],
  ];

  for (const [botUserId, eventId] of invalidIdentities) {
    assert.throws(() => sunnReceiptKey(botUserId, eventId), {
      name: "Error",
      message: "Invalid Sunn Secretary receipt identity",
    });
    await assert.rejects(
      () => new SunnSecretaryEventReceiptService({} as PrismaService).reserve(botUserId, eventId),
      { name: "Error", message: "Invalid Sunn Secretary receipt identity" },
    );
  }
});

test("only the externalWebhookEventId unique violation is classified as duplicate", async () => {
  const receiptService = receiptServiceWithCreate(async () => {
    throw uniqueViolation({ target: ["externalWebhookEventId"] });
  });

  assert.equal(await receiptService.reserve(bot, "event-1"), "DUPLICATE");
});

test("an unrelated P2002 constraint propagates", async () => {
  const error = uniqueViolation({ target: ["id"] });
  const receiptService = receiptServiceWithCreate(async () => { throw error; });

  await assert.rejects(() => receiptService.reserve(bot, "event-1"), (caught: unknown) => caught === error);
});

test("missing P2002 metadata fails closed", async () => {
  const error = uniqueViolation();
  const receiptService = receiptServiceWithCreate(async () => { throw error; });

  await assert.rejects(() => receiptService.reserve(bot, "event-1"), (caught: unknown) => caught === error);
});

test("unverified P2002 metadata formats fail closed", async () => {
  const unexpectedTargets: Array<Record<string, unknown>> = [
    { target: "WebhookEvent_externalWebhookEventId_key" },
    { target: ["externalWebhookEventId", "id"] },
    { target: { field: "externalWebhookEventId" } },
  ];

  for (const meta of unexpectedTargets) {
    const error = uniqueViolation(meta);
    const receiptService = receiptServiceWithCreate(async () => { throw error; });
    await assert.rejects(() => receiptService.reserve(bot, "event-1"), (caught: unknown) => caught === error);
  }
});

test("concurrent mock reservations demonstrate adapter behavior only", async () => {
  const seen = new Set<string>();
  const prisma = {
    webhookEvent: {
      create: async ({ data }: { data: { externalWebhookEventId: string; processingStatus: string; eventType: string; destination: string; processedAt: Date } }) => {
        assert.equal(data.processingStatus, WebhookProcessingStatus.IGNORED);
        assert.equal(data.eventType, "SUNN_SECRETARY_RESERVED");
        assert.equal(data.destination, bot);
        assert.ok(data.processedAt instanceof Date);
        if (seen.has(data.externalWebhookEventId)) {
          throw uniqueViolation({ target: ["externalWebhookEventId"] });
        }
        seen.add(data.externalWebhookEventId);
      },
    },
  } as unknown as PrismaService;
  const receipts = new SunnSecretaryEventReceiptService(prisma);

  const duplicateResults = await Promise.all([receipts.reserve(bot, "ev1"), receipts.reserve(bot, "ev1")]);
  assert.equal(duplicateResults.filter((result) => result === "NEW").length, 1);
  assert.equal(duplicateResults.filter((result) => result === "DUPLICATE").length, 1);
  assert.equal(await receipts.reserve(bot, "ev2"), "NEW");
});

test("ordinary database failures fail closed rather than looking like fresh events", async () => {
  const error = new Error("db unavailable");
  const receiptService = receiptServiceWithCreate(async () => { throw error; });

  await assert.rejects(() => receiptService.reserve(bot, "event-1"), (caught: unknown) => caught === error);
});

const testDatabaseUrl = process.env.SUNN_SECRETARY_RECEIPT_TEST_DATABASE_URL ?? process.env.SECRETARY_SETTINGS_TEST_DATABASE_URL;

function safeDisposableTestUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Sunn receipt PostgreSQL test URL is malformed");
  }

  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const hostname = url.hostname.toLowerCase();
  const agentCiDatabaseAlias = hostname === "postgres" && process.env.CODEX_AGENT_CI_POSTGRES === "true" && ["postgres:", "postgresql:"].includes(url.protocol) && url.username === "ci" && url.password === "ci" && url.port === "5432" && url.pathname === "/ci" && url.search === "" && url.hash === "";
  if (
    (url.protocol !== "postgresql:" && url.protocol !== "postgres:") ||
    (!allowedHosts.has(hostname) && !agentCiDatabaseAlias) ||
    url.username !== "ci" || decodeURIComponent(url.pathname.slice(1)) !== "ci"
  ) {
    throw new Error("Sunn receipt PostgreSQL test requires the isolated local CI database (ci user/database)");
  }

  return url;
}

function migrateDisposableDatabase(databaseUrl: string): void {
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: databaseUrl },
    maxBuffer: 2 * 1024 * 1024,
  });

  if (!result.error && result.status === 0) return;

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/giu, "[REDACTED_DATABASE_URL]")
    .trim()
    .slice(-1600);
  const reason = result.error ? "migration process could not start" : `migration exited ${result.status ?? "without a status"}`;
  throw new Error(`Sunn receipt disposable database setup failed (${reason})${output ? `: ${output}` : ""}`);
}

test("real PostgreSQL uniqueness safely serializes concurrent Sunn receipt reservations", {
  skip: !testDatabaseUrl && process.env.CI !== "true" ? "requires a disposable local CI PostgreSQL service" : false,
}, async () => {
  assert.ok(testDatabaseUrl, "CI must provide SECRETARY_SETTINGS_TEST_DATABASE_URL for the PostgreSQL receipt test");
  const baseUrl = safeDisposableTestUrl(testDatabaseUrl);
  const databaseName = `sunn_receipt_ci_${process.pid}_${randomBytes(6).toString("hex")}`;
  const targetUrl = new URL(baseUrl);
  targetUrl.pathname = `/${databaseName}`;

  const admin = new PrismaService({ datasources: { db: { url: baseUrl.toString() } } });
  let databaseCreated = false;
  let firstClient: PrismaService | undefined;
  let secondClient: PrismaService | undefined;

  try {
    await admin.$connect();
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    migrateDisposableDatabase(targetUrl.toString());

    firstClient = new PrismaService({ datasources: { db: { url: targetUrl.toString() } } });
    secondClient = new PrismaService({ datasources: { db: { url: targetUrl.toString() } } });
    await Promise.all([firstClient.$connect(), secondClient.$connect()]);

    const firstReceipts = new SunnSecretaryEventReceiptService(firstClient);
    const secondReceipts = new SunnSecretaryEventReceiptService(secondClient);
    const sameEventResults = await Promise.all([
      firstReceipts.reserve(bot, "01HF7YAT000000000000000001"),
      secondReceipts.reserve(bot, "01HF7YAT000000000000000001"),
    ]);

    assert.equal(sameEventResults.filter((result) => result === "NEW").length, 1);
    assert.equal(sameEventResults.filter((result) => result === "DUPLICATE").length, 1);
    assert.equal(
      await firstClient.webhookEvent.count({ where: { externalWebhookEventId: sunnReceiptKey(bot, "01HF7YAT000000000000000001") } }),
      1,
    );

    assert.equal(await firstReceipts.reserve(bot, "01HF7YAT000000000000000002"), "NEW");
    assert.equal(await secondReceipts.reserve(secondBot, "01HF7YAT000000000000000001"), "NEW");

    const receipts = await firstClient.webhookEvent.findMany({
      orderBy: { externalWebhookEventId: "asc" },
      select: { externalWebhookEventId: true, eventType: true, destination: true, processingStatus: true, processedAt: true },
    });
    assert.equal(receipts.length, 3);
    assert.ok(receipts.every((receipt) => receipt.eventType === "SUNN_SECRETARY_RESERVED"));
    assert.ok(receipts.every((receipt) => receipt.processingStatus === WebhookProcessingStatus.IGNORED));
    assert.ok(receipts.every((receipt) => receipt.processedAt instanceof Date));
    assert.deepEqual(
      receipts.map((receipt) => receipt.externalWebhookEventId).sort(),
      [
        sunnReceiptKey(bot, "01HF7YAT000000000000000001"),
        sunnReceiptKey(bot, "01HF7YAT000000000000000002"),
        sunnReceiptKey(secondBot, "01HF7YAT000000000000000001"),
      ].sort(),
    );
    assert.equal(await firstClient.webhookEvent.count({ where: { processingStatus: WebhookProcessingStatus.RECEIVED } }), 0);
    // Independent PostgreSQL connections exercise actual CAS, not mock scheduling.
    const envKeys = ["SUNN_SECRETARY_WEBHOOK_ENABLED", "SUNN_SECRETARY_ALLOWED_USER_IDS", "SUNN_SECRETARY_STORE_SCOPE_BY_USER"] as const;
    const saved = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    const owner = "U" + "c".repeat(32);
    const event = (id: string) => ({ type: "message", webhookEventId: id, timestamp: Date.now(), source: { type: "group", groupId: "C" + "d".repeat(32), userId: owner }, message: { type: "text", text: "@เลขาซันน์ เดือนตุลาคม ปี 2026 LINE OA ไหนยังค้างตอบลูกค้า", mention: { mentionees: [{ type: "user", userId: bot }] } }, replyToken: "never-persist-this-token" });
    const credentials = { inboundIdentity: async () => ({ botUserId: bot, channelSecret: "unused" }) } as unknown as SunnSecretaryCredentialsService;
    let preparations = 0;
    const actual = new SunnSecretaryCommandPreparation();
    const preparation: SunnSecretaryCommandPreparation = { prepare: (plan: InboundPlan) => { preparations++; return actual.prepare(plan); } };
    const worker = (db: PrismaService, prep = preparation) => new SunnSecretaryInboundService(db, new SunnSecretaryEventReceiptService(db), credentials, prep);
    const one = worker(firstClient), two = worker(secondClient);
    const state = (id: string) => firstClient!.webhookEvent.findUniqueOrThrow({ where: { externalWebhookEventId: sunnReceiptKey(bot, id) } });
    const expire = (id: string) => secondClient!.webhookEvent.update({ where: { externalWebhookEventId: sunnReceiptKey(bot, id) }, data: { updatedAt: new Date(Date.now() - 60_000) } });
    try {
      process.env.SUNN_SECRETARY_WEBHOOK_ENABLED = "true";
      process.env.SUNN_SECRETARY_ALLOWED_USER_IDS = owner;
      process.env.SUNN_SECRETARY_STORE_SCOPE_BY_USER = JSON.stringify({ [owner]: ["11111111-1111-4111-8111-111111111111"] });
      await Promise.all([one.accept(bot, [event("inbound-race")]), two.accept(bot, [event("inbound-race")])]);
      assert.equal(await firstClient.webhookEvent.count({ where: { externalWebhookEventId: sunnReceiptKey(bot, "inbound-race") } }), 1);
      await Promise.all([one.recoverAndPrepare(), two.recoverAndPrepare()]);
      assert.equal(preparations, 1, "concurrent workers own one preparation lease");
      assert.equal((await state("inbound-race")).eventType, SUNN_INBOUND_PREFIX + "PREPARED");
      await one.accept(bot, [event("inbound-race")]); await two.recoverAndPrepare();
      assert.equal(preparations, 1, "duplicate must not reset terminal work");
      const persisted = JSON.stringify(await state("inbound-race"));
      for (const secret of ["never-persist-this-token", owner, "ค้างตอบ"]) assert.ok(!persisted.includes(secret));
      await one.accept(bot, [event("restart-received")]); await worker(secondClient).recoverAndPrepare();
      assert.equal((await state("restart-received")).eventType, SUNN_INBOUND_PREFIX + "PREPARED");
      await one.accept(bot, [event("restart-processing")]);
      const plan = JSON.parse((await state("restart-processing")).errorMessage!) as InboundPlan;
      await firstClient.webhookEvent.update({ where: { externalWebhookEventId: sunnReceiptKey(bot, "restart-processing") }, data: { eventType: SUNN_INBOUND_PREFIX + "PROCESSING", errorMessage: JSON.stringify({ ...plan, attempts: 1, lease: "11111111-1111-4111-8111-111111111111" }) } });
      const before = preparations;
      await two.recoverAndPrepare(); assert.equal(preparations, before, "active lease cannot be stolen");
      await expire("restart-processing"); await worker(secondClient).recoverAndPrepare();
      assert.equal((await state("restart-processing")).eventType, SUNN_INBOUND_PREFIX + "PREPARED");
      await one.accept(bot, [event("revoked")]); process.env.SUNN_SECRETARY_ALLOWED_USER_IDS = "";
      await two.recoverAndPrepare(); assert.equal((await state("revoked")).eventType, SUNN_INBOUND_PREFIX + "UNAUTHORIZED");
      process.env.SUNN_SECRETARY_ALLOWED_USER_IDS = owner;
      process.env.SUNN_SECRETARY_STORE_SCOPE_BY_USER = "{}";
      await one.accept(bot, [event("no-scope")]); await two.recoverAndPrepare();
      assert.equal((await state("no-scope")).eventType, SUNN_INBOUND_PREFIX + "BLOCKED_SCOPE");
      const fail = { prepare: () => { throw new Error("sensitive-private-error"); } } as unknown as SunnSecretaryCommandPreparation;
      await one.accept(bot, [event("bounded-failure")]);
      for (let attempt = 0; attempt < 3; attempt++) { await expire("bounded-failure"); await worker(secondClient, fail).recoverAndPrepare(); }
      const failed = await state("bounded-failure");
      assert.equal(failed.eventType, SUNN_INBOUND_PREFIX + "FAILED_FINAL");
      assert.equal((JSON.parse(failed.errorMessage!) as InboundPlan).attempts, 3);
      assert.ok(!failed.errorMessage!.includes("sensitive"));
      const otherPlan = classifySunnInbound(event("other-bot"), bot, [owner], new Date()).plan;
      await secondReceipts.reserveInbound(secondBot, "other-bot", otherPlan); await one.recoverAndPrepare();
      assert.equal((await firstClient.webhookEvent.findUniqueOrThrow({ where: { externalWebhookEventId: sunnReceiptKey(secondBot, "other-bot") } })).eventType, SUNN_INBOUND_PREFIX + "RECEIVED");
      const count = await firstClient.webhookEvent.count(); process.env.SUNN_SECRETARY_WEBHOOK_ENABLED = "false";
      await one.accept(bot, [event("disabled-write")]); await one.recoverAndPrepare();
      assert.equal(await firstClient.webhookEvent.count(), count);
      assert.equal(await firstClient.webhookEvent.count({ where: { processingStatus: WebhookProcessingStatus.RECEIVED } }), 0, "storefront workers cannot claim assistant work");
    } finally {
      for (const key of envKeys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    }

  } finally {
    await Promise.all([firstClient?.$disconnect(), secondClient?.$disconnect()]);
    if (databaseCreated) {
      await admin.$executeRawUnsafe(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        databaseName,
      );
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
      const remaining = await admin.$queryRawUnsafe<Array<{ exists: boolean }>>(
        "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
        databaseName,
      );
      assert.equal(remaining[0]?.exists, false, "disposable PostgreSQL database must be removed");
    }
    await admin.$disconnect();
  }
});
