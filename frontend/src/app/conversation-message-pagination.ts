import type { ConversationMessagesResponse } from "../types/api.ts";

/** Merge a newly fetched message page without dropping pages already shown. */
export function mergeConversationMessagePages(
  current: ConversationMessagesResponse | null,
  incoming: ConversationMessagesResponse,
): ConversationMessagesResponse {
  const byId = new Map<string, ConversationMessagesResponse["items"][number]>();

  for (const message of current?.items ?? []) byId.set(message.id, message);
  for (const message of incoming.items) byId.set(message.id, message);

  const items = [...byId.values()].sort((left, right) => {
    const timestampDifference = Date.parse(left.sentAt) - Date.parse(right.sentAt);
    if (Number.isFinite(timestampDifference) && timestampDifference !== 0) return timestampDifference;
    return left.id.localeCompare(right.id);
  });
  const total = incoming.total;

  return {
    ...incoming,
    items,
    page: Math.max(current?.page ?? 0, incoming.page),
    hasEarlier: total > items.length,
  };
}
