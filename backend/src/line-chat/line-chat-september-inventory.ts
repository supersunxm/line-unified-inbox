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
  conversationsObserved: number;
  /** Exact total only when inventoryComplete; otherwise null. */
  septemberChats: number | null;
  septemberChatsObserved: number;
  beforeSeptemberObserved: number;
  afterSeptemberObserved: number;
  /** USER records where LINE Manager supplied no latestEvent object. */
  noLatestEventChats: number;
  /** USER records whose latestEvent exists but has no usable timestamp. */
  malformedTimestampChats: number;
  /** Compatibility total: noLatestEventChats + malformedTimestampChats. */
  unknownDateChats: number;
  pagesFetched: number;
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
  noLatestEventObserved: number;
  malformedTimestampObserved: number;
  reachedBeforeSeptember: boolean;
  orderingAnomaly: boolean;
  duplicateConflict: boolean;
  /**
   * Diagnostic only. Production evidence showed the Manager chat list is not
   * globally monotonic, so this condition must never terminate enumeration.
   */
  earlyStopCandidateReached: boolean;
}

function chatTimestampState(chat: Pick<LineChatDiscoveredChat, "lastMessageAt" | "lastMessageAtState">):
  "VALID_TIMESTAMP" | "NO_LATEST_EVENT" | "MISSING_TIMESTAMP" | "INVALID_TIMESTAMP" {
  if (chat.lastMessageAtState) return chat.lastMessageAtState;
  return timestampMilliseconds(chat.lastMessageAt) === null
    ? "INVALID_TIMESTAMP"
    : "VALID_TIMESTAMP";
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
  private readonly chatsById = new Map<string, Pick<LineChatDiscoveredChat, "displayName" | "lastMessageAt" | "lastMessageAtState">>();
  private state: SeptemberChatListOrderSnapshot = {
    pagesObserved: 0,
    invalidUserRecords: 0,
    unknownTimestampObserved: false,
    noLatestEventObserved: 0,
    malformedTimestampObserved: 0,
    reachedBeforeSeptember: false,
    orderingAnomaly: false,
    duplicateConflict: false,
    earlyStopCandidateReached: false,
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
          lastMessageAtState: chat.lastMessageAtState,
        });
      } else if (
        previousChat.displayName !== chat.displayName
        || previousChat.lastMessageAt !== chat.lastMessageAt
        || previousChat.lastMessageAtState !== chat.lastMessageAtState
      ) {
        this.state.duplicateConflict = true;
      }

      const timestampState = chatTimestampState(chat);
      if (timestampState === "NO_LATEST_EVENT") {
        this.state.noLatestEventObserved += 1;
        continue;
      }

      const milliseconds = timestampMilliseconds(chat.lastMessageAt);
      if (timestampState !== "VALID_TIMESTAMP" || milliseconds === null) {
        this.state.unknownTimestampObserved = true;
        this.state.malformedTimestampObserved += 1;
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

    const earlyStopCandidate = this.state.reachedBeforeSeptember
      && !this.state.orderingAnomaly
      && !this.state.unknownTimestampObserved
      && this.state.invalidUserRecords === 0
      && !this.state.duplicateConflict;
    if (earlyStopCandidate) this.state.earlyStopCandidateReached = true;

    // Do not stop on the observed timestamp boundary. The first production
    // inventory proved that later chat-list pages can contain timestamp-order
    // anomalies, so only cursor exhaustion can establish the exact denominator.
    return false;
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
  >;
  order: SeptemberChatListOrderSnapshot;
  historicalStates: readonly SeptemberChatHistoricalState[];
}): SeptemberChatInventoryReport {
  const uniqueChats = [...new Map(input.discovery.chats.map((chat) => [chat.chatUserId, chat])).values()];
  const classifications = uniqueChats.map((chat) => ({
    chat,
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
  const unknownEntries = classifications
    .filter((entry) => entry.classification === SeptemberChatClassification.UNKNOWN);
  const noLatestEventChats = unknownEntries
    .filter((entry) => chatTimestampState(entry.chat) === "NO_LATEST_EVENT")
    .length;
  const malformedTimestampChats = unknownEntries.length - noLatestEventChats;
  const unknownDateChats = unknownEntries.length;
  const timestamps = classifications
    .map((entry) => timestampMilliseconds(entry.chat.lastMessageAt))
    .filter((timestamp): timestamp is number => timestamp !== null);
  const orderingValidated = input.order.pagesObserved > 0
    && malformedTimestampChats === 0
    && input.discovery.invalidUserRecords === 0
    && !input.order.orderingAnomaly;
  const cursorExhausted = input.discovery.nextTerminationObserved;
  // A USER record with no latestEvent has no dated Manager event to place in
  // the September window. It is therefore safely excluded from the September
  // candidate set. Missing/invalid timestamps on an existing latestEvent still
  // fail closed because September membership is unknowable.
  const noUnknownMembership = malformedTimestampChats === 0
    && input.order.malformedTimestampObserved === 0
    && input.order.invalidUserRecords === 0;
  const noConflicts = input.discovery.conflictingDuplicates === 0 && !input.order.duplicateConflict;
  const completeByCursorExhaustion = cursorExhausted
    && input.discovery.enumerationStatus === "COMPLETE"
    && noUnknownMembership
    && noConflicts;
  // Production chat-list ordering is not globally monotonic. Exact September
  // membership therefore requires enumerating until LINE returns terminal next.
  const inventoryComplete = completeByCursorExhaustion;

  let inventoryIncompleteReason: string | null = null;
  if (!inventoryComplete) {
    const boundReached = /(?:page|discovered-chat) limit reached/iu.test(input.discovery.enumerationError ?? "");
    if (malformedTimestampChats > 0 || input.order.unknownTimestampObserved) {
      inventoryIncompleteReason = "UNKNOWN_CHAT_LIST_TIMESTAMP";
    } else if (!noConflicts || input.discovery.invalidUserRecords > 0 || input.order.invalidUserRecords > 0) {
      inventoryIncompleteReason = "INVALID_OR_CONFLICTING_CHAT_LIST_RECORD";
    } else if (boundReached && beforeSeptemberObserved === 0) {
      inventoryIncompleteReason = "DISCOVERY_BOUND_REACHED_BEFORE_SEPTEMBER_BOUNDARY";
    } else if (boundReached && input.order.orderingAnomaly) {
      inventoryIncompleteReason = "ORDERING_ANOMALY_AND_DISCOVERY_BOUND_REACHED";
    } else if (input.order.orderingAnomaly && !cursorExhausted) {
      inventoryIncompleteReason = "ORDERING_ANOMALY_WITHOUT_CURSOR_EXHAUSTION";
    } else {
      inventoryIncompleteReason = "CHAT_LIST_DISCOVERY_INCOMPLETE";
    }
  }

  const coverage = summarizeSeptemberChatCoverage(septemberChats, input.historicalStates);
  return {
    storeCode: input.storeCode,
    conversationsObserved: uniqueChats.length,
    septemberChats: inventoryComplete ? septemberChats.length : null,
    septemberChatsObserved: septemberChats.length,
    beforeSeptemberObserved,
    afterSeptemberObserved,
    noLatestEventChats,
    malformedTimestampChats,
    unknownDateChats,
    pagesFetched: input.discovery.pagesFetched,
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
    conversationsObserved: 0,
    septemberChats: null,
    septemberChatsObserved: 0,
    beforeSeptemberObserved: 0,
    afterSeptemberObserved: 0,
    noLatestEventChats: 0,
    malformedTimestampChats: 0,
    unknownDateChats: 0,
    pagesFetched: 0,
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
    `September inventory complete: ${report.inventoryComplete ? "YES" : "NO"}`,
    `septemberChats: ${report.septemberChats ?? `unknown (at least ${report.septemberChatsObserved} observed)`}`,
    `noLatestEventChats: ${report.noLatestEventChats}`,
    `malformedTimestampChats: ${report.malformedTimestampChats}`,
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
