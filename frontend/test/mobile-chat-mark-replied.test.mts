import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mobileCode = readFileSync(
  new URL("../src/components/chats/mobile-chats-app.tsx", import.meta.url),
  "utf8",
);
const chatsPageCode = readFileSync(new URL("../src/app/chats/page.tsx", import.meta.url), "utf8");

test("mobile Store Chats exposes a one-tap mark replied action for writable non-replied rows", () => {
  assert.match(mobileCode, /data-mobile-mark-replied/);
  assert.match(mobileCode, /conversation\.bmReplyStatus !== "REPLIED" && user\.role !== "VIEWER"/);
  assert.match(mobileCode, /"✓ ตอบแล้ว"/);
  assert.match(mobileCode, /api\.updateBmReplyStatus\(conversation\.id, "REPLIED"\)/);
});

test("mark replied reconciles filtered list and visible status summary", () => {
  assert.match(mobileCode, /status === "NOT_REPLIED" \|\| status === "NOTIFIED_BM"/);
  assert.match(mobileCode, /await loadList\(\)/);
  assert.match(mobileCode, /window\.dispatchEvent\(new Event\("bm-reply-status-summary-refresh"\)\)/);
  assert.match(chatsPageCode, /window\.addEventListener\("bm-reply-status-summary-refresh", refresh\)/);
  assert.match(chatsPageCode, /window\.removeEventListener\("bm-reply-status-summary-refresh", refresh\)/);
});
