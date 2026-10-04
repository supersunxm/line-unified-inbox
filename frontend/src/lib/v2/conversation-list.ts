// The chat view's middle pane: waiting chats first, then replied. Pure: node --test imports it.
// Reply state comes from the backend via getEffectiveReplyState (app/reply-state.ts).

import type { ApiConversation } from "@/types/api";
import { getEffectiveReplyState } from "../../app/reply-state.ts";
import { sortWaitingChats, toWaitingChat, type WaitingChat } from "./response-model.ts";

export type ConversationListItem =
  | { kind: "waiting"; id: string; storeId: string; storeName: string; customerName: string; chat: WaitingChat }
  | { kind: "replied"; id: string; storeId: string; storeName: string; customerName: string; latestMessageAt: string };

/**
 * Waiting chats first (longest business-hours wait first), then replied chats (latest first),
 * limited to `storeIds`. Waiting comes from the shared waiting set plus any NOT_REPLIED chat in `recent`.
 */
export function buildConversationList(waiting: WaitingChat[], recent: ApiConversation[], storeIds: ReadonlySet<string>, now: number): ConversationListItem[] {
  const waitingById = new Map(waiting.filter((chat) => storeIds.has(chat.storeId)).map((chat) => [chat.id, chat]));
  const replied: Array<Extract<ConversationListItem, { kind: "replied" }>> = [];
  for (const conversation of recent) {
    if (!storeIds.has(conversation.store.id)) continue;
    if (getEffectiveReplyState(conversation) === "NOT_REPLIED") {
      if (!waitingById.has(conversation.id)) waitingById.set(conversation.id, toWaitingChat(conversation, now));
    } else {
      replied.push({ kind: "replied", id: conversation.id, storeId: conversation.store.id, storeName: conversation.store.name, customerName: conversation.customer.displayName, latestMessageAt: conversation.latestMessageAt });
    }
  }
  replied.sort((a, b) => Date.parse(b.latestMessageAt) - Date.parse(a.latestMessageAt));
  const waitingItems: ConversationListItem[] = sortWaitingChats([...waitingById.values()]).map((chat) => ({ kind: "waiting", id: chat.id, storeId: chat.storeId, storeName: chat.storeName, customerName: chat.customerName, chat }));
  return [...waitingItems, ...replied];
}
