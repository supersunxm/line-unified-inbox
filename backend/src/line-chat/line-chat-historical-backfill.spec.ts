import assert from "node:assert/strict";
import test from "node:test";
import { LineChatMirrorDirection } from "@prisma/client";
import {
  HistoricalBackfillStatus,
  classifyHistoricalPage,
  deriveHistoricalManagerEventId,
  historicalBackfillCanResume,
  historicalFetchResultPatch,
  historicalFetchStartedPatch,
  isHistoricalBackfillEventInRange,
  lineChatHistoricalLowerBound,
  parseManagerHistoryPage,
  persistHistoricalEvents,
  runIndependently,
  type HistoricalMirrorEvent,
} from "./line-chat-historical-backfill";

const beforeBoundary = Date.parse("2026-08-31T23:59:59.999+07:00");
const boundary = Date.parse("2026-09-01T00:00:00+07:00");
const afterBoundary = Date.parse("2026-09-01T00:00:00.001+07:00");

function page(events: unknown[], backward?: unknown) {
  return parseManagerHistoryPage({ list: events, backward });
}

function textEvent(id: string, timestamp: number): unknown {
  return {
    type: "messageReceived",
    timestamp,
    bizId: "customer",
    message: { id, type: "text", text: "safe fixture" },
  };
}

function chatReadEvent(input: {
  timestamp?: number;
  chatId?: string;
  userId?: string;
  watermark?: number;
  bizId?: string;
} = {}): Record<string, unknown> {
  return {
    type: "chatRead",
    timestamp: input.timestamp ?? 1_789_522_965_624,
    source: {
      chatId: input.chatId ?? "chat-user-29113",
      userId: input.userId ?? "line-user-7f3a",
    },
    read: { watermark: input.watermark ?? 1_789_522_965_624 },
    ...(input.bizId ? { bizId: input.bizId } : {}),
  };
}

function followEvent(type: "follow" | "unfollow", timestamp = 1_784_776_041_142) {
  return {
    type,
    timestamp,
    source: { chatId: "chat-user-29113", userId: "line-user-7f3a" },
  };
}

test("A1 fast path completes when the first page crosses the Sep 1 boundary", () => {
  const parsed = page([
    textEvent("new", Date.parse("2026-09-04T10:00:00+07:00")),
    textEvent("old", beforeBoundary),
  ], "opaque-continuation");
  const result = classifyHistoricalPage(parsed);
  assert.equal(result.status, HistoricalBackfillStatus.FAST_PATH_COMPLETE);
  assert.equal(result.complete, true);
  assert.equal(result.backwardRequired, false);
  assert.equal(result.oldestValidTimestamp?.getTime(), beforeBoundary);
});

test("A1 fast path treats an event exactly at Sep 1 midnight as covered", () => {
  const result = classifyHistoricalPage(page([textEvent("boundary", boundary)]));
  assert.equal(result.status, HistoricalBackfillStatus.FAST_PATH_COMPLETE);
  assert.equal(result.oldestValidTimestamp?.getTime(), boundary);
});

test("A1 leaves a page after Sep 1 incomplete when backward is present", () => {
  const result = classifyHistoricalPage(page([textEvent("new", afterBoundary)], "opaque"));
  assert.equal(result.status, HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION);
  assert.equal(result.backwardRequired, true);
  assert.equal(result.complete, false);
  assert.equal(result.errorCode, "BACKWARD_CONTRACT_UNPROVEN");
});

test("A1 fails closed when the page is after Sep 1 without backward continuation", () => {
  const result = classifyHistoricalPage(page([textEvent("new", afterBoundary)]));
  assert.equal(result.status, HistoricalBackfillStatus.HISTORICAL_COVERAGE_UNPROVEN);
  assert.equal(result.backwardRequired, false);
  assert.equal(result.complete, false);
  assert.equal(result.errorCode, "NO_BACKWARD_CONTINUATION");
});

test("A1 does not call an empty initial response complete", () => {
  const result = classifyHistoricalPage(page([]));
  assert.equal(result.status, HistoricalBackfillStatus.HISTORICAL_COVERAGE_UNPROVEN);
  assert.equal(result.errorCode, "NO_VALID_EVENTS");
  assert.equal(result.backwardRequired, null);
  assert.equal(result.oldestValidTimestamp, null);
});

