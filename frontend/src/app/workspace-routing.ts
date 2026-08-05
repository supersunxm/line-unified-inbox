export type ChatRouteFilters = {
  store?: string;
  status?: string;
  bmReplyStatus?: string;
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
  return {
    store: query.get("storeId") ?? undefined,
    status: query.get("status") ?? undefined,
    ...(bmReplyStatus ? { bmReplyStatus } : {}),
    priority: query.get("priority") ?? undefined,
    model: query.get("model") ?? undefined,
    topic: query.get("topic") ?? undefined,
    lineOaId: query.get("lineOaId") ?? undefined,
    conversationId: query.get("conversationId") ?? undefined,
  };
}
