"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MobileChatsApp } from "@/components/chats/mobile-chats-app";
import { api } from "@/lib/api";
import type { ApiBmReplyStatus, BmReplyStatusSummaryResponse } from "@/types/api";
import { AuthorizedSection, AuthorizedWorkspace } from "../authorized-workspace";
import { LegacyI18nBoundary } from "../legacy-i18n-boundary";
import { pickLanguageText, useAppLanguage } from "../language";
import { mobileChatsPhrases, mobileChatsTemplates } from "../mobile-route-i18n";

type ViewportMode = "loading" | "mobile" | "desktop";
type MobileStatusFilter = "all" | ApiBmReplyStatus;

function MobileViewportBridge() {
  useEffect(() => {
    let frame = 0;

    const syncViewport = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const height = Math.round(viewport?.height ?? window.innerHeight);
        const offsetTop = Math.round(viewport?.offsetTop ?? 0);

        document.documentElement.style.setProperty("--mobile-chat-vv-height", `${height}px`);
        document.documentElement.style.setProperty("--mobile-chat-vv-top", `${offsetTop}px`);
      });
    };

    syncViewport();
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);

    return () => {
      window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      document.documentElement.style.removeProperty("--mobile-chat-vv-height");
      document.documentElement.style.removeProperty("--mobile-chat-vv-top");
    };
  }, []);

  return (
    <style>{`
      @media (max-width: 767px) {
        [data-mobile-chats-root] {
          top: var(--mobile-chat-vv-top, 0px) !important;
          bottom: auto !important;
          height: var(--mobile-chat-vv-height, 100dvh) !important;
          max-height: var(--mobile-chat-vv-height, 100dvh) !important;
          transform: translateZ(0);
        }
      }
    `}</style>
  );
}

function MobileChatFiltersBridge() {
  const { language } = useAppLanguage();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [summary, setSummary] = useState<BmReplyStatusSummaryResponse | null>(null);
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState<MobileStatusFilter>("all");

  const labels = pickLanguageText(language, {
    th: { store: "ร้านค้า", selectStore: "เลือกร้านค้า", allStores: "ร้านค้าทั้งหมด", all: "ทั้งหมด", notReplied: "ยังไม่ตอบ", notifiedBm: "แจ้ง BM", replied: "ตอบแล้ว" },
    en: { store: "Store", selectStore: "Select store", allStores: "All stores", all: "All", notReplied: "Not replied", notifiedBm: "BM notified", replied: "Replied" },
    zh: { store: "门店", selectStore: "选择门店", allStores: "全部门店", all: "全部", notReplied: "尚未回复", notifiedBm: "已通知 BM", replied: "已回复" },
  });
  const locale = language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-US";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlStatus = params.get("bmReplyStatus");
    setStoreId(params.get("store") || "");
    setStatus(
      urlStatus === "NOT_REPLIED" || urlStatus === "NOTIFIED_BM" || urlStatus === "REPLIED"
        ? urlStatus
        : "all",
    );
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void api
        .bmReplyStatusSummary()
        .then((value) => {
          if (active) setSummary(value);
        })
        .catch(() => undefined);
    };
    refresh();
    window.addEventListener("bm-reply-status-summary-refresh", refresh);
    return () => {
      active = false;
      window.removeEventListener("bm-reply-status-summary-refresh", refresh);
    };
  }, []);

  useEffect(() => {
    const syncTarget = () => {
      const nextTarget = document.querySelector<HTMLElement>(
        '[data-mobile-chats-root][data-mobile-chats-view="list"] > header',
      );
      setTarget((current) => (current === nextTarget ? current : nextTarget));
    };

    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-mobile-chats-view"],
    });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;

  const selectedStore = summary?.stores.find((store) => store.storeId === storeId) ?? null;
  const counts = selectedStore ?? summary?.overview ?? { notReplied: 0, notifiedBm: 0, replied: 0 };
  const statusCounts: Record<MobileStatusFilter, number> = {
    all: counts.notReplied + counts.notifiedBm + counts.replied,
    NOT_REPLIED: counts.notReplied,
    NOTIFIED_BM: counts.notifiedBm,
    REPLIED: counts.replied,
  };
  const stores = [...(summary?.stores ?? [])].sort((a, b) => a.storeName.localeCompare(b.storeName, locale));

  const applyFilters = (nextStoreId: string, nextStatus: MobileStatusFilter) => {
    const url = new URL(window.location.href);
    if (nextStoreId) url.searchParams.set("store", nextStoreId);
    else url.searchParams.delete("store");
    if (nextStatus === "all") url.searchParams.delete("bmReplyStatus");
    else url.searchParams.set("bmReplyStatus", nextStatus);
    url.searchParams.delete("conversationId");
    window.location.assign(`${url.pathname}${url.search}`);
  };

  return createPortal(
    <div data-mobile-chat-filter-bridge className="mt-2.5 space-y-2">
      <label className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--app-text-tertiary)]">
          {labels.store}
        </span>
        <select
          value={storeId}
          onChange={(event) => {
            const nextStoreId = event.target.value;
            setStoreId(nextStoreId);
            applyFilters(nextStoreId, status);
          }}
          className="h-10 w-full appearance-none rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] pl-16 pr-9 text-sm font-semibold text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
          aria-label={labels.selectStore}
        >
          <option value="">{labels.allStores}</option>
          {stores.map((store) => (
            <option key={store.storeId} value={store.storeId}>
              {store.storeName}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--app-text-tertiary)]">⌄</span>
      </label>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {(
          [
            ["all", labels.all],
            ["NOT_REPLIED", labels.notReplied],
            ["NOTIFIED_BM", labels.notifiedBm],
            ["REPLIED", labels.replied],
          ] as Array<[MobileStatusFilter, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setStatus(value);
              applyFilters(storeId, value);
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              status === value
                ? "bg-[var(--app-accent)] text-white"
                : "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-secondary)]"
            }`}
          >
            {label} <span className="ml-1 opacity-80">{statusCounts[value].toLocaleString(locale)}</span>
          </button>
        ))}
      </div>
    </div>,
    target,
  );
}

function ChatsUiOverrides() {
  return (
    <style>{`
      [data-product-intent-card] {
        display: none !important;
      }

      @media (max-width: 767px) {
        [data-mobile-chats-root][data-mobile-chats-view="list"] > header > label + div {
          display: none !important;
        }
      }
    `}</style>
  );
}

export default function ChatsPage() {
  const { language } = useAppLanguage();
  const [mode, setMode] = useState<ViewportMode>("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMode(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mode === "loading") {
    return (
      <main className="flex h-dvh w-full items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">
        {pickLanguageText(language, { th: "กำลังเปิดแชทร้านค้า...", en: "Opening store chats...", zh: "正在打开门店聊天..." })}
      </main>
    );
  }

  if (mode === "mobile") {
    return (
      <AuthorizedSection section="chats">
        <LegacyI18nBoundary phrases={mobileChatsPhrases} templates={mobileChatsTemplates}>
          <ChatsUiOverrides />
          <MobileViewportBridge />
          <MobileChatFiltersBridge />
          <MobileChatsApp />
        </LegacyI18nBoundary>
      </AuthorizedSection>
    );
  }

  return (
    <>
      <ChatsUiOverrides />
      <AuthorizedWorkspace section="chats" />
    </>
  );
}
