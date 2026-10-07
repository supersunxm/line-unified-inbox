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

/**
 * One store's counts as Store Chats shows them for a month (bm-reply-status-summary row →
 * sidebar counts). v2's monthly views call this same function, so both agree by construction.
 */
export function chatsStoreCounts(store: {
  total: number;
  notReplied: number;
  notifiedBm: number;
  replied: number;
  oldestWaitingMinutes?: number | null;
}) {
  const effectiveCounts = effectiveSummaryCounts(store);
  return {
    total: store.total,
    notReplied: effectiveCounts.notReplied,
    notifiedBm: 0,
    replied: effectiveCounts.replied,
    oldestWaitingMinutes: store.oldestWaitingMinutes ?? 0,
  };
}
