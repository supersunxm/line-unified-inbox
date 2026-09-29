import type { NormalizedReplyEvent } from "./reply-state-resolver";

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
