import assert from "node:assert/strict";
import test from "node:test";
import {
  HistoricalBackfillStatus,
} from "./line-chat-historical-backfill";
import {
  SeptemberChatClassification,
  SeptemberChatListOrderTracker,
  buildSeptemberChatInventoryReport,
  classifySeptemberChat,
  formatSeptemberChatInventoryReport,
  isSeptemberHistoricalChatCandidate,
  summarizeSeptemberChatCoverage,
} from "./line-chat-september-inventory";
import type {
  LineChatDiscoveredChat,
  LineChatDiscoveryResult,
} from "./line-chat.types";

function chat(
  id: string,
  lastMessageAt: string | null,
  lastMessageAtState?: LineChatDiscoveredChat["lastMessageAtState"],
): LineChatDiscoveredChat {
  return {
    chatUserId: `U${id.padStart(32, "0")}`,
    displayName: "Customer",
    lastMessageText: null,
    lastMessageAt,
    ...(lastMessageAtState ? { lastMessageAtState } : {}),
    lastMessageDirection: null,
  };
}

function page(chats: LineChatDiscoveredChat[], invalidUserRecords = 0) {
  return {
    responseShape: "list" as const,
    chats,
    totalRawRecords: chats.length + invalidUserRecords,
    validUserChats: chats.length,
    ignoredNonUserRecords: 0,
    invalidUserRecords,
  };
}

function discovery(
  chats: LineChatDiscoveredChat[],
  overrides: Partial<Pick<LineChatDiscoveryResult,
    | "pagesFetched"
    | "enumerationStatus"
    | "invalidUserRecords"
    | "conflictingDuplicates"
    | "nextTerminationObserved"
    | "enumerationError"
    | "stoppedEarlyByObserver"
  >> = {},
) {
  return {
    chats,
    pagesFetched: 1,
    enumerationStatus: "COMPLETE" as const,
    invalidUserRecords: 0,
    conflictingDuplicates: 0,
    nextTerminationObserved: true,
    ...overrides,
  };
}

test("September classifier honors the Asia/Bangkok lower and upper boundaries", () => {
  assert.equal(
    classifySeptemberChat("2026-09-01T00:00:00+07:00"),
    SeptemberChatClassification.SEPTEMBER,
  );
  assert.equal(
    classifySeptemberChat("2026-08-31T23:59:59+07:00"),
    SeptemberChatClassification.BEFORE_SEPTEMBER,
  );
  assert.equal(
    classifySeptemberChat("2026-09-30T23:59:59+07:00"),
    SeptemberChatClassification.SEPTEMBER,
  );
  assert.equal(
    classifySeptemberChat("2026-10-01T00:00:00+07:00"),
    SeptemberChatClassification.AFTER_SEPTEMBER,
  );
});

test("September classifier returns UNKNOWN for missing or invalid timestamps", () => {
  for (const value of [
    null,
    undefined,
    "",
    "not-a-timestamp",
    "9/1",
    "2026-09-01",
    Number.NaN,
    1_789_522_965_624,
  ]) {
    assert.equal(classifySeptemberChat(value), SeptemberChatClassification.UNKNOWN);
  }
});

test("order tracker observes the September boundary but does not early-stop without cursor exhaustion", () => {
  const tracker = new SeptemberChatListOrderTracker();
  assert.equal(tracker.observePage(page([
    chat("1", "2026-09-23T10:00:00+07:00"),
    chat("2", "2026-09-10T10:00:00+07:00"),
  ])), false);
  assert.equal(tracker.observePage(page([
    chat("3", "2026-09-01T00:00:00+07:00"),
    chat("4", "2026-08-31T23:59:59+07:00"),
  ])), false);
  assert.deepEqual(tracker.snapshot(), {
    pagesObserved: 2,
    invalidUserRecords: 0,
    unknownTimestampObserved: false,
    noLatestEventObserved: 0,
    malformedTimestampObserved: 0,
    reachedBeforeSeptember: true,
    orderingAnomaly: false,
    duplicateConflict: false,
    earlyStopCandidateReached: true,
  });

  const report = buildSeptemberChatInventoryReport({
    storeCode: "28375",
    discovery: discovery([
      chat("1", "2026-09-23T10:00:00+07:00"),
      chat("2", "2026-09-10T10:00:00+07:00"),
      chat("3", "2026-09-01T00:00:00+07:00"),
      chat("4", "2026-08-31T23:59:59+07:00"),
    ], {
      pagesFetched: 2,
      enumerationStatus: "PARTIAL",
      nextTerminationObserved: false,
      enumerationError: "Chat-list page limit reached.",
    }),
    order: tracker.snapshot(),
    historicalStates: [],
  });
  assert.equal(report.inventoryComplete, false);
  assert.equal(report.septemberChats, null);
  assert.equal(report.septemberChatsObserved, 3);
  assert.equal(report.beforeSeptemberObserved, 1);
  assert.equal(report.inventoryIncompleteReason, "CHAT_LIST_DISCOVERY_INCOMPLETE");
});

