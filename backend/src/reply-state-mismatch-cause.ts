import {
  buildDeterministicResponseCycles,
  normalizeCanonicalReplyMessage,
  normalizeHistoricalReplyMessage,
  normalizeReplyTimeline,
  resolveReplyState,
  type CanonicalReplyMessage,
  type HistoricalReplyMessage,
  type ReplyState,
} from "./reply-state-resolver";

export type StoredReplyStatus = "REPLIED" | "NOT_REPLIED" | "NOTIFIED_BM";

export type ReplyStateMismatchPrimaryCause =
  | "MATCH"
  | "AMBIGUOUS"
  | "STORED_REPLIED_REOPENED_AFTER_VALID_REPLY"
  | "STORED_REPLIED_NEVER_VALIDLY_REPLIED"
  | "STORED_NOT_REPLIED_VALID_REPLY_EXISTS"
  | "STORED_NOTIFIED_BM_RESOLVED_REPLIED"
  | "STORED_NOTIFIED_BM_RESOLVED_NOT_REPLIED";

export type HistoricalReplyStateEffect =
  | "NO_HISTORICAL_EVIDENCE"
  | "NO_STATE_CHANGE"
  | "RESOLVED_CANONICAL_AMBIGUITY"
  | "CHANGED_FINAL_STATE"
  | "COMBINED_BECAME_AMBIGUOUS";

export type ReplyStateMismatchAnalysis = {
  storedStatus: StoredReplyStatus;
  canonicalState: ReplyState;
  resolvedState: ReplyState;
  mismatch: boolean;
  primaryCause: ReplyStateMismatchPrimaryCause;
  historicalEffect: HistoricalReplyStateEffect;
  answeredCycleCount: number;
  openCycleStartedAt: Date | null;
  automatedOutboundAfterOpen: boolean;
  failedOrPendingCanonicalOutboundAfterOpen: boolean;
  unknownOutboundAfterOpen: boolean;
};

function primaryCause(
  storedStatus: StoredReplyStatus,
  resolvedState: ReplyState,
  answeredCycleCount: number,
): ReplyStateMismatchPrimaryCause {
  if (resolvedState === "AMBIGUOUS") return "AMBIGUOUS";
  if (storedStatus === resolvedState) return "MATCH";

  if (storedStatus === "REPLIED" && resolvedState === "NOT_REPLIED") {
    return answeredCycleCount > 0
      ? "STORED_REPLIED_REOPENED_AFTER_VALID_REPLY"
      : "STORED_REPLIED_NEVER_VALIDLY_REPLIED";
  }

  if (storedStatus === "NOT_REPLIED" && resolvedState === "REPLIED") {
    return "STORED_NOT_REPLIED_VALID_REPLY_EXISTS";
  }

  if (storedStatus === "NOTIFIED_BM" && resolvedState === "REPLIED") {
    return "STORED_NOTIFIED_BM_RESOLVED_REPLIED";
  }

  if (storedStatus === "NOTIFIED_BM" && resolvedState === "NOT_REPLIED") {
    return "STORED_NOTIFIED_BM_RESOLVED_NOT_REPLIED";
  }

  return "AMBIGUOUS";
}

function historicalEffect(
  historicalCount: number,
  canonicalState: ReplyState,
  resolvedState: ReplyState,
): HistoricalReplyStateEffect {
  if (historicalCount === 0) return "NO_HISTORICAL_EVIDENCE";
  if (canonicalState === resolvedState) return "NO_STATE_CHANGE";
  if (canonicalState === "AMBIGUOUS" && resolvedState !== "AMBIGUOUS") {
    return "RESOLVED_CANONICAL_AMBIGUITY";
  }
  if (canonicalState !== "AMBIGUOUS" && resolvedState === "AMBIGUOUS") {
    return "COMBINED_BECAME_AMBIGUOUS";
  }
  return "CHANGED_FINAL_STATE";
}

export function analyzeReplyStateMismatch(input: {
  storedStatus: StoredReplyStatus;
  canonical: readonly CanonicalReplyMessage[];
  historical: readonly HistoricalReplyMessage[];
}): ReplyStateMismatchAnalysis {
  const canonicalEvents = input.canonical.map(normalizeCanonicalReplyMessage);
  const historicalEvents = input.historical.map(normalizeHistoricalReplyMessage);
  const combinedEvents = normalizeReplyTimeline({
    canonical: input.canonical,
    historical: input.historical,
  });

  const canonicalResolution = resolveReplyState(canonicalEvents);
  const combinedResolution = resolveReplyState(combinedEvents);
  const cycles = buildDeterministicResponseCycles(combinedEvents);
  const deterministicCycles = cycles.status === "DETERMINISTIC" ? cycles.cycles : [];
  const answeredCycleCount = deterministicCycles.filter((cycle) => cycle.answeredAt !== null).length;
  const latestCycle = deterministicCycles.at(-1) ?? null;
  const openCycleStartedAt = latestCycle?.answeredAt === null ? latestCycle.startedAt : null;

  const canonicalAfterOpen = openCycleStartedAt
    ? input.canonical.filter((message) => message.sentAt.getTime() >= openCycleStartedAt.getTime())
    : [];
  const historicalAfterOpen = openCycleStartedAt
    ? historicalEvents.filter((event) => event.sentAt.getTime() >= openCycleStartedAt.getTime())
    : [];

  const normalizedCanonicalAfterOpen = canonicalAfterOpen.map(normalizeCanonicalReplyMessage);
  const automatedOutboundAfterOpen = [
    ...normalizedCanonicalAfterOpen,
    ...historicalAfterOpen,
  ].some((event) => event.direction === "OUTBOUND" && event.actor === "AUTOMATED");

  const failedOrPendingCanonicalOutboundAfterOpen = canonicalAfterOpen.some(
    (message) =>
      message.direction === "OUTBOUND" &&
      (message.deliveryStatus === "FAILED" || message.deliveryStatus === "PENDING"),
  );

  const unknownOutboundAfterOpen = [
    ...normalizedCanonicalAfterOpen,
    ...historicalAfterOpen,
  ].some((event) => event.direction === "OUTBOUND" && event.actor === "UNKNOWN");

  return {
    storedStatus: input.storedStatus,
    canonicalState: canonicalResolution.state,
    resolvedState: combinedResolution.state,
    mismatch:
      combinedResolution.state !== "AMBIGUOUS" &&
      input.storedStatus !== combinedResolution.state,
    primaryCause: primaryCause(
      input.storedStatus,
      combinedResolution.state,
      answeredCycleCount,
    ),
    historicalEffect: historicalEffect(
      input.historical.length,
      canonicalResolution.state,
      combinedResolution.state,
    ),
    answeredCycleCount,
    openCycleStartedAt,
    automatedOutboundAfterOpen,
    failedOrPendingCanonicalOutboundAfterOpen,
    unknownOutboundAfterOpen,
  };
}
