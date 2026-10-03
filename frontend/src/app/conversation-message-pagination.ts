import type { ConversationMessagesResponse } from "../types/api.ts";

export interface ScopedConversationMessagePage {
  scopeKey: string;
  response: ConversationMessagesResponse;
}

export function emptyConversationMessagePage(pageSize = 30): ConversationMessagesResponse {
  return { items: [], total: 0, page: 1, pageSize, hasEarlier: false };
}

export function resetScopedConversationMessagePage(
  scopeKey: string,
  pageSize = 30,
): ScopedConversationMessagePage {
  return { scopeKey, response: emptyConversationMessagePage(pageSize) };
}

export function conversationMessagePageForScope(
  current: ScopedConversationMessagePage,
  activeScopeKey: string,
  pageSize = 30,
): ConversationMessagesResponse {
  return current.scopeKey === activeScopeKey
    ? current.response
    : emptyConversationMessagePage(pageSize);
}

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

/** Ignore responses from a conversation/store/OA scope that is no longer active. */
export function mergeScopedConversationMessagePage(
  current: ScopedConversationMessagePage,
  scopeKey: string,
  incoming: ConversationMessagesResponse,
  activeScopeKey = scopeKey,
): ScopedConversationMessagePage {
  if (current.scopeKey !== scopeKey || activeScopeKey !== scopeKey) return current;
  return { scopeKey, response: mergeConversationMessagePages(current.response, incoming) };
}

export function replaceScopedConversationMessagePage(
  current: ScopedConversationMessagePage,
  scopeKey: string,
  incoming: ConversationMessagesResponse,
  activeScopeKey = scopeKey,
): ScopedConversationMessagePage {
  if (activeScopeKey !== scopeKey) return current;
  return { scopeKey, response: incoming };
}

export function updateScopedConversationMessagePage(
  current: ScopedConversationMessagePage,
  scopeKey: string,
  update: (response: ConversationMessagesResponse) => ConversationMessagesResponse,
  activeScopeKey = scopeKey,
): ScopedConversationMessagePage {
  if (current.scopeKey !== scopeKey || activeScopeKey !== scopeKey) return current;
  return { scopeKey, response: update(current.response) };
}
