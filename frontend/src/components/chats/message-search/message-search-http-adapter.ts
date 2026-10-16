/**
 * HTTP adapter for message search. The only module in this feature that imports the API client.
 * It is selected only when the frontend flag is enabled AND the data mode is explicitly "backend".
 * Store scope and authorization are enforced by the backend; this adapter forwards requests and maps
 * responses to the interface fields only.
 */
import { api } from "@/lib/api";
import type { ApiRequestOptions } from "@/lib/api";
import type { ChatMessageSearchApiResponse } from "@/types/api";
import type { ChatMessageSearchAdapter, MessageSearchPage } from "./message-search-adapter.ts";
import type { MessageSearchStore } from "./message-search-stores.ts";

function toPage(response: ChatMessageSearchApiResponse): MessageSearchPage {
  return {
    items: response.items.map((item) => ({
      messageId: item.messageId,
      conversationId: item.conversationId,
      storeId: item.storeId,
      storeName: item.storeName,
      customerDisplayName: item.customerDisplayName,
      direction: item.direction,
      sentAt: item.sentAt,
      snippet: item.snippet,
      source: item.source,
    })),
    hasMore: response.hasMore,
    nextCursor: response.nextCursor,
  };
}

export function createHttpChatMessageSearchAdapter(): ChatMessageSearchAdapter {
  return {
    async search(request, options) {
      const response = await api.searchChatMessages(
        {
          q: request.q,
          startDate: request.startDate,
          endDate: request.endDate,
          ...(request.storeIds ? { storeIds: request.storeIds } : {}),
          cursor: request.cursor ?? null,
          ...(request.limit !== undefined ? { limit: request.limit } : {}),
        },
        options as ApiRequestOptions | undefined,
      );
      return toPage(response);
    },
    async listStores(options) {
      // /stores is already scoped to the caller's authorized stores on the server.
      const stores = await api.stores(false, options as ApiRequestOptions | undefined);
      return stores
        .filter((store) => !store.archivedAt)
        .map((store): MessageSearchStore => ({
          id: store.id,
          name: store.name,
          code: store.code,
          storeId: store.storeId ?? null,
        }));
    },
  };
}
