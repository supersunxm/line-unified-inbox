import assert from "node:assert/strict";
import test from "node:test";
import { historyPageUrl, observeHistoryPage, startHistoryCoverage } from "./line-chat-history-pagination";
const boundary = new Date("2026-10-05T17:35:00+07:00"), at = boundary.getTime();
const page = (times: number[], backward?: unknown) => ({ list: times.map((timestamp, i) => ({ type: "messageReceived", timestamp, message: { id: `fixture-${timestamp}-${i}`, type: "text" } })), backward });
const initial = () => startHistoryCoverage("fixture-oa/chat", boundary);
const observe = (times: number[], backward?: unknown) => observeHistoryPage(initial(), { httpStatus: 200, requestedBackward: null, body: page(times, backward) });
test("opaque URL-shaped tokens stay on the exact Manager endpoint", () => {
  const endpoint = "https://chat.line.biz/api/v3/bots/bot/chats/chat/messages";
  for (const token of [" +/= &%?# ", "https://other.invalid/opaque", "/opaque?x=y"]) {
    const url = new URL(historyPageUrl(endpoint, token));
    assert.equal(url.searchParams.get("backward"), token);
    assert.equal(url.origin, "https://chat.line.biz");
    assert.equal(url.pathname, new URL(endpoint).pathname);
  }
  assert.throws(() => historyPageUrl("https://other.invalid/messages", null));
});
test("ordered initial history crosses Bangkok/UTC boundary", () => {
  assert.equal(observe([at + 1, at]).status, "COVERAGE_PROVEN");
  assert.equal(initial().lowerBoundAt, "2026-10-05T10:35:00.000Z");
});
test("serialized checkpoint resumes opaque tokens and rejects loops", () => {
  const state = JSON.parse(JSON.stringify(observe([at + 4, at + 3], "opaque"))) as ReturnType<typeof initial>;
  assert.equal(observeHistoryPage(state, { httpStatus: 200, requestedBackward: "opaque", body: page([at + 2], "opaque") }).reason, "HISTORY_CURSOR_LOOP");
  assert.equal(observeHistoryPage(state, { httpStatus: 200, requestedBackward: "opaque", body: page([at + 2, at]) }).status, "COVERAGE_PROVEN");
});
test("a persisted cursor resumes the next page and resets its per-page retry budget", async () => {
  const { restoreHistoryCursor, serializeHistoryCursor } = await import("./line-chat-history-pagination");
  const first = observeHistoryPage(initial(), {
    httpStatus: 200,
    requestedBackward: null,
    body: page([at + 4, at + 3], "opaque-next"),
  });
  const restored = restoreHistoryCursor(serializeHistoryCursor(first), first.sourceKey, boundary);
  assert.equal(restored.backward, "opaque-next");
  assert.equal(restored.pages, 1);
  const second = observeHistoryPage(restored, {
    httpStatus: 200,
    requestedBackward: "opaque-next",
    body: page([at + 2, at]),
  });
  assert.equal(second.status, "COVERAGE_PROVEN");
  assert.equal(second.pages, 2);
  assert.equal(second.attemptsForPage, 0);
});
test("empty/recent terminal is no proof of lower bound", () => {
  assert.equal(observe([]).status, "API_LIMITATION");
  assert.equal(observe([at + 1]).reason, "HISTORY_TERMINAL_LOWER_BOUND_UNPROVEN");
});
test("repeated pages, nonprogress and timestamp inversion fail closed", () => {
  const first = observe([at + 4, at + 3], "one");
  const next = (times: number[]) => observeHistoryPage(first, { httpStatus: 200, requestedBackward: "one", body: page(times, "two") });
  assert.equal(next([at + 4, at + 3]).reason, "HISTORY_REPEATED_PAGE");
  assert.equal(next([at + 6, at + 5]).reason, "HISTORY_NO_OLDER_EVIDENCE");
  assert.equal(observe([at + 2, at, at + 1]).reason, "HISTORY_TIMESTAMP_INVERSION");
});
test("transient errors retain cursor; auth failures are explicit", () => {
  for (const httpStatus of [429, 500, 503]) {
    const result = observeHistoryPage(initial(), { httpStatus, requestedBackward: null, body: null });
    assert.equal(result.pages, 0); assert.equal(result.status, "IN_PROGRESS");
  }
  for (const httpStatus of [401, 403]) assert.equal(observeHistoryPage(initial(), { httpStatus, requestedBackward: null, body: null }).status, "AUTHENTICATION_BLOCKED");
});
test("transient history requests stop after the bounded per-page retry budget", () => {
  let state = initial();
  state = observeHistoryPage(state, { httpStatus: 503, requestedBackward: null, body: null });
  assert.equal(state.status, "IN_PROGRESS");
  state = observeHistoryPage(state, { httpStatus: 503, requestedBackward: null, body: null });
  assert.equal(state.status, "IN_PROGRESS");
  state = observeHistoryPage(state, { httpStatus: 503, requestedBackward: null, body: null });
  assert.equal(state.status, "API_LIMITATION");
  assert.equal(state.reason, "HISTORY_HTTP_503_RETRY_BUDGET_EXHAUSTED");
});
test("page budgets cannot become coverage claims", () => {
  const state = startHistoryCoverage("source", boundary, 1);
  assert.equal(observeHistoryPage(state, { httpStatus: 200, requestedBackward: null, body: page([at + 1], "next") }).reason, "HISTORY_PAGE_BUDGET_EXHAUSTED");
  assert.throws(() => startHistoryCoverage("source", boundary, 201));
});
test("malformed shape and cursor mismatch cannot certify coverage", () => {
  for (const body of [{}, { list: [{}] }, { list: [{ timestamp: "" }] }, { list: [{ timestamp: 1 }], backward: {} }]) assert.equal(observeHistoryPage(initial(), { httpStatus: 200, requestedBackward: null, body }).status, "COVERAGE_BLOCKED");
  assert.equal(observeHistoryPage(initial(), { httpStatus: 200, requestedBackward: "wrong", body: page([at]) }).reason, "CURSOR_RESPONSE_MISMATCH");
});

test("checkpoint integrity and source/window isolation fail closed", async () => {
  const { serializeHistoryCursor, restoreHistoryCursor } = await import("./line-chat-history-pagination");
  const state = observe([at + 2], "opaque");
  const serialized = serializeHistoryCursor(state);
  assert.deepEqual(restoreHistoryCursor(serialized, state.sourceKey, boundary), state);
  assert.throws(() => restoreHistoryCursor(serialized.replace("opaque", "changed"), state.sourceKey, boundary));
  assert.throws(() => restoreHistoryCursor(serialized, "wrong-store", boundary));
  assert.throws(() => restoreHistoryCursor(serialized, state.sourceKey, new Date(at + 1)));
});

test("syntactically valid checkpoint cannot invent proven coverage", async () => {
  const { serializeHistoryCursor, restoreHistoryCursor } = await import("./line-chat-history-pagination");
  const state = { ...initial(), status: "COVERAGE_PROVEN" as const };
  assert.throws(() => restoreHistoryCursor(serializeHistoryCursor(state), state.sourceKey, boundary));
});