test("A1 rejects malformed timestamps instead of treating them as coverage", () => {
  const parsed = page([{
    type: "messageReceived",
    timestamp: "not-a-timestamp",
    message: { id: "bad-time", type: "text", text: "fixture" },
  }], "opaque");
  assert.equal(parsed.invalidEventCount, 1);
  assert.equal(classifyHistoricalPage(parsed).complete, false);
});

test("A1 invalid events without stable IDs cannot prove the boundary", () => {
  const parsed = page([{
    type: "messageReceived",
    timestamp: beforeBoundary,
    message: { type: "text", text: "fixture" },
  }]);
  assert.equal(parsed.events.length, 0);
  assert.equal(parsed.invalidEventCount, 1);
  assert.equal(classifyHistoricalPage(parsed).complete, false);
});

test("A1 keeps non-text event metadata and does not persist its body as text", () => {
  const parsed = page([{
    type: "messageReceived",
    timestamp: afterBoundary,
    message: { id: "file-1", type: "file", text: "must not persist", fileName: "manual.pdf" },
  }]);
  assert.equal(parsed.events[0].messageType, "file");
  assert.equal(parsed.events[0].text, null);
  assert.equal(parsed.events[0].fileName, "manual.pdf");
});

test("A1 accepts production-shaped chatRead metadata without event IDs", () => {
  const parsed = page([chatReadEvent({ timestamp: afterBoundary, watermark: afterBoundary })]);
  assert.equal(parsed.events.length, 1);
  assert.match(parsed.events[0].managerMessageId, /^event:chatread:[0-9a-f]{64}$/u);
  assert.equal(parsed.events[0].messageType, null);
  assert.equal(parsed.events[0].direction, LineChatMirrorDirection.UNKNOWN);
  assert.equal(parsed.events[0].text, null);
  assert.equal(parsed.events[0].ownerName, null);
});

test("A1 gives an identical chatRead the same deterministic synthetic identity", () => {
  const event = chatReadEvent();
  const first = parseManagerHistoryPage({ list: [event] }).events[0];
  const second = parseManagerHistoryPage({ list: [event] }).events[0];
  assert.equal(first.managerMessageId, second.managerMessageId);
});

test("A1 changes synthetic chatRead identity when stable source fields change", () => {
  const base = chatReadEvent();
  const baseId = deriveHistoricalManagerEventId(base);
  assert.ok(baseId);

  const variants = [
    chatReadEvent({ timestamp: 1_789_522_965_625 }),
    chatReadEvent({ watermark: 1_789_522_965_625 }),
    chatReadEvent({ chatId: "chat-user-29114" }),
    chatReadEvent({ userId: "line-user-7f3b" }),
    chatReadEvent({ bizId: "manager-owner-2" }),
    followEvent("follow", 1_789_522_965_624),
  ];
  for (const variant of variants) {
    assert.notEqual(deriveHistoricalManagerEventId(variant), baseId);
  }

  const payloadTextChanged = {
    ...base,
    message: { type: "text", text: "must not affect event identity" },
  };
  assert.equal(deriveHistoricalManagerEventId(payloadTextChanged), baseId);
});

test("A1 supports production-shaped follow and unfollow event-only records", () => {
  for (const type of ["follow", "unfollow"] as const) {
    const parsed = page([followEvent(type)]);
    assert.equal(parsed.events.length, 1);
    assert.match(parsed.events[0].managerMessageId, new RegExp(`^event:${type}:`));
    assert.equal(parsed.events[0].eventType, type);
    assert.equal(parsed.events[0].direction, LineChatMirrorDirection.UNKNOWN);
    assert.equal(parsed.events[0].messageType, null);
    assert.equal(parsed.events[0].text, null);
  }
});

test("A1 rejects event-only metadata that lacks enough stable identity", () => {
  const parsed = page([{
    type: "chatRead",
    timestamp: beforeBoundary,
    source: { chatId: "chat-user-29113", userId: "line-user-7f3a" },
  }, {
    type: "delivery",
    timestamp: beforeBoundary,
    source: { chatId: "chat-user-29113", userId: "line-user-7f3a" },
  }]);
  assert.equal(parsed.events.length, 0);
  assert.equal(parsed.invalidEventCount, 2);
  assert.equal(classifyHistoricalPage(parsed).complete, false);
});

