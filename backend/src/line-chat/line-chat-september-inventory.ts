import {
  HistoricalBackfillStatus,
} from "./line-chat-historical-backfill";
import type {
  LineChatDiscoveredChat,
  LineChatDiscoveryPageObservation,
  LineChatDiscoveryResult,
} from "./line-chat.types";

export const SEPTEMBER_CHAT_LOWER_BOUND_ISO = "2026-09-01T00:00:00+07:00";
export const SEPTEMBER_CHAT_UPPER_BOUND_EXCLUSIVE_ISO = "2026-10-01T00:00:00+07:00";

const SEPTEMBER_CHAT_LOWER_BOUND_MS = Date.parse(SEPTEMBER_CHAT_LOWER_BOUND_ISO);
const SEPTEMBER_CHAT_UPPER_BOUND_EXCLUSIVE_MS = Date.parse(SEPTEMBER_CHAT_UPPER_BOUND_EXCLUSIVE_ISO);
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

export const SeptemberChatClassification = {
  SEPTEMBER: "SEPTEMBER",
  BEFORE_SEPTEMBER: "BEFORE_SEPTEMBER",
  AFTER_SEPTEMBER: "AFTER_SEPTEMBER",
  UNKNOWN: "UNKNOWN",
} as const;

export type SeptemberChatClassificationValue =
  typeof SeptemberChatClassification[keyof typeof SeptemberChatClassification];

export interface SeptemberChatHistoricalState {
  lineChatUserId: string;
  historicalBackfillStatus: string | null;
}

export interface SeptemberChatCoverageSummary {
  historicalChecked: number;
  fastPathComplete: number;
  needsBackwardPagination: number;
  historicalCoverageUnproven: number;
  failed: number;
  historicalNotStarted: number;
  fetchingInitialPage: number;
  historicalCheckedRate: number | null;
  fastPathCompleteRate: number | null;
}

export interface SeptemberChatInventoryReport extends SeptemberChatCoverageSummary {
  storeCode: string;
  targetResolutionSource: "EXISTING_OA" | "MANAGER_ACCOUNT_REDIRECT" | null;
  conversationsObserved: number;
  /** Exact total only when inventoryComplete; otherwise null. */
  septemberChats: number | null;
  septemberChatsObserved: number;
  beforeSeptemberObserved: number;
  afterSeptemberObserved: number;
  chatsWithValidTimestamp: number;
  chatsWithoutLatestEvent: number;
  chatsWithMissingTimestamp: number;
  chatsWithInvalidTimestamp: number;
  unknownDateChats: number;
  pagesFetched: number;
  pageLimitReached: boolean;
  chatLimitReached: boolean;
  timeLimitReached: boolean;
  newestChatListTimestamp: string | null;
  oldestChatListTimestamp: string | null;
  reachedBeforeSeptember: boolean;
  cursorExhausted: boolean;
  orderingValidated: boolean;
  orderingAnomaly: boolean;
  inventoryComplete: boolean;
  inventoryIncompleteReason: string | null;
}

export interface SeptemberChatListOrderSnapshot {
  pagesObserved: number;
  invalidUserRecords: number;
  unknownTimestampObserved: boolean;
  reachedBeforeSeptember: boolean;
  orderingAnomaly: boolean;
  duplicateConflict: boolean;
  safeEarlyStopReached: boolean;
}

type ChatTimestampStatus = NonNullable<LineChatDiscoveredChat["lastMessageTimestampStatus"]>;

function chatTimestampStatus(chat: LineChatDiscoveredChat): ChatTimestampStatus {
  const explicitStatus = chat.lastMessageTimestampStatus;
  const validTimestamp = timestampMilliseconds(chat.lastMessageAt) !== null;
  if (explicitStatus === "VALID") return validTimestamp ? "VALID" : "TIMESTAMP_INVALID";
  if (explicitStatus) {
    return chat.lastMessageAt === null ? explicitStatus : "TIMESTAMP_INVALID";
  }
  if (validTimestamp) return "VALID";
  // Legacy hand-built callers with a null timestamp cannot prove why it is null.
  return "TIMESTAMP_INVALID";
}

