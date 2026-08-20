"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type MobileChatView = "list" | "chat" | "info";

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

function getShell() {
  return document.querySelector<HTMLElement>(".app-shell");
}

function getDetailPane() {
  return document.querySelector<HTMLElement>('[data-chat-pane="detail"]');
}

function hasChatPanes() {
  return Boolean(
    document.querySelector('[data-chat-pane="conversations"]') &&
    document.querySelector('[data-chat-pane="detail"]'),
  );
}

export function MobileChatsController() {
  const [view, setView] = useState<MobileChatView>("list");
  const [detailPane, setDetailPane] = useState<HTMLElement | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);

  useEffect(() => {
    if (!isMobileViewport()) return;

    const params = new URLSearchParams(window.location.search);
    const hasDeepLinkedConversation = Boolean(params.get("conversationId"));
    setView(hasDeepLinkedConversation ? "chat" : "list");

    const connectWorkspace = () => {
      const shell = getShell();
      const detail = getDetailPane();
      const ready = Boolean(shell && detail && hasChatPanes());

      setWorkspaceReady(ready);
      if (detail) setDetailPane(detail);
      if (ready && shell) {
        shell.setAttribute("data-mobile-chat-view", hasDeepLinkedConversation ? "chat" : "list");
      }
      return ready;
    };

    connectWorkspace();

    const observer = new MutationObserver(() => {
      connectWorkspace();
    });
    observer.observe(document.body, { childList: true, subtree: true });

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
        getShell()?.removeAttribute("data-mobile-chat-view");
      } else {
        connectWorkspace();
      }
    };
    media.addEventListener("change", handleViewport);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", openConversation, true);
      document.removeEventListener("keydown", openConversation, true);
      media.removeEventListener("change", handleViewport);
      getShell()?.removeAttribute("data-mobile-chat-view");
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport() || !workspaceReady) return;
    const shell = getShell();
    shell?.setAttribute("data-mobile-chat-view", view);

    if (view === "list") {
      document.querySelector<HTMLElement>('[data-chat-pane="conversations"]')?.scrollTo({ top: 0 });
    } else if (view === "chat") {
      window.requestAnimationFrame(() => {
        const messageScroll = document.querySelector<HTMLElement>("[data-chat-message-scroll]");
        if (messageScroll) messageScroll.scrollTop = messageScroll.scrollHeight;
      });
    }
  }, [view, workspaceReady]);

  const toolbar = detailPane && workspaceReady && view !== "list"
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
          .app-shell[data-mobile-chat-view] {
            padding-bottom: 0 !important;
          }

          .app-shell[data-mobile-chat-view] [data-chat-pane="sidebar"],
          .app-shell[data-mobile-chat-view] [data-chat-separator] {
            display: none !important;
          }

          .app-shell[data-mobile-chat-view] [data-chat-pane="conversations"],
          .app-shell[data-mobile-chat-view] [data-chat-pane="detail"] {
            min-width: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            border-right: 0 !important;
          }

          .app-shell[data-mobile-chat-view="list"] [data-chat-pane="conversations"] {
            display: flex !important;
            flex: 1 1 auto !important;
            height: 100% !important;
            min-height: 0 !important;
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
            height: 100% !important;
            min-height: 0 !important;
          }

          .app-shell[data-mobile-chat-view="chat"] nav[aria-label="Mobile primary navigation"],
          .app-shell[data-mobile-chat-view="info"] nav[aria-label="Mobile primary navigation"] {
            display: none !important;
          }

          .app-shell[data-mobile-chat-view="list"] nav[aria-label="Mobile primary navigation"] {
            display: grid !important;
          }
          .app-shell[data-mobile-chat-view="list"] {
            padding-bottom: calc(4.35rem + env(safe-area-inset-bottom)) !important;
          }

          [data-mobile-chat-toolbar] {
            order: -20;
            position: relative;
            z-index: 4;
          }

          [data-chat-detail-workspace] {
            height: 100% !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
            overflow: hidden !important;
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
            max-width: 84% !important;
          }
          .app-shell[data-mobile-chat-view="chat"] [data-chat-reply-composer] {
            padding: 0.625rem 0.75rem calc(0.625rem + env(safe-area-inset-bottom)) !important;
          }
          .app-shell[data-mobile-chat-view="chat"] [data-chat-reply-composer] textarea {
            font-size: 16px !important;
          }
          .app-shell[data-mobile-chat-view="chat"] [data-chat-reply-composer] > p:last-child,
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
            padding-bottom: env(safe-area-inset-bottom);
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
