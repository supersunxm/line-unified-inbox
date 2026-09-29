import type { ApiConversation, ApiEffectiveReplyState } from "@/types/api";

export function getEffectiveReplyState(
  conversation: Pick<ApiConversation, "bmReplyStatus" | "effectiveReplyState">,
): ApiEffectiveReplyState {
  if (conversation.effectiveReplyState === "REPLIED" || conversation.effectiveReplyState === "NOT_REPLIED") {
    return conversation.effectiveReplyState;
  }
  return conversation.bmReplyStatus === "REPLIED" ? "REPLIED" : "NOT_REPLIED";
}

export function effectiveSummaryCounts(summary: {
  notReplied: number;
  notifiedBm: number;
  replied: number;
}) {
  return {
    notReplied: summary.notReplied + summary.notifiedBm,
    replied: summary.replied,
    total: summary.notReplied + summary.notifiedBm + summary.replied,
  };
}