function timestampMilliseconds(value: unknown): number | null {
  if (value instanceof Date) {
    const milliseconds = value.getTime();
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value.trim())) return null;
  const milliseconds = Date.parse(value.trim());
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

export function classifySeptemberChat(lastMessageAt: unknown): SeptemberChatClassificationValue {
  const milliseconds = timestampMilliseconds(lastMessageAt);
  if (milliseconds === null) return SeptemberChatClassification.UNKNOWN;
  if (milliseconds < SEPTEMBER_CHAT_LOWER_BOUND_MS) {
    return SeptemberChatClassification.BEFORE_SEPTEMBER;
  }
  if (milliseconds >= SEPTEMBER_CHAT_UPPER_BOUND_EXCLUSIVE_MS) {
    return SeptemberChatClassification.AFTER_SEPTEMBER;
  }
  return SeptemberChatClassification.SEPTEMBER;
}

export function isSeptemberHistoricalChatCandidate(lastMessageAt: unknown): boolean {
  return classifySeptemberChat(lastMessageAt) === SeptemberChatClassification.SEPTEMBER;
}

/**
 * Tracks chat-list timestamp order as pages arrive. The observer sees only
 * parsed chat metadata; the raw opaque `next` cursor is never passed through.
 */
export class SeptemberChatListOrderTracker {
  private previousTimestampMs: number | null = null;
  private readonly chatsById = new Map<string, Pick<LineChatDiscoveredChat,
    "displayName" | "lastMessageAt" | "lastMessageTimestampStatus">>();
  private state: SeptemberChatListOrderSnapshot = {
    pagesObserved: 0,
    invalidUserRecords: 0,
    unknownTimestampObserved: false,
    reachedBeforeSeptember: false,
    orderingAnomaly: false,
    duplicateConflict: false,
    safeEarlyStopReached: false,
  };

  public observePage = (page: LineChatDiscoveryPageObservation): boolean => {
    this.state.pagesObserved += 1;
    this.state.invalidUserRecords += page.invalidUserRecords;

    for (const chat of page.chats) {
      const previousChat = this.chatsById.get(chat.chatUserId);
      if (!previousChat) {
        this.chatsById.set(chat.chatUserId, {
          displayName: chat.displayName,
          lastMessageAt: chat.lastMessageAt,
          lastMessageTimestampStatus: chat.lastMessageTimestampStatus,
        });
      } else if (
        previousChat.displayName !== chat.displayName
        || previousChat.lastMessageAt !== chat.lastMessageAt
        || previousChat.lastMessageTimestampStatus !== chat.lastMessageTimestampStatus
      ) {
        this.state.duplicateConflict = true;
      }

      const status = chatTimestampStatus(chat);
      if (status === "NO_LATEST_EVENT") continue;
      if (status !== "VALID") {
        this.state.unknownTimestampObserved = true;
        continue;
      }
      const milliseconds = timestampMilliseconds(chat.lastMessageAt);
      if (milliseconds === null) {
        this.state.unknownTimestampObserved = true;
        continue;
      }

      if (this.previousTimestampMs !== null && milliseconds > this.previousTimestampMs) {
        this.state.orderingAnomaly = true;
      }
      this.previousTimestampMs = milliseconds;
      if (milliseconds < SEPTEMBER_CHAT_LOWER_BOUND_MS) {
        this.state.reachedBeforeSeptember = true;
      }
    }

    const safeToStop = this.state.reachedBeforeSeptember
      && !this.state.orderingAnomaly
      && !this.state.unknownTimestampObserved
      && this.state.invalidUserRecords === 0
      && !this.state.duplicateConflict;
    if (safeToStop) this.state.safeEarlyStopReached = true;
    return safeToStop;
  };

  public snapshot(): SeptemberChatListOrderSnapshot {
    return { ...this.state };
  }
}

