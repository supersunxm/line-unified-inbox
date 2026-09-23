import assert from "node:assert/strict";
import test from "node:test";
import { LineChatMirrorDirection } from "@prisma/client";
import {
  HistoricalBackfillStatus,
  classifyHistoricalPage,
  historicalBackfillCanResume,
  historicalFetchResultPatch,
  historicalFetchStartedPatch,
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

test("A1 preserves event-only timeline metadata without treating it as a message", () => {
  const parsed = page([{
    id: "read-event-1",
    type: "chatRead",
    timestamp: afterBoundary,
  }]);
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].managerMessageId, "read-event-1");
  assert.equal(parsed.events[0].direction, LineChatMirrorDirection.UNKNOWN);
  assert.equal(parsed.events[0].text, null);
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

test("A1 checkpoint resumes an interrupted initial-page attempt after restart", () => {
  const started = historicalFetchStartedPatch(new Date("2026-09-23T10:00:00Z"));
  assert.equal(started.historicalBackfillStatus, HistoricalBackfillStatus.FETCHING_INITIAL_PAGE);
  assert.equal(historicalBackfillCanResume(started.historicalBackfillStatus), true);
  assert.equal(historicalBackfillCanResume(null), true);
  assert.equal(historicalBackfillCanResume(HistoricalBackfillStatus.FAST_PATH_COMPLETE), false);
  assert.equal(historicalBackfillCanResume(HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION), false);
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
  const patch = historicalFetchResultPatch(classification, new Date("2026-09-23T10:00:00Z"));
  assert.equal(classification.complete, false);
  assert.equal(classification.status, HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION);
  assert.equal("historySyncedThroughAt" in patch, false);
  assert.equal(patch.historicalBackfillLowerBoundAt.toISOString(), "2026-08-31T17:00:00.000Z");
});

test("A1 lower bound uses the explicit Asia/Bangkok UTC offset", () => {
  assert.equal(lineChatHistoricalLowerBound().toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(lineChatHistoricalLowerBound().getTime(), boundary);
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