test("A1 keeps event-only timeline rows outside human reply semantics", () => {
  const parsed = page([chatReadEvent({ timestamp: beforeBoundary, watermark: beforeBoundary })]);
  const [event] = parsed.events;
  assert.equal(event.eventType, "chatRead");
  assert.equal(event.direction, LineChatMirrorDirection.UNKNOWN);
  assert.equal(event.messageType, null);
  assert.equal(event.text, null);
  assert.equal(event.ownerName, null);
  assert.notEqual(event.direction, LineChatMirrorDirection.INBOUND);
  assert.notEqual(event.direction, LineChatMirrorDirection.OUTBOUND);
});

test("A1 trusts deterministic chatRead timestamp evidence for Sep 1 coverage", () => {
  const parsed = page([chatReadEvent({ timestamp: beforeBoundary, watermark: beforeBoundary })]);
  assert.equal(parsed.invalidEventCount, 0);
  assert.equal(classifyHistoricalPage(parsed).status, HistoricalBackfillStatus.FAST_PATH_COMPLETE);
});

test("A1 preserves auto response identity as outbound metadata", () => {
  const parsed = parseManagerHistoryPage({ list: [{
    type: "messageSent",
    timestamp: afterBoundary,
    bizId: "__AUTO_RESPONSE",
    message: { id: "auto-1", type: "text", text: "automated reply" },
  }] }, new Map([["__AUTO_RESPONSE", "Incorrect staff match"]]));
  assert.equal(parsed.events[0].direction, LineChatMirrorDirection.OUTBOUND);
  assert.equal(parsed.events[0].bizId, "__AUTO_RESPONSE");
  assert.equal(parsed.events[0].ownerName, null);
});

test("A1 preserves real Manager IDs for text and media messages", () => {
  const text = page([textEvent("manager-text-1", afterBoundary)]).events[0];
  assert.equal(text.managerMessageId, "manager-text-1");
  assert.equal(text.managerMessageId.startsWith("event:"), false);

  for (const messageType of ["image", "video", "file", "sticker", "audio", "location"]) {
    const event = page([{
      type: "messageReceived",
      timestamp: afterBoundary,
      message: { id: `manager-${messageType}-1`, type: messageType },
    }]).events[0];
    assert.equal(event.managerMessageId, `manager-${messageType}-1`);
    assert.equal(event.messageType, messageType);
    assert.equal(event.text, null);
    assert.equal(event.managerMessageId.startsWith("event:"), false);
  }
});

test("A1 keeps message.id ahead of top-level id and top-level id ahead of synthetic identity", () => {
  const nestedMessageId = page([{
    id: "top-level-event-id",
    type: "messageReceived",
    timestamp: afterBoundary,
    message: { id: "manager-message-id", type: "text", text: "fixture" },
  }]).events[0];
  assert.equal(nestedMessageId.managerMessageId, "manager-message-id");

  const topLevelEventId = page([{
    id: "manager-event-id",
    type: "chatRead",
    timestamp: afterBoundary,
    source: { chatId: "chat-user-29113", userId: "line-user-7f3a" },
    read: { watermark: afterBoundary },
  }]).events[0];
  assert.equal(topLevelEventId.managerMessageId, "manager-event-id");
  assert.equal(topLevelEventId.direction, LineChatMirrorDirection.UNKNOWN);
});

test("A1 reruns upsert by stable Manager event ID without creating duplicates", async () => {
  const rows = new Map<string, HistoricalMirrorEvent>();
  const writer = {
    findExistingIds: async (_oaId: string, ids: string[]) => ids.filter((id) => rows.has(id)),
    upsert: async (_oaId: string, _chatUserId: string, event: HistoricalMirrorEvent) => {
      rows.set(event.managerMessageId, event);
    },
  };
  const event = parseManagerHistoryPage({ list: [textEvent("stable-id", beforeBoundary)] }).events[0];
  const input = {
    writer,
    lineOfficialAccountId: "oa-1",
    lineChatUserId: "chat-1",
    events: [event],
  };

  const first = await persistHistoricalEvents(input);
  const second = await persistHistoricalEvents(input);
  assert.equal(rows.size, 1);
  assert.equal(first.existingBeforeWrite, 0);
  assert.equal(second.existingBeforeWrite, 1);
  assert.equal(second.upsertOperations, 1);
});