export function summarizeSeptemberChatCoverage(
  septemberChats: readonly Pick<LineChatDiscoveredChat, "chatUserId">[],
  historicalStates: readonly SeptemberChatHistoricalState[],
): SeptemberChatCoverageSummary {
  const stateByChatId = new Map(
    historicalStates.map((state) => [state.lineChatUserId, state.historicalBackfillStatus]),
  );
  let fastPathComplete = 0;
  let needsBackwardPagination = 0;
  let historicalCoverageUnproven = 0;
  let failed = 0;
  let historicalNotStarted = 0;
  let fetchingInitialPage = 0;

  for (const chat of septemberChats) {
    const status = stateByChatId.get(chat.chatUserId) ?? null;
    switch (status) {
      case HistoricalBackfillStatus.FAST_PATH_COMPLETE:
        fastPathComplete += 1;
        break;
      case HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION:
        needsBackwardPagination += 1;
        break;
      case HistoricalBackfillStatus.HISTORICAL_COVERAGE_UNPROVEN:
        historicalCoverageUnproven += 1;
        break;
      case HistoricalBackfillStatus.FAILED:
        failed += 1;
        break;
      case HistoricalBackfillStatus.FETCHING_INITIAL_PAGE:
        fetchingInitialPage += 1;
        break;
      case null:
        historicalNotStarted += 1;
        break;
      default:
        // Unknown persisted status strings cannot prove historical coverage.
        historicalCoverageUnproven += 1;
        break;
    }
  }

  const historicalChecked = fastPathComplete
    + needsBackwardPagination
    + historicalCoverageUnproven
    + failed;
  const denominator = septemberChats.length;
  return {
    historicalChecked,
    fastPathComplete,
    needsBackwardPagination,
    historicalCoverageUnproven,
    failed,
    historicalNotStarted,
    fetchingInitialPage,
    historicalCheckedRate: denominator > 0 ? historicalChecked / denominator : 0,
    fastPathCompleteRate: denominator > 0 ? fastPathComplete / denominator : 0,
  };
}

