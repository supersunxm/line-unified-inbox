import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import { LineAccountType, MessageDirection, Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import type { StoreAccessService } from "../auth/store-access.service";
import { PrismaService } from "../prisma.service";
import { ChatSearchService } from "./chat-search.service";

/**
 * Real PostgreSQL verification using synthetic data only. Runs against a disposable,
 * uniquely named database on a local host, which is dropped afterwards. Skipped unless
 * CHAT_SEARCH_TEST_DATABASE_URL is set; CI must provide it.
 */
const testDatabaseUrl = process.env.CHAT_SEARCH_TEST_DATABASE_URL;
const ADMIN = { id: "admin-it", role: "ADMIN", isActive: true, status: "ACTIVE" } as unknown as AuthUser;
const THAI_SARA_AM_DECOMPOSED = "ํา";
const RANGE = { startDate: "2026-09-01", endDate: "2026-09-30" };

function safeLocalBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Chat search PostgreSQL test URL is malformed");
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
  if ((url.protocol !== "postgresql:" && url.protocol !== "postgres:") || !localHost) {
    throw new Error("Chat search PostgreSQL test requires a disposable database on a local host");
  }
  return url;
}

function migrateDisposableDatabase(databaseUrl: string): void {
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: databaseUrl },
    maxBuffer: 4 * 1024 * 1024,
  });
  if (!result.error && result.status === 0) return;
  throw new Error(`Chat search disposable database migration failed (exit ${result.status ?? "none"})`);
}

function storeAccess(scope: string[] | null): StoreAccessService {
  return { accessibleStoreIds: async () => scope } as unknown as StoreAccessService;
}

function search(scope: string[] | null, prisma: PrismaService): ChatSearchService {
  return new ChatSearchService(prisma, storeAccess(scope));
}

type Seeded = {
  stores: { a: string; b: string };
  conversations: Record<"a" | "b" | "archived" | "inactive" | "head" | "disabled" | "archivedOa" | "mismatch" | "mixed", string>;
};

async function seedStructure(prisma: PrismaService): Promise<Seeded> {
  const storeA = await prisma.store.create({ data: { name: "Store A", code: "it-a" } });
  const storeB = await prisma.store.create({ data: { name: "Store B", code: "it-b" } });
  const storeArchived = await prisma.store.create({ data: { name: "Store Archived", code: "it-arch", archivedAt: new Date("2026-06-01T00:00:00Z") } });
  const storeInactive = await prisma.store.create({ data: { name: "Store Inactive", code: "it-inact", isActive: false } });

  // The database requires STORE accounts to belong to a store and HEAD_OFFICE accounts to belong to none.
  const createOa = async (key: string, storeId: string | null, options: { accountType?: LineAccountType; isActive?: boolean; archivedAt?: Date } = {}) =>
    (await prisma.lineOfficialAccount.create({ data: { webhookKey: `it-${key}`, name: `OA ${key}`, storeId, ...options } })).id;
  const oaA = await createOa("a", storeA.id);
  const oaB = await createOa("b", storeB.id);
  const oaArchived = await createOa("arch", storeArchived.id);
  const oaInactive = await createOa("inact", storeInactive.id);
  const oaHead = await createOa("head", null, { accountType: LineAccountType.HEAD_OFFICE });
  const oaDisabled = await createOa("disabled", storeA.id, { isActive: false });
  const oaArchivedOa = await createOa("archived-oa", storeA.id, { archivedAt: new Date("2026-06-01T00:00:00Z") });

  const customerOne = await prisma.customer.create({ data: { displayName: "Somchai", lineUserId: "Uit-one" } });
  const customerTwo = await prisma.customer.create({ data: { displayName: "Malee", lineUserId: "Uit-two" } });
  const createConversation = async (storeId: string | null, lineOfficialAccountId: string, customerId: string) =>
    (await prisma.conversation.create({
      data: { customerId, storeId, lineOfficialAccountId, latestMessageAt: new Date("2026-09-01T00:00:00Z") },
    })).id;

  return {
    stores: { a: storeA.id, b: storeB.id },
    conversations: {
      a: await createConversation(storeA.id, oaA, customerOne.id),
      b: await createConversation(storeB.id, oaB, customerTwo.id),
      archived: await createConversation(storeArchived.id, oaArchived, customerOne.id),
      inactive: await createConversation(storeInactive.id, oaInactive, customerTwo.id),
      head: await createConversation(storeA.id, oaHead, customerOne.id),
      disabled: await createConversation(storeA.id, oaDisabled, customerTwo.id),
      archivedOa: await createConversation(storeA.id, oaArchivedOa, customerTwo.id),
      mismatch: await createConversation(storeA.id, oaB, customerOne.id),
      mixed: await createConversation(storeA.id, oaA, customerTwo.id),
    },
  };
}

