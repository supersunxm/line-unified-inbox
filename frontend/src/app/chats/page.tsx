"use client";

import { useEffect, useState } from "react";
import { MobileChatsApp } from "@/components/chats/mobile-chats-app";
import { ApplicationWorkspace } from "../page";

type ViewportMode = "loading" | "mobile" | "desktop";

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
    ? <MobileChatsApp />
    : <ApplicationWorkspace initialSection="chats" />;
}
