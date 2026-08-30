import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const mobile = readFileSync(new URL("../src/components/chats/mobile-chats-app.tsx", import.meta.url), "utf8");
const mainOa = readFileSync(new URL("../src/app/main-oa/page.tsx", import.meta.url), "utf8");
const helper = readFileSync(new URL("../src/app/message-sender.ts", import.meta.url), "utf8");
const realtime = readFileSync(new URL("../src/app/realtime.ts", import.meta.url), "utf8");

test("Web conversation views render the persisted outbound sender", () => {
  assert.match(page, /getMessageSenderName\(message\)/);
  assert.match(page, /data-message-sender/);
  assert.match(mobile, /getMessageSenderName\(message\)/);
  assert.match(mainOa, /getMessageSenderName\(message\)/);
});

test("sender helper never attributes inbound or unattributed messages", () => {
  assert.match(helper, /message\.direction !== "OUTBOUND"/);
  assert.match(helper, /message\.sender\?\.displayName/);
  assert.doesNotMatch(helper, /currentUser|loggedIn|lastResponder/);
});

test("realtime message contract carries sender and maps it without a reload", () => {
  assert.match(realtime, /sender\?: \{ userId: string \| null; displayName: string \}/);
  assert.match(realtime, /type: "conversation\.updated"/);
  assert.match(realtime, /mapRealtimeMessage/);
  assert.match(page, /subscribeToRealtimeEvents/);
  assert.match(mobile, /subscribeToRealtimeEvents/);
  assert.match(page, /event\.type === "conversation\.updated"/);
  assert.match(mobile, /event\.type === "conversation\.updated"/);
});