async function message(prisma: PrismaService, conversationId: string, sentAt: string, originalText: string, direction = MessageDirection.INBOUND): Promise<string> {
  return (await prisma.message.create({ data: { conversationId, direction, originalText, sentAt: new Date(sentAt) } })).id;
}

async function seedMessages(prisma: PrismaService, c: Seeded["conversations"]): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  const add = async (key: string, conversationId: string, sentAt: string, text: string) => {
    ids[key] = await message(prisma, conversationId, sentAt, text);
  };
  await add("thaiA", c.a, "2026-09-10T03:00:00.000Z", "สวัสดีครับ ลูกค้าถามเรื่องราคา");
  await add("english", c.a, "2026-09-10T04:00:00.000Z", "Hello, what's the price of the 100% model?");
  await add("composed", c.a, "2026-09-11T05:00:00.000Z", "ขอบคุณคำแนะนำ");
  await add("decomposed", c.a, "2026-09-11T06:00:00.000Z", `ขอบคุณค${THAI_SARA_AM_DECOMPOSED}แนะนำ`);
  await add("underscore", c.a, "2026-09-12T02:00:00.000Z", "model_X2 ready");
  await add("noUnderscore", c.a, "2026-09-12T03:00:00.000Z", "modelXX2 ready");
  await add("startBoundary", c.a, "2026-08-31T17:00:00.000Z", "boundary start");
  await add("beforeBoundary", c.a, "2026-08-31T16:59:59.999Z", "boundary before");
  await add("endBoundary", c.a, "2026-09-30T16:59:59.999Z", "boundary end");
  await add("afterBoundary", c.a, "2026-09-30T17:00:00.000Z", "boundary after");
  await add("storeB", c.b, "2026-09-10T03:30:00.000Z", "สวัสดีจากสาขา B");
  await add("archivedStore", c.archived, "2026-09-10T03:31:00.000Z", "สวัสดีจากสาขาปิด");
  await add("inactiveStore", c.inactive, "2026-09-10T03:32:00.000Z", "สวัสดีจากสาขาไม่ใช้งาน");
  await add("headOffice", c.head, "2026-09-10T03:33:00.000Z", "สวัสดีจาก HQ");
  await add("disabledOa", c.disabled, "2026-09-10T03:34:00.000Z", "สวัสดี disabled-oa");
  await add("archivedOa", c.archivedOa, "2026-09-10T03:35:00.000Z", "สวัสดี archived-oa");
  await add("mismatch", c.mismatch, "2026-09-10T03:36:00.000Z", "สวัสดี mismatch");
  await add("alphaOutside", c.mixed, "2026-08-15T03:00:00.000Z", "keyword-alpha early");
  await add("plainInside", c.mixed, "2026-09-12T04:00:00.000Z", "plain text inside");
  await add("alphaInside", c.mixed, "2026-09-13T04:00:00.000Z", "keyword-alpha inside");
  await add("newYear", c.a, "2025-12-31T18:00:00.000Z", "newyear-zeta");
  for (let index = 0; index < 5; index += 1) {
    await add(`paged${index}`, c.a, "2026-09-20T02:00:00.000Z", `paged-omega ${index}`);
  }
  return ids;
}

