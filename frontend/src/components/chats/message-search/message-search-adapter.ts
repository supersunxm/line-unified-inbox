/**
 * Message-search data adapter contract plus a fully synthetic implementation for local testing.
 * Pure module: the synthetic adapter performs no network access.
 */
import { getBkkDateStr, getInclusiveCalendarDays } from "../../../app/follower-insights/follower-insights-utils.ts";
import { MESSAGE_SEARCH_MAX_DAYS, MESSAGE_SEARCH_PAGE_SIZE } from "./message-search-config.ts";
import { normalizeMessageSearchKeyword, validateMessageSearchKeyword, type MessageSearchRequest } from "./message-search-query.ts";
import type { MessageSearchStore } from "./message-search-stores.ts";

export type MessageSearchSource = "LIVE" | "HISTORICAL";
export type MessageSearchDirection = "INBOUND" | "OUTBOUND" | "SYSTEM";

export type MessageSearchItem = {
  messageId: string;
  conversationId: string;
  storeId: string;
  storeName: string;
  customerDisplayName: string | null;
  direction: MessageSearchDirection;
  sentAt: string;
  snippet: string;
  source: MessageSearchSource;
};

export type MessageSearchPage = {
  items: MessageSearchItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type MessageSearchRequestOptions = { signal?: AbortSignal };

/** A search request plus paging fields. `cursor` is opaque; `limit` is optional. */
export type MessageSearchAdapterRequest = MessageSearchRequest & { cursor?: string | null; limit?: number };

/** Frontend boundary: the UI talks only to this interface, never to a concrete transport. */
export interface ChatMessageSearchAdapter {
  search(request: MessageSearchAdapterRequest, options?: MessageSearchRequestOptions): Promise<MessageSearchPage>;
  listStores(options?: MessageSearchRequestOptions): Promise<MessageSearchStore[]>;
}

export type SyntheticMessageRecord = MessageSearchItem & { text: string };

/** Fully fictional. Names, stores, and messages do not refer to any real customer or store. */
export const SYNTHETIC_MESSAGE_STORES: MessageSearchStore[] = [
  { id: "store-syn-01", name: "Synthetic Store 01", code: "SYN01", storeId: "SYN01" },
  { id: "store-syn-02", name: "Synthetic Store 02", code: "SYN02", storeId: "SYN02" },
  { id: "store-syn-03", name: "Synthetic Store 03", code: "SYN03", storeId: "SYN03" },
];

const SYNTHETIC_RECORDS: Array<Omit<SyntheticMessageRecord, "snippet" | "source">> = [
  { messageId: "syn-msg-001", conversationId: "syn-conv-01", storeId: "store-syn-01", storeName: "Synthetic Store 01", customerDisplayName: "Sample Customer A", direction: "INBOUND", sentAt: "2026-10-14T03:00:00.000Z", text: "สวัสดีครับ สอบถามราคาสินค้า" },
  { messageId: "syn-msg-002", conversationId: "syn-conv-02", storeId: "store-syn-01", storeName: "Synthetic Store 01", customerDisplayName: "Sample Customer B", direction: "INBOUND", sentAt: "2026-10-13T07:30:00.000Z", text: "Hello, what is the price of the sample model?" },
  { messageId: "syn-msg-003", conversationId: "syn-conv-03", storeId: "store-syn-02", storeName: "Synthetic Store 02", customerDisplayName: "Sample Customer C", direction: "OUTBOUND", sentAt: "2026-10-12T05:00:00.000Z", text: "ขอบคุณที่ติดต่อเรา" },
  // 23:59:59.999 Bangkok on 30 Sep (last instant of the day)
  { messageId: "syn-msg-004", conversationId: "syn-conv-04", storeId: "store-syn-02", storeName: "Synthetic Store 02", customerDisplayName: "Sample Customer D", direction: "INBOUND", sentAt: "2026-09-30T16:59:59.999Z", text: "สวัสดีครับ มีสาขาไหนบ้าง" },
  // 00:00 Bangkok on 1 Oct (first instant of the next day)
  { messageId: "syn-msg-005", conversationId: "syn-conv-05", storeId: "store-syn-01", storeName: "Synthetic Store 01", customerDisplayName: "Sample Customer E", direction: "INBOUND", sentAt: "2026-09-30T17:00:00.000Z", text: "สวัสดี ส่งรูปให้ดูหน่อย" },
  { messageId: "syn-msg-006", conversationId: "syn-conv-06", storeId: "store-syn-03", storeName: "Synthetic Store 03", customerDisplayName: "Sample Customer F", direction: "INBOUND", sentAt: "2026-09-16T10:00:00.000Z", text: "Hi, testing the 100% discount policy" },
  { messageId: "syn-msg-007", conversationId: "syn-conv-07", storeId: "store-syn-03", storeName: "Synthetic Store 03", customerDisplayName: "Sample Customer G", direction: "INBOUND", sentAt: "2026-08-31T16:59:59.999Z", text: "ขอบคุณคำแนะนำ" },
  { messageId: "syn-msg-008", conversationId: "syn-conv-08", storeId: "store-syn-01", storeName: "Synthetic Store 01", customerDisplayName: "Sample Customer H", direction: "SYSTEM", sentAt: "2026-10-10T02:00:00.000Z", text: "Automated reply: business hours" },
];

const SNIPPET_MAX_LENGTH = 160;

function buildSnippet(text: string, keyword: string): string {
  if (text.length <= SNIPPET_MAX_LENGTH) return text;
  const haystack = text.toLocaleLowerCase("en-US");
  const matchAt = haystack.indexOf(keyword.toLocaleLowerCase("en-US"));
  const start = matchAt < 0 ? 0 : Math.max(0, matchAt - 60);
  const end = Math.min(text.length, start + SNIPPET_MAX_LENGTH);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/** The synthetic dataset as stored records (snippet is derived per query). */
export function syntheticMessageRecords(): SyntheticMessageRecord[] {
  return SYNTHETIC_RECORDS.map((record) => ({ ...record, snippet: record.text, source: "LIVE" as const }));
}

/**
 * Synthetic adapter that mirrors the backend contract: same keyword rules, inclusive Bangkok dates,
 * the 90-day cap, store selection, newest-first ordering, and offset-style cursors.
 */
export function createSyntheticChatMessageSearchAdapter(
  records: SyntheticMessageRecord[] = syntheticMessageRecords(),
  stores: MessageSearchStore[] = SYNTHETIC_MESSAGE_STORES,
  pageSize: number = MESSAGE_SEARCH_PAGE_SIZE,
): ChatMessageSearchAdapter {
  return {
    async search(request, options) {
      if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const keyword = validateMessageSearchKeyword(request.q);
      if (!keyword.valid) throw new Error("Invalid keyword");
      const days = getInclusiveCalendarDays(request.startDate, request.endDate);
      if (days < 1 || days > MESSAGE_SEARCH_MAX_DAYS) throw new Error("Invalid date range");
      const offset = request.cursor ? Number(request.cursor) : 0;
      if (!Number.isInteger(offset) || offset < 0) throw new Error("Invalid cursor");

      const needle = normalizeMessageSearchKeyword(keyword.keyword).toLocaleLowerCase("en-US");
      const storeFilter = request.storeIds && request.storeIds.length > 0 ? new Set(request.storeIds) : null;
      const matches = records
        .filter((record) => storeFilter === null || storeFilter.has(record.storeId))
        .filter((record) => {
          const bangkokDate = getBkkDateStr(new Date(record.sentAt));
          return bangkokDate >= request.startDate && bangkokDate <= request.endDate;
        })
        .filter((record) => record.text.toLocaleLowerCase("en-US").includes(needle))
        .sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : b.messageId.localeCompare(a.messageId)));

      const size = request.limit ?? pageSize;
      const pageItems = matches.slice(offset, offset + size).map((record) => ({
        messageId: record.messageId,
        conversationId: record.conversationId,
        storeId: record.storeId,
        storeName: record.storeName,
        customerDisplayName: record.customerDisplayName,
        direction: record.direction,
        sentAt: record.sentAt,
        snippet: buildSnippet(record.text, needle),
        source: record.source,
      }));
      const nextOffset = offset + pageItems.length;
      const hasMore = nextOffset < matches.length;
      return { items: pageItems, hasMore, nextCursor: hasMore ? String(nextOffset) : null };
    },
    async listStores(options) {
      if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return stores.map((store) => ({ ...store }));
    },
  };
}
