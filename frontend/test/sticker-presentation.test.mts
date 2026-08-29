import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sticker = readFileSync(new URL("../src/app/message-sticker.tsx", import.meta.url), "utf8");
const desktop = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const mobile = readFileSync(new URL("../src/components/chats/mobile-chats-app.tsx", import.meta.url), "utf8");
const mainOa = readFileSync(new URL("../src/app/main-oa/page.tsx", import.meta.url), "utf8");

void test("web sticker component renders LINE label and optional useful text", () => {
  assert.match(sticker, /ส่งสติกเกอร์ LINE/);
  assert.match(sticker, /firstUsefulStickerText/);
  assert.match(sticker, /sticker\?\.text/);
  assert.match(sticker, /sticker\?\.keywords/);
  assert.match(sticker, /data-line-sticker-text/);
  assert.match(sticker, /#06c755/i);
});

void test("desktop, mobile web, and Main OA use the dedicated sticker presentation", () => {
  assert.match(desktop, /message\.messageType === "STICKER" \? <MessageSticker/);
  assert.match(mobile, /message\.messageType === "STICKER"/);
  assert.match(mobile, /<MessageSticker sticker=\{message\.sticker\}/);
  assert.match(mainOa, /message\.messageType === "STICKER" \? <MessageSticker/);
  assert.match(mainOa, /lineStickerLabel\(language\)/);
});
