import assert from "node:assert/strict";
import test from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { BrowserContext } from "playwright";
import { LineChatSessionService, type ContextLauncher } from "./line-chat-session.service";
import { isLineChatUserId, parseLineChatListResponse } from "./line-chat-chat-discovery";
import {
  sanitizeDiagnosticUrl,
  summarizeChatListContractJson,
  summarizeDiagnosticJson,
} from "./line-chat-diagnostic-metadata";

const VALID_USER_ID = `U${"1a".repeat(16)}`;
const VALID_USER_ID_2 = `Ud${"2b".repeat(15)}c`;

test("LINE USER ID validation follows the official U plus 32 hex contract", () => {
  assert.equal(isLineChatUserId(`U${"a".repeat(32)}`), true);
  assert.equal(isLineChatUserId(`U${"ABCDEF01".repeat(4)}`), true);
  assert.equal(isLineChatUserId(VALID_USER_ID_2), true);
  assert.equal(isLineChatUserId(`U${"g".repeat(32)}`), false);
  assert.equal(isLineChatUserId(`U${"a".repeat(31)}`), false);
  assert.equal(isLineChatUserId(`U${"a".repeat(33)}`), false);
  assert.equal(isLineChatUserId(`C${"a".repeat(32)}`), false);
  assert.equal(isLineChatUserId(`R${"a".repeat(32)}`), false);
});

test("verified v2 list envelope uses chatId as the authoritative USER ID", () => {
  const result = parseLineChatListResponse({ list: [
    { chatId: VALID_USER_ID, userId: `U${"f".repeat(32)}`, chatType: "USER", name: "Somchai", latestEvent: { timestamp: 1788152400 } },
    { chatId: `U${"g".repeat(32)}`, userId: VALID_USER_ID_2, chatType: "USER", name: "Invalid" },
    { chatId: VALID_USER_ID_2, userId: null, chatType: "GROUP", name: "Ignored" },
  ], next: "opaque-next-value" }, {
    botId: "Ubot",
    endpoint: "https://chat.line.biz/api/v2/bots/Ubot/chats",
  });
  assert.equal(result.responseShape, "list");
  assert.deepEqual(result.chats, [{
    chatUserId: VALID_USER_ID,
    displayName: "Somchai",
    lastMessageText: null,
    lastMessageAt: "2026-08-31T05:00:00.000Z",
    lastMessageDirection: null,
  }]);
  assert.equal(result.validUserChats, 1);
  assert.equal(result.invalidUserRecords, 1);
  assert.equal(result.ignoredNonUserRecords, 1);
  assert.equal(result.nextTerminationObserved, false);
  assert.equal(result.enumerationError, "Invalid USER chat record encountered.");
});

test("v2 parser normalizes latestEvent.timestamp seconds and milliseconds only", () => {
  const result = parseLineChatListResponse({ list: [
    { chatId: VALID_USER_ID, chatType: "USER", latestEvent: { timestamp: 1788152400 } },
    { chatId: VALID_USER_ID_2, chatType: "USER", latestEvent: { timestamp: "1788152400000" } },
    { chatId: `U${"3c".repeat(16)}`, chatType: "USER", latestEvent: { timestamp: "not-a-date" } },
  ], next: null }, {
    botId: "Ubot",
    endpoint: "https://chat.line.biz/api/v2/bots/Ubot/chats",
  });
  assert.equal(result.chats[0]?.lastMessageAt, "2026-08-31T05:00:00.000Z");
  assert.equal(result.chats[1]?.lastMessageAt, result.chats[0]?.lastMessageAt);
  assert.equal(result.chats[2]?.lastMessageAt, null);
  assert.equal(result.enumerationStatus, "COMPLETE");
});

test("v2 parser fails closed on malformed envelope or next", () => {
  assert.throws(
    () => parseLineChatListResponse(null, { botId: "Ubot", endpoint: "https://chat.line.biz/api/v2/bots/Ubot/chats" }),
    /must contain a list array/,
  );
  assert.throws(
    () => parseLineChatListResponse({ list: [], next: { cursor: "secret" } }, { botId: "Ubot", endpoint: "https://chat.line.biz/api/v2/bots/Ubot/chats" }),
    /malformed next/,
  );
});

test("v2 parser ignores non-USER entries and counts invalid USER records", () => {
  const result = parseLineChatListResponse({ list: [
    { chatId: VALID_USER_ID, chatType: "USER" },
    { chatId: VALID_USER_ID_2, chatType: "ROOM" },
    { chatType: "USER" },
    { chatId: `C${"a".repeat(32)}`, chatType: "USER" },
  ], next: null }, { botId: "Ubot", endpoint: "https://chat.line.biz/api/v2/bots/Ubot/chats" });
  assert.equal(result.validUserChats, 1);
  assert.equal(result.ignoredNonUserRecords, 1);
  assert.equal(result.invalidUserRecords, 2);
  assert.equal(result.enumerationStatus, "PARTIAL");
});