test("discovery cap before the September boundary leaves inventory incomplete", () => {
  const tracker = new SeptemberChatListOrderTracker();
  tracker.observePage(page([chat("1", "2026-09-10T10:00:00+07:00")]));
  const report = buildSeptemberChatInventoryReport({
    storeCode: "29113",
    discovery: discovery([chat("1", "2026-09-10T10:00:00+07:00")], {
      pagesFetched: 200,
      enumerationStatus: "PARTIAL",
      nextTerminationObserved: false,
      enumerationError: "Chat-list page limit reached.",
    }),
    order: tracker.snapshot(),
    historicalStates: [],
  });
  assert.equal(report.inventoryComplete, false);
  assert.equal(report.inventoryIncompleteReason, "DISCOVERY_BOUND_REACHED_BEFORE_SEPTEMBER_BOUNDARY");
  assert.equal(report.septemberChats, null);
  assert.equal(report.septemberChatsObserved, 1);
  assert.equal(report.historicalCheckedRate, null);
  assert.equal(report.fastPathCompleteRate, null);
});

test("cursor exhaustion completes an all-September inventory without an older chat", () => {
  const tracker = new SeptemberChatListOrderTracker();
  tracker.observePage(page([
    chat("1", "2026-09-23T10:00:00+07:00"),
    chat("2", "2026-09-01T00:00:00+07:00"),
  ]));
  const report = buildSeptemberChatInventoryReport({
    storeCode: "25610",
    discovery: discovery([
      chat("1", "2026-09-23T10:00:00+07:00"),
      chat("2", "2026-09-01T00:00:00+07:00"),
    ]),
    order: tracker.snapshot(),
    historicalStates: [],
  });
  assert.equal(report.cursorExhausted, true);
  assert.equal(report.inventoryComplete, true);
  assert.equal(report.septemberChats, 2);
  assert.equal(report.historicalNotStarted, 2);
});

test("monotonic descending dates mark the boundary candidate without terminating enumeration", () => {
  const tracker = new SeptemberChatListOrderTracker();
  tracker.observePage(page([chat("1", "2026-09-02T00:00:00+07:00")]));
  assert.equal(tracker.observePage(page([chat("2", "2026-08-31T23:59:59+07:00")])), false);
  assert.equal(tracker.snapshot().orderingAnomaly, false);
  assert.equal(tracker.snapshot().earlyStopCandidateReached, true);
});

test("ordering anomaly prevents early stop and fails closed at the discovery bound", () => {
  const tracker = new SeptemberChatListOrderTracker();
  tracker.observePage(page([chat("1", "2026-09-10T10:00:00+07:00")]));
  assert.equal(tracker.observePage(page([chat("2", "2026-09-15T10:00:00+07:00")])), false);
  assert.equal(tracker.observePage(page([chat("3", "2026-08-31T23:59:59+07:00")])), false);
  const report = buildSeptemberChatInventoryReport({
    storeCode: "28375",
    discovery: discovery([
      chat("1", "2026-09-10T10:00:00+07:00"),
      chat("2", "2026-09-15T10:00:00+07:00"),
      chat("3", "2026-08-31T23:59:59+07:00"),
    ], {
      pagesFetched: 200,
      enumerationStatus: "PARTIAL",
      nextTerminationObserved: false,
      enumerationError: "Chat-list page limit reached.",
    }),
    order: tracker.snapshot(),
    historicalStates: [],
  });
  assert.equal(report.orderingAnomaly, true);
  assert.equal(report.inventoryComplete, false);
  assert.equal(report.inventoryIncompleteReason, "ORDERING_ANOMALY_AND_DISCOVERY_BOUND_REACHED");
});

