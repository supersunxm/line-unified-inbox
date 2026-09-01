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

test("chat-list parser prefers customer_name for the customer identity used by nickname resolution", () => {
  const chat = parse({
    customer_name: "Customer From LINE",
    customerName: "camel fallback",
    name: "manager nickname",
  });
  assert.equal(chat?.displayName, "Customer From LINE");
});

test("chat-list parser accepts customerName and keeps name as legacy fallback", () => {
  assert.equal(parse({ customerName: "Camel Customer", name: "legacy" })?.displayName, "Camel Customer");
  assert.equal(parse({ name: "Legacy Customer" })?.displayName, "Legacy Customer");
});

test("blank customer-name fields fall through without exposing or inventing identity", () => {
  assert.equal(parse({ customer_name: "   ", customerName: "", name: "Legacy Customer" })?.displayName, "Legacy Customer");
  assert.equal(parse({})?.displayName, null);
});
