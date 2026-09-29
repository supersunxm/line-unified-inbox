import type { NormalizedReplyEvent, ReplyState } from "./reply-state-resolver";

export type ReplyEvidenceWindow = {
  boundary: Date;
  firstRelevantMessageAt: Date | null;
  latestRelevantMessageAt: Date | null;
  latestCustomerInboundAt: Date | null;
  latestHumanStaffReplyAt: Date | null;
  hasRelevantMessageBeforeBoundary: boolean;
  hasRelevantMessageOnOrAfterBoundary: boolean;
  latestCustomerInboundOnOrAfterBoundary: boolean;
  latestHumanStaffReplyOnOrAfterBoundary: boolean;
};

function maxDate(values: Date[]): Date | null {
  if (values.length === 0) return null;
  return new Date(Math.max(...values.map((value) => value.getTime())));
}

function minDate(values: Date[]): Date | null {
  if (values.length === 0) return null;
  return new Date(Math.min(...values.map((value) => value.getTime())));
}

export function analyzeReplyEvidenceWindow(
  events: readonly NormalizedReplyEvent[],
  boundary: Date,
): ReplyEvidenceWindow {
  const relevant = events.filter(
    (event) =>
      event.eventKind === "MESSAGE" &&
      event.direction !== "SYSTEM",
  );

  const relevantTimes = relevant.map((event) => event.sentAt);
  const customerTimes = relevant
    .filter((event) => event.direction === "INBOUND")
    .map((event) => event.sentAt);
  const humanReplyTimes = relevant
    .filter(
      (event) =>
        event.direction === "OUTBOUND" &&
        event.actor === "HUMAN_STAFF",
    )
    .map((event) => event.sentAt);

  const latestCustomerInboundAt = maxDate(customerTimes);
  const latestHumanStaffReplyAt = maxDate(humanReplyTimes);

  return {
    boundary,
    firstRelevantMessageAt: minDate(relevantTimes),
    latestRelevantMessageAt: maxDate(relevantTimes),
    latestCustomerInboundAt,
    latestHumanStaffReplyAt,
    hasRelevantMessageBeforeBoundary: relevant.some(
      (event) => event.sentAt.getTime() < boundary.getTime(),
    ),
    hasRelevantMessageOnOrAfterBoundary: relevant.some(
      (event) => event.sentAt.getTime() >= boundary.getTime(),
    ),
    latestCustomerInboundOnOrAfterBoundary: Boolean(
      latestCustomerInboundAt &&
      latestCustomerInboundAt.getTime() >= boundary.getTime(),
    ),
    latestHumanStaffReplyOnOrAfterBoundary: Boolean(
      latestHumanStaffReplyAt &&
      latestHumanStaffReplyAt.getTime() >= boundary.getTime(),
    ),
  };
}


export type ReplyProjectionEligibility =
  | {
      eligible: true;
      state: "REPLIED" | "NOT_REPLIED";
      decidingEventKind: "CUSTOMER_INBOUND" | "HUMAN_STAFF_REPLY";
      decidingEventAt: Date;
      reason: "DECIDING_EVENT_ON_OR_AFTER_BOUNDARY";
    }
  | {
      eligible: false;
      reason: "AMBIGUOUS" | "PRE_BOUNDARY_DECIDING_EVENT" | "NO_DECIDING_EVENT";
    };

export function classifyReplyProjectionEligibility(
  resolvedState: ReplyState,
  window: ReplyEvidenceWindow,
): ReplyProjectionEligibility {
  if (resolvedState === "AMBIGUOUS") {
    return { eligible: false, reason: "AMBIGUOUS" };
  }

  if (resolvedState === "NOT_REPLIED") {
    if (!window.latestCustomerInboundAt) {
      return { eligible: false, reason: "NO_DECIDING_EVENT" };
    }
    if (!window.latestCustomerInboundOnOrAfterBoundary) {
      return { eligible: false, reason: "PRE_BOUNDARY_DECIDING_EVENT" };
    }
    return {
      eligible: true,
      state: "NOT_REPLIED",
      decidingEventKind: "CUSTOMER_INBOUND",
      decidingEventAt: window.latestCustomerInboundAt,
      reason: "DECIDING_EVENT_ON_OR_AFTER_BOUNDARY",
    };
  }

  if (!window.latestHumanStaffReplyAt) {
    return { eligible: false, reason: "NO_DECIDING_EVENT" };
  }
  if (!window.latestHumanStaffReplyOnOrAfterBoundary) {
    return { eligible: false, reason: "PRE_BOUNDARY_DECIDING_EVENT" };
  }
  return {
    eligible: true,
    state: "REPLIED",
    decidingEventKind: "HUMAN_STAFF_REPLY",
    decidingEventAt: window.latestHumanStaffReplyAt,
    reason: "DECIDING_EVENT_ON_OR_AFTER_BOUNDARY",
  };
}
