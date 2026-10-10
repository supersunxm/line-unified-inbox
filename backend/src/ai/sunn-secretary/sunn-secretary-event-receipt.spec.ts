import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { Prisma, WebhookProcessingStatus } from "@prisma/client";
import { sunnReceiptKey, SunnSecretaryEventReceiptService } from "./sunn-secretary-event-receipt";
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
  if (
    (url.protocol !== "postgresql:" && url.protocol !== "postgres:") ||
    !allowedHosts.has(url.hostname.toLowerCase()) ||
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
