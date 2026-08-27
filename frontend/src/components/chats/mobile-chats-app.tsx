"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type {
  ApiBmReplyStatus,
  ApiConversation,
  ApiCustomerIntelligence,
  ConversationMessagesResponse,
} from "@/types/api";
import { MessageImage } from "@/app/message-image";
import { getMessageSenderName } from "@/app/message-sender";
import { mapRealtimeMessage, subscribeToRealtimeEvents } from "@/app/realtime";
import { formatRelativeTime } from "@/app/relative-time";
import { openLineOaManager } from "@/app/line-oa-manager";

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: "ADMIN" | "VIEWER";
};

type MobileView = "list" | "chat" | "info";
type StatusFilter = "all" | ApiBmReplyStatus;

const PAGE_SIZE = 40;
const statusLabels: Record<ApiBmReplyStatus, string> = {
  NOT_REPLIED: "ยังไม่ตอบ",
  NOTIFIED_BM: "แจ้ง BM แล้ว",
  REPLIED: "ตอบแล้ว",
};

function statusClass(status: ApiBmReplyStatus) {
  if (status === "REPLIED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200";
  if (status === "NOTIFIED_BM") return "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function previewText(conversation: ApiConversation) {
  const message = conversation.messages[0];
  if (!message) return "ยังไม่มีข้อความ";
  if (message.messageType === "IMAGE") return "📷 รูปภาพ";
  if (message.messageType !== "TEXT") return `ข้อความ ${message.messageType.toLowerCase()}`;
  return message.translatedThai || message.originalText || "ข้อความ";
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "OA";
}

function thaiDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(value));
}

function thaiTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function Avatar({ conversation, size = "md" }: { conversation: ApiConversation; size?: "sm" | "md" }) {
  const classes = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  if (conversation.customer.pictureUrl) {
    return (
      <div
        role="img"
        aria-label={conversation.customer.displayName}
        style={{ backgroundImage: `url(${conversation.customer.pictureUrl})` }}
        className={`${classes} shrink-0 rounded-full border border-[var(--app-border)] bg-cover bg-center shadow-sm`}
      />
    );
  }
  return (
    <div className={`${classes} flex shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] font-bold text-[var(--app-accent)]`}>
      {initials(conversation.customer.displayName)}
    </div>
  );
}

function MobileBottomNav({ onMore }: { onMore: () => void }) {
  return (
    <nav
      aria-label="Mobile primary navigation"
      className="grid shrink-0 grid-cols-4 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-1 pt-1.5"
      style={{ paddingBottom: "max(0.45rem, env(safe-area-inset-bottom))" }}
    >
      <Link href="/dashboard" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-[var(--app-text-secondary)]">
        <span className="text-lg leading-none">▦</span><span>แดชบอร์ด</span>
      </Link>
      <Link href="/chats" aria-current="page" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-[var(--app-accent)]">
        <span className="text-lg leading-none">◫</span><span>แชทร้านค้า</span>
      </Link>
      <Link href="/follower-insights" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-[var(--app-text-secondary)]">
        <span className="text-lg leading-none">↗</span><span>ข้อมูลผู้ติดตาม</span>
      </Link>
      <button type="button" onClick={onMore} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-[var(--app-text-secondary)]">
        <span className="text-xl leading-none">•••</span><span>เพิ่มเติม</span>
      </button>
    </nav>
  );
}

