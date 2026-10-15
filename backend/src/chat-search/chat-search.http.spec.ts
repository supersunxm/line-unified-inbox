import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { PrismaService } from "../prisma.service";
import { MobileApiExceptionFilter } from "../mobile/mobile-api-exception.filter";
import { ChatMessageSearchQueryDto } from "./chat-message-search.dto";
import { ChatSearchController } from "./chat-search.controller";
import { ChatSearchService } from "./chat-search.service";

/**
 * HTTP-level checks for the route, the global ValidationPipe options from main.ts, and the
 * feature flag. Uses a fake database and synthetic data; no connection is made.
 *
 * tsx (esbuild) does not emit decorator metadata, which Nest needs for constructor injection and
 * for DTO validation. The production build (tsc) emits it. These declarations reproduce what tsc
 * would emit for exactly these classes, and only inside this test file.
 */
Reflect.defineMetadata("design:paramtypes", [ChatSearchService], ChatSearchController);
Reflect.defineMetadata("design:paramtypes", [ChatMessageSearchQueryDto, Object], ChatSearchController.prototype, "messages");
Reflect.defineMetadata("design:paramtypes", [PrismaService, StoreAccessService], ChatSearchService);
const ADMIN = { id: "admin-http", role: "ADMIN" } as unknown as AuthUser;
const VIEWER = { id: "viewer-http", role: "VIEWER", authorization: { workspaces: { hq: false }, scope: { allStores: false } } } as unknown as AuthUser;

const SAMPLE_ROW = {
  messageId: "msg-http",
  conversationId: "conv-http",
  storeId: "store-a",
  storeName: "Store A",
  customerDisplayName: "Somchai",
  direction: "INBOUND",
  sentAt: new Date("2026-09-10T03:00:00.000Z"),
  originalText: "สวัสดีครับ",
};

async function boot(user: AuthUser | undefined, flag: string | undefined, options: { searchError?: Error } = {}) {
  const previous = process.env.CHAT_MESSAGE_SEARCH_ENABLED;
  if (flag === undefined) delete process.env.CHAT_MESSAGE_SEARCH_ENABLED;
  else process.env.CHAT_MESSAGE_SEARCH_ENABLED = flag;
  const statements: string[] = [];
  const tx = {
    $executeRaw: async (query: { sql: string }) => {
      statements.push(query.sql);
      return 0;
    },
    $queryRaw: async (query: { sql: string }) => {
      statements.push(query.sql);
      if (query.sql.includes("set_config")) return [];
      if (options.searchError) throw options.searchError;
      return [SAMPLE_ROW];
    },
  };
  const prisma = { $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx) };
  const moduleRef = await Test.createTestingModule({
    controllers: [ChatSearchController],
    providers: [
      ChatSearchService,
      { provide: PrismaService, useValue: prisma },
      { provide: StoreAccessService, useValue: { accessibleStoreIds: async () => null } },
    ],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new MobileApiExceptionFilter());
  app.use((request: { user?: AuthUser }, _response: unknown, next: () => void) => {
    if (user) request.user = user;
    next();
  });
  await app.init();
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as { port: number };
  const close = async () => {
    await app.close();
    if (previous === undefined) delete process.env.CHAT_MESSAGE_SEARCH_ENABLED;
    else process.env.CHAT_MESSAGE_SEARCH_ENABLED = previous;
  };
  return { url: `http://127.0.0.1:${address.port}/chat-search/messages`, statements, close };
}

