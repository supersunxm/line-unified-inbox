import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MessageType } from "@prisma/client";
import {
  extractManagerContentHash,
  extractManagerMediaUrlCandidates,
  extractManagerStickerIdentity,
  inferManagerMediaMimeFromMagic,
  isTransientManagerMediaError,
  managerContentHashUrl,
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
  assert.match(source, /retryDelayMs = errorMessage\.startsWith\("MANAGER_MEDIA_AUTH_"\) \? 5 \* 60_000 : 30_000/);
  assert.match(source, /Date\.now\(\) \+ retryDelayMs/);
});


test("infers generic Manager media MIME types from safe magic bytes", () => {
  assert.equal(
    inferManagerMediaMimeFromMagic(
      MessageType.IMAGE,
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
    ),
    "image/jpeg",
  );
  assert.equal(
    inferManagerMediaMimeFromMagic(
      MessageType.IMAGE,
      Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]),
    ),
    "image/webp",
  );
  assert.equal(
    inferManagerMediaMimeFromMagic(
      MessageType.VIDEO,
      Buffer.concat([Buffer.alloc(4), Buffer.from("ftyp"), Buffer.from("isom")]),
    ),
    "video/mp4",
  );
  assert.equal(
    inferManagerMediaMimeFromMagic(
      MessageType.VIDEO,
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]),
    ),
    "video/webm",
  );
});


test("preserves content-hash path separators while encoding each path segment safely", () => {
  assert.equal(
    managerContentHashUrl("bot-1", "abc/def+ghi=="),
    "https://chat-content.line-scdn.net/bot/bot-1/abc/def%2Bghi%3D%3D",
  );
  assert.equal(managerContentHashUrl("bot-1", "../escape"), null);
  assert.equal(managerContentHashUrl("bot-1", "bad?query"), null);
});

test("treats browser process exhaustion as transient materialization contention", () => {
  assert.equal(isTransientManagerMediaError("MANAGER_MEDIA_PROFILE_BUSY"), true);
  assert.equal(isTransientManagerMediaError("spawn chromium EAGAIN"), true);
  assert.equal(isTransientManagerMediaError("Target page, context or browser has been closed"), true);
  assert.equal(isTransientManagerMediaError("MANAGER_MEDIA_BINARY_NOT_FOUND"), false);
});

test("materializer reuses a single persistent browser context for a candidate batch", () => {
  const source = readFileSync(new URL("./line-chat-manager-media-materializer.service.ts", import.meta.url), "utf8");
  assert.match(source, /materializeMessageBatch/);
  assert.match(source, /materializeLoadedGroup/);
  assert.match(source, /for \(const \{ input, message \} of runnable\)/);
  assert.match(source, /launchManagedPersistentContext/);
  assert.match(source, /persistDownloadedMedia/);
});


test("materializer treats Manager auth expiry as retryable and wires safe remembered-account recovery", () => {
  const source = readFileSync(new URL("./line-chat-manager-media-materializer.service.ts", import.meta.url), "utf8");
  assert.equal(isTransientManagerMediaError("MANAGER_MEDIA_AUTH_AUTH_EXPIRED"), true);
  assert.match(source, /LineChatAuthRecoveryService/);
  assert.match(source, /recordSessionHealthResult/);
  assert.match(source, /status:\s*"AUTH_REQUIRED"/);
  assert.match(source, /failureStage:\s*"MANAGER_AUTH"/);
  assert.match(source, /recoverSession\(sessionId, "SCHEDULED"\)/);
  assert.match(source, /line_chat_manager_media_auth_recovered_retrying_batch/);
});


test("Chromium launch timeouts are retryable and the media worker uses a bounded launch timeout", () => {
  assert.equal(
    isTransientManagerMediaError("browserType.launchPersistentContext: Timeout 30000ms exceeded."),
    true,
  );
  const source = readFileSync(new URL("./line-chat-manager-media-materializer.service.ts", import.meta.url), "utf8");
  assert.match(source, /timeout:\s*30_000/);
});