void test("chat message search against disposable PostgreSQL with synthetic data", {
  skip: !testDatabaseUrl && process.env.CI !== "true" ? "requires a disposable local PostgreSQL (CHAT_SEARCH_TEST_DATABASE_URL)" : false,
  timeout: 180_000,
}, async (t) => {
  assert.ok(testDatabaseUrl, "CI must provide CHAT_SEARCH_TEST_DATABASE_URL for the chat search PostgreSQL test");
  const base = safeLocalBaseUrl(testDatabaseUrl);
  const databaseName = `chat_search_it_${process.pid}_${randomBytes(4).toString("hex")}`;
  const target = new URL(base);
  target.pathname = `/${databaseName}`;
  const previousFlag = process.env.CHAT_MESSAGE_SEARCH_ENABLED;
  process.env.CHAT_MESSAGE_SEARCH_ENABLED = "true";

  const admin = new PrismaService({ datasources: { db: { url: base.toString() } } });
  let prisma: PrismaService | null = null;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    migrateDisposableDatabase(target.toString());
    prisma = new PrismaService({ datasources: { db: { url: target.toString() } } });
    await prisma.$connect();
    const db = prisma;

    const structure = await seedStructure(db);
    const ids = await seedMessages(db, structure.conversations);
    const expected = (...names: string[]) => names.map((name) => ids[name]).sort();
    const keys = (result: { items: Array<{ messageId: string }> }) => result.items.map((item) => item.messageId).sort();
    const hq = search(null, db);

    await t.test("HQ default scope returns active store messages and excludes archived, inactive, HEAD_OFFICE, disabled, archived and mismatched OAs", async () => {
      const result = await hq.search(ADMIN, { q: "สวัสดี", ...RANGE, limit: 50 });
      assert.deepEqual(keys(result), expected("thaiA", "storeB"));
      assert.equal(result.hasMore, false);
    });

    await t.test("a restricted scope and an explicit selection never reveal another store", async () => {
      const restricted = await search([structure.stores.a], db).search(ADMIN, { q: "สวัสดี", ...RANGE, limit: 50 });
      assert.deepEqual(keys(restricted), expected("thaiA"));
      const selected = await hq.search(ADMIN, { q: "สวัสดี", ...RANGE, storeIds: [structure.stores.b], limit: 50 });
      assert.deepEqual(keys(selected), expected("storeB"));
      await assert.rejects(
        search([structure.stores.a], db).search(ADMIN, { q: "สวัสดี", ...RANGE, storeIds: [structure.stores.b] }),
        (error: unknown) => error instanceof HttpException && error.getStatus() === 403,
      );
    });

    await t.test("Thai composed and decomposed SARA AM spellings match the same keyword", async () => {
      assert.deepEqual(keys(await hq.search(ADMIN, { q: "คำ", ...RANGE, limit: 50 })), expected("composed", "decomposed"));
      assert.deepEqual(keys(await hq.search(ADMIN, { q: `ค${THAI_SARA_AM_DECOMPOSED}`, ...RANGE, limit: 50 })), expected("composed", "decomposed"));
    });

    await t.test("English matching is case-insensitive and LIKE wildcards are literal", async () => {
      assert.deepEqual(keys(await hq.search(ADMIN, { q: "HELLO", ...RANGE, limit: 50 })), expected("english"));
      assert.deepEqual(keys(await hq.search(ADMIN, { q: "100%", ...RANGE, limit: 50 })), expected("english"));
      assert.deepEqual(keys(await hq.search(ADMIN, { q: "model_X", ...RANGE, limit: 50 })), expected("underscore"));
    });

    await t.test("Bangkok midnight boundaries are inclusive at the start and end and exclusive after", async () => {
      assert.deepEqual(keys(await hq.search(ADMIN, { q: "boundary", ...RANGE, limit: 50 })), expected("startBoundary", "endBoundary"));
    });

    await t.test("keyword and date are matched on the same message row", async () => {
      assert.deepEqual(
        keys(await hq.search(ADMIN, { q: "keyword-alpha", ...RANGE, limit: 50 })),
        expected("alphaInside"),
        "the out-of-range keyword message must not pair with an in-range message of the same conversation",
      );
    });

    await t.test("cross-year ranges include the first Bangkok day of the new year", async () => {
      const result = await hq.search(ADMIN, { q: "newyear", startDate: "2025-12-25", endDate: "2026-01-05", limit: 50 });
      assert.deepEqual(keys(result), expected("newYear"));
    });

    await t.test("an empty result is a normal page", async () => {
      const result = await hq.search(ADMIN, { q: "ไม่มีคำนี้เลย", ...RANGE, limit: 50 });
      assert.deepEqual(result.items, []);
      assert.equal(result.hasMore, false);
      assert.equal(result.nextCursor, null);
    });

    await t.test("pages are bounded, never repeat or skip matches, and finish with no next cursor", async () => {
      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await hq.search(ADMIN, { q: "paged-omega", ...RANGE, limit: 2, cursor });
        assert.ok(page.items.length <= 2);
        seen.push(...page.items.map((item) => item.messageId));
        cursor = page.nextCursor ?? undefined;
        pages += 1;
      } while (cursor && pages < 10);
      assert.equal(pages, 3, "five matches at limit 2 need three pages");
      assert.deepEqual([...seen].sort(), expected("paged0", "paged1", "paged2", "paged3", "paged4"));
      assert.equal(new Set(seen).size, seen.length, "no duplicates across pages");
    });

    await t.test("messages inserted while paging do not duplicate or skip existing matches", async () => {
      const first = await hq.search(ADMIN, { q: "paged-omega", ...RANGE, limit: 2 });
      const newerId = await message(db, structure.conversations.a, "2026-09-20T03:00:00.000Z", "paged-omega newer arrival");
      const olderId = await message(db, structure.conversations.a, "2026-09-20T01:00:00.000Z", "paged-omega older arrival");
      const second = await hq.search(ADMIN, { q: "paged-omega", ...RANGE, limit: 2, cursor: first.nextCursor ?? undefined });
      const third = await hq.search(ADMIN, { q: "paged-omega", ...RANGE, limit: 2, cursor: second.nextCursor ?? undefined });
      const combined = [...first.items, ...second.items, ...third.items].map((item) => item.messageId);
      assert.equal(new Set(combined).size, combined.length, "no duplicates after concurrent insertion");
      for (const existing of expected("paged0", "paged1", "paged2", "paged3", "paged4")) {
        assert.ok(combined.includes(existing), "every pre-existing match is returned exactly once");
      }
      assert.equal(combined.includes(newerId), false, "a newer arrival is not injected into a session already past that position");
      assert.ok(combined.includes(olderId), "an older arrival sorts after every 02:00 match and appears on the last page");
    });

    await t.test("the search transaction is read-only and the statement timeout is applied by PostgreSQL", async () => {
      await assert.rejects(
        db.$transaction(async (tx) => {
          await tx.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
          await tx.$executeRaw(Prisma.sql`INSERT INTO "Store" ("id", "name", "updatedAt") VALUES (${randomBytes(8).toString("hex")}, 'nope', now())`);
        }),
        /read-only/iu,
      );
      const timeout = await db.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
        await tx.$queryRaw(Prisma.sql`SELECT set_config('statement_timeout', ${"1234"}, true)`);
        return tx.$queryRaw<Array<{ value: string }>>(Prisma.sql`SELECT current_setting('statement_timeout') AS value`);
      });
      assert.equal(timeout[0].value, "1234ms");
    });
  } finally {
    if (prisma) await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
    await admin.$disconnect();
    if (previousFlag === undefined) delete process.env.CHAT_MESSAGE_SEARCH_ENABLED;
    else process.env.CHAT_MESSAGE_SEARCH_ENABLED = previousFlag;
  }
});
