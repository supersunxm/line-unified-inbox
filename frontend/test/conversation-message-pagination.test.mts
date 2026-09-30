import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationMessagePageForScope,
  mergeConversationMessagePages,
  mergeScopedConversationMessagePage,
  replaceScopedConversationMessagePage,
  resetScopedConversationMessagePage,
} from "../src/app/conversation-message-pagination.ts";
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

const fixtureStart = Date.parse("2026-09-22T00:00:00.000Z");
const fixtureMessages = Array.from({ length: 120 }, (_, index) => message(
  `m${String(index).padStart(3, "0")}`,
  new Date(fixtureStart + index * 60_000).toISOString(),
));

function fixturePage(pageNumber: number, withNewPageOneMessage = false): ConversationMessagesResponse {
  if (pageNumber === 1 && withNewPageOneMessage) {
    return page([
      ...fixtureMessages.slice(91, 120),
      message("m120", new Date(fixtureStart + 120 * 60_000).toISOString()),
    ], 1, 121);
  }

  const pageRanges: Record<number, [number, number]> = {
    1: [90, 120],
    2: [60, 91],
    3: [30, 61],
    4: [0, 31],
  };
  const range = pageRanges[pageNumber];
  assert.ok(range, `fixture page ${pageNumber} exists`);
  return page(fixtureMessages.slice(range[0], range[1]), pageNumber, 120);
}

class TimelineFixture {
  scopeKey = "conversation-a|store-a|oa-a";
  state = resetScopedConversationMessagePage(this.scopeKey);

  get response(): ConversationMessagesResponse {
    return conversationMessagePageForScope(this.state, this.scopeKey);
  }

  select(scopeKey: string): void {
    this.scopeKey = scopeKey;
  }

  replace(scopeKey: string, incoming: ConversationMessagesResponse): void {
    this.state = replaceScopedConversationMessagePage(this.state, scopeKey, incoming, this.scopeKey);
  }

  merge(scopeKey: string, incoming: ConversationMessagesResponse): void {
    this.state = mergeScopedConversationMessagePage(this.state, scopeKey, incoming, this.scopeKey);
  }
}

function assertUniqueChronological(response: ConversationMessagesResponse): void {
  const ids = response.items.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, "visible message IDs are unique");
  assert.deepEqual(ids, [...ids].sort((leftId, rightId) => {
    const left = response.items.find(({ id }) => id === leftId);
    const right = response.items.find(({ id }) => id === rightId);
    assert.ok(left && right);
    return Date.parse(left.sentAt) - Date.parse(right.sentAt) || left.id.localeCompare(right.id);
  }));
}

function loadThreePages(timeline: TimelineFixture): void {
  timeline.replace(timeline.scopeKey, fixturePage(1));
  timeline.merge(timeline.scopeKey, fixturePage(2));
  timeline.merge(timeline.scopeKey, fixturePage(3));
}

