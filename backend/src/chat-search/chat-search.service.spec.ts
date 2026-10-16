import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException, HttpException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import type { StoreAccessService } from "../auth/store-access.service";
import type { PrismaService } from "../prisma.service";
import { chatSearchFingerprint, decodeChatSearchCursor } from "./chat-search-query";
import { ChatSearchService, isChatMessageSearchEnabled, type ChatMessageSearchRow } from "./chat-search.service";

const ACTIVE = { isActive: true, status: "ACTIVE" };
const ADMIN = { id: "admin-1", role: "ADMIN", ...ACTIVE } as unknown as AuthUser;
const HQ_ALL_STORES = {
  id: "hq-1",
  role: "ASSISTANT",
  ...ACTIVE,
  authorization: { workspaces: { hq: true }, scope: { allStores: true, storeIds: [] } },
} as unknown as AuthUser;
const HQ_WITHOUT_ALL_STORES = {
  id: "hq-2",
  role: "ASSISTANT",
  ...ACTIVE,
  authorization: { workspaces: { hq: true }, scope: { allStores: false, storeIds: ["store-a"] } },
} as unknown as AuthUser;
const STORE_VIEWER = {
  id: "viewer-1",
  role: "VIEWER",
  ...ACTIVE,
  authorization: { workspaces: { hq: false, store: true }, scope: { allStores: false, storeIds: ["store-a"] } },
} as unknown as AuthUser;

const BASE_INPUT = { q: "สวัสดี", startDate: "2026-09-01", endDate: "2026-09-30" };

type Statement = { sql: string; values: unknown[] };

function row(overrides: Partial<ChatMessageSearchRow> = {}): ChatMessageSearchRow {
  return {
    messageId: "msg-1",
    conversationId: "conv-1",
    storeId: "store-a",
    storeName: "Store A",
    customerDisplayName: "Customer One",
    direction: "INBOUND",
    sentAt: new Date("2026-09-10T03:00:00.000Z"),
    originalText: "สวัสดีครับ ลูกค้าถามเรื่องราคา",
    ...overrides,
  };
}

function fakePrisma(options: {
  rows?: ChatMessageSearchRow[];
  onSearch?: (statement: Statement) => Promise<ChatMessageSearchRow[]>;
}) {
  const statements: Statement[] = [];
  const record = (query: Prisma.Sql): Statement => {
    const statement = { sql: query.sql, values: [...query.values] };
    statements.push(statement);
    return statement;
  };
  const tx = {
    $executeRaw: async (query: Prisma.Sql) => {
      record(query);
      return 0;
    },
    $queryRaw: async (query: Prisma.Sql) => {
      const statement = record(query);
      if (statement.sql.includes("set_config")) return [];
      if (options.onSearch) return options.onSearch(statement);
      return options.rows ?? [];
    },
  };
  const prisma = {
    statements,
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx),
  };
  return prisma as unknown as PrismaService & { statements: Statement[] };
}

function storeAccess(scope: string[] | null): StoreAccessService {
  return { accessibleStoreIds: async () => scope } as unknown as StoreAccessService;
}

function serviceWith(scope: string[] | null, prisma: PrismaService): ChatSearchService {
  return new ChatSearchService(prisma, storeAccess(scope));
}

async function withFlag<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  const previous = process.env.CHAT_MESSAGE_SEARCH_ENABLED;
  if (value === undefined) delete process.env.CHAT_MESSAGE_SEARCH_ENABLED;
  else process.env.CHAT_MESSAGE_SEARCH_ENABLED = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.CHAT_MESSAGE_SEARCH_ENABLED;
    else process.env.CHAT_MESSAGE_SEARCH_ENABLED = previous;
  }
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("expected the promise to reject");
}

function codeOf(error: unknown): string | undefined {
  const response = (error as { getResponse?: () => unknown }).getResponse?.();
  return (response as { code?: string } | undefined)?.code;
}

void test("the feature flag is off unless the environment says exactly true", async () => {
  await withFlag(undefined, async () => assert.equal(isChatMessageSearchEnabled(), false));
  await withFlag("false", async () => assert.equal(isChatMessageSearchEnabled(), false));
  await withFlag("TRUE", async () => assert.equal(isChatMessageSearchEnabled(), false));
  await withFlag("true", async () => assert.equal(isChatMessageSearchEnabled(), true));
});

