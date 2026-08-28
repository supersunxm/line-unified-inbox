import test from "node:test";
import assert from "node:assert/strict";
import {
  detectImageMagicBytes,
  detectImageMime,
  extractAllGreetingVariables,
  normalizeGreetingMessages,
  validateGreetingMessages,
} from "./greeting-message.utils";

test("detectImageMagicBytes identifies JPEG and PNG headers", () => {
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
  ]);
  assert.equal(detectImageMagicBytes(pngHeader), "png");
  assert.equal(detectImageMime(pngHeader), "image/png");

  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(detectImageMagicBytes(jpegHeader), "jpeg");
  assert.equal(detectImageMime(jpegHeader), "image/jpeg");

  const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  assert.equal(detectImageMagicBytes(gifHeader), "unknown");
  assert.equal(detectImageMime(gifHeader), null);
});

test("normalizeGreetingMessages normalizes contentJson safely", () => {
  const template = {
    contentJson: {
      version: 1,
      messages: [
        { id: "1", type: "TEXT", textTemplate: "Hello" },
        { id: "2", type: "IMAGE", mediaObjectKey: "line-media/greeting/test.jpg" },
      ],
    },
  };
  const normalized = normalizeGreetingMessages(template);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].type, "TEXT");
  assert.equal(normalized[1].type, "IMAGE");

  const empty = normalizeGreetingMessages({});
  assert.deepEqual(empty, []);
});

test("extractAllGreetingVariables extracts variables across multiple text blocks", () => {
  const messages = [
    {
      id: "1",
      type: "TEXT" as const,
      textTemplate: "สวัสดี {{user.displayName}} ยินดีต้อนรับสู่ {{store.storeName}}",
    },
    {
      id: "2",
      type: "IMAGE" as const,
      mediaObjectKey: "key.jpg",
    },
    {
      id: "3",
      type: "TEXT" as const,
      textTemplate: "แผนที่ร้าน: {{store.googleMapsUrl}} ดูแลโดย {{account.name}}",
    },
  ];

  const vars = extractAllGreetingVariables(messages);
  assert.deepEqual(vars.sort(), [
    "account.name",
    "store.googleMapsUrl",
    "store.storeName",
    "user.displayName",
  ]);
});

test("validateGreetingMessages enforces count, text content, and media presence", () => {
  // Empty array
  const emptyRes = validateGreetingMessages([]);
  assert.equal(emptyRes.valid, false);
  assert.match(emptyRes.errors[0], /at least 1 message block/);

  // > 5 blocks
  const sixBlocks = Array.from({ length: 6 }, (_, i) => ({
    id: String(i),
    type: "TEXT" as const,
    textTemplate: `Message ${i}`,
  }));
  const sixRes = validateGreetingMessages(sixBlocks);
  assert.equal(sixRes.valid, false);
  assert.match(sixRes.errors[0], /cannot exceed 5/);

  // Missing text in TEXT block
  const emptyTextRes = validateGreetingMessages([
    { id: "1", type: "TEXT", textTemplate: "   " },
  ]);
  assert.equal(emptyTextRes.valid, false);
  assert.match(emptyTextRes.errors[0], /cannot be empty/);

  // Missing mediaObjectKey in IMAGE block
  const emptyImageRes = validateGreetingMessages([
    { id: "1", type: "IMAGE", mediaObjectKey: "" },
  ]);
  assert.equal(emptyImageRes.valid, false);
  assert.match(emptyImageRes.errors[0], /missing media object key/);

  // Valid blocks
  const validRes = validateGreetingMessages([
    { id: "1", type: "TEXT", textTemplate: "Hello" },
    { id: "2", type: "IMAGE", mediaObjectKey: "key.png" },
  ]);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.errors.length, 0);
});