async function get(url: string, query: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${url}?${query}`);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const VALID = "q=%E0%B8%AA%E0%B8%A7%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B5&startDate=2026-09-01&endDate=2026-09-30";

void test("the route is absent-looking (404) while the feature flag is off, and no query runs", async () => {
  const server = await boot(ADMIN, undefined);
  try {
    const result = await get(server.url, VALID);
    assert.equal(result.status, 404);
    assert.equal(server.statements.length, 0);
  } finally {
    await server.close();
  }
});

void test("an HQ request with the flag on returns a bounded page with only the interface fields", async () => {
  const server = await boot(ADMIN, "true");
  try {
    const result = await get(server.url, `${VALID}&limit=2`);
    assert.equal(result.status, 200);
    const items = result.body.items as Array<Record<string, unknown>>;
    assert.equal(items.length, 1);
    assert.deepEqual(Object.keys(items[0]).sort(), [
      "conversationId", "customerDisplayName", "direction", "messageId", "sentAt", "snippet", "source", "storeId", "storeName",
    ]);
    assert.equal(JSON.stringify(result.body).includes("originalText"), false);
    assert.equal(result.body.hasMore, false);
    assert.equal(server.statements[0], "SET TRANSACTION READ ONLY");
  } finally {
    await server.close();
  }
});

void test("repeated and single storeIds parameters both reach the service as a store list", async () => {
  const server = await boot(ADMIN, "true");
  try {
    const repeated = await get(server.url, `${VALID}&storeIds=store-a&storeIds=store-b`);
    assert.equal(repeated.status, 200);
    assert.deepEqual((repeated.body.scope as { stores: unknown }).stores, { mode: "SELECTED", storeIds: ["store-a", "store-b"] });
    const single = await get(server.url, `${VALID}&storeIds=store-a`);
    assert.deepEqual((single.body.scope as { stores: unknown }).stores, { mode: "SELECTED", storeIds: ["store-a"] });
  } finally {
    await server.close();
  }
});

void test("invalid or unknown parameters are rejected by validation with a 400", async () => {
  const server = await boot(ADMIN, "true");
  try {
    assert.equal((await get(server.url, `${VALID}&limit=51`)).status, 400, "limit above the maximum");
    assert.equal((await get(server.url, `${VALID}&limit=abc`)).status, 400, "non-numeric limit");
    assert.equal((await get(server.url, `${VALID}&unexpected=1`)).status, 400, "unknown parameter");
    assert.equal((await get(server.url, "q=a&startDate=2026-09-01")).status, 400, "missing end date");
    const shortKeyword = await get(server.url, "q=a&startDate=2026-09-01&endDate=2026-09-30");
    assert.equal(shortKeyword.status, 400);
    assert.equal((shortKeyword.body as { code?: string }).code, "CHAT_SEARCH_INVALID_KEYWORD");
    const tooLong = await get(server.url, "q=xx&startDate=2026-01-01&endDate=2026-06-30");
    assert.equal((tooLong.body as { code?: string }).code, "CHAT_SEARCH_RANGE_TOO_LARGE");
    assert.equal(server.statements.length, 0, "no rejected request reaches the database");
  } finally {
    await server.close();
  }
});

void test("a non-HQ account is refused with 403 and no query runs", async () => {
  const server = await boot(VIEWER, "true");
  try {
    const result = await get(server.url, VALID);
    assert.equal(result.status, 403);
    assert.equal((result.body as { code?: string }).code, "CHAT_SEARCH_HQ_REQUIRED");
    assert.equal(server.statements.length, 0);
  } finally {
    await server.close();
  }
});

void test("the conversation list's month and date-range parameters are not accepted, keeping this search independent of chatMonth", async () => {
  const server = await boot(ADMIN, "true");
  try {
    assert.equal((await get(server.url, `${VALID}&month=2026-09`)).status, 400, "month filter is not part of this contract");
    assert.equal((await get(server.url, `${VALID}&month=all`)).status, 400);
    assert.equal((await get(server.url, `${VALID}&from=2026-09-01&to=2026-09-30`)).status, 400, "conversation-list date params are not accepted");
    assert.equal(server.statements.length, 0);
  } finally {
    await server.close();
  }
});

void test("an unexpected database failure returns a generic 500 and never exposes SQL or driver text", async () => {
  const server = await boot(ADMIN, "true", {
    searchError: new Error('Raw query failed: SELECT m."originalText" FROM "Message" m WHERE secret_column = 42'),
  });
  try {
    const response = await fetch(`${server.url}?${VALID}`);
    const text = await response.text();
    assert.equal(response.status, 500);
    assert.doesNotMatch(text, /Message|secret_column|Raw query|SELECT/u);
    assert.match(text, /Internal server error/u);
  } finally {
    await server.close();
  }
});

void test("a statement timeout is returned as a 503 with a stable code, not as a 500", async () => {
  const server = await boot(ADMIN, "true", {
    searchError: new Error("Raw query failed. canceling statement due to statement timeout"),
  });
  try {
    const result = await get(server.url, VALID);
    assert.equal(result.status, 503);
    assert.equal((result.body as { code?: string }).code, "CHAT_SEARCH_TIMEOUT");
  } finally {
    await server.close();
  }
});
