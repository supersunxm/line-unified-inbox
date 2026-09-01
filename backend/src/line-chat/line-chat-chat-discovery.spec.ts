import assert from "node:assert/strict";
import test from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { APIResponse, BrowserContext } from "playwright";
import { LineChatSessionService, type ContextLauncher } from "./line-chat-session.service";
import { parseLineChatListResponse } from "./line-chat-chat-discovery";
import {
  sanitizeDiagnosticUrl,
  summarizeChatListContractJson,
  summarizeDiagnosticJson,
} from "./line-chat-diagnostic-metadata";

test("chat-list adapter preserves only sanitized known fields for a supported shape", () => {
  const result = parseLineChatListResponse({ data: [{
    userId: "Ud1234567890abcdef",
    displayName: "Somchai",
    lastMessage: { text: "Hello", sentAt: "2026-08-31T05:00:00.000Z", direction: "INBOUND" },
    cookie: "must-not-be-retained",
  }] }, {
    botId: "Ubot",
    endpoint: "https://chat.line.biz/api/v1/bots/Ubot/chats",
  });
  assert.equal(result.responseShape, "data");
  assert.deepEqual(result.chats, [{
    chatUserId: "Ud1234567890abcdef",
    displayName: "Somchai",
    lastMessageText: "Hello",
    lastMessageAt: "2026-08-31T05:00:00.000Z",
    lastMessageDirection: "INBOUND",
  }]);
  assert.doesNotMatch(JSON.stringify(result), /cookie/i);
  assert.equal(result.enumerationStatus, "UNVERIFIED");
});

test("chat-list adapter supports a direct array shape", () => {
  const result = parseLineChatListResponse([{ id: "Ud1234567890abcdef", name: "Somchai" }], {
    botId: "Ubot",
    endpoint: "https://chat.line.biz/api/v1/bots/Ubot/chats",
  });
  assert.equal(result.responseShape, "array");
  assert.equal(result.chats[0]?.chatUserId, "Ud1234567890abcdef");
});

test("chat-list adapter supports an alternate items shape and distinguishes an empty list", () => {
  const result = parseLineChatListResponse({ items: [] }, {
    botId: "Ubot",
    endpoint: "https://chat.line.biz/api/v1/bots/Ubot/chats",
  });
  assert.equal(result.responseShape, "items");
  assert.deepEqual(result.chats, []);
  assert.equal(result.enumerationStatus, "UNVERIFIED");
});

test("chat-list adapter normalizes epoch seconds and milliseconds deterministically", () => {
  const seconds = parseLineChatListResponse({ chats: [{ userId: "Ud1234567890abcdef", lastMessageAt: 1788152400 }] }, {
    botId: "Ubot",
    endpoint: "https://chat.line.biz/api/v1/bots/Ubot/chats",
  });
  const milliseconds = parseLineChatListResponse({ chats: [{ userId: "Ud1234567890abcdef", lastMessageAt: "1788152400000" }] }, {
    botId: "Ubot",
    endpoint: "https://chat.line.biz/api/v1/bots/Ubot/chats",
  });
  assert.equal(seconds.chats[0]?.lastMessageAt, "2026-08-31T05:00:00.000Z");
  assert.equal(milliseconds.chats[0]?.lastMessageAt, seconds.chats[0]?.lastMessageAt);
});

test("malformed and unknown top-level payloads fail closed", () => {
  assert.throws(
    () => parseLineChatListResponse(null, { botId: "Ubot", endpoint: "https://chat.line.biz/api/v1/bots/Ubot/chats" }),
    /Unsupported.*response shape/,
  );
  assert.throws(
    () => parseLineChatListResponse({ page: 1, results: [] }, { botId: "Ubot", endpoint: "https://chat.line.biz/api/v1/bots/Ubot/chats" }),
    /did not contain a supported chat array/,
  );
});

test("entries without usable IDs and invalid IDs are skipped safely", () => {
  const result = parseLineChatListResponse({ chats: [
    { displayName: "No ID" },
    { userId: "U1234567890abcdef", displayName: "Messaging API" },
    { userId: "Ud1234567890abcdef", displayName: "Valid" },
  ] }, { botId: "Ubot", endpoint: "https://chat.line.biz/api/v1/bots/Ubot/chats" });
  assert.deepEqual(result.chats.map((chat) => chat.chatUserId), ["Ud1234567890abcdef"]);
});