void test("with the flag off no query runs and the endpoint looks absent", async () => {
  const prisma = fakePrisma({ rows: [row()] });
  const service = serviceWith(null, prisma);
  await withFlag(undefined, async () => {
    const error = await rejectionOf(service.search(ADMIN, BASE_INPUT));
    assert.ok(error instanceof NotFoundException);
  });
  assert.equal(prisma.statements.length, 0);
});

void test("only platform admins or HQ accounts with all-store scope may search", async () => {
  await withFlag("true", async () => {
    for (const user of [STORE_VIEWER, HQ_WITHOUT_ALL_STORES]) {
      const prisma = fakePrisma({ rows: [row()] });
      const error = await rejectionOf(serviceWith(null, prisma).search(user, BASE_INPUT));
      assert.ok(error instanceof ForbiddenException, `${user.role} must be refused`);
      assert.equal(codeOf(error), "CHAT_SEARCH_HQ_REQUIRED");
      assert.equal(prisma.statements.length, 0, "no query for unauthorized accounts");
    }
    const hqPrisma = fakePrisma({ rows: [row()] });
    const result = await serviceWith(null, hqPrisma).search(HQ_ALL_STORES, BASE_INPUT);
    assert.equal(result.items.length, 1);
  });
});

void test("default scope covers every store the HQ account may see and binds the Bangkok window", async () => {
  await withFlag("true", async () => {
    const prisma = fakePrisma({ rows: [row()] });
    const result = await serviceWith(null, prisma).search(ADMIN, BASE_INPUT);
    assert.deepEqual(result.scope, {
      timezone: "Asia/Bangkok",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      stores: { mode: "ALL_AUTHORIZED" },
    });
    assert.equal(prisma.statements[0].sql, "SET TRANSACTION READ ONLY", "the transaction is read-only before any other work");
    assert.match(prisma.statements[1].sql, /set_config\('statement_timeout'/u);
    assert.deepEqual(prisma.statements[1].values, ["5000"]);
    const search = prisma.statements[2];
    assert.match(search.sql, /FROM "Message" m/u);
    assert.doesNotMatch(search.sql, /c\."storeId" IN/u);
    assert.ok(search.values.some((value) => value instanceof Date && value.toISOString() === "2026-08-31T17:00:00.000Z"));
    assert.ok(search.values.some((value) => value instanceof Date && value.toISOString() === "2026-09-30T17:00:00.000Z"));
  });
});

void test("an explicit store selection narrows the query to those stores", async () => {
  await withFlag("true", async () => {
    const prisma = fakePrisma({ rows: [row()] });
    const result = await serviceWith(null, prisma).search(ADMIN, { ...BASE_INPUT, storeIds: ["store-a", "store-b"] });
    const search = prisma.statements[2];
    assert.match(search.sql, /c\."storeId" IN \(\?,\s?\?\)/u);
    assert.ok(search.values.includes("store-a") && search.values.includes("store-b"));
    assert.deepEqual(result.scope.stores, { mode: "SELECTED", storeIds: ["store-a", "store-b"] });
  });
});

void test("explicit store IDs outside the caller's scope are refused before any query", async () => {
  await withFlag("true", async () => {
    const prisma = fakePrisma({ rows: [row()] });
    const service = serviceWith(["store-a", "store-b"], prisma);
    const error = await rejectionOf(service.search(HQ_ALL_STORES, { ...BASE_INPUT, storeIds: ["store-a", "store-c"] }));
    assert.ok(error instanceof ForbiddenException);
    assert.equal(codeOf(error), "CHAT_SEARCH_STORE_FORBIDDEN");
    assert.equal(prisma.statements.length, 0);
    assert.doesNotMatch(JSON.stringify(error.getResponse()), /store-c/u, "the refused ID is not echoed");
  });
});

void test("without a selection a restricted caller is limited to its own authorized stores", async () => {
  await withFlag("true", async () => {
    const prisma = fakePrisma({ rows: [row()] });
    const result = await serviceWith(["store-a", "store-b"], prisma).search(ADMIN, BASE_INPUT);
    const search = prisma.statements[2];
    assert.match(search.sql, /c\."storeId" IN \(\?,\s?\?\)/u);
    assert.ok(search.values.includes("store-a") && search.values.includes("store-b"));
    assert.deepEqual(result.scope.stores, { mode: "ALL_AUTHORIZED" });
  });
});

void test("an empty authorized store list returns an empty page without querying", async () => {
  await withFlag("true", async () => {
    const prisma = fakePrisma({ rows: [row()] });
    const result = await serviceWith([], prisma).search(ADMIN, BASE_INPUT);
    assert.deepEqual(result.items, []);
    assert.equal(result.hasMore, false);
    assert.equal(prisma.statements.length, 0);
  });
});

void test("invalid parameters are rejected with a 400 before any query", async () => {
  await withFlag("true", async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["CHAT_SEARCH_INVALID_KEYWORD", { q: "ก" }],
      ["CHAT_SEARCH_INVALID_DATE", { startDate: "2026-02-31" }],
      ["CHAT_SEARCH_RANGE_TOO_LARGE", { startDate: "2026-01-01", endDate: "2026-06-30" }],
      ["CHAT_SEARCH_INVALID_LIMIT", { limit: 51 }],
      ["CHAT_SEARCH_INVALID_STORE", { storeIds: ["bad id;"] }],
    ];
    for (const [code, override] of cases) {
      const prisma = fakePrisma({ rows: [row()] });
      const error = await rejectionOf(serviceWith(null, prisma).search(ADMIN, { ...BASE_INPUT, ...override }));
      assert.ok(error instanceof BadRequestException, code);
      assert.equal(codeOf(error), code);
      assert.equal(prisma.statements.length, 0, `${code} must not query`);
    }
  });
});

