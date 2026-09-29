import {
  buildDeterministicResponseCycles,
  normalizeReplyTimeline,
  type CanonicalReplyMessage,
  type HistoricalReplyMessage,
  type ReplyStateAmbiguityReason,
} from "./reply-state-resolver";

export type ReplyCycleAnalyticsConversationInput = {
  conversationId: string;
  canonical?: readonly CanonicalReplyMessage[];
  historical?: readonly HistoricalReplyMessage[];
};

export type ReplyCycleAnalyticsCycle = {
  conversationId: string;
  startedAt: Date;
  answeredAt: Date | null;
  durationSeconds: number | null;
};

export type ReplyCycleAnalyticsResult = {
  cycles: ReplyCycleAnalyticsCycle[];
  evaluatedConversationCount: number;
  ambiguousConversationCount: number;
  ambiguityReasons: Partial<Record<ReplyStateAmbiguityReason, number>>;
};

export function buildReplyCycleAnalytics(
  conversations: readonly ReplyCycleAnalyticsConversationInput[],
): ReplyCycleAnalyticsResult {
  const cycles: ReplyCycleAnalyticsCycle[] = [];
  const ambiguityReasons: Partial<Record<ReplyStateAmbiguityReason, number>> = {};
  let ambiguousConversationCount = 0;

  for (const conversation of conversations) {
    const timeline = normalizeReplyTimeline({
      canonical: [...(conversation.canonical ?? [])],
      historical: [...(conversation.historical ?? [])],
    });
    const result = buildDeterministicResponseCycles(timeline);

    if (result.status === "AMBIGUOUS") {
      ambiguousConversationCount += 1;
      ambiguityReasons[result.reason] = (ambiguityReasons[result.reason] ?? 0) + 1;
      continue;
    }

    for (const cycle of result.cycles) {
      cycles.push({
        conversationId: conversation.conversationId,
        ...cycle,
      });
    }
  }

  cycles.sort(
    (left, right) =>
      left.startedAt.getTime() - right.startedAt.getTime() ||
      left.conversationId.localeCompare(right.conversationId),
  );

  return {
    cycles,
    evaluatedConversationCount: conversations.length,
    ambiguousConversationCount,
    ambiguityReasons,
  };
}