test("A1 synthetic chatRead identity remains idempotent through historical persistence", async () => {
  const rows = new Map<string, HistoricalMirrorEvent>();
  const writer = {
    findExistingIds: async (_oaId: string, ids: string[]) => ids.filter((id) => rows.has(id)),
    upsert: async (_oaId: string, _chatUserId: string, event: HistoricalMirrorEvent) => {
      rows.set(event.managerMessageId, event);
    },
  };
  const raw = chatReadEvent();
  const firstParsed = page([raw]).events;
  const secondParsed = page([raw]).events;
  assert.equal(firstParsed[0].managerMessageId, secondParsed[0].managerMessageId);

  await persistHistoricalEvents({
    writer,
    lineOfficialAccountId: "oa-1",
    lineChatUserId: "chat-1",
    events: firstParsed,
  });
  const second = await persistHistoricalEvents({
    writer,
    lineOfficialAccountId: "oa-1",
    lineChatUserId: "chat-1",
    events: secondParsed,
  });

  assert.equal(rows.size, 1);
  assert.equal(second.existingBeforeWrite, 1);
  assert.equal(second.upsertOperations, 1);
});

test("A1 checkpoint resumes an interrupted initial-page attempt after restart", () => {
  const started = historicalFetchStartedPatch(new Date("2026-09-23T10:00:00Z"));
  assert.equal(started.historicalBackfillStatus, HistoricalBackfillStatus.FETCHING_INITIAL_PAGE);
  assert.equal(historicalBackfillCanResume(started.historicalBackfillStatus), true);
  assert.equal(historicalBackfillCanResume(null), true);
  assert.equal(historicalBackfillCanResume(HistoricalBackfillStatus.FAST_PATH_COMPLETE), false);
  assert.equal(historicalBackfillCanResume(HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION), true);
});

test("A1 checkpoint writes do not overwrite live sync or conversation state", () => {
  const liveState = {
    historySyncedThroughAt: new Date("2026-09-23T09:00:00Z"),
    lastHistorySyncedAt: new Date("2026-09-23T09:00:00Z"),
    status: "SUCCESS",
    lastErrorCode: null,
  };
  const historicalPatch = historicalFetchResultPatch(
    classifyHistoricalPage(page([textEvent("new", afterBoundary)], "opaque")),
    new Date("2026-09-23T10:00:00Z"),
  );
  Object.assign(liveState, historicalPatch);
  assert.equal(liveState.historySyncedThroughAt.toISOString(), "2026-09-23T09:00:00.000Z");
  assert.equal(liveState.lastHistorySyncedAt.toISOString(), "2026-09-23T09:00:00.000Z");
  assert.equal(liveState.status, "SUCCESS");
  assert.equal(liveState.lastErrorCode, null);
});

