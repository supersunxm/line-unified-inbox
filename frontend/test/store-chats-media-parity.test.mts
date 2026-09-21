import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/components/chats/mobile-chats-app.tsx", import.meta.url), "utf8");
const mediaSource = readFileSync(new URL("../src/app/message-media.tsx", import.meta.url), "utf8");

test("Store Chats renders Manager media types instead of text placeholders", () => {
  assert.match(source, /message\.messageType === "STICKER" && message\.media/);
  assert.match(source, /<MessageVideo messageId=\{message\.id\} media=\{message\.media\}/);
  assert.match(source, /<MessageFileAttachment/);
  assert.match(mediaSource, /messageMediaUrl\(messageId\)/);
  assert.match(mediaSource, /<video/);
  assert.match(mediaSource, /anchor\.download/);
});