interface MockPageOptions {
  firstRequestUrl?: string;
  navigationError?: Error;
}

interface MockPageDefinition {
  status?: number;
  body?: unknown;
  jsonError?: Error;
  transportError?: Error;
}

function mockNaturalDiscoveryContext(
  pageDefinitions: readonly MockPageDefinition[],
  options: MockPageOptions = {},
) {
  const firstRequestUrl = options.firstRequestUrl
    ?? "https://chat.line.biz/api/v2/bots/Ubot/chats?folderType=ALL&tagIds=&autoTagIds=&limit=25&prioritizePinnedChat=true";
  const calls: Array<{ url: string; options: Record<string, unknown> }> = [];
  const gotoUrls: string[] = [];
  const listeners: { request: Array<(request: unknown) => void>; response: Array<(response: unknown) => void> } = {
    request: [],
    response: [],
  };
  let closed = false;
  const responseFor = (definition: MockPageDefinition, url: string) => ({
    status: () => definition.status ?? 200,
    url: () => url,
    request: () => ({ method: () => "GET", url: () => url }),
    json: async () => {
      if (definition.jsonError) throw definition.jsonError;
      return definition.body;
    },
  });
  const page = {
    on: (event: "request" | "response", listener: (value: unknown) => void) => {
      listeners[event].push(listener);
      return page;
    },
    goto: async (url: string) => {
      gotoUrls.push(url);
      const request = {
        method: () => "GET",
        url: () => firstRequestUrl,
        headers: () => ({
          accept: "application/json, text/plain, */*",
          "x-xsrf-token": "PRESENT",
          "x-oa-chat-client-version": "PRESENT",
          referer: `https://chat.line.biz/Ubot`,
          origin: "https://chat.line.biz",
        }),
      };
      for (const listener of listeners.request) listener(request);
      const first = pageDefinitions[0] ?? { status: 200, body: { list: [], next: null } };
      if (first.transportError) throw first.transportError;
      const response = responseFor(first, firstRequestUrl);
      for (const listener of listeners.response) listener(response);
      if (options.navigationError) throw options.navigationError;
      return null;
    },
    isClosed: () => false,
  };
  const context = {
    request: {
      get: async (url: string, requestOptions: Record<string, unknown>) => {
        calls.push({ url, options: requestOptions });
        const definition = pageDefinitions[calls.length] ?? { status: 200, body: { list: [], next: null } };
        if (definition.transportError) throw definition.transportError;
        return responseFor(definition, url);
      },
      post: async () => { throw new Error("POST must not be called"); },
      put: async () => { throw new Error("PUT must not be called"); },
      patch: async () => { throw new Error("PATCH must not be called"); },
      delete: async () => { throw new Error("DELETE must not be called"); },
    },
    pages: () => [page],
    newPage: async () => page,
    close: async () => { closed = true; },
  } as unknown as BrowserContext;
  return { context, calls, gotoUrls, wasClosed: () => closed };
}

function validPage(chatUserId: string, next: string | null = null): MockPageDefinition {
  return { body: { list: [{ chatId: chatUserId, chatType: "USER", name: "Sanitized" }], next } };
}

async function discoverWithPages(pageDefinitions: readonly MockPageDefinition[], options: MockPageOptions = {}) {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-discovery-"));
  const mock = mockNaturalDiscoveryContext(pageDefinitions, options);
  const launcher: ContextLauncher = async () => mock.context;
  try {
    const service = new LineChatSessionService(launcher);
    const result = await service.discoverChats({ botId: "Ubot", profilePath, customLauncher: launcher });
    return { result, mock };
  } finally {
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
}

test("session discovery captures the natural v2 GET and enumerates subsequent pages", async () => {
  const secondId = `U${"2b".repeat(16)}`;
  const { result, mock } = await discoverWithPages([
    validPage(VALID_USER_ID, "opaque-next-value"),
    validPage(secondId, null),
  ]);
  assert.equal(result.endpoint, "https://chat.line.biz/api/v2/bots/Ubot/chats");
  assert.deepEqual(mock.gotoUrls, ["https://chat.line.biz/Ubot"]);
  assert.equal(mock.calls.length, 1);
  const nextUrl = new URL(mock.calls[0].url);
  assert.equal(nextUrl.pathname, "/api/v2/bots/Ubot/chats");
  assert.equal(nextUrl.searchParams.get("limit"), "25");
  assert.deepEqual(nextUrl.searchParams.getAll("folderType"), ["ALL"]);
  assert.equal(nextUrl.searchParams.get("next"), "opaque-next-value");
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.validUserChats, 2);
  assert.equal(result.enumerationStatus, "COMPLETE");
  assert.deepEqual(result.chats.map((chat) => chat.chatUserId), [VALID_USER_ID, secondId]);
  assert.equal(mock.wasClosed(), true);
});

