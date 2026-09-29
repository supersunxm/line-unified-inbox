import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mobileCode = readFileSync(
  new URL("../src/components/chats/mobile-chats-app.tsx", import.meta.url),
  "utf8",
);
const chatsPageCode = readFileSync(new URL("../src/app/chats/page.tsx", import.meta.url), "utf8");

test("mobile Store Chats displays the effective two-state reply status", () => {
  assert.match(mobileCode, /getEffectiveReplyState\(conversation\)/);
  assert.match(mobileCode, /type StatusFilter = "all" \| ApiEffectiveReplyState/);
  assert.match(mobileCode, /replyState: status === "all" \? undefined : status/);
  assert.match(mobileCode, /NOT_REPLIED: "ยังไม่ตอบ"/);
  assert.match(mobileCode, /REPLIED: "ตอบแล้ว"/);
});

test("mobile reply filters expose only all, not replied, and replied", () => {
  assert.match(chatsPageCode, /\["NOT_REPLIED", labels\.notReplied\]/);
  assert.match(chatsPageCode, /\["REPLIED", labels\.replied\]/);
  assert.doesNotMatch(chatsPageCode, /\["NOTIFIED_BM", labels\.notifiedBm\]/);

  assert.match(chatsPageCode, /\[data-mobile-mark-replied\]/);
  assert.match(chatsPageCode, /display: none !important/);
});

test("legacy notified URLs normalize into the effective NOT_REPLIED state", () => {
  assert.match(mobileCode, /value === "NOT_REPLIED" \|\| value === "NOTIFIED_BM"/);
  assert.match(chatsPageCode, /urlStatus === "NOT_REPLIED" \|\| urlStatus === "NOTIFIED_BM"/);
  assert.match(chatsPageCode, /url\.searchParams\.delete\("bmReplyStatus"\)/);
  assert.match(chatsPageCode, /url\.searchParams\.set\("replyState", nextStatus\)/);
});

test("sending or retrying a staff reply updates the visible effective state optimistically", () => {
  assert.match(mobileCode, /effectiveReplyState: "REPLIED"/);
  assert.match(mobileCode, /api\.sendConversationMessage/);
  assert.match(mobileCode, /api\.retryConversationMessage/);
  assert.match(mobileCode, /window\.dispatchEvent\(new Event\("bm-reply-status-summary-refresh"\)\)/);
});
