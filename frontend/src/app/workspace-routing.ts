export type ChatRouteFilters = {
  store?: string;
  status?: string;
  bmReplyStatus?: string;
  replyState?: string;
  priority?: string;
  model?: string;
  topic?: string;
  lineOaId?: string;
  conversationId?: string;
};

export type ConversationRouteLookupStatus = "pending" | "resolved" | "failed";

/** A proven route destination can be outside the current paginated list. */
export function resolveSelectedConversationState<T>(input: {
  selectedConversationId: string;
  listedStates: Readonly<Record<string, T>>;
  routeConversationId?: string;
  routeState?: T;
}): T | undefined {
  return input.listedStates[input.selectedConversationId]
    ?? (input.routeConversationId === input.selectedConversationId ? input.routeState : undefined);
}

export function resolveSelectedConversation<T extends { id: string }>(input: {
  visibleConversations: readonly T[];
  selectedConversationId: string;
  routeConversation?: T;
}): T | undefined {
  const listed = input.visibleConversations.find(({ id }) => id === input.selectedConversationId);
  if (listed) return listed;
  if (input.routeConversation?.id === input.selectedConversationId) return input.routeConversation;
  return input.visibleConversations[0];
}

export function resolveSelectedConversationId(input: {
  selectedConversationId: string;
  visibleConversations: readonly { id: string }[];
  routeConversationId?: string;
  routeLookupStatus?: ConversationRouteLookupStatus;
}): string {
  const { selectedConversationId, visibleConversations } = input;
  if (selectedConversationId && visibleConversations.some(({ id }) => id === selectedConversationId)) {
    return selectedConversationId;
  }

  if (
    selectedConversationId
    && selectedConversationId === input.routeConversationId
    && input.routeLookupStatus !== "failed"
  ) {
    return selectedConversationId;
  }

  return visibleConversations[0]?.id ?? "";
}

export function buildChatsHref(filters: ChatRouteFilters = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all") query.set(key === "store" ? "storeId" : key, value);
  }
  const serialized = query.toString();
  return serialized ? `/chats?${serialized}` : "/chats";
}

export function readChatRouteFilters(search: string): ChatRouteFilters {
  const query = new URLSearchParams(search);
  const bmReplyStatus = query.get("bmReplyStatus") ?? undefined;
  const explicitReplyState = query.get("replyState") ?? undefined;
  const replyState =
    explicitReplyState === "REPLIED" || explicitReplyState === "NOT_REPLIED"
      ? explicitReplyState
      : bmReplyStatus === "REPLIED"
        ? "REPLIED"
        : bmReplyStatus === "NOT_REPLIED" || bmReplyStatus === "NOTIFIED_BM"
          ? "NOT_REPLIED"
          : undefined;
  return {
    store: query.get("storeId") ?? undefined,
    status: query.get("status") ?? undefined,
    ...(bmReplyStatus ? { bmReplyStatus } : {}),
    ...(replyState ? { replyState } : {}),
    priority: query.get("priority") ?? undefined,
    model: query.get("model") ?? undefined,
    topic: query.get("topic") ?? undefined,
    lineOaId: query.get("lineOaId") ?? undefined,
    conversationId: query.get("conversationId") ?? undefined,
  };
}
