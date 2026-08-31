import assert from "node:assert/strict";
import test from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { BrowserContext, Page } from "playwright";
import { LineChatSessionService, type ContextLauncher } from "./line-chat-session.service";
import { parseLineChatListResponse } from "./line-chat-chat-discovery";

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

test("session discovery observes the authenticated GET chat-list response and closes the context", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-discovery-"));
  let closed = false;
  let evaluatedUrl = "";
  const page: Partial<Page> = {
    goto: async () => {
      return null;
    },
    evaluate: async (_fn: unknown, targetUrl: unknown) => {
      evaluatedUrl = String(targetUrl);
      return { status: 200, body: { chats: [{ userId: "Ud1234567890abcdef", displayName: "Somchai" }] } };
    },
    waitForTimeout: async () => {},
  };
  const context = {
    pages: () => [page as Page],
    newPage: async () => page as Page,
    close: async () => { closed = true; },
  } as unknown as BrowserContext;
  const launcher: ContextLauncher = async () => context;
  try {
    const service = new LineChatSessionService(launcher);
    const result = await service.discoverChats({ botId: "Ubot", profilePath, customLauncher: launcher });
    assert.equal(result.endpoint, "https://chat.line.biz/api/v1/bots/Ubot/chats");
    assert.equal(evaluatedUrl, result.endpoint);
    assert.equal(result.chats[0]?.chatUserId, "Ud1234567890abcdef");
    assert.equal(result.enumerationStatus, "UNVERIFIED");
    assert.equal(closed, true);
  } finally {
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});
