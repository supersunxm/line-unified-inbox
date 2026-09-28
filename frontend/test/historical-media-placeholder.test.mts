import assert from "node:assert/strict";
import test from "node:test";
import { historicalMediaPlaceholder } from "../src/app/historical-media-placeholder.ts";
import type { ApiConversation } from "../src/types/api.ts";

type Message = ApiConversation["messages"][number];
const message = (overrides: Partial<Message>): Message => ({
  id: "historical-1",
  direction: "INBOUND",
  messageType: "IMAGE",
  originalText: "",
  originalLanguage: null,
  translatedThai: null,
  translatedEnglish: null,
  translatedChinese: null,
  sentAt: "2026-09-01T00:00:00.000Z",
  fileName: null,
  sender: null,
  media: null,
  latitude: null,
  longitude: null,
  historical: true,
  ...overrides,
});

test("Historical media placeholders identify unavailable typed content and preserve safe metadata", () => {
  assert.deepEqual(historicalMediaPlaceholder(message({})), { label: "Historical image unavailable", detail: null });
  assert.deepEqual(historicalMediaPlaceholder(message({ messageType: "VIDEO", historicalMediaMetadata: { availability: "METADATA_ONLY", packageId: null, stickerId: null, resourceType: null, duration: 12 } })), { label: "Historical video unavailable", detail: "Duration: 12s" });
  assert.deepEqual(historicalMediaPlaceholder(message({ messageType: "FILE", fileName: "manual.pdf" })), { label: "Historical file unavailable", detail: "manual.pdf" });
  assert.deepEqual(historicalMediaPlaceholder(message({ messageType: "STICKER", historicalMediaMetadata: { availability: "METADATA_ONLY", packageId: "p1", stickerId: "s1", resourceType: "STATIC", duration: null } })), { label: "Historical sticker unavailable", detail: "Package p1 · Sticker s1" });
});

test("current media messages and Historical text never receive a media placeholder", () => {
  assert.equal(historicalMediaPlaceholder(message({ historical: false })), null);
  assert.equal(historicalMediaPlaceholder(message({ messageType: "TEXT" })), null);
});