function loadFourPages(timeline: TimelineFixture): void {
  loadThreePages(timeline);
  timeline.merge(timeline.scopeKey, fixturePage(4));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

test("page 1 initial load shows the newest 30 messages", () => {
  const timeline = new TimelineFixture();
  timeline.replace(timeline.scopeKey, fixturePage(1));
  assert.equal(timeline.response.items.length, 30);
  assert.equal(timeline.response.page, 1);
  assert.equal(timeline.response.items[0].id, "m090");
  assert.equal(timeline.response.items.at(-1)?.id, "m119");
});

test("page 2 appends older messages without dropping page 1", () => {
  const timeline = new TimelineFixture();
  timeline.replace(timeline.scopeKey, fixturePage(1));
  timeline.merge(timeline.scopeKey, fixturePage(2));
  assert.equal(timeline.response.page, 2);
  assert.equal(timeline.response.items.length, 60);
  assert.equal(timeline.response.items[0].id, "m060");
});

test("page 3 appends older messages without dropping pages 1 and 2", () => {
  const timeline = new TimelineFixture();
  timeline.replace(timeline.scopeKey, fixturePage(1));
  timeline.merge(timeline.scopeKey, fixturePage(2));
  timeline.merge(timeline.scopeKey, fixturePage(3));
  assert.equal(timeline.response.page, 3);
  assert.equal(timeline.response.items.length, 90);
  assert.equal(timeline.response.items[0].id, "m030");
});

test("poll refresh retains pages 2 and 3", () => {
  const timeline = new TimelineFixture();
  loadThreePages(timeline);
  timeline.merge(timeline.scopeKey, fixturePage(1));
  assert.equal(timeline.response.page, 3);
  assert.equal(timeline.response.items.length, 90);
  assert.ok(timeline.response.items.some(({ id }) => id === "m030"));
  assert.ok(timeline.response.items.some(({ id }) => id === "m060"));
});

test("poll refresh merges a newly received page 1 message", () => {
  const timeline = new TimelineFixture();
  loadThreePages(timeline);
  timeline.merge(timeline.scopeKey, fixturePage(1, true));
  assert.ok(timeline.response.items.some(({ id }) => id === "m120"));
  assert.equal(timeline.response.items.length, 91);
});

test("poll refresh does not duplicate existing page 1 messages", () => {
  const timeline = new TimelineFixture();
  loadThreePages(timeline);
  timeline.merge(timeline.scopeKey, fixturePage(1, true));
  const counts = new Map<string, number>();
  for (const item of timeline.response.items) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  assert.ok([...counts.values()].every((count) => count === 1));
});

test("overlapping page boundary messages are deduplicated", () => {
  const timeline = new TimelineFixture();
  timeline.replace(timeline.scopeKey, fixturePage(1));
  timeline.merge(timeline.scopeKey, fixturePage(2));
  timeline.merge(timeline.scopeKey, fixturePage(3));
  assert.equal(timeline.response.items.filter(({ id }) => id === "m090").length, 1);
  assert.equal(timeline.response.items.filter(({ id }) => id === "m060").length, 1);
});

test("polling and page appends keep deterministic chronological order", () => {
  const timeline = new TimelineFixture();
  loadThreePages(timeline);
  timeline.merge(timeline.scopeKey, fixturePage(1, true));
  assertUniqueChronological(timeline.response);
});

test("repeated polling is idempotent", () => {
  const timeline = new TimelineFixture();
  loadFourPages(timeline);
  const refreshed = fixturePage(1, true);
  timeline.merge(timeline.scopeKey, refreshed);
  const once = timeline.response.items.map(({ id }) => id);
  timeline.merge(timeline.scopeKey, refreshed);
  timeline.merge(timeline.scopeKey, refreshed);
  assert.deepEqual(timeline.response.items.map(({ id }) => id), once);
  assert.equal(timeline.response.page, 4);
  assert.equal(timeline.response.items.length, 121);
});

test("switching conversation resets page and messages", () => {
  const timeline = new TimelineFixture();
  loadThreePages(timeline);
  timeline.select("conversation-b|store-a|oa-a");
  assert.equal(timeline.response.page, 1);
  assert.equal(timeline.response.items.length, 0);
});

test("switching store resets page and messages even for the same conversation ID", () => {
  const timeline = new TimelineFixture();
  loadThreePages(timeline);
  timeline.select("conversation-a|store-b|oa-a");
  assert.equal(timeline.response.page, 1);
  assert.equal(timeline.response.items.length, 0);
});

test("an older in-flight response cannot leak into a newly selected conversation", () => {
  const timeline = new TimelineFixture();
  loadThreePages(timeline);
  const oldScope = timeline.scopeKey;
  timeline.select("conversation-b|store-a|oa-a");
  timeline.replace(timeline.scopeKey, page([message("new-chat", "2026-09-30T00:00:00Z")], 1, 1));
  timeline.merge(oldScope, fixturePage(4));
  assert.deepEqual(timeline.response.items.map(({ id }) => id), ["new-chat"]);
});

test("loading an older page after a poll still advances to page 4", () => {
  const timeline = new TimelineFixture();
  loadThreePages(timeline);
  timeline.merge(timeline.scopeKey, fixturePage(1, true));
  timeline.merge(timeline.scopeKey, fixturePage(4));
  assert.equal(timeline.response.page, 4);
  assert.equal(timeline.response.items.length, 121);
  assertUniqueChronological(timeline.response);
});

test("poll completing before Load Earlier preserves both responses", async () => {
  const timeline = new TimelineFixture();
  timeline.replace(timeline.scopeKey, fixturePage(1));
  const scope = timeline.scopeKey;
  const pollResponse = deferred<ConversationMessagesResponse>();
  const earlierResponse = deferred<ConversationMessagesResponse>();
  const pollRequest = pollResponse.promise.then((response) => timeline.merge(scope, response));
  const earlierRequest = earlierResponse.promise.then((response) => timeline.merge(scope, response));
  pollResponse.resolve(fixturePage(1, true));
  await pollRequest;
  earlierResponse.resolve(fixturePage(2));
  await earlierRequest;
  assert.equal(timeline.response.page, 2);
  assert.equal(timeline.response.items.length, 61);
});

test("Load Earlier completing before poll preserves both responses", async () => {
  const timeline = new TimelineFixture();
  timeline.replace(timeline.scopeKey, fixturePage(1));
  const scope = timeline.scopeKey;
  const pollResponse = deferred<ConversationMessagesResponse>();
  const earlierResponse = deferred<ConversationMessagesResponse>();
  const pollRequest = pollResponse.promise.then((response) => timeline.merge(scope, response));
  const earlierRequest = earlierResponse.promise.then((response) => timeline.merge(scope, response));
  earlierResponse.resolve(fixturePage(2));
  await earlierRequest;
  pollResponse.resolve(fixturePage(1, true));
  await pollRequest;
  assert.equal(timeline.response.page, 2);
  assert.equal(timeline.response.items.length, 61);
  assert.ok(timeline.response.items.some(({ id }) => id === "m120"));
});

test("overlapping poll and Load Earlier completions preserve all unique messages", async () => {
  const timeline = new TimelineFixture();
  timeline.replace(timeline.scopeKey, fixturePage(1));
  const scope = timeline.scopeKey;
  const pollResponse = deferred<ConversationMessagesResponse>();
  const earlierResponse = deferred<ConversationMessagesResponse>();
  const pollRequest = pollResponse.promise.then((response) => timeline.merge(scope, response));
  const earlierRequest = earlierResponse.promise.then((response) => timeline.merge(scope, response));
  pollResponse.resolve(fixturePage(1, true));
  earlierResponse.resolve(fixturePage(2));
  await Promise.all([pollRequest, earlierRequest]);
  assert.equal(timeline.response.page, 2);
  assert.equal(timeline.response.items.length, 61);
  assertUniqueChronological(timeline.response);
});

test("conversation switch while an earlier-page request is in flight rejects its late response", async () => {
  const timeline = new TimelineFixture();
  loadThreePages(timeline);
  const oldScope = timeline.scopeKey;
  const pendingEarlier = deferred<ConversationMessagesResponse>();
  const earlierRequest = pendingEarlier.promise.then((response) => timeline.merge(oldScope, response));
  timeline.select("conversation-b|store-a|oa-a");
  timeline.replace(timeline.scopeKey, page([message("new-chat", "2026-09-30T00:00:00Z")], 1, 1));
  pendingEarlier.resolve(fixturePage(4));
  await earlierRequest;
  assert.deepEqual(timeline.response.items.map(({ id }) => id), ["new-chat"]);
});

test("account context switch resets the timeline scope", () => {
  const timeline = new TimelineFixture();
  loadThreePages(timeline);
  timeline.select("account-b|conversation-a|store-a|oa-a");
  assert.equal(timeline.response.items.length, 0);
  assert.equal(timeline.response.page, 1);
});

test("a stale request after store/OA scope change is ignored", () => {
  const timeline = new TimelineFixture();
  loadThreePages(timeline);
  const staleScope = timeline.scopeKey;
  timeline.select("conversation-a|store-a|oa-b");
  timeline.replace(timeline.scopeKey, page([message("oa-b-message", "2026-09-30T00:00:00Z")], 1, 1));
  timeline.merge(staleScope, fixturePage(4));
  assert.deepEqual(timeline.response.items.map(({ id }) => id), ["oa-b-message"]);
});

test("a remounted timeline starts with no previous conversation history", () => {
  const firstMount = new TimelineFixture();
  loadThreePages(firstMount);
  const remounted = new TimelineFixture();
  assert.equal(remounted.response.items.length, 0);
  assert.equal(remounted.response.page, 1);
});
