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