export function buildSeptemberChatInventoryReport(input: {
  storeCode: string;
  discovery: Pick<LineChatDiscoveryResult,
    | "chats"
    | "pagesFetched"
    | "enumerationStatus"
    | "invalidUserRecords"
    | "conflictingDuplicates"
    | "nextTerminationObserved"
    | "enumerationError"
    | "stoppedEarlyByObserver"
    | "pageLimitReached"
    | "chatLimitReached"
    | "timeLimitReached"
  >;
  order: SeptemberChatListOrderSnapshot;
  historicalStates: readonly SeptemberChatHistoricalState[];
}): SeptemberChatInventoryReport {
  const uniqueChats = [...new Map(input.discovery.chats.map((chat) => [chat.chatUserId, chat])).values()];
  const classifications = uniqueChats.map((chat) => ({
    chat,
    status: chatTimestampStatus(chat),
    classification: classifySeptemberChat(chat.lastMessageAt),
  }));
  const septemberChats = classifications
    .filter((entry) => entry.classification === SeptemberChatClassification.SEPTEMBER)
    .map((entry) => entry.chat);
  const beforeSeptemberObserved = classifications
    .filter((entry) => entry.classification === SeptemberChatClassification.BEFORE_SEPTEMBER)
    .length;
  const afterSeptemberObserved = classifications
    .filter((entry) => entry.classification === SeptemberChatClassification.AFTER_SEPTEMBER)
    .length;
  const chatsWithoutLatestEvent = classifications.filter((entry) => entry.status === "NO_LATEST_EVENT").length;
  const chatsWithMissingTimestamp = classifications.filter((entry) => entry.status === "TIMESTAMP_MISSING").length;
  const chatsWithInvalidTimestamp = classifications.filter((entry) => entry.status === "TIMESTAMP_INVALID").length;
  const chatsWithValidTimestamp = classifications.filter((entry) => entry.status === "VALID").length;
  const unknownDateChats = chatsWithMissingTimestamp + chatsWithInvalidTimestamp;
  const timestamps = classifications
    .filter((entry) => entry.status === "VALID")
    .map((entry) => timestampMilliseconds(entry.chat.lastMessageAt))
    .filter((timestamp): timestamp is number => timestamp !== null);
  const orderingValidated = input.order.pagesObserved > 0
    && unknownDateChats === 0
    && !input.order.unknownTimestampObserved
    && input.discovery.invalidUserRecords === 0
    && !input.order.orderingAnomaly;
  const cursorExhausted = input.discovery.nextTerminationObserved;
  const noUnknownMembership = unknownDateChats === 0
    && !input.order.unknownTimestampObserved
    && input.order.invalidUserRecords === 0;
  const noConflicts = input.discovery.conflictingDuplicates === 0 && !input.order.duplicateConflict;
  const completeBySafeEarlyStop = input.discovery.stoppedEarlyByObserver === true
    && input.order.safeEarlyStopReached
    && !input.order.orderingAnomaly
    && !input.discovery.enumerationError
    && noUnknownMembership
    && noConflicts;
  const completeByCursorExhaustion = cursorExhausted
    && input.discovery.enumerationStatus === "COMPLETE"
    && noUnknownMembership
    && noConflicts;
  const inventoryComplete = completeBySafeEarlyStop || completeByCursorExhaustion;

  let inventoryIncompleteReason: string | null = null;
  if (!inventoryComplete) {
    const boundReached = input.discovery.pageLimitReached === true
      || input.discovery.chatLimitReached === true
      || input.discovery.timeLimitReached === true
      || /(?:page|discovered-chat|time) limit reached/iu.test(input.discovery.enumerationError ?? "");
    if (unknownDateChats > 0 || input.order.unknownTimestampObserved) {
      inventoryIncompleteReason = chatsWithMissingTimestamp > 0
        ? "LATEST_EVENT_TIMESTAMP_MISSING"
        : "LATEST_EVENT_TIMESTAMP_INVALID";
    } else if (!noConflicts || input.discovery.invalidUserRecords > 0 || input.order.invalidUserRecords > 0) {
      inventoryIncompleteReason = "INVALID_OR_CONFLICTING_CHAT_LIST_RECORD";
    } else if (boundReached && beforeSeptemberObserved === 0) {
      inventoryIncompleteReason = input.discovery.timeLimitReached
        ? "DISCOVERY_TIME_LIMIT_REACHED_BEFORE_SEPTEMBER_BOUNDARY"
        : "DISCOVERY_BOUND_REACHED_BEFORE_SEPTEMBER_BOUNDARY";
    } else if (boundReached && input.order.orderingAnomaly) {
      inventoryIncompleteReason = "ORDERING_ANOMALY_AND_DISCOVERY_BOUND_REACHED";
    } else if (input.discovery.timeLimitReached) {
      inventoryIncompleteReason = "DISCOVERY_TIME_LIMIT_REACHED";
    } else if (input.order.orderingAnomaly && !cursorExhausted) {
      inventoryIncompleteReason = "ORDERING_ANOMALY_WITHOUT_CURSOR_EXHAUSTION";
    } else {
      inventoryIncompleteReason = "CHAT_LIST_DISCOVERY_INCOMPLETE";
    }
  }

  const coverage = summarizeSeptemberChatCoverage(septemberChats, input.historicalStates);
  return {
    storeCode: input.storeCode,
    targetResolutionSource: null,
    conversationsObserved: uniqueChats.length,
    septemberChats: inventoryComplete ? septemberChats.length : null,
    septemberChatsObserved: septemberChats.length,
    beforeSeptemberObserved,
    afterSeptemberObserved,
    chatsWithValidTimestamp,
    chatsWithoutLatestEvent,
    chatsWithMissingTimestamp,
    chatsWithInvalidTimestamp,
    unknownDateChats,
    pagesFetched: input.discovery.pagesFetched,
    pageLimitReached: input.discovery.pageLimitReached ?? false,
    chatLimitReached: input.discovery.chatLimitReached ?? false,
    timeLimitReached: input.discovery.timeLimitReached ?? false,
    newestChatListTimestamp: timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null,
    oldestChatListTimestamp: timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null,
    reachedBeforeSeptember: beforeSeptemberObserved > 0,
    cursorExhausted,
    orderingValidated,
    orderingAnomaly: input.order.orderingAnomaly,
    inventoryComplete,
    inventoryIncompleteReason,
    ...coverage,
    historicalCheckedRate: inventoryComplete ? coverage.historicalCheckedRate : null,
    fastPathCompleteRate: inventoryComplete ? coverage.fastPathCompleteRate : null,
  };
}

