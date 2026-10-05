import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { LineChatMirrorService } from "./line-chat-mirror.service";
import { fetchCachedMirrorDirectUrl, validateMirrorDirectUrl } from "./mirror-direct-url";
import { handleMirrorDirectUrlRoute } from "./mirror-direct-url-route";

const chat = `U${"a".repeat(32)}`;
const bot = `U${"b".repeat(32)}`;
const identity = { storeId: "store", lineOfficialAccountId: "oa", lineChatUserId: chat };
const target = { ...identity, conversationId: "conversation", botId: bot, url: `https://chat.line.biz/${bot}/chat/${chat}` };
test("cached URL response requires exact OA, Store, destination, chat, bot and URL", () => {
  assert.equal(validateMirrorDirectUrl({ success: true, target }, "conversation", identity), target.url);
  for (const [field, value] of Object.entries({ storeId: "other", lineOfficialAccountId: "other", conversationId: "other", lineChatUserId: `U${"c".repeat(32)}`, botId: "bad", url: "https://evil.example/" })) {
    assert.equal(validateMirrorDirectUrl({ success: true, target: { ...target, [field]: value } }, "conversation", identity), null);
  }
  assert.equal(validateMirrorDirectUrl({ success: true, target: null }, "conversation", identity), null);
  assert.equal(validateMirrorDirectUrl({ success: false, target }, "conversation", identity), null);
});

test("protected cache endpoint serves real HTTP GET, rejects unauthorized/POST/invalid ID and preserves cache miss", async () => {
  const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const reply = { ...target, conversationId: id };
  let calls = 0;
  let available = true;
  const service = { getCachedConversationDirectUrl: async () => { calls++; return available ? reply : null; } };
  const server = createServer((request, response) => {
    void (async () => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const result = await handleMirrorDirectUrlRoute({ pathname: url.pathname, method: request.method,
      conversationId: url.searchParams.get("conversationId"), receivedSecret: request.headers["x-line-chat-internal-secret"],
      expectedSecret: "synthetic", service });
    response.writeHead(result?.statusCode ?? 404, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result?.body ?? {}));
    })().catch(() => { response.writeHead(500); response.end(); });
  });
  const oldUrl = process.env.LINE_CHAT_WORKER_INTERNAL_URL;
  const oldSecret = process.env.LINE_CHAT_WORKER_INTERNAL_SECRET;
  try {
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const path = `${base}/internal/line-chat/mirror/direct-url?conversationId=${id}`;
    assert.equal((await fetch(path)).status, 401);
    const headers = { "x-line-chat-internal-secret": "synthetic" };
    assert.equal((await fetch(path, { method: "POST", headers })).status, 405);
    assert.equal((await fetch(`${base}/internal/line-chat/mirror/direct-url?conversationId=bad`, { headers })).status, 400);
    assert.equal(calls, 0);
    process.env.LINE_CHAT_WORKER_INTERNAL_URL = base;
    process.env.LINE_CHAT_WORKER_INTERNAL_SECRET = "synthetic";
    assert.equal(await fetchCachedMirrorDirectUrl(id, identity), target.url);
    available = false;
    assert.equal(await fetchCachedMirrorDirectUrl(id, identity), null);
    assert.equal(calls, 2);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (oldUrl === undefined) delete process.env.LINE_CHAT_WORKER_INTERNAL_URL; else process.env.LINE_CHAT_WORKER_INTERNAL_URL = oldUrl;
    if (oldSecret === undefined) delete process.env.LINE_CHAT_WORKER_INTERNAL_SECRET; else process.env.LINE_CHAT_WORKER_INTERNAL_SECRET = oldSecret;
  }
});

test("Mirror lookup never opens a browser and holds drift, stale health, duplicate identity and inactive sessions", async () => {
  const previous = process.env.LINE_CHAT_MIRROR_STORE_CODES;
  const previousOverride = process.env.LINE_CHAT_MIRROR_MANAGER_ACCOUNT_OVERRIDES;
  process.env.LINE_CHAT_MIRROR_STORE_CODES = "TEST";
  delete process.env.LINE_CHAT_MIRROR_MANAGER_ACCOUNT_OVERRIDES;
  const session = { id: "session", sessionKey: "account-1", status: "ACTIVE", profilePath: "/private/profile", profileStorageKey: "key" };
  const oa = { id: "oa", chatBotId: null, basicId: "@oa", lineChatWorkspaceUrl: null, lineChatSession: null };
  const inputs = { storeId: "store", effectiveStoreCode: "TEST", storeManagerUrl: "https://chat.line.biz/account/@oa", oa };
  const signature = JSON.stringify(["oa", null, "@oa", null, inputs.storeManagerUrl, null, null]);
  const cache = new Map([["oa", { botId: bot, session, source: "MANAGER_ACCOUNT_REDIRECT", directLinkInputSignature: signature }]]);
  const state = { enabled: true, storeId: "store", status: "SUCCESS", lastErrorCode: null as string | null, lastSuccessfulSyncAt: new Date() };
  let owners = 1;
  const prisma = {
    conversation: { findUnique: async () => ({ id: "conversation", ...identity, store: { code: "TEST" } }), count: async () => owners },
    lineChatMirrorStoreState: { findUnique: async () => state },
    lineChatSession: { findUnique: async () => session },
  };
  const service = Object.create(LineChatMirrorService.prototype) as LineChatMirrorService;
  Object.assign(service, { prisma, targetCache: cache, getStoreMirrorTargetInputs: async () => inputs,
    resolveMirrorTarget: async () => { throw new Error("LOOKUP_MUST_NEVER_OPEN_BROWSER"); } });
  try {
    assert.deepEqual(await service.getCachedConversationDirectUrl("conversation"), target);
    owners = 2;
    assert.equal(await service.getCachedConversationDirectUrl("conversation"), null);
    owners = 1;
    state.lastSuccessfulSyncAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    assert.equal(await service.getCachedConversationDirectUrl("conversation"), null);
    state.lastSuccessfulSyncAt = new Date();
    state.lastErrorCode = "PROFILE_OPERATION_BUSY";
    assert.equal(await service.getCachedConversationDirectUrl("conversation"), null);
    state.lastErrorCode = null;
    session.status = "INACTIVE";
    assert.equal(await service.getCachedConversationDirectUrl("conversation"), null);
    session.status = "ACTIVE";
    inputs.storeId = "other";
    assert.equal(await service.getCachedConversationDirectUrl("conversation"), null);
    inputs.storeId = "store";
    oa.basicId = "@changed";
    assert.equal(await service.getCachedConversationDirectUrl("conversation"), null);
    oa.basicId = "@oa";
    cache.clear();
    assert.equal(await service.getCachedConversationDirectUrl("conversation"), null);
  } finally {
    if (previous === undefined) delete process.env.LINE_CHAT_MIRROR_STORE_CODES; else process.env.LINE_CHAT_MIRROR_STORE_CODES = previous;
    if (previousOverride === undefined) delete process.env.LINE_CHAT_MIRROR_MANAGER_ACCOUNT_OVERRIDES; else process.env.LINE_CHAT_MIRROR_MANAGER_ACCOUNT_OVERRIDES = previousOverride;
  }
});
