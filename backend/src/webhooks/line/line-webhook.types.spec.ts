import assert from "node:assert/strict";
import test from "node:test";
import { LineMessage, messagePlaceholder } from "./line-webhook.types";

const cases: Array<[LineMessage, string]> = [
  [{ id: "1", type: "text", text: "hello" }, "hello"],
  [{ id: "2", type: "image" }, "[Image]"],
  [{ id: "3", type: "video" }, "[Video]"],
  [{ id: "4", type: "audio" }, "[Audio]"],
  [{ id: "5", type: "file", fileName: "manual.pdf" }, "[File: manual.pdf]"],
  [{ id: "6", type: "location", title: "Store" }, "[Location: Store]"],
  [{ id: "7", type: "sticker" }, "ส่งสติกเกอร์ LINE"],
  [{ id: "8", type: "future-type" }, "[Unsupported message]"],
];
for (const [message, expected] of cases) void test(`stores ${message.type} placeholder`, () => assert.equal(messagePlaceholder(message), expected));
