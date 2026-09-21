import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  extractManagerContentHash,
  extractManagerMediaUrlCandidates,
  extractManagerStickerIdentity,
} from "./line-chat-manager-media-materializer.service";

test("extracts nested Manager content hashes without depending on payload depth", () => {
  assert.equal(
    extractManagerContentHash({
      message: {
        content: {
          originalContentHash: "abc123",
        },
      },
    }),
    "abc123",
  );
});

test("extracts Manager sticker identity from nested message payload", () => {
  assert.deepEqual(
    extractManagerStickerIdentity({
      message: {
        packageId: "11537",
        stickerId: "52002734",
      },
    }),
    { packageId: "11537", stickerId: "52002734" },
  );
});

test("accepts only LINE-owned media URL candidates", () => {
  assert.deepEqual(
    extractManagerMediaUrlCandidates({
      originalUrl: "https://chat-content.line-scdn.net/bot/U123/hash",
      previewUrl: "https://chat.line.biz/api/v1/media/preview",
      maliciousUrl: "https://example.com/customer-data",
    }),
    [
      "https://chat-content.line-scdn.net/bot/U123/hash",
      "https://chat.line.biz/api/v1/media/preview",
    ],
  );
});


test("materializer waits briefly for the shared Manager profile instead of failing immediately", () => {
  const source = readFileSync(new URL("./line-chat-manager-media-materializer.service.ts", import.meta.url), "utf8");
  assert.match(source, /waitForLock:\s*true/);
  assert.match(source, /waitForLockMs:\s*15_000/);
  assert.match(source, /line_chat_manager_media_materialize_deferred/);
  assert.match(source, /Date\.now\(\) \+ 30_000/);
});