function mockResponse(status: number, body: unknown, jsonError?: Error): APIResponse {
  return {
    status: () => status,
    json: async () => {
      if (jsonError) throw jsonError;
      return body;
    },
  } as unknown as APIResponse;
}

function mockRequestContext(response: APIResponse | Error) {
  const calls: Array<{ url: string; options: Record<string, unknown> }> = [];
  let closed = false;
  const context = {
    request: {
      get: async (url: string, options: Record<string, unknown>) => {
        calls.push({ url, options });
        if (response instanceof Error) throw response;
        return response;
      },
      post: async () => { throw new Error("POST must not be called"); },
      put: async () => { throw new Error("PUT must not be called"); },
      patch: async () => { throw new Error("PATCH must not be called"); },
      delete: async () => { throw new Error("DELETE must not be called"); },
    },
    pages: () => { throw new Error("page navigation must not be used for discovery"); },
    newPage: async () => { throw new Error("individual chat pages must not be opened"); },
    close: async () => { closed = true; },
  } as unknown as BrowserContext;
  return { context, calls, wasClosed: () => closed };
}

async function discoverWithResponse(response: APIResponse | Error) {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-discovery-"));
  const mock = mockRequestContext(response);
  const launcher: ContextLauncher = async () => mock.context;
  try {
    const service = new LineChatSessionService(launcher);
    const result = await service.discoverChats({ botId: "Ubot", profilePath, customLauncher: launcher });
    return { result, mock };
  } finally {
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
}

test("session discovery uses the authenticated BrowserContext request GET", async () => {
  const { result, mock } = await discoverWithResponse(mockResponse(200, {
    chats: [{ userId: "Ud1234567890abcdef", displayName: "Somchai" }],
  }));
  assert.equal(result.endpoint, "https://chat.line.biz/api/v1/bots/Ubot/chats");
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0]?.url, result.endpoint);
  assert.deepEqual(mock.calls[0]?.options, {
    headers: { Accept: "application/json, text/plain, */*" },
    timeout: 15000,
  });
  assert.equal(result.chats[0]?.chatUserId, "Ud1234567890abcdef");
  assert.equal(result.enumerationStatus, "UNVERIFIED");
  assert.equal(mock.wasClosed(), true);
});

test("session discovery performs no page navigation, individual chat opening, or non-GET request", async () => {
  const { mock } = await discoverWithResponse(mockResponse(200, { chats: [] }));
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.wasClosed(), true);
});

test("session discovery reports safe HTTP status failures", async (t) => {
  for (const status of [401, 403, 404, 500]) {
    await t.test(`HTTP ${status}`, async () => {
      await assert.rejects(
        () => discoverWithResponse(mockResponse(status, { secret: "must-not-surface" })),
        new RegExp(`LINE OA Manager chat-list returned HTTP ${status}`),
      );
    });
  }
});

test("session discovery distinguishes transport and non-JSON failures without surfacing secrets", async () => {
  await assert.rejects(
    () => discoverWithResponse(new Error("cookie=secret authorization=secret")),
    (error: unknown) => error instanceof Error
      && error.message === "LINE OA Manager chat-list transport failed"
      && !/cookie|authorization|secret/i.test(error.message),
  );
  await assert.rejects(
    () => discoverWithResponse(mockResponse(200, "not-json", new Error("raw response secret"))),
    (error: unknown) => error instanceof Error
      && error.message === "LINE OA Manager chat-list response was not JSON"
      && !/secret/i.test(error.message),
  );
});

test("session discovery preserves fail-closed errors for unsupported JSON shapes", async () => {
  await assert.rejects(
    () => discoverWithResponse(mockResponse(200, { unknown: [] })),
    /did not contain a supported chat array/,
  );
});

test("diagnostic URL metadata keeps pagination scalars and redacts cursor/token values", () => {
  const sanitized = sanitizeDiagnosticUrl(
    "https://chat.line.biz/api/v1/bots/Ubot/chats?limit=20&offset=40&page=2&size=50&cursor=secret&authToken=secret&name=customer"
  );
  assert.equal(sanitized.url, "https://chat.line.biz/api/v1/bots/Ubot/chats");
  assert.deepEqual(sanitized.query.parameterNames, ["limit", "offset", "page", "size", "cursor", "authToken", "name"]);
  assert.deepEqual(sanitized.query.safeScalars, { limit: "20", offset: "40", page: "2", size: "50" });
  assert.deepEqual(sanitized.query.redactedParameters, ["cursor=PRESENT_REDACTED", "authToken=PRESENT_REDACTED"]);
  assert.doesNotMatch(JSON.stringify(sanitized), /secret|customer/);
});