void test("pagination returns a bounded page, a cursor for the next page, and no duplicates across pages", async () => {
  await withFlag("true", async () => {
    const newest = row({ messageId: "msg-c", sentAt: new Date("2026-09-10T05:00:00.000Z") });
    const middle = row({ messageId: "msg-b", sentAt: new Date("2026-09-10T04:00:00.000Z") });
    const oldest = row({ messageId: "msg-a", sentAt: new Date("2026-09-10T03:00:00.000Z") });
    // The fake honours the keyset position it is given: rows after msg-b are only msg-a.
    const prisma = fakePrisma({
      onSearch: async (statement) => (statement.values.includes("msg-b") ? [oldest] : [newest, middle, oldest]),
    });
    const service = serviceWith(null, prisma);

    const first = await service.search(ADMIN, { ...BASE_INPUT, limit: 2 });
    assert.deepEqual(first.items.map((item) => item.messageId), ["msg-c", "msg-b"]);
    assert.equal(first.hasMore, true);
    assert.ok(first.nextCursor);
    assert.equal(prisma.statements[2].values.at(-1), 3, "limit + 1 rows are fetched to detect the next page");

    const fingerprint = chatSearchFingerprint({ keyword: "สวัสดี", startDate: "2026-09-01", endDate: "2026-09-30", storeIds: null });
    const cursor = decodeChatSearchCursor(first.nextCursor ?? "", fingerprint);
    assert.equal(cursor.messageId, "msg-b");
    assert.equal(cursor.sentAt.toISOString(), "2026-09-10T04:00:00.000Z");

    const second = await service.search(ADMIN, { ...BASE_INPUT, limit: 2, cursor: first.nextCursor ?? undefined });
    const keysetStatement = prisma.statements.at(-1);
    assert.ok(keysetStatement);
    assert.match(keysetStatement.sql, /\(m\."sentAt", m\."id"\) < \(\?,\s?\?\)/u);
    assert.ok(keysetStatement.values.includes("msg-b"));
    assert.equal(second.hasMore, false);
    assert.equal(second.nextCursor, null);
  });
});

void test("a cursor cannot be reused with a different keyword, dates, or store selection", async () => {
  await withFlag("true", async () => {
    const prisma = fakePrisma({ rows: [row({ messageId: "x1" }), row({ messageId: "x2" }), row({ messageId: "x3" })] });
    const service = serviceWith(null, prisma);
    const first = await service.search(ADMIN, { ...BASE_INPUT, limit: 2 });
    const statementsBefore = prisma.statements.length;
    const error = await rejectionOf(service.search(ADMIN, { ...BASE_INPUT, q: "ครับ", limit: 2, cursor: first.nextCursor ?? undefined }));
    assert.equal(codeOf(error), "CHAT_SEARCH_INVALID_CURSOR");
    assert.equal(prisma.statements.length, statementsBefore, "a mismatched cursor never reaches the database");
  });
});

