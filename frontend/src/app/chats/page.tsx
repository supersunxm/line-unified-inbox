"use client";

import { useEffect, useState } from "react";
import { MobileChatsApp } from "@/components/chats/mobile-chats-app";
import { ApplicationWorkspace } from "../page";

type ViewportMode = "loading" | "mobile" | "desktop";

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

function ChatsUiOverrides() {
  return (
    <style>{`
      [data-product-intent-card] {
        display: none !important;
      }
    `}</style>
  );
}

export default function ChatsPage() {
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
        กำลังเปิดแชทร้านค้า...
      </main>
    );
  }

  return mode === "mobile"
    ? <><ChatsUiOverrides /><MobileViewportBridge /><MobileChatsApp /></>
    : <><ChatsUiOverrides /><ApplicationWorkspace initialSection="chats" /></>;
}
