import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mobileChats = readFileSync(new URL("../src/components/chats/mobile-chats-app.tsx", import.meta.url), "utf8");

void test("opening a canonical conversation uses the merged canonical messages endpoint regardless of list filter", () => {
  const start = mobileChats.indexOf("const loadConversation = useCallback(async");
  const end = mobileChats.indexOf("}, [scrollMessagesToBottom, updateUrlConversation]);", start);
  assert.ok(start >= 0 && end > start);
  const loader = mobileChats.slice(start, end);
  assert.match(loader, /const historical = seed\?\.historicalOnly === true \|\| id\.startsWith\("historical:"\)/);
  assert.match(loader, /api\.conversationMessages\(id\)/);
  assert.doesNotMatch(loader, /\bstatus\b|api\.historicalChats\(/);
});

void test("virtual Historical chats remain a separate read-only list limited to the all filter", () => {
  const loadListStart = mobileChats.indexOf("const loadList = useCallback(async");
  const loadListEnd = mobileChats.indexOf("}, [historicalPage, page, search, status, storeId, user]);", loadListStart);
  assert.ok(loadListStart >= 0 && loadListEnd > loadListStart);
  const loader = mobileChats.slice(loadListStart, loadListEnd);
  assert.match(loader, /status === "all"\s*\? api\.historicalChats/);
});