export function emptySeptemberChatInventoryReport(
  storeCode: string,
  inventoryIncompleteReason: string,
): SeptemberChatInventoryReport {
  return {
    storeCode,
    targetResolutionSource: null,
    conversationsObserved: 0,
    septemberChats: null,
    septemberChatsObserved: 0,
    beforeSeptemberObserved: 0,
    afterSeptemberObserved: 0,
    chatsWithValidTimestamp: 0,
    chatsWithoutLatestEvent: 0,
    chatsWithMissingTimestamp: 0,
    chatsWithInvalidTimestamp: 0,
    unknownDateChats: 0,
    pagesFetched: 0,
    pageLimitReached: false,
    chatLimitReached: false,
    timeLimitReached: false,
    newestChatListTimestamp: null,
    oldestChatListTimestamp: null,
    reachedBeforeSeptember: false,
    cursorExhausted: false,
    orderingValidated: false,
    orderingAnomaly: false,
    inventoryComplete: false,
    inventoryIncompleteReason,
    historicalChecked: 0,
    fastPathComplete: 0,
    needsBackwardPagination: 0,
    historicalCoverageUnproven: 0,
    failed: 0,
    historicalNotStarted: 0,
    fetchingInitialPage: 0,
    historicalCheckedRate: null,
    fastPathCompleteRate: null,
  };
}

export function formatSeptemberChatInventoryReport(report: SeptemberChatInventoryReport): string {
  return [
    `Store: ${report.storeCode}`,
    `Target resolution source: ${report.targetResolutionSource ?? "unresolved"}`,
    `September inventory complete: ${report.inventoryComplete ? "YES" : "NO"}`,
    `septemberChats: ${report.septemberChats ?? `unknown (at least ${report.septemberChatsObserved} observed)`}`,
    `chatsWithValidTimestamp: ${report.chatsWithValidTimestamp}`,
    `chatsWithoutLatestEvent: ${report.chatsWithoutLatestEvent}`,
    `chatsWithMissingTimestamp: ${report.chatsWithMissingTimestamp}`,
    `chatsWithInvalidTimestamp: ${report.chatsWithInvalidTimestamp}`,
    `pageLimitReached: ${report.pageLimitReached}`,
    `chatLimitReached: ${report.chatLimitReached}`,
    `timeLimitReached: ${report.timeLimitReached}`,
    `historicalChecked: ${report.historicalChecked}`,
    `fastPathComplete: ${report.fastPathComplete}`,
    `needsBackwardPagination: ${report.needsBackwardPagination}`,
    `historicalCoverageUnproven: ${report.historicalCoverageUnproven}`,
    `failed: ${report.failed}`,
    `fetchingInitialPage: ${report.fetchingInitialPage}`,
    `historicalNotStarted: ${report.historicalNotStarted}`,
    `historicalCheckedRate: ${report.historicalCheckedRate === null ? "unknown (incomplete inventory)" : `${(report.historicalCheckedRate * 100).toFixed(2)}%`}`,
    `fastPathCompleteRate: ${report.fastPathCompleteRate === null ? "unknown (incomplete inventory)" : `${(report.fastPathCompleteRate * 100).toFixed(2)}%`}`,
    ...(report.inventoryIncompleteReason ? [`Incomplete reason: ${report.inventoryIncompleteReason}`] : []),
  ].join("\n");
}