function MoreSheet({ user, onClose }: { user: AuthUser; onClose: () => void }) {
  const links = [
    { href: "/dashboard/message-traffic", label: "Message Traffic" },
    { href: "/coupons", label: "คูปอง" },
    { href: "/stores", label: "จัดการร้านค้า" },
    ...(user.role === "ADMIN" ? [{ href: "/admin/purchase-analytics", label: "ข้อมูลการซื้อ" }, { href: "/mass-messages", label: "ส่งข้อความ" }] : []),
  ];
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/35" onClick={onClose}>
      <div
        className="w-full rounded-t-[1.6rem] border-t border-[var(--app-border)] bg-[var(--app-surface)] px-4 pt-3 shadow-2xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--app-border)]" />
        <div className="mb-3 flex items-center justify-between">
          <div><p className="text-sm font-bold">เพิ่มเติม</p><p className="mt-0.5 text-xs text-[var(--app-text-tertiary)]">{user.displayName}</p></div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-lg">×</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-3 text-sm font-semibold">
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MobileChatsApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [view, setView] = useState<MobileView>("list");
  const [routingReady, setRoutingReady] = useState(false);
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>(() => {
    if (typeof window === "undefined") return "all";
    const value = new URLSearchParams(window.location.search).get("bmReplyStatus");
    return value === "NOT_REPLIED" || value === "NOTIFIED_BM" || value === "REPLIED" ? value : "all";
  });
  const [storeId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("store") || "");
  const [summary, setSummary] = useState({ notReplied: 0, notifiedBm: 0, replied: 0 });
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApiConversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessagesResponse>({ items: [], total: 0, page: 1, pageSize: 30, hasEarlier: false });
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [intelligence, setIntelligence] = useState<ApiCustomerIntelligence | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const listRequestId = useRef(0);
  const openedFromList = useRef(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const statusCounts = useMemo(() => ({
    all: summary.notReplied + summary.notifiedBm + summary.replied,
    NOT_REPLIED: summary.notReplied,
    NOTIFIED_BM: summary.notifiedBm,
    REPLIED: summary.replied,
  }), [summary]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const updateViewport = () => setViewportHeight(Math.round(window.visualViewport?.height ?? window.innerHeight));
    updateViewport();
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const refreshSummary = useCallback(async () => {
    try {
      const result = await api.bmReplyStatusSummary();
      setSummary(result.overview);
    } catch { /* list remains usable without summary */ }
  }, []);

  useEffect(() => {
    let active = true;
    void api.me()
      .then((value) => { if (active) setUser(value); })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) window.location.replace("/login");
        else setListError(error instanceof Error ? error.message : "ไม่สามารถตรวจสอบบัญชีได้");
      })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || !selected?.id) return;
    return subscribeToRealtimeEvents((event) => {
      if (event.conversationId !== selected.id || !event.message) return;
      const incoming = mapRealtimeMessage(event.message);
      if (event.type === "message.created") {
        setMessages((current) => current.items.some((item) => item.id === incoming.id)
          ? current
          : { ...current, items: [...current.items, incoming], total: current.total + 1 });
        setSelected((current) => current && !current.messages.some((item) => item.id === incoming.id)
          ? { ...current, messages: [...current.messages, incoming] }
          : current);
        return;
      }
      setMessages((current) => ({ ...current, items: current.items.map((item) => item.id === incoming.id ? { ...item, media: incoming.media } : item) }));
      setSelected((current) => current ? { ...current, messages: current.messages.map((item) => item.id === incoming.id ? { ...item, media: incoming.media } : item) } : current);
    });
  }, [selected?.id, user]);

  const loadList = useCallback(async () => {
    if (!user) return;
    const requestId = ++listRequestId.current;
    setListLoading(true);
    setListError(null);
    try {
      const response = await api.conversations({
        page,
        pageSize: PAGE_SIZE,
        search: search.trim() || undefined,
        bmReplyStatus: status === "all" ? undefined : status,
        storeId: storeId || undefined,
      });
      if (requestId !== listRequestId.current) return;
      setConversations(response.items);
      setTotal(response.total);
    } catch (error) {
      if (requestId === listRequestId.current) setListError(error instanceof Error ? error.message : "โหลดรายการแชทไม่สำเร็จ");
    } finally {
      if (requestId === listRequestId.current) setListLoading(false);
    }
  }, [page, search, status, storeId, user]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => void loadList(), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadList, search, user]);

  useEffect(() => { if (user) void refreshSummary(); }, [refreshSummary, user]);

  const updateUrlConversation = useCallback((id: string | null, mode: "push" | "replace" = "replace") => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("conversationId", id);
    else url.searchParams.delete("conversationId");
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", `${url.pathname}${url.search}`);
  }, []);

  const scrollMessagesToBottom = useCallback(() => {
    window.requestAnimationFrame(() => messageEndRef.current?.scrollIntoView({ block: "end" }));
  }, []);

  const loadConversation = useCallback(async (id: string, seed?: ApiConversation, pushHistory = false) => {
    if (seed) setSelected(seed);
    setView("chat");
    setChatLoading(true);
    setChatError(null);
    setIntelligence(null);
    if (pushHistory) {
      openedFromList.current = true;
      updateUrlConversation(id, "push");
    } else {
      updateUrlConversation(id, "replace");
    }
    try {
      const [conversation, history] = await Promise.all([api.conversation(id), api.conversationMessages(id)]);
      setSelected(conversation);
      setMessages(history);
      scrollMessagesToBottom();
      void api.customerIntelligence(conversation.customer.id).then(setIntelligence).catch(() => undefined);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "โหลดห้องแชทไม่สำเร็จ");
    } finally {
      setChatLoading(false);
    }
  }, [scrollMessagesToBottom, updateUrlConversation]);

  useEffect(() => {
    if (!user || routingReady) return;
    const id = new URLSearchParams(window.location.search).get("conversationId");
    if (!id) {
      setView("list");
      setRoutingReady(true);
      return;
    }
    openedFromList.current = false;
    void loadConversation(id, undefined, false).finally(() => setRoutingReady(true));
  }, [loadConversation, routingReady, user]);

  useEffect(() => {
    if (!routingReady) return;
    const handlePopState = () => {
      const id = new URLSearchParams(window.location.search).get("conversationId");
      if (!id) {
        openedFromList.current = false;
        setView("list");
        return;
      }
      if (id !== selected?.id) void loadConversation(id, undefined, false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [loadConversation, routingReady, selected?.id]);

  const backToList = useCallback(() => {
    setReplyError(null);
    if (openedFromList.current) {
      openedFromList.current = false;
      window.history.back();
      return;
    }
    updateUrlConversation(null, "replace");
    setView("list");
  }, [updateUrlConversation]);

  const sendReply = useCallback(async () => {
    if (!selected || !user || user.role === "VIEWER" || !replyText.trim() || replySending) return;
    const text = replyText.trim();
    setReplySending(true);
    setReplyError(null);
    try {
      const response = await api.sendConversationMessage(selected.id, text, crypto.randomUUID());
      setMessages((current) => current.items.some((item) => item.id === response.message.id)
        ? current
        : { ...current, items: [...current.items, response.message], total: current.total + 1 });
      setSelected((current) => current ? { ...current, bmReplyStatus: "REPLIED" } : current);
      setConversations((current) => current.map((item) => item.id === selected.id ? { ...item, bmReplyStatus: "REPLIED" } : item));
      setReplyText("");
      void refreshSummary();
      scrollMessagesToBottom();
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setReplySending(false);
    }
  }, [refreshSummary, replySending, replyText, scrollMessagesToBottom, selected, user]);

  const loadEarlier = useCallback(async () => {
    if (!selected || !messages.hasEarlier || chatLoading) return;
    setChatLoading(true);
    try {
      const earlier = await api.conversationMessages(selected.id, messages.page + 1);
      setMessages((current) => ({ ...earlier, items: [...earlier.items, ...current.items] }));
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading, messages.hasEarlier, messages.page, selected]);

  const updateBmStatus = useCallback(async (next: ApiBmReplyStatus) => {
    if (!selected || !user || user.role === "VIEWER") return;
    const previous = selected.bmReplyStatus;
    setSelected({ ...selected, bmReplyStatus: next });
    try {
      const response = await api.updateBmReplyStatus(selected.id, next);
      setSelected(response.conversation);
      setConversations((current) => current.map((item) => item.id === selected.id ? response.conversation : item));
      void refreshSummary();
    } catch {
      setSelected((current) => current ? { ...current, bmReplyStatus: previous } : current);
    }
  }, [refreshSummary, selected, user]);

  const openManager = useCallback(async () => {
    if (!selected) return;
    const result = await openLineOaManager({
      managerUrl: selected.resolvedLineOaManagerUrl || selected.store.lineManagerUrl,
      customerName: selected.customer.displayName,
      copy: (value) => navigator.clipboard.writeText(value),
      open: (url, target, features) => window.open(url, target, features),
    });
    if (result === "missing") setChatError("ร้านนี้ยังไม่มี LINE OA Manager URL");
  }, [selected]);

  if (!authChecked || !user || !routingReady) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">
        <div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-[var(--app-accent)]" />กำลังเปิดแชทร้านค้า...</div>
      </div>
    );
  }

  const rootStyle = viewportHeight ? { height: `${viewportHeight}px` } : { height: "100dvh" };

  return (
    <div
      data-mobile-chats-root
      data-mobile-chats-view={view}
      className="fixed inset-x-0 top-0 z-[60] flex w-full flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--app-text-primary)] md:hidden"
      style={rootStyle}
    >
      {view === "list" && (
        <>
          <header className="shrink-0 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-3 pb-2.5 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight">แชทร้านค้า</h1>
                <p className="mt-0.5 text-xs text-[var(--app-text-tertiary)]">{total.toLocaleString()} บทสนทนา{storeId ? " · กรองตามสาขา" : ""}</p>
              </div>
              <button type="button" onClick={() => { void loadList(); void refreshSummary(); }} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-lg" aria-label="รีเฟรช">↻</button>
            </div>
            <label className="relative mt-3 block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--app-text-tertiary)]">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="ค้นหาลูกค้า ร้านค้า หรือข้อความ"
                className="h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] pl-9 pr-3 text-base outline-none focus:border-[var(--app-accent)]"
              />
            </label>
            <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
              {([
                ["all", "ทั้งหมด"],
                ["NOT_REPLIED", "ยังไม่ตอบ"],
                ["NOTIFIED_BM", "แจ้ง BM"],
                ["REPLIED", "ตอบแล้ว"],
              ] as Array<[StatusFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setStatus(value); setPage(1); }}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${status === value ? "bg-[var(--app-accent)] text-white" : "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-secondary)]"}`}
                >
                  {label} <span className="ml-1 opacity-80">{statusCounts[value].toLocaleString()}</span>
                </button>
              ))}
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--app-surface)]">
            {listLoading && conversations.length === 0 ? (
              <div className="space-y-0 divide-y divide-[var(--app-border-subtle)]">
                {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-24 animate-pulse bg-[var(--app-surface-subtle)]/40" />)}
              </div>
            ) : listError ? (
              <div className="p-8 text-center"><p className="text-sm font-semibold text-[var(--app-danger)]">{listError}</p><button onClick={() => void loadList()} className="mt-3 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white">ลองอีกครั้ง</button></div>
            ) : conversations.length === 0 ? (
              <div className="p-10 text-center"><p className="text-base font-bold">ไม่พบบทสนทนา</p><p className="mt-1 text-sm text-[var(--app-text-tertiary)]">ลองเปลี่ยนคำค้นหาหรือสถานะ</p></div>
            ) : (
              <div className="divide-y divide-[var(--app-border-subtle)]">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => void loadConversation(conversation.id, conversation, true)}
                    className="flex w-full items-start gap-3 px-3 py-3 text-left active:bg-[var(--app-surface-hover)]"
                  >
                    <Avatar conversation={conversation} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[15px] font-bold">{conversation.customer.displayName}</p>
                        <span className="shrink-0 text-[11px] text-[var(--app-text-tertiary)]">{formatRelativeTime(conversation.latestMessageAt, "th")}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--app-text-secondary)]">{previewText(conversation)}</p>
                      <div className="mt-2 flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--app-text-tertiary)]">{conversation.store.name}</span>
                        {conversation.priority === "HIGH" || conversation.priority === "CRITICAL" ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-200">สำคัญ</span> : null}
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(conversation.bmReplyStatus)}`}>{statusLabels[conversation.bmReplyStatus]}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[var(--app-border)] px-3 py-3">
                <button disabled={page <= 1 || listLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-semibold disabled:opacity-40">ก่อนหน้า</button>
                <span className="text-xs text-[var(--app-text-tertiary)]">หน้า {page} / {totalPages}</span>
                <button disabled={page >= totalPages || listLoading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-semibold disabled:opacity-40">ถัดไป</button>
              </div>
            )}
          </main>
          <MobileBottomNav onMore={() => setMoreOpen(true)} />
          {moreOpen && <MoreSheet user={user} onClose={() => setMoreOpen(false)} />}
        </>
      )}

      {(view === "chat" || view === "info") && (
        <>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-2.5">
            <button type="button" onClick={backToList} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-3xl leading-none active:bg-[var(--app-surface-hover)]" aria-label="กลับไปยังรายการแชท">‹</button>
            {selected ? <Avatar conversation={selected} size="sm" /> : <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--app-surface-subtle)]" />}
            <button type="button" onClick={() => setView("chat")} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-bold">{selected?.customer.displayName || "กำลังโหลด..."}</p>
              <p className="truncate text-[11px] text-[var(--app-text-tertiary)]">{selected?.store.name || ""}</p>
            </button>
            <button type="button" onClick={() => setView(view === "info" ? "chat" : "info")} className={`flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-xs font-bold ${view === "info" ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)]"}`} aria-label="ข้อมูลลูกค้า">ⓘ</button>
            <button type="button" onClick={() => void openManager()} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-lg" aria-label="เปิดใน LINE OA">↗</button>
          </header>

          {view === "chat" ? (
            <div className="flex min-h-0 flex-1 flex-col bg-[var(--app-surface)]">
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--app-border-subtle)] px-3">
                <span className="text-[11px] text-[var(--app-text-tertiary)]">{messages.total.toLocaleString()} ข้อความ</span>
                <button type="button" onClick={() => setShowOriginal((value) => !value)} className="rounded-full px-2 py-1 text-[11px] font-semibold text-[var(--app-accent)]">{showOriginal ? "ดูคำแปล" : "ดูต้นฉบับ"}</button>
              </div>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain bg-[var(--app-surface-subtle)]/35 px-3 py-3">
                {messages.hasEarlier && <div className="pb-1 text-center"><button onClick={() => void loadEarlier()} disabled={chatLoading} className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-semibold">โหลดข้อความก่อนหน้า</button></div>}
                {chatLoading && messages.items.length === 0 && <div className="py-16 text-center text-sm text-[var(--app-text-tertiary)]">กำลังโหลดข้อความ...</div>}
                {chatError && <div className="rounded-2xl bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">{chatError}</div>}
                {messages.items.map((message, index) => {
                  const previous = messages.items[index - 1];
                  const showDate = !previous || new Date(previous.sentAt).toDateString() !== new Date(message.sentAt).toDateString();
                  const inbound = message.direction === "INBOUND";
                  const senderName = getMessageSenderName(message);
                  const translated = message.translatedThai;
                  const content = showOriginal || !translated ? message.originalText : translated;
                  return (
                    <div key={message.id}>
                      {showDate && <div className="my-3 text-center text-[11px] text-[var(--app-text-tertiary)]">{thaiDate(message.sentAt)}</div>}
                      {message.direction === "SYSTEM" ? (
                        <p className="mx-auto max-w-[85%] py-1 text-center text-xs text-[var(--app-text-tertiary)]">{content}</p>
                      ) : (
                        <div className={`flex items-end gap-1.5 ${inbound ? "justify-start" : "justify-end"}`}>
                          {inbound && selected && <Avatar conversation={selected} size="sm" />}
                          <div className={`max-w-[84%] rounded-2xl px-3 py-2 shadow-sm ${inbound ? "rounded-bl-sm border border-[var(--app-border)] bg-[var(--app-surface)]" : "rounded-br-sm bg-[var(--app-accent)] text-white"}`}>
                            {senderName && <p data-message-sender className={`mb-1 text-[11px] font-semibold ${inbound ? "text-[var(--app-text-secondary)]" : "text-white/80"}`}>{senderName}</p>}
                            {message.messageType === "IMAGE" ? (
                              <MessageImage messageId={message.id} media={message.media} alt="รูปภาพจากลูกค้า" unavailableLabel="รูปภาพไม่ได้ถูกจัดเก็บ" errorLabel="โหลดรูปภาพไม่สำเร็จ" retryLabel="ลองอีกครั้ง" />
                            ) : (
                              <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.45]">{content || "—"}</p>
                            )}
                            {message.fileName && <p className="mt-1 text-xs">📎 {message.fileName}</p>}
                            <p className={`mt-1 text-[10px] ${inbound ? "text-[var(--app-text-tertiary)]" : "text-white/70"}`}>{thaiTime(message.sentAt)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>
              <div className="shrink-0 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 pt-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
                <div className="flex items-end gap-2">
                  <textarea
                    rows={1}
                    value={replyText}
                    disabled={replySending || user.role === "VIEWER"}
                    onChange={(event) => { setReplyText(event.target.value); setReplyError(null); }}
                    placeholder={user.role === "VIEWER" ? "บัญชี Viewer อ่านได้อย่างเดียว" : "พิมพ์ข้อความ..."}
                    className="max-h-28 min-h-11 flex-1 resize-none rounded-[1.35rem] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-2.5 text-base leading-5 outline-none focus:border-[var(--app-accent)]"
                  />
                  <button type="button" onClick={() => void sendReply()} disabled={!replyText.trim() || replySending || user.role === "VIEWER"} className="h-11 shrink-0 rounded-[1.35rem] bg-[var(--app-accent)] px-4 text-sm font-bold text-white disabled:opacity-40">{replySending ? "..." : "ส่ง"}</button>
                </div>
                {replyError && <p className="mt-1.5 px-1 text-xs text-[var(--app-danger)]">{replyError}</p>}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--app-bg)] px-3 py-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
              {selected && (
                <div className="space-y-3">
                  <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]">สถานะการตอบ</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div><p className="text-sm font-bold">{selected.customer.displayName}</p><p className="mt-0.5 text-xs text-[var(--app-text-tertiary)]">{selected.store.name}</p></div>
                      <select value={selected.bmReplyStatus} disabled={user.role === "VIEWER"} onChange={(event) => void updateBmStatus(event.target.value as ApiBmReplyStatus)} className="h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2 text-sm font-semibold">
                        <option value="NOT_REPLIED">ยังไม่ตอบ</option><option value="NOTIFIED_BM">แจ้ง BM แล้ว</option><option value="REPLIED">ตอบแล้ว</option>
                      </select>
                    </div>
                    <button type="button" onClick={() => void openManager()} className="mt-3 w-full rounded-xl bg-[var(--app-accent)] px-3 py-2.5 text-sm font-bold text-white">เปิดใน LINE OA ↗</button>
                  </section>

                  <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]">ข้อมูลลูกค้า</p>
                    {intelligenceLoading ? <p className="mt-3 text-sm text-[var(--app-text-tertiary)]">กำลังวิเคราะห์...</p> : intelligence ? (
                      <div className="mt-3 space-y-3">
                        <div><p className="text-xs text-[var(--app-text-tertiary)]">Customer Stage</p><p className="mt-1 text-sm font-bold">{intelligence.customerStage.replaceAll("_", " ")}</p></div>
                        {intelligence.profileSummary && <div><p className="text-xs text-[var(--app-text-tertiary)]">สรุป</p><p className="mt-1 text-sm leading-6">{intelligence.profileSummary}</p></div>}
                        {intelligence.intent.length > 0 && <div><p className="text-xs text-[var(--app-text-tertiary)]">ความตั้งใจ</p><div className="mt-1.5 flex flex-wrap gap-1.5">{intelligence.intent.map((item) => <span key={item} className="rounded-full bg-[var(--app-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--app-accent)]">{item}</span>)}</div></div>}
                        {intelligence.interestedProducts.length > 0 && <div><p className="text-xs text-[var(--app-text-tertiary)]">สินค้าที่สนใจ</p><p className="mt-1 text-sm font-semibold">{intelligence.interestedProducts.join(" · ")}</p></div>}
                      </div>
                    ) : <p className="mt-3 text-sm text-[var(--app-text-tertiary)]">ยังไม่มีข้อมูลเชิงลึกลูกค้า</p>}
                  </section>

                  <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]">ข้อมูลการซื้อ / AI</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <p><span className="text-[var(--app-text-tertiary)]">ความสัมพันธ์:</span> <span className="font-semibold">{selected.productRelationship || "—"}</span></p>
                      <p><span className="text-[var(--app-text-tertiary)]">Purchase intent:</span> <span className="font-semibold">{selected.purchaseIntent || "—"}</span></p>
                      {selected.purchaseInformation?.products?.[0] && <p><span className="text-[var(--app-text-tertiary)]">สินค้าที่บันทึก:</span> <span className="font-semibold">{selected.purchaseInformation.products[0].model.name}</span></p>}
                      {selected.aiInsight?.mentionedProducts?.[0] && <p><span className="text-[var(--app-text-tertiary)]">AI พบสินค้า:</span> <span className="font-semibold">{selected.aiInsight.mentionedProducts[0].model.name}</span></p>}
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