test("unknown timestamp prevents early stop and a complete range claim", () => {
  const tracker = new SeptemberChatListOrderTracker();
  assert.equal(tracker.observePage(page([
    chat("1", "2026-09-10T00:00:00+07:00"),
    chat("2", null),
    chat("3", "2026-08-31T00:00:00+07:00"),
  ])), false);
  assert.equal(tracker.snapshot().unknownTimestampObserved, true);
  const report = buildSeptemberChatInventoryReport({
    storeCode: "29113",
    discovery: discovery([
      chat("1", "2026-09-10T00:00:00+07:00"),
      chat("2", null),
      chat("3", "2026-08-31T00:00:00+07:00"),
    ]),
    order: tracker.snapshot(),
    historicalStates: [],
  });
  assert.equal(report.inventoryComplete, false);
  assert.equal(report.unknownDateChats, 1);
  assert.equal(report.septemberChats, null);
  assert.equal(report.septemberChatsObserved, 1);
  assert.equal(report.inventoryIncompleteReason, "UNKNOWN_CHAT_LIST_TIMESTAMP");
});

test("USER rows with no latestEvent are excluded without making September membership unknown", () => {
  const tracker = new SeptemberChatListOrderTracker();
  const september = chat("1", "2026-09-10T00:00:00+07:00", "VALID_TIMESTAMP");
  const noEvent = chat("2", null, "NO_LATEST_EVENT");
  const august = chat("3", "2026-08-31T00:00:00+07:00", "VALID_TIMESTAMP");

  assert.equal(tracker.observePage(page([september, noEvent, august])), false);
  const snapshot = tracker.snapshot();
  assert.equal(snapshot.unknownTimestampObserved, false);
  assert.equal(snapshot.noLatestEventObserved, 1);
  assert.equal(snapshot.malformedTimestampObserved, 0);
  assert.equal(snapshot.orderingAnomaly, false);

  const report = buildSeptemberChatInventoryReport({
    storeCode: "25610",
    discovery: discovery([september, noEvent, august]),
    order: snapshot,
    historicalStates: [],
  });

  assert.equal(report.inventoryComplete, true);
  assert.equal(report.septemberChats, 1);
  assert.equal(report.noLatestEventChats, 1);
  assert.equal(report.malformedTimestampChats, 0);
  assert.equal(report.unknownDateChats, 1);
  assert.equal(report.inventoryIncompleteReason, null);
});

test("September membership stays independent when historical messages extend into August", () => {
  const septemberChat = chat("1", "2026-09-01T00:00:00+07:00");
  assert.equal(classifySeptemberChat(septemberChat.lastMessageAt), SeptemberChatClassification.SEPTEMBER);
  const coverage = summarizeSeptemberChatCoverage([septemberChat], [{
    lineChatUserId: septemberChat.chatUserId,
    historicalBackfillStatus: HistoricalBackfillStatus.FAST_PATH_COMPLETE,
  }]);
  assert.equal(coverage.fastPathComplete, 1);
  assert.equal(coverage.historicalChecked, 1);
});

test("September membership remains September when history reaches Sep 7 and backward exists", () => {
  const septemberChat = chat("2", "2026-09-23T10:00:00+07:00");
  assert.equal(classifySeptemberChat(septemberChat.lastMessageAt), SeptemberChatClassification.SEPTEMBER);
  const coverage = summarizeSeptemberChatCoverage([septemberChat], [{
    lineChatUserId: septemberChat.chatUserId,
    historicalBackfillStatus: HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION,
  }]);
  assert.equal(coverage.needsBackwardPagination, 1);
  assert.equal(coverage.fastPathComplete, 0);
});

test("August chat-list activity is excluded from historical worker candidate classification", () => {
  assert.equal(isSeptemberHistoricalChatCandidate("2026-08-31T23:59:59+07:00"), false);
  assert.equal(isSeptemberHistoricalChatCandidate("2026-09-01T00:00:00+07:00"), true);
  assert.equal(isSeptemberHistoricalChatCandidate("2026-10-01T00:00:00+07:00"), false);
});

