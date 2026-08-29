import assert from "node:assert/strict";
import test from "node:test";
import { firstUsefulStickerText, stickerPresentationFromRawPayload } from "./sticker-message";

void test("sticker presentation prefers explicit message-sticker text", () => {
  const sticker = stickerPresentationFromRawPayload({
    type: "sticker",
    text: "  ขอบคุณ  ",
    keywords: ["thanks", "smile"],
  });
  assert.deepEqual(sticker, { text: "ขอบคุณ", keywords: ["thanks", "smile"] });
  assert.equal(firstUsefulStickerText(sticker), "ขอบคุณ");
});

void test("sticker presentation falls back to the first useful keyword", () => {
  const sticker = stickerPresentationFromRawPayload({
    type: "sticker",
    keywords: ["  ", " ขอบคุณ\nมาก ", 17],
  });
  assert.deepEqual(sticker, { text: null, keywords: ["ขอบคุณ มาก"] });
  assert.equal(firstUsefulStickerText(sticker), "ขอบคุณ มาก");
});

void test("non-sticker and historical empty sticker payloads degrade safely", () => {
  assert.equal(stickerPresentationFromRawPayload({ type: "image", keywords: ["wrong"] }), null);
  assert.deepEqual(stickerPresentationFromRawPayload({ type: "sticker" }), { text: null, keywords: [] });
});