test("A1 historical checkpoints never use the live watermark as Sep 1 proof", () => {
  const classification = classifyHistoricalPage(page([textEvent("new", afterBoundary)], "opaque"));
  const patch = historicalFetchResultPatch(classification, new Date("2026-09-23T10:00:00Z"), "cursor-checkpoint");
  assert.equal(classification.complete, false);
  assert.equal(classification.status, HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION);
  assert.equal("historySyncedThroughAt" in patch, false);
  assert.equal(patch.historicalBackfillLowerBoundAt.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(patch.historicalBackfillCursor, "cursor-checkpoint");
});

test("A1 lower bound uses the explicit Asia/Bangkok UTC offset", () => {
  assert.equal(lineChatHistoricalLowerBound().toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(lineChatHistoricalLowerBound().getTime(), boundary);
});

test("coverage classification uses the full Manager page while persistence can stay range-bounded", () => {
  const fullPage = page([
    textEvent("new", Date.parse("2026-09-10T10:00:00+07:00")),
    textEvent("old", Date.parse("2026-08-26T10:00:00+07:00")),
  ], "opaque");
  const freezeAt = new Date("2026-09-24T01:15:00.000Z");
  const boundedEvents = fullPage.events.filter((event) =>
    isHistoricalBackfillEventInRange(
      event.sentAt,
      lineChatHistoricalLowerBound(),
      freezeAt,
    ),
  );

  assert.equal(boundedEvents.length, 1);
  assert.equal(
    classifyHistoricalPage(fullPage).status,
    HistoricalBackfillStatus.FAST_PATH_COMPLETE,
  );
  assert.equal(
    classifyHistoricalPage({
      events: boundedEvents,
      backwardPresent: fullPage.backwardPresent,
    }).status,
    HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION,
  );
});

test("mode-controlled historical range includes Sep 1 and freezeAt, but excludes later events", () => {
  const start = lineChatHistoricalLowerBound();
  const freezeAt = new Date("2026-09-24T01:15:00.000Z");
  assert.equal(isHistoricalBackfillEventInRange(start, start, freezeAt), true);
  assert.equal(isHistoricalBackfillEventInRange(freezeAt, start, freezeAt), true);
  assert.equal(isHistoricalBackfillEventInRange(new Date(start.getTime() - 1), start, freezeAt), false);
  assert.equal(isHistoricalBackfillEventInRange(new Date(freezeAt.getTime() + 1), start, freezeAt), false);
});

test("opaque backward values are reduced to presence and never returned or persisted", () => {
  const opaqueValue = "private-backward-cursor-should-not-escape";
  const parsed = page([textEvent("within-range", afterBoundary)], opaqueValue);
  assert.equal(parsed.backwardPresent, true);
  assert.equal(JSON.stringify(parsed).includes(opaqueValue), false);
});

test("A1 isolates one conversation failure and continues the store batch", async () => {
  const visited: string[] = [];
  const outcome = await runIndependently({
    items: ["failed-chat", "good-chat"],
    process: async (chatId) => {
      visited.push(chatId);
      if (chatId === "failed-chat") throw new Error("fixture");
      return chatId;
    },
    onFailure: async () => {},
  });
  assert.deepEqual(visited, ["failed-chat", "good-chat"]);
  assert.deepEqual(outcome.results, ["good-chat"]);
  assert.equal(outcome.failures, 1);
});

test("A1 isolates one store failure and continues the pilot store batch", async () => {
  const visited: string[] = [];
  const outcome = await runIndependently({
    items: ["29113", "28375", "25610"],
    process: async (storeCode) => {
      visited.push(storeCode);
      if (storeCode === "29113") throw new Error("fixture");
      return storeCode;
    },
    onFailure: async () => {},
  });
  assert.deepEqual(visited, ["29113", "28375", "25610"]);
  assert.deepEqual(outcome.results, ["28375", "25610"]);
  assert.equal(outcome.failures, 1);
});

test("historical boundary cannot hide invalid events", () => {
  const parsed = page([textEvent("old", beforeBoundary), { timestamp: "invalid", message: { id: "bad" } }]);
  assert.equal(classifyHistoricalPage(parsed).complete, false);
  assert.equal(classifyHistoricalPage(parsed).errorCode, "HISTORY_INVALID_EVENTS");
});
test("historical boundary requires ordered timestamps", () => {
  const parsed = page([textEvent("new", afterBoundary + 2), textEvent("old", beforeBoundary), textEvent("middle", afterBoundary)]);
  assert.equal(classifyHistoricalPage(parsed).complete, false);
  assert.equal(classifyHistoricalPage(parsed).errorCode, "HISTORY_TIMESTAMP_INVERSION");
});
test("malformed Manager history shape stays unproven", () => {
  assert.equal(classifyHistoricalPage(parseManagerHistoryPage({})).errorCode, "HISTORY_INVALID_SHAPE");
});

test("unsafe numeric Manager IDs cannot fabricate exact identities", () => {
  const parsed = page([{ type: "messageReceived", timestamp: beforeBoundary, message: { id: Number.MAX_SAFE_INTEGER + 1, type: "text" } }]);
  assert.equal(parsed.invalidEventCount, 1);
  assert.equal(classifyHistoricalPage(parsed).complete, false);
});
