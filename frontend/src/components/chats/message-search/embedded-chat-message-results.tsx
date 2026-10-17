"use client";

import { useMemo, useState } from "react";
import type { AppLanguage } from "../../../app/language-utils.ts";
import type { MessageSearchItem } from "./message-search-adapter.ts";
import { createHttpChatMessageSearchAdapter } from "./message-search-http-adapter.ts";
import { bangkokTodayIso, type MessageSearchPeriod } from "./message-search-period.ts";
import { formatMessageSearchTimestamp } from "./message-search-format.ts";
import { highlightedSearchText } from "./highlight-search-text.tsx";
import { EMBEDDED_SEARCH_MAX_AUTOMATIC_ITEMS, EMBEDDED_SEARCH_PAGE_SIZE, useChatMessageSearch } from "./use-chat-message-search.ts";

/**
 * Embedded message-level search in the existing /chats middle column.
 * The backend always authorizes store scope. This list is rendered ONLY for HQ users
 * while the production search feature is explicitly enabled.
 */
const BACKEND_ADAPTER = createHttpChatMessageSearchAdapter();

export type EmbeddedMessageSearchSelection = {
  messageId: string;
  conversationId: string;
  keyword: string;
  snippet: string;
};

export function EmbeddedChatMessageResults({
  keyword, period, storeId, language, selectedMessageId, onSelect,
}: {
  keyword: string;
  period: MessageSearchPeriod;
  storeId: string;
  language: AppLanguage;
  selectedMessageId: string | null;
  onSelect: (selection: EmbeddedMessageSearchSelection) => void;
}) {
  const [retryNonce, setRetryNonce] = useState(0);
  const todayIso = bangkokTodayIso();
  const filters = useMemo(() => ({
    keyword,
    period,
    storeIds: storeId === "all" ? [] : [storeId],
  }), [keyword, period, storeId]);
  const copy = language === "th" ? {
    loading: "กำลังค้นหาข้อความ…", empty: "ไม่พบข้อความในช่วงวันที่นี้",
    error: "ค้นหาไม่สำเร็จ กรุณาลองอีกครั้ง", retry: "ลองอีกครั้ง",
    more: "โหลดเพิ่มเติม", loadingMore: "กำลังโหลดเพิ่มเติม…",
    matches: "บทสนทนาที่พบ", messages: "ข้อความที่พบ", gathering: "กำลังรวบรวมผลให้ครบอัตโนมัติ…",
    complete: "โหลดผลครบแล้ว", limitReached: "มีผลลัพธ์มากกว่าเกณฑ์แสดงอัตโนมัติ โปรดจำกัดช่วงวันที่หรือเลือกร้านค้า",
    filterScopeNote: "ค้นหาจากคำ วันที่ และร้านค้า ตัวกรองสถานะหรือสินค้าใช้กับรายการบทสนทนาแบบเดิม",
  } : language === "zh" ? {
    loading: "正在搜索消息…", empty: "选定日期内没有匹配消息",
    error: "搜索失败，请重试", retry: "重试", more: "加载更多",
    loadingMore: "正在加载…", matches: "匹配会话", messages: "匹配消息",
    gathering: "正在自动加载全部结果…", complete: "结果已全部加载",
    limitReached: "结果过多，请缩小日期范围或选择门店",
    filterScopeNote: "按关键词、日期、门店搜索；状态和商品筛选仅适用于旧会话列表",
  } : {
    loading: "Searching messages…", empty: "No matching messages in this date range",
    error: "Search failed. Please retry.", retry: "Retry", more: "Load more",
    loadingMore: "Loading more…", matches: "Matching conversations", messages: "Matching messages",
    gathering: "Collecting the remaining results automatically…", complete: "All results loaded",
    limitReached: "Too many results to load automatically. Narrow the date range or select a store.",
    filterScopeNote: "Search uses keyword, date and store; status/product filters apply only to the legacy conversation list.",
  };
  const search = useChatMessageSearch({
    adapter: BACKEND_ADAPTER,
    filters,
    todayIso,
    retryNonce,
    errorMessage: copy.error,
    autoLoadAll: true,
    pageSize: EMBEDDED_SEARCH_PAGE_SIZE,
    maxAutoItems: EMBEDDED_SEARCH_MAX_AUTOMATIC_ITEMS,
  });
  const rows = useMemo(() => {
    // One conversation per row, newest matching message first, like /chats.
    const groups = new Map<string, { first: MessageSearchItem; count: number }>();
    for (const item of search.state.items) {
      const group = groups.get(item.conversationId);
      if (group) group.count += 1;
      else groups.set(item.conversationId, { first: item, count: 1 });
    }
    return [...groups.values()];
  }, [search.state.items]);
  if (search.state.status === "loading") {
    return <p data-embedded-chat-search-state="loading" role="status" className="p-5 text-center text-sm text-[var(--app-text-secondary)]">{copy.loading}</p>;
  }
  if (search.state.status === "error") {
    return <div role="alert" className="p-5 text-center text-sm text-[var(--app-danger)]">
      <p>{search.state.error ?? copy.error}</p>
      <button type="button" onClick={() => setRetryNonce((n) => n + 1)} className="mt-2 rounded-lg border border-[var(--app-border)] px-3 py-1.5">{copy.retry}</button>
    </div>;
  }
  if (search.state.status === "empty") {
    return <p data-embedded-chat-search-state="empty" className="p-5 text-center text-sm text-[var(--app-text-secondary)]">{copy.empty}</p>;
  }
  return (
    <div data-embedded-chat-search-results className="flex min-h-0 flex-col">
      <p className="border-b border-[var(--app-border)] px-3 py-2 text-xs text-[var(--app-text-secondary)]">
        {copy.matches}: {rows.length} · {copy.messages}: {search.state.items.length}
        <span data-chat-search-completeness role="status" className="block mt-1 text-[10px]">
          {search.state.error ? copy.error
            : search.state.hasMore
              ? search.state.items.length >= EMBEDDED_SEARCH_MAX_AUTOMATIC_ITEMS || !search.state.nextCursor
                ? copy.limitReached
                : copy.gathering
              : copy.complete}
        </span>
        <span className="block mt-1 text-[10px]">
          {copy.filterScopeNote}
        </span>
      </p>
      {rows.map(({ first, count }) => (
        <button
          key={first.conversationId}
          type="button"
          onClick={() => onSelect({ messageId: first.messageId, conversationId: first.conversationId, keyword, snippet: first.snippet })}
          aria-pressed={first.messageId === selectedMessageId}
          className="w-full border-b border-[var(--app-border-subtle)] px-3.5 py-3 text-left hover:bg-[var(--app-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-accent)]"
        >
          <div className="flex min-w-0 items-start justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-semibold text-[var(--app-text-primary)]">{first.customerDisplayName || first.storeName}</span>
            <span className="shrink-0 text-[10px] text-[var(--app-text-tertiary)]">{formatMessageSearchTimestamp(first.sentAt, language)}</span>
          </div>
          <p className="mt-1 line-clamp-2 break-words text-xs text-[var(--app-text-primary)]">{highlightedSearchText(first.snippet, keyword)}</p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--app-text-secondary)]">
            <span className="min-w-0 truncate">{first.storeName}</span>
            {count > 1 && <span className="shrink-0 rounded-md bg-[var(--app-accent-soft)] px-1.5 text-[var(--app-accent)]">{count}</span>}
          </div>
        </button>
      ))}
      {search.state.error && (
        <div role="alert" className="p-3 text-xs text-[var(--app-danger)]">
          <p>{search.state.error}</p>
          <button type="button" onClick={() => setRetryNonce((n) => n + 1)}
            className="mt-2 rounded-lg border border-[var(--app-border)] px-3 py-1.5">
            {copy.retry}
          </button>
        </div>
      )}
    </div>
  );
}
