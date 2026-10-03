import assert from "node:assert/strict";
import test from "node:test";
import { mergeConversationMessagePages } from "../src/app/conversation-message-pagination.ts";
import type { ConversationMessagesResponse } from "../src/types/api.ts";

type Message = ConversationMessagesResponse["items"][number];

function message(id: string, sentAt: string, originalText = id): Message {
  return {
    id,
    direction: "INBOUND",
    messageType: "TEXT",
    originalText,
    originalLanguage: null,
    translatedThai: null,
    translatedEnglish: null,
    translatedChinese: null,
    sentAt,
    fileName: null,
    sender: null,
    media: null,
    latitude: null,
    longitude: null,
  };
}

function page(items: Message[], pageNumber: number, total: number): ConversationMessagesResponse {
  return { items, page: pageNumber, pageSize: 30, total, hasEarlier: pageNumber * 30 < total };
}

test("polling page one preserves previously loaded older pages", () => {
  const firstPage = page([message("m3", "2026-09-03T00:00:00Z"), message("m4", "2026-09-04T00:00:00Z")], 1, 4);
  const loadedEarlier = mergeConversationMessagePages(
    firstPage,
    page([message("m1", "2026-09-01T00:00:00Z"), message("m2", "2026-09-02T00:00:00Z")], 2, 4),
  );

  const refreshed = mergeConversationMessagePages(
    loadedEarlier,
    page([message("m3", "2026-09-03T00:00:00Z", "refreshed"), message("m4", "2026-09-04T00:00:00Z")], 1, 4),
  );

  assert.deepEqual(refreshed.items.map(({ id }) => id), ["m1", "m2", "m3", "m4"]);
  assert.equal(refreshed.items[2].originalText, "refreshed");
  assert.equal(refreshed.page, 2);
  assert.equal(refreshed.hasEarlier, false);
});

test("overlapping fetched pages produce unique chronological messages", () => {
  const current = page([message("m2", "2026-09-02T00:00:00Z"), message("m3", "2026-09-03T00:00:00Z")], 1, 4);
  const merged = mergeConversationMessagePages(
    current,
    page([message("m1", "2026-09-01T00:00:00Z"), message("m2", "2026-09-02T00:00:00Z")], 2, 4),
  );

  assert.deepEqual(merged.items.map(({ id }) => id), ["m1", "m2", "m3"]);
  assert.equal(new Set(merged.items.map(({ id }) => id)).size, 3);
  assert.equal(merged.page, 2);
  assert.equal(merged.hasEarlier, true);
});
