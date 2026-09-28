import assert from "node:assert/strict";
import test from "node:test";
import { MessageDirection, MessageType } from "@prisma/client";
import { isHistoricalMediaEvent, mapHistoricalMediaEvent } from "./historical-media";

const event = (messageType: string, message: Record<string, unknown> = {}) => ({
  storeId: "store-1",
  conversationId: `U${"a".repeat(32)}`,
  sourceEventId: "event-1",
  deterministicIdentity: "line-chat-manager:event-1",
  timestamp: "2026-09-01T00:00:00.000Z",
  type: "message",
  direction: "INBOUND",
  messageType,
  text: null,
  rawMetadata: { message },
});

test("historical media event recognition is typed and excludes text or non-message events", () => {
  assert.equal(isHistoricalMediaEvent(event("sticker")), true);
  assert.equal(isHistoricalMediaEvent(event("image")), true);
  assert.equal(isHistoricalMediaEvent({ type: "chatRead", messageType: "image" }), false);
  assert.equal(isHistoricalMediaEvent(event("text")), false);
});

test("sticker identity and LINE identifiers are preserved without inventing text", () => {
  const mapped = mapHistoricalMediaEvent({
    event: event("sticker", { id: "content-id", packageId: "pkg-1", stickerId: "sticker-1", resourceType: "STATIC" }),
    storeId: "store-1",
    lineOfficialAccountId: "oa-1",
    sourceArchiveKey: "store-1",
    sourceArchiveSha256: "a".repeat(64),
  });
  assert.equal(mapped.messageType, MessageType.STICKER);
  assert.equal(mapped.direction, MessageDirection.INBOUND);
  assert.equal(mapped.text, "");
  assert.deepEqual(mapped.mediaMetadata, {
    availability: "METADATA_ONLY",
    sourceReferenceId: "content-id",
    packageId: "pkg-1",
    stickerId: "sticker-1",
    resourceType: "STATIC",
  });
  assert.equal(mapped.sourceEventId, "event-1");
});

test("file and video names/duration survive as metadata-only Historical events", () => {
  const input = { storeId: "store-1", lineOfficialAccountId: "oa-1", sourceArchiveKey: "store-1", sourceArchiveSha256: "b".repeat(64) };
  const file = mapHistoricalMediaEvent({ ...input, event: event("file", { id: "file-ref", fileName: "manual.pdf" }) });
  const video = mapHistoricalMediaEvent({ ...input, event: event("video", { id: "video-ref", duration: 14 }) });
  assert.equal(file.messageType, MessageType.FILE);
  assert.equal(file.fileName, "manual.pdf");
  assert.equal(file.text, "");
  assert.equal(video.messageType, MessageType.VIDEO);
  assert.equal(video.mediaMetadata.duration, 14);
  assert.equal(video.mediaMetadata.sourceReferenceId, "video-ref");
});

test("invalid or out-of-window media identity fails closed", () => {
  const input = { storeId: "store-1", lineOfficialAccountId: "oa-1", sourceArchiveKey: "store-1", sourceArchiveSha256: "c".repeat(64) };
  assert.throws(() => mapHistoricalMediaEvent({ ...input, event: { ...event("image"), conversationId: "bad" } }), /IDENTITY_INVALID/u);
  assert.throws(() => mapHistoricalMediaEvent({ ...input, event: { ...event("image"), timestamp: "2026-08-01T00:00:00.000Z" } }), /OUTSIDE_TARGET/u);
  assert.throws(() => mapHistoricalMediaEvent({ ...input, event: event("sticker", { id: "ref" }) }), /STICKER_ID_METADATA_MISSING/u);
});