test("diagnostic URL metadata redacts customer identifiers in individual-chat paths", () => {
  const sanitized = sanitizeDiagnosticUrl("https://chat.line.biz/Ubot/chat/Ud-customer-id?token=secret");
  assert.equal(sanitized.url, "https://chat.line.biz/Ubot/chat/<customer-id-redacted>");
  assert.doesNotMatch(sanitized.url, /Ud-customer-id/);
});

test("diagnostic JSON schema summarizer emits structure only", () => {
  const summary = summarizeDiagnosticJson({
    items: [{ id: "Ud-customer-id", displayName: "Customer name", lastMessage: { text: "Private text" } }],
    nextCursor: "secret-next-cursor",
    total: 1,
  });
  assert.equal(summary.parseStatus, "JSON");
  assert.equal(summary.topLevelType, "object");
  assert.deepEqual(summary.topLevelKeyNames, ["items", "nextCursor", "total"]);
  assert.deepEqual(summary.arrayLengths, [{ path: "$.items", length: 1 }]);
  assert.ok(summary.nestedKeyNames.includes("displayName"));
  assert.ok(summary.paginationKeyNames.includes("nextCursor"));
  assert.ok(summary.candidateFieldNames.includes("id"));
  assert.doesNotMatch(JSON.stringify(summary), /Ud-customer-id|Customer name|Private text|secret-next-cursor/);
});

test("chat-list contract summarizes list identifier shapes without values", () => {
  const summary = summarizeChatListContractJson({
    list: [
      { chatId: "Ud1234567890abcdef", userId: "Udabcdef1234567890", name: "Customer One" },
      { chatId: "not-an-ud-id", userId: null, nickname: "Private nickname" },
      { chatId: null, userId: "Udqwerty12345678", latestEvent: { message: "Private text" } },
      { name: "Missing identifiers" },
    ],
    next: "opaque-next-token-value",
  });

  assert.ok(summary);
  assert.equal(summary.identifierShape.listCount, 4);
  assert.deepEqual(summary.identifierShape.chatId, {
    stringCount: 2,
    matchesUdPattern: 1,
    otherStringCount: 1,
    nullOrMissing: 2,
  });
  assert.deepEqual(summary.identifierShape.userId, {
    stringCount: 2,
    matchesUdPattern: 2,
    otherStringCount: 0,
    nullOrMissing: 2,
  });
  assert.deepEqual(summary.identifierShape.presenceCounts, {
    bothPresent: 1,
    chatIdOnly: 1,
    userIdOnly: 1,
    neither: 1,
  });
  assert.equal(summary.pagination.nextPresent, "YES");
  assert.equal(summary.pagination.nextType, "string");
  assert.equal(summary.pagination.nextStringClassification, "OPAQUE_TOKEN");
  assert.equal(summary.pagination.nextLengthBucket, "1-32");
  assert.doesNotMatch(JSON.stringify(summary), /Ud1234567890abcdef|Customer One|Private nickname|Private text|opaque-next-token-value/);
});

test("chat-list contract classifies URL, empty, null, and object next metadata safely", () => {
  const urlNext = summarizeChatListContractJson({ list: [], next: "https://chat.line.biz/api/next?cursor=secret" });
  assert.equal(urlNext?.pagination.nextStringClassification, "URL");
  assert.equal(urlNext?.pagination.nextLengthBucket, "33-128");
  assert.doesNotMatch(JSON.stringify(urlNext), /secret/);

  const emptyNext = summarizeChatListContractJson({ list: [], next: "" });
  assert.equal(emptyNext?.pagination.nextStringClassification, "EMPTY");
  assert.equal(emptyNext?.pagination.nextLengthBucket, "0");

  const nullNext = summarizeChatListContractJson({ list: [], next: null });
  assert.equal(nullNext?.pagination.nextType, "null");
  assert.equal(nullNext?.pagination.nextStringClassification, "NOT_APPLICABLE");
  assert.equal(nullNext?.pagination.nextLengthBucket, "NOT_APPLICABLE");

  const objectNext = summarizeChatListContractJson({ list: [], next: { cursor: "secret", hasMore: true } });
  assert.equal(objectNext?.pagination.nextType, "object");
  assert.deepEqual(objectNext?.pagination.nextObjectKeys, ["cursor", "hasMore"]);
  assert.doesNotMatch(JSON.stringify(objectNext), /secret/);
});
