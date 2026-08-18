import type { CalculatedPriority, PriorityContext, PriorityMessage, PriorityReasonCode } from "./priority.types";

const HOUR_SECONDS = 60 * 60;
const FOUR_HOURS = 4 * HOUR_SECONDS;
const TWELVE_HOURS = 12 * HOUR_SECONDS;
const DAY = 24 * HOUR_SECONDS;
const MAX_SCORE = 140;

function latestTimestamp(messages: PriorityMessage[], predicate: (message: PriorityMessage) => boolean): Date | null {
  return messages
    .filter(predicate)
    .reduce<Date | null>((latest, message) => !latest || message.sentAt > latest ? message.sentAt : latest, null);
}

function levelForScore(score: number): CalculatedPriority["level"] {
  if (score === 0) return "NONE";
  if (score >= 100) return "URGENT";
  if (score >= 70) return "HIGH";
  return "NORMAL";
}

export function calculatePriority(context: PriorityContext, now = new Date()): CalculatedPriority {
  const latestHumanOutbound = latestTimestamp(
    context.messages,
    (message) => message.direction === "OUTBOUND" && message.senderUserId !== null,
  );
  const unansweredInbound = context.messages.filter(
    (message) => message.direction === "INBOUND" && (!latestHumanOutbound || message.sentAt > latestHumanOutbound),
  );
  const waitingSince = latestTimestamp(unansweredInbound, () => true);

  if (!waitingSince) {
    return { score: 0, level: "NONE", waitingSeconds: 0, waitingSince: null, reasons: [] };
  }

  const waitingSeconds = Math.max(0, Math.floor((now.getTime() - waitingSince.getTime()) / 1000));
  const reasons: PriorityReasonCode[] = ["NEEDS_REPLY"];
  let score = 50;

  if (waitingSeconds > DAY) {
    score += 50;
    reasons.push("WAITING_OVER_24H");
  } else if (waitingSeconds >= TWELVE_HOURS) {
    score += 30;
    reasons.push("WAITING_12_TO_24H");
  } else if (waitingSeconds >= FOUR_HOURS) {
    score += 15;
    reasons.push("WAITING_4_TO_12H");
  }

  if (context.isInstallment) {
    score += 20;
    reasons.push("INSTALLMENT_CUSTOMER");
  }
  if (context.hasManualProductTag) {
    score += 10;
    reasons.push("MANUAL_PRODUCT_TAG");
  }
  if (unansweredInbound.length >= 2) {
    score += 10;
    reasons.push("MULTIPLE_UNANSWERED_INBOUND");
  }

  const boundedScore = Math.min(MAX_SCORE, score);
  return { score: boundedScore, level: levelForScore(boundedScore), waitingSeconds, waitingSince, reasons };
}
