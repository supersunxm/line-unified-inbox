import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const desktop = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const mobile = readFileSync(new URL("../src/components/chats/mobile-chats-app.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const routing = readFileSync(new URL("../src/app/workspace-routing.ts", import.meta.url), "utf8");
const query = readFileSync(new URL("../src/app/conversation-list-query.ts", import.meta.url), "utf8");

test("desktop Store Chats defaults to the latest real activity month and exposes a selector", () => {
  assert.match(desktop, /api\.conversationMonthOptions/);
  assert.match(desktop, /result\.latestMonth/);
  assert.match(desktop, /data-chat-month-selector/);
  assert.match(desktop, /month: initialSection === "chats" && chatMonth \? chatMonth : undefined/);
});

test("mobile Store Chats uses the same latest-month default and month-scoped APIs", () => {
  assert.match(mobile, /api\.conversationMonthOptions/);
  assert.match(mobile, /result\.latestMonth/);
  assert.match(mobile, /data-mobile-chat-month-selector/);
  assert.match(mobile, /month: month \|\| undefined/);
  assert.match(mobile, /historicalChatMessages\(id, 1, undefined, month \|\| undefined\)/);
});

test("historical month views cannot send a current reply from desktop or mobile", () => {
  assert.match(desktop, /!viewingLatestChatMonth/);
  assert.match(mobile, /!viewingLatestMonth/);
  assert.match(mobile, /เปลี่ยนเป็นเดือนล่าสุดเพื่อส่งข้อความ/);
});

test("month is preserved in chat routing and list query contracts", () => {
  assert.match(routing, /month\?: string/);
  assert.match(routing, /month: query\.get\("month"\)/);
  assert.match(query, /month\?: string/);
  assert.match(query, /month: input\.month/);
});

test("frontend API exposes month options, month summaries, and month-scoped message history", () => {
  assert.match(api, /conversationMonthOptions/);
  assert.match(api, /bmReplyStatusSummaryForMonth/);
  assert.match(api, /query\.set\("month", month\)/);
});
