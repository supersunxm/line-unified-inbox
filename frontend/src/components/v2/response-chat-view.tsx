"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getEffectiveReplyState } from "@/app/reply-state";
import { mergeConversationMessagePages } from "@/app/conversation-message-pagination";
import { api, isAbortError } from "@/lib/api";
import type { ApiConversation, ConversationMessagesResponse } from "@/types/api";
import { formatSentAt, formatWaitMinutes, needsFollowUp } from "@/lib/v2/business-hours";
import { managerUrlOf, toWaitingChat, type StoreRow } from "@/lib/v2/response-model";
import { buildConversationList, type ConversationListItem } from "@/lib/v2/conversation-list";
import { ALL_STORES, type ResponseUrlState } from "@/lib/v2/response-url";
import { useV2Data } from "./v2-data";
import { ManagerLink, SourceNotice, WaitLabel } from "./v2-ui";

function StorePane({ rows, selected, onSelect }: { rows: StoreRow[]; selected: string; onSelect: (store: string) => void }) {
  const itemClass = (active: boolean) => `flex w-full items-center justify-between gap-2 rounded-[var(--app-radius-md)] px-3 py-2 text-left text-sm ${active ? "bg-[var(--app-accent-soft)] font-semibold text-[var(--app-accent)]" : "text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"}`;
  return (
    <nav aria-label="ร้าน" className="flex min-h-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-surface)]">
      <div className="border-b border-[var(--app-border-subtle)] px-4 py-3 text-xs font-semibold text-[var(--app-text-secondary)]">ร้าน ({rows.length})</div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        <button type="button" onClick={() => onSelect(ALL_STORES)} aria-current={selected === ALL_STORES ? "true" : undefined} className={itemClass(selected === ALL_STORES)}>
          <span>ทุกร้านในรายการนี้</span>
        </button>
        {rows.map((row) => (
          <button key={row.storeId} type="button" data-v2-chat-store={row.storeId} onClick={() => onSelect(row.storeId)} aria-current={selected === row.storeId ? "true" : undefined} className={itemClass(selected === row.storeId)}>
            <span className="min-w-0 truncate">{row.storeName}</span>
            {row.hasData && row.waitingCount > 0 && (
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${row.needsFollowUp ? "bg-[var(--app-danger-soft)] text-[var(--app-danger)]" : "bg-[var(--app-neutral-soft)] text-[var(--app-text-secondary)]"}`}>
                {row.waitingCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

function ConversationPane({ items, selected, onSelect, loading, error, showStore, now }: { items: ConversationListItem[]; selected: string | null; onSelect: (item: ConversationListItem) => void; loading: boolean; error: string | null; showStore: boolean; now: number }) {
  return (
    <section aria-label="แชท" className="flex min-h-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-surface)]">
      <div className="border-b border-[var(--app-border-subtle)] px-4 py-3 text-xs font-semibold text-[var(--app-text-secondary)]">แชท ({items.length}){loading ? " · กำลังโหลด…" : ""}</div>
      {error && <div className="p-3"><SourceNotice>โหลดแชทล่าสุดไม่สำเร็จ: {error}</SourceNotice></div>}
      <ul className="min-h-0 flex-1 divide-y divide-[var(--app-border-subtle)] overflow-y-auto">
        {!loading && items.length === 0 && <li className="p-6 text-center text-sm text-[var(--app-text-secondary)]">ไม่มีแชทในรายการนี้</li>}
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" data-v2-conversation={item.id} onClick={() => onSelect(item)} aria-current={selected === item.id ? "true" : undefined} className={`flex w-full flex-col gap-1 px-4 py-3 text-left ${selected === item.id ? "bg-[var(--app-accent-soft)]" : "hover:bg-[var(--app-surface-hover)]"}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">{item.customerName}</span>
                {item.kind === "waiting" ? (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${needsFollowUp(item.chat.businessMinutes) ? "bg-[var(--app-danger-soft)] text-[var(--app-danger)]" : "bg-[var(--app-warning-soft)] text-[var(--app-text-primary)]"}`}>
                    รอ {formatWaitMinutes(item.chat.businessMinutes)}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-[var(--app-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--app-text-primary)]">ตอบแล้ว</span>
                )}
              </span>
              <span className="truncate text-xs text-[var(--app-text-secondary)]">
                {showStore ? `${item.storeName} · ` : ""}{item.kind === "waiting" ? `ส่งเมื่อ ${formatSentAt(item.chat.waitingSince, now)}` : `ล่าสุด ${formatSentAt(item.latestMessageAt, now)}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function messageText(message: ApiConversation["messages"][number]): React.ReactNode {
  if (message.messageType === "TEXT") return message.originalText;
  if (message.messageType === "IMAGE" && message.media?.url) return <a href={message.media.url} target="_blank" rel="noreferrer" className="italic text-[var(--app-accent)] underline">[รูปภาพ] เปิดดู ↗</a>;
  const labels: Record<string, string> = { IMAGE: "รูปภาพ", VIDEO: "วิดีโอ", AUDIO: "ข้อความเสียง", FILE: "ไฟล์", LOCATION: "ตำแหน่ง", STICKER: "สติกเกอร์", UNSUPPORTED: "ข้อความที่แสดงไม่ได้" };
  const extra = message.messageType === "STICKER" && message.sticker?.text ? ` ${message.sticker.text}` : message.fileName ? ` ${message.fileName}` : "";
  return <span className="italic text-[var(--app-text-secondary)]">[{labels[message.messageType] ?? message.messageType}]{extra}</span>;
}

function ThreadPane({ conversationId, now }: { conversationId: string | null; now: number }) {
  // Results are kept with the id they belong to, so a new selection reads as "loading" without resetting state in the effect.
  const [loaded, setLoaded] = useState<{ id: string; conversation: ApiConversation | null; messages: ConversationMessagesResponse | null; error: string | null } | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) return undefined;
    const controller = new AbortController();
    void Promise.all([api.conversation(conversationId, { signal: controller.signal }), api.conversationMessages(conversationId, 1, { signal: controller.signal })])
      .then(([detail, page]) => {
        if (controller.signal.aborted) return;
        setLoaded({ id: conversationId, conversation: detail, messages: page, error: null });
        window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end" }));
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted && !isAbortError(reason)) setLoaded({ id: conversationId, conversation: null, messages: null, error: reason instanceof Error ? reason.message : "โหลดแชทไม่สำเร็จ" });
      });
    return () => controller.abort();
  }, [conversationId]);

  const current = loaded && loaded.id === conversationId ? loaded : null;
  const conversation = current?.conversation ?? null;
  const messages = current?.messages ?? null;
  const error = current?.error ?? null;

  const loadEarlier = async () => {
    if (!conversationId || !messages) return;
    setLoadingEarlier(true);
    try {
      const page = await api.conversationMessages(conversationId, messages.page + 1);
      setLoaded((previous) => previous && previous.id === conversationId
        ? { ...previous, messages: { ...mergeConversationMessagePages(previous.messages, page), page: page.page, hasEarlier: page.hasEarlier } }
        : previous);
    } catch (reason) {
      setLoaded((previous) => previous && previous.id === conversationId ? { ...previous, error: reason instanceof Error ? reason.message : "โหลดข้อความก่อนหน้าไม่สำเร็จ" } : previous);
    } finally {
      setLoadingEarlier(false);
    }
  };

  if (!conversationId) {
    return <section className="flex min-h-0 items-center justify-center bg-[var(--app-bg)] p-8 text-sm text-[var(--app-text-secondary)]">เลือกแชทเพื่อดูข้อความ</section>;
  }
  const state = conversation ? getEffectiveReplyState(conversation) : null;
  const waiting = conversation && state === "NOT_REPLIED" ? toWaitingChat(conversation, now) : null;
  return (
    <section aria-label="ข้อความ" className="flex min-h-0 flex-col bg-[var(--app-bg)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{conversation?.customer.displayName ?? "กำลังโหลด…"}</div>
          <div className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
            {conversation && <span className="truncate">{conversation.store.name}</span>}
            {state === "REPLIED" && <span className="rounded-full bg-[var(--app-success-soft)] px-2 py-0.5 font-medium text-[var(--app-text-primary)]">ตอบแล้ว</span>}
            {waiting && <span className="inline-flex items-center gap-1">รอ <WaitLabel businessMinutes={waiting.businessMinutes} waitingSince={waiting.waitingSince} now={now} /></span>}
          </div>
        </div>
        {conversation && <ManagerLink href={managerUrlOf(conversation)} size="sm" />}
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {error && <SourceNotice>{error}</SourceNotice>}
        {messages?.hasEarlier && (
          <div className="text-center">
            <button type="button" onClick={() => void loadEarlier()} disabled={loadingEarlier} className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50">
              {loadingEarlier ? "กำลังโหลด…" : "โหลดข้อความก่อนหน้า"}
            </button>
          </div>
        )}
        {!messages && !error && <p className="text-center text-sm text-[var(--app-text-secondary)]">กำลังโหลดข้อความ…</p>}
        {messages?.items.map((message) => {
          if (message.direction === "SYSTEM") return <p key={message.id} className="text-center text-xs text-[var(--app-text-tertiary)]">{messageText(message)}</p>;
          const fromStore = message.direction === "OUTBOUND";
          return (
            <div key={message.id} data-v2-message={message.direction} className={`flex ${fromStore ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${fromStore ? "items-end" : "items-start"} flex flex-col`}>
                <div className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${fromStore ? "rounded-br-md bg-[var(--app-accent-soft)] text-[var(--app-text-primary)]" : "rounded-bl-md border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-primary)]"}`}>
                  {messageText(message)}
                </div>
                <span className="mt-0.5 text-[11px] text-[var(--app-text-tertiary)]">{fromStore && message.sender?.displayName ? `${message.sender.displayName} · ` : ""}{formatSentAt(message.sentAt, now)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <footer className="border-t border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-2.5 text-center text-xs text-[var(--app-text-secondary)]">
        ดูอย่างเดียว · ร้านตอบลูกค้าผ่าน LINE OA Manager
      </footer>
    </section>
  );
}

export function ResponseChatView({ rows, state, onSelectStore, onSelectConversation }: {
  rows: StoreRow[];
  state: ResponseUrlState;
  onSelectStore: (store: string) => void;
  onSelectConversation: (storeId: string, conversationId: string) => void;
}) {
  const data = useV2Data();
  const selectedStore = state.store && (state.store === ALL_STORES || rows.some((row) => row.storeId === state.store)) ? state.store : ALL_STORES;
  const storeIds = useMemo(() => new Set(selectedStore === ALL_STORES ? rows.map((row) => row.storeId) : [selectedStore]), [rows, selectedStore]);
  const [recent, setRecent] = useState<{ key: string; items: ApiConversation[]; error: string | null }>({ key: "", items: [], error: null });

  useEffect(() => {
    const key = selectedStore;
    const controller = new AbortController();
    // One store: its latest chats in every state. All stores: the latest replied chats; waiting ones come from the shared set.
    const params = selectedStore === ALL_STORES ? { replyState: "REPLIED", pageSize: 100 } : { storeId: selectedStore, pageSize: 100 };
    void api.conversations(params, { signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) setRecent({ key, items: response.items, error: null }); })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted && !isAbortError(reason)) setRecent({ key, items: [], error: reason instanceof Error ? reason.message : "โหลดไม่สำเร็จ" });
      });
    return () => controller.abort();
  }, [selectedStore]);

  const recentLoaded = recent.key === selectedStore;
  const items = useMemo(
    () => buildConversationList(data.waitingChats, recent.key === selectedStore ? recent.items : [], storeIds, data.now),
    [data.waitingChats, data.now, recent, selectedStore, storeIds],
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-[240px_320px_minmax(0,1fr)] overflow-hidden rounded-[var(--app-radius-lg)] border border-[var(--app-border)]">
      <StorePane rows={rows} selected={selectedStore} onSelect={onSelectStore} />
      <ConversationPane
        items={items}
        selected={state.conversation}
        onSelect={(item) => onSelectConversation(selectedStore === ALL_STORES ? ALL_STORES : item.storeId, item.id)}
        loading={!recentLoaded}
        error={recentLoaded ? recent.error : null}
        showStore={selectedStore === ALL_STORES}
        now={data.now}
      />
      <ThreadPane conversationId={state.conversation} now={data.now} />
    </div>
  );
}
