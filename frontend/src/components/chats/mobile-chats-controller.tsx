"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type MobileChatView = "list" | "chat" | "info";

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

export function MobileChatsController() {
  const [view, setView] = useState<MobileChatView>("list");
  const [detailPane, setDetailPane] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isMobileViewport()) return;

    const shell = document.querySelector<HTMLElement>(".app-shell");
    const detail = document.querySelector<HTMLElement>('[data-chat-pane="detail"]');
    setDetailPane(detail);

    const params = new URLSearchParams(window.location.search);
    const hasDeepLinkedConversation = Boolean(params.get("conversationId"));
    setView(hasDeepLinkedConversation ? "chat" : "list");

    const openConversation = (event: Event) => {
      if (!isMobileViewport()) return;
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-conversation-row]")) return;
      if (target.closest("[data-conversation-action-menu]")) return;
      window.setTimeout(() => setView("chat"), 0);
    };

    document.addEventListener("click", openConversation, true);
    document.addEventListener("keydown", openConversation, true);

    const media = window.matchMedia("(max-width: 767px)");
    const handleViewport = () => {
      if (!media.matches) {
        shell?.removeAttribute("data-mobile-chat-view");
      }
    };
    media.addEventListener("change", handleViewport);

    return () => {
      document.removeEventListener("click", openConversation, true);
      document.removeEventListener("keydown", openConversation, true);
      media.removeEventListener("change", handleViewport);
      shell?.removeAttribute("data-mobile-chat-view");
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport()) return;
    const shell = document.querySelector<HTMLElement>(".app-shell");
    shell?.setAttribute("data-mobile-chat-view", view);
    if (view === "list") {
      document.querySelector<HTMLElement>('[data-chat-pane="conversations"]')?.scrollTo({ top: 0 });
    }
  }, [view]);

  const toolbar = detailPane && view !== "list"
    ? createPortal(
        <div data-mobile-chat-toolbar className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 md:hidden">
          <button
            type="button"
            onClick={() => setView("list")}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2.5 text-sm font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
            aria-label="กลับไปยังรายการแชท"
          >
            <span aria-hidden="true" className="text-lg">‹</span>
            <span>แชททั้งหมด</span>
          </button>
          <div className="flex rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-0.5">
            <button
              type="button"
              onClick={() => setView("chat")}
              className={`min-h-9 rounded-[10px] px-3 text-xs font-semibold transition-colors ${view === "chat" ? "bg-[var(--app-surface)] text-[var(--app-accent)] shadow-sm" : "text-[var(--app-text-secondary)]"}`}
            >
              แชท
            </button>
            <button
              type="button"
              onClick={() => setView("info")}
              className={`min-h-9 rounded-[10px] px-3 text-xs font-semibold transition-colors ${view === "info" ? "bg-[var(--app-surface)] text-[var(--app-accent)] shadow-sm" : "text-[var(--app-text-secondary)]"}`}
            >
              ข้อมูล
            </button>
          </div>
        </div>,
        detailPane,
      )
    : null;

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .app-shell[data-mobile-chat-view] [data-chat-pane="sidebar"],
          .app-shell[data-mobile-chat-view] [data-chat-separator] {
            display: none !important;
          }

          .app-shell[data-mobile-chat-view] *:has(> [data-chat-pane="conversations"]) {
            display: flex !important;
            min-width: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            grid-template-columns: 1fr !important;
          }

          .app-shell[data-mobile-chat-view="list"] [data-chat-pane="conversations"] {
            display: flex !important;
            flex: 1 1 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            border-right: 0 !important;
          }
          .app-shell[data-mobile-chat-view="list"] [data-chat-pane="detail"] {
            display: none !important;
          }

          .app-shell[data-mobile-chat-view="chat"] [data-chat-pane="conversations"],
          .app-shell[data-mobile-chat-view="info"] [data-chat-pane="conversations"] {
            display: none !important;
          }
          .app-shell[data-mobile-chat-view="chat"] [data-chat-pane="detail"],
          .app-shell[data-mobile-chat-view="info"] [data-chat-pane="detail"] {
            display: flex !important;
            flex: 1 1 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
          }

          [data-mobile-chat-toolbar] { order: -20; }
          [data-chat-detail-workspace] {
            height: auto !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
          }

          [data-chat-detail-header] {
            padding: 0.625rem 0.75rem !important;
            gap: 0.5rem !important;
          }
          [data-chat-detail-header] > div:first-child {
            width: 100%;
          }
          [data-chat-detail-header] > div:last-child {
            width: 100%;
            justify-content: flex-end;
          }
          [data-chat-detail-primary-action] {
            min-height: 2.5rem;
          }

          .app-shell[data-mobile-chat-view="chat"] [data-chat-detail-scroll] {
            display: none !important;
          }
          .app-shell[data-mobile-chat-view="chat"] [data-chat-detail-workspace] > div:has([data-chat-message-scroll]) {
            display: flex !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
          }
          .app-shell[data-mobile-chat-view="chat"] [data-chat-message-scroll] {
            height: auto !important;
            min-height: 0 !important;
            flex: 1 1 auto !important;
            padding: 0.75rem !important;
          }
          .app-shell[data-mobile-chat-view="chat"] [data-chat-message-scroll] > div > div > div[class*="max-w"] {
            max-width: 82% !important;
          }
          .app-shell[data-mobile-chat-view="chat"] [data-chat-reply-composer] {
            padding: 0.625rem 0.75rem !important;
          }
          .app-shell[data-mobile-chat-view="chat"] [data-chat-reply-composer] textarea {
            font-size: 16px !important;
          }
          .app-shell[data-mobile-chat-view="chat"] [data-chat-reply-composer] > p:last-child {
            display: none !important;
          }
          .app-shell[data-mobile-chat-view="chat"] [data-line-oa-manager-notice] {
            display: none !important;
          }

          .app-shell[data-mobile-chat-view="info"] [data-chat-detail-workspace] > div:has([data-chat-message-scroll]) {
            display: none !important;
          }
          .app-shell[data-mobile-chat-view="info"] [data-chat-detail-scroll] {
            display: block !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
            overflow-y: auto !important;
          }

          [data-chat-pane="conversations"] > div:first-child {
            padding: 0.75rem !important;
          }
          [data-chat-pane="conversations"] [data-chat-filter-button] {
            min-height: 2.5rem;
          }
          [data-chat-pane="conversations"] [data-conversation-row] {
            padding: 0.875rem 0.75rem !important;
            min-height: 5.25rem;
          }
          [data-chat-pane="conversations"] [data-conversation-action-menu] {
            min-width: 2.5rem;
            min-height: 2.5rem;
          }
          [data-chat-pane="conversations"] .app-filter-panel {
            grid-template-columns: 1fr !important;
            max-height: 48dvh;
            overflow-y: auto;
          }
        }
      `}</style>
      {toolbar}
    </>
  );
}