test("recent discovery stops at five pages without turning into historical enumeration", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-recent-discovery-"));
  const definitions = Array.from({ length: 6 }, (_, index) => validPage(
    `U${index.toString(16).repeat(32)}`,
    `opaque-next-${index}`,
  ));
  const mock = mockNaturalDiscoveryContext(definitions);
  const launcher: ContextLauncher = async () => mock.context;
  try {
    const service = new LineChatSessionService(launcher);
    const result = await service.discoverRecentChats({ botId: "Ubot", profilePath, customLauncher: launcher });
    assert.equal(result.status, "READY");
    assert.equal(result.pagesFetched, 5);
    assert.equal(mock.calls.length, 4);
    assert.equal(result.chats.length, 5);
  } finally {
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("discovery uses chatId only, ignores guessed v1 paths, and never opens a customer chat", async () => {
  const { result, mock } = await discoverWithPages([{ body: {
    list: [{ userId: VALID_USER_ID, chatType: "USER", name: "Wrong fallback" }],
    next: null,
  } }]);
  assert.equal(result.invalidUserRecords, 1);
  assert.equal(result.chats.length, 0);
  assert.equal(result.enumerationStatus, "PARTIAL");
  assert.equal(mock.gotoUrls[0], "https://chat.line.biz/Ubot");
  assert.equal(mock.calls.length, 0);
});

test("session discovery reports safe HTTP status, transport, JSON, and schema failures", async (t) => {
  for (const status of [401, 403, 404, 500]) {
    await t.test(`HTTP ${status}`, async () => {
      const { result } = await discoverWithPages([{ status, body: { secret: "must-not-surface" } }]);
      assert.equal(result.enumerationStatus, "PARTIAL");
      assert.match(result.enumerationError ?? "", new RegExp(`HTTP ${status}`));
      assert.doesNotMatch(result.enumerationError ?? "", /secret|cookie|authorization/i);
    });
  }
  const nonJson = await discoverWithPages([{ status: 200, body: null, jsonError: new Error("body secret") }]);
  assert.match(nonJson.result.enumerationError ?? "", /was not JSON/);
  const malformed = await discoverWithPages([{ status: 200, body: { unknown: [] } }]);
  assert.match(malformed.result.enumerationError ?? "", /unsupported or malformed envelope/);
});

test("pagination failure modes remain PARTIAL and do not expose opaque tokens", async () => {
  const repeated = await discoverWithPages([
    validPage(VALID_USER_ID, "same-next"),
    validPage(`U${"2b".repeat(16)}`, "same-next"),
  ]);
  assert.equal(repeated.result.enumerationStatus, "PARTIAL");
  assert.match(repeated.result.enumerationError ?? "", /Repeated/);
  assert.doesNotMatch(JSON.stringify(repeated.result), /same-next/);

  const failed = await discoverWithPages([
    validPage(VALID_USER_ID, "opaque-next"),
    { transportError: new Error("token=secret") },
  ]);
  assert.equal(failed.result.enumerationStatus, "PARTIAL");
  assert.match(failed.result.enumerationError ?? "", /transport failed/);
  assert.doesNotMatch(JSON.stringify(failed.result), /opaque-next|secret/);
});

test("duplicate candidates are deduplicated and conflicting metadata blocks completion", async () => {
  const same = validPage(VALID_USER_ID, "next");
  const duplicate = { body: { list: [{ chatId: VALID_USER_ID, chatType: "USER", name: "Different" }], next: null } };
  const { result } = await discoverWithPages([same, duplicate]);
  assert.equal(result.duplicateIds, 1);
  assert.equal(result.conflictingDuplicates, 1);
  assert.equal(result.enumerationStatus, "PARTIAL");
});

test("discovery fails closed at the bounded page and chat limits", async () => {
  const manyPages = Array.from({ length: 201 }, (_, index) => validPage(
    `U${index.toString(16).padStart(32, "0")}`,
    `next-${index}`,
  ));
  const pageBound = await discoverWithPages(manyPages);
  assert.equal(pageBound.result.enumerationStatus, "PARTIAL");
  assert.match(pageBound.result.enumerationError ?? "", /page limit/i);
  assert.equal(pageBound.result.pagesFetched, 200);

  const manyChats = Array.from({ length: 10001 }, (_, index) => ({
    chatId: `U${index.toString(16).padStart(32, "0")}`,
    chatType: "USER",
  }));
  const chatBound = await discoverWithPages([{ body: { list: manyChats, next: null } }]);
  assert.equal(chatBound.result.enumerationStatus, "PARTIAL");
  assert.match(chatBound.result.enumerationError ?? "", /discovered-chat limit/i);
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
      { chatId: VALID_USER_ID, userId: VALID_USER_ID_2, name: "Customer One" },
      { chatId: "not-a-user-id", userId: null, nickname: "Private nickname" },
      { chatId: null, userId: `U${"3c".repeat(16)}`, latestEvent: { message: "Private text" } },
      { name: "Missing identifiers" },
    ],
    next: "opaque-next-token-value",
  });

  assert.ok(summary);
  assert.equal(summary.identifierShape.listCount, 4);
  assert.deepEqual(summary.identifierShape.chatId, {
    stringCount: 2,
    matchesUserIdPattern: 1,
    otherStringCount: 1,
    nullOrMissing: 2,
  });
  assert.deepEqual(summary.identifierShape.userId, {
    stringCount: 2,
    matchesUserIdPattern: 2,
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
  assert.ok(!JSON.stringify(summary).includes(VALID_USER_ID));
  assert.doesNotMatch(JSON.stringify(summary), /Customer One|Private nickname|Private text|opaque-next-token-value/);
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

test("chat-list contract classifies chatId prefixes and length buckets structurally", () => {
  const identifiers = [
    VALID_USER_ID_2,
    "U1234567890123456",
    `R${"r".repeat(32)}`,
    `C${"c".repeat(40)}`,
    "x-other",
  ];
  const summary = summarizeChatListContractJson({
    list: identifiers.map((chatId) => ({ chatId, chatType: "USER" })),
    next: null,
  });

  assert.deepEqual(summary?.chatIdStructure, {
    totalStrings: 5,
    prefixClass: { validUserId: 1, invalidU: 1, R: 1, C: 1, other: 1 },
    lengthBuckets: { lte16: 1, from17To32: 1, from33To40: 2, gte41: 1 },
  });
  for (const identifier of identifiers) {
    assert.ok(!JSON.stringify(summary).includes(identifier));
  }
});

test("chat-list contract correlates safe chatType categories with ID shapes only", () => {
  const summary = summarizeChatListContractJson({
    list: [
      { chatId: VALID_USER_ID, chatType: "USER", friend: true, profile: { name: "Private profile" } },
      { chatId: "U1234567890", chatType: "USER", friend: false },
      { chatId: "R1234567890", chatType: "Customer-derived category", friend: "unknown" },
      { chatId: "C1234567890", chatType: "Another private category", profile: { id: "private-profile-id" } },
      { chatId: "x-other", chatType: null },
    ],
    next: null,
  });

  assert.deepEqual(summary?.chatTypeCorrelation, {
    matrix: [
      { category: "USER", count: 2, idShape: { validUserId: 1, invalidU: 1, R: 0, C: 0, other: 0 } },
      { category: "TYPE_A", count: 1, idShape: { validUserId: 0, invalidU: 0, R: 1, C: 0, other: 0 } },
      { category: "TYPE_B", count: 1, idShape: { validUserId: 0, invalidU: 0, R: 0, C: 1, other: 0 } },
      { category: "MISSING", count: 1, idShape: { validUserId: 0, invalidU: 0, R: 0, C: 0, other: 1 } },
    ],
    chatTypePresence: { present: 4, missing: 1 },
    friend: { trueCount: 1, falseCount: 1, otherOrMissing: 3 },
    profile: { present: 2, missing: 3 },
  });
  assert.doesNotMatch(
    JSON.stringify(summary),
    /Customer-derived category|Another private category|Private profile|private-profile-id|U1234567890|R1234567890|C1234567890|x-other/,
  );
  assert.ok(!JSON.stringify(summary).includes(VALID_USER_ID));
});

test("known chat ID matching returns flags only and never retains the supplied value", () => {
  const knownChatId = "Ud-known-private-123456";
  const found = summarizeChatListContractJson({
    list: [
      { chatId: knownChatId, userId: "Ud-other-private-123456" },
    ],
    next: null,
  }, knownChatId);
  assert.deepEqual(found?.knownChatIdMatch, { chatId: "FOUND", userId: "NOT_FOUND" });
  assert.ok(!JSON.stringify(found).includes(knownChatId));

  const notFound = summarizeChatListContractJson({
    list: [{ chatId: "Ud-other-private-123456", userId: null }],
    next: null,
  }, knownChatId);
  assert.deepEqual(notFound?.knownChatIdMatch, { chatId: "NOT_FOUND", userId: "NOT_FOUND" });
  assert.ok(!JSON.stringify(notFound).includes(knownChatId));
});