void test("response items expose only the fields the search interface needs", async () => {
  await withFlag("true", async () => {
    const longText = `${"ก".repeat(200)}สวัสดี${"ข".repeat(200)}`;
    const prisma = fakePrisma({ rows: [row({ originalText: longText })] });
    const result = await serviceWith(null, prisma).search(ADMIN, BASE_INPUT);
    const [item] = result.items;
    assert.deepEqual(Object.keys(item).sort(), [
      "conversationId",
      "customerDisplayName",
      "direction",
      "messageId",
      "sentAt",
      "snippet",
      "source",
      "storeId",
      "storeName",
    ]);
    assert.equal(item.source, "LIVE");
    assert.ok(item.snippet.includes("สวัสดี"));
    assert.ok(item.snippet.length < longText.length, "long message text is excerpted, not returned whole");
    assert.equal(JSON.stringify(result).includes(longText), false);
  });
});

void test("concurrent searches are capped and the slot is released after completion", async () => {
  await withFlag("true", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prisma = fakePrisma({
      onSearch: async () => {
        await gate;
        return [row()];
      },
    });
    const service = serviceWith(null, prisma);
    service.limits.maxConcurrent = 1;

    const first = service.search(ADMIN, BASE_INPUT);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const refused = await rejectionOf(service.search(ADMIN, BASE_INPUT));
    assert.ok(refused instanceof HttpException);
    assert.equal(refused.getStatus(), 429);
    assert.equal(codeOf(refused), "CHAT_SEARCH_BUSY");

    release();
    assert.equal((await first).items.length, 1);
    const afterRelease = await service.search(ADMIN, BASE_INPUT);
    assert.equal(afterRelease.items.length, 1, "slot is available again");
  });
});

void test("a statement timeout becomes a 503 and still releases the slot", async () => {
  await withFlag("true", async () => {
    let calls = 0;
    const prisma = fakePrisma({
      onSearch: async () => {
        calls += 1;
        if (calls === 1) throw new Error("Raw query failed. Code: 57014. canceling statement due to statement timeout");
        return [row()];
      },
    });
    const service = serviceWith(null, prisma);
    service.limits.maxConcurrent = 1;
    const error = await rejectionOf(service.search(ADMIN, BASE_INPUT));
    assert.ok(error instanceof ServiceUnavailableException);
    assert.equal(codeOf(error), "CHAT_SEARCH_TIMEOUT");
    const retry = await service.search(ADMIN, BASE_INPUT);
    assert.equal(retry.items.length, 1);
  });
});

void test("connection-pool exhaustion is reported as temporary unavailability, and other database errors are not masked", async () => {
  await withFlag("true", async () => {
    const poolPrisma = fakePrisma({
      onSearch: async () => {
        throw Object.assign(new Error("Timed out fetching a new connection from the pool"), { code: "P2024" });
      },
    });
    const poolError = await rejectionOf(serviceWith(null, poolPrisma).search(ADMIN, BASE_INPUT));
    assert.ok(poolError instanceof ServiceUnavailableException);
    assert.equal(codeOf(poolError), "CHAT_SEARCH_UNAVAILABLE");

    const original = new Error("unexpected failure");
    const otherPrisma = fakePrisma({ onSearch: async () => { throw original; } });
    assert.equal(await rejectionOf(serviceWith(null, otherPrisma).search(ADMIN, BASE_INPUT)), original);

    // A generic transaction error (P2028) that is not a timeout must not be reported as one.
    const closedTransaction = Object.assign(new Error("Transaction already closed: a query cannot be executed"), { code: "P2028" });
    const closedPrisma = fakePrisma({ onSearch: async () => { throw closedTransaction; } });
    assert.equal(await rejectionOf(serviceWith(null, closedPrisma).search(ADMIN, BASE_INPUT)), closedTransaction);

    const expiredTransaction = Object.assign(new Error("Transaction already closed: The timeout for this transaction was 7000 ms"), { code: "P2028" });
    const expiredPrisma = fakePrisma({ onSearch: async () => { throw expiredTransaction; } });
    assert.equal(codeOf(await rejectionOf(serviceWith(null, expiredPrisma).search(ADMIN, BASE_INPUT))), "CHAT_SEARCH_TIMEOUT");
  });
});