test("coverage rates use only the September inventory denominator", () => {
  const septemberChats = [
    chat("1", "2026-09-20T00:00:00+07:00"),
    chat("2", "2026-09-10T00:00:00+07:00"),
    chat("3", "2026-09-01T00:00:00+07:00"),
    chat("4", "2026-09-05T00:00:00+07:00"),
  ];
  assert.equal(isSeptemberHistoricalChatCandidate("2026-08-31T23:59:59+07:00"), false);
  const coverage = summarizeSeptemberChatCoverage(septemberChats, [
    { lineChatUserId: septemberChats[0].chatUserId, historicalBackfillStatus: HistoricalBackfillStatus.FAST_PATH_COMPLETE },
    { lineChatUserId: septemberChats[1].chatUserId, historicalBackfillStatus: HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION },
    { lineChatUserId: septemberChats[2].chatUserId, historicalBackfillStatus: HistoricalBackfillStatus.FAILED },
  ]);
  assert.equal(coverage.historicalChecked, 3);
  assert.equal(coverage.fastPathComplete, 1);
  assert.equal(coverage.failed, 1);
  assert.equal(coverage.historicalNotStarted, 1);
  assert.equal(coverage.historicalCheckedRate, 3 / 4);
  assert.equal(coverage.fastPathCompleteRate, 1 / 4);
  assert.equal(
    coverage.historicalChecked,
    coverage.fastPathComplete
      + coverage.needsBackwardPagination
      + coverage.historicalCoverageUnproven
      + coverage.failed,
  );
});

test("NOT_STARTED, FETCHING, and unknown stored status occupy distinct safe buckets", () => {
  const chats = [chat("1", "2026-09-20T00:00:00+07:00"), chat("2", "2026-09-19T00:00:00+07:00"), chat("3", "2026-09-18T00:00:00+07:00")];
  const coverage = summarizeSeptemberChatCoverage(chats, [
    { lineChatUserId: chats[1].chatUserId, historicalBackfillStatus: HistoricalBackfillStatus.FETCHING_INITIAL_PAGE },
    { lineChatUserId: chats[2].chatUserId, historicalBackfillStatus: "UNRECOGNIZED_STATUS" },
  ]);
  assert.equal(coverage.historicalNotStarted, 1);
  assert.equal(coverage.fetchingInitialPage, 1);
  assert.equal(coverage.historicalCoverageUnproven, 1);
  assert.equal(coverage.historicalChecked, 1);
});

test("zero September chats produce zero rates without division errors", () => {
  const coverage = summarizeSeptemberChatCoverage([], []);
  assert.equal(coverage.historicalCheckedRate, 0);
  assert.equal(coverage.fastPathCompleteRate, 0);
});

test("sanitized A2 report contains counts and timestamps but no customer identifiers", () => {
  const customerId = `U${"a".repeat(32)}`;
  const report = buildSeptemberChatInventoryReport({
    storeCode: "29113",
    discovery: discovery([{
      chatUserId: customerId,
      displayName: "Private display name",
      lastMessageText: "Private message text",
      lastMessageAt: "2026-09-10T00:00:00+07:00",
      lastMessageDirection: "INBOUND",
    }]),
    order: new SeptemberChatListOrderTracker().snapshot(),
    historicalStates: [],
  });
  const safeText = formatSeptemberChatInventoryReport(report);
  assert.match(safeText, /septemberChats: 1/u);
  assert.match(safeText, /historicalChecked: 0/u);
  assert.match(safeText, /fastPathComplete: 0/u);
  assert.match(safeText, /needsBackwardPagination: 0/u);
  assert.match(safeText, /historicalCoverageUnproven: 0/u);
  assert.match(safeText, /historicalNotStarted: 1/u);
  assert.match(safeText, /fetchingInitialPage: 0/u);
  assert.match(safeText, /failed: 0/u);
  assert.doesNotMatch(JSON.stringify(report), new RegExp(customerId, "u"));
  assert.doesNotMatch(safeText, /Private display name|Private message text/u);
});
