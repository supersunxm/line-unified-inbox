import assert from "node:assert/strict";
import test from "node:test";
import { parseLineChatListResponse } from "./line-chat-chat-discovery";

const CHAT_ID = `U${"a".repeat(32)}`;

function parse(record: Record<string, unknown>) {
  return parseLineChatListResponse({
    list: [{ chatId: CHAT_ID, chatType: "USER", ...record }],
    next: null,
  }, {
    botId: "Ubot",
    endpoint: "https://chat.line.biz/api/v2/bots/Ubot/chats",
  }).chats[0];
}

test("chat-list parser prefers profile.name as the customer identity used by nickname resolution", () => {
  const chat = parse({
    profile: {
      name: "Customer From LINE",
      nickname: "Manager Assigned Nickname",
    },
    customer_name: "legacy snake fallback",
    customerName: "legacy camel fallback",
    name: "legacy top-level fallback",
  });
  assert.equal(chat?.displayName, "Customer From LINE");
});

test("manager nickname is never used as the customer source identity", () => {
  assert.equal(parse({ profile: { nickname: "Manager Nickname Only" } })?.displayName, null);
});

test("chat-list parser keeps customer_name, customerName, and top-level name as compatibility fallbacks", () => {
  assert.equal(parse({ customer_name: "Snake Customer", customerName: "camel", name: "legacy" })?.displayName, "Snake Customer");
  assert.equal(parse({ customerName: "Camel Customer", name: "legacy" })?.displayName, "Camel Customer");
  assert.equal(parse({ name: "Legacy Customer" })?.displayName, "Legacy Customer");
});

test("blank customer-name fields fall through without exposing or inventing identity", () => {
  assert.equal(parse({ profile: { name: "   " }, customer_name: "", customerName: "", name: "Legacy Customer" })?.displayName, "Legacy Customer");
  assert.equal(parse({ profile: {} })?.displayName, null);
});