void test("the configured statement timeout is the value applied to the search transaction", async () => {
  await withFlag("true", async () => {
    const prisma = fakePrisma({ rows: [] });
    const service = serviceWith(null, prisma);
    service.limits.statementTimeoutMs = 1234;
    await service.search(ADMIN, BASE_INPUT);
    assert.deepEqual(prisma.statements[1].values, ["1234"]);
  });
});

void test("role matrix: only ADMIN and HQ all-store ASSISTANT may search; every other account is refused before any query", async () => {
  await withFlag("true", async () => {
    const hqAssistantNoAllStores = { id: "hq-x", role: "ASSISTANT", ...ACTIVE, authorization: { workspaces: { hq: true }, scope: { allStores: false } } } as unknown as AuthUser;
    const allStoresNoHq = { id: "as-x", role: "ASSISTANT", ...ACTIVE, authorization: { workspaces: { hq: false }, scope: { allStores: true } } } as unknown as AuthUser;
    const viewerWithHqAttributes = { id: "vw-x", role: "VIEWER", ...ACTIVE, authorization: { workspaces: { hq: true }, scope: { allStores: true } } } as unknown as AuthUser;
    const storeAssistant = { id: "sa-x", role: "ASSISTANT", ...ACTIVE, authorization: { workspaces: { hq: false, store: true }, scope: { allStores: false, storeIds: ["store-a"] } } } as unknown as AuthUser;

    for (const [label, user] of [
      ["ADMIN", ADMIN],
      ["ASSISTANT with HQ and all-store scope", HQ_ALL_STORES],
    ] as const) {
      const prisma = fakePrisma({ rows: [row()] });
      const result = await serviceWith(null, prisma).search(user, BASE_INPUT);
      assert.equal(result.items.length, 1, `${label} must be allowed`);
    }

    const refused: Array<[string, AuthUser | undefined]> = [
      ["ASSISTANT with HQ but no all-store scope", hqAssistantNoAllStores],
      ["ASSISTANT with all-store scope but no HQ workspace", allStoresNoHq],
      ["VIEWER with HQ and all-store attributes", viewerWithHqAttributes],
      ["VIEWER store-scoped", STORE_VIEWER],
      ["ASSISTANT store-scoped without HQ", storeAssistant],
      ["inactive ADMIN", { ...ADMIN, isActive: false }],
      ["suspended ADMIN", { ...ADMIN, status: "SUSPENDED" }],
      ["pending-approval ADMIN", { ...ADMIN, status: "PENDING_APPROVAL" }],
      ["no authenticated user", undefined],
    ];
    for (const [label, user] of refused) {
      const prisma = fakePrisma({ rows: [row()] });
      const error = await rejectionOf(serviceWith(null, prisma).search(user, BASE_INPUT));
      assert.ok(error instanceof ForbiddenException, `${label} must be refused`);
      assert.equal(codeOf(error), "CHAT_SEARCH_HQ_REQUIRED", label);
      assert.equal(prisma.statements.length, 0, `${label} must not reach the database`);
    }
  });
});

void test("an HQ account acting as one store cannot widen its scope with an explicit other-store selection", async () => {
  await withFlag("true", async () => {
    const storeContextAdmin = { ...ADMIN, storeContext: { mode: "STORE", storeId: "store-a", storeName: "Store A", storeCode: null } } as unknown as AuthUser;
    const prisma = fakePrisma({ rows: [row()] });
    const error = await rejectionOf(serviceWith(["store-a"], prisma).search(storeContextAdmin, { ...BASE_INPUT, storeIds: ["store-b"] }));
    assert.ok(error instanceof ForbiddenException);
    assert.equal(codeOf(error), "CHAT_SEARCH_STORE_FORBIDDEN");
    assert.equal(prisma.statements.length, 0);
    const scoped = await serviceWith(["store-a"], fakePrisma({ rows: [row()] })).search(storeContextAdmin, BASE_INPUT);
    assert.deepEqual(scoped.scope.stores, { mode: "ALL_AUTHORIZED" });
  });
});
