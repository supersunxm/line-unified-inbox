"use client";

import { useEffect, useState } from "react";
import { ApplicationWorkspace } from "../page";
import { MobileFriendSourceLinksApp } from "./mobile-friend-source-links-app";

type ViewportMode = "loading" | "mobile" | "desktop";

export default function FriendSourceLinksPage() {
  const [mode, setMode] = useState<ViewportMode>("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMode(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mode === "loading") return <main className="flex h-dvh w-full items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิด Friend Source Links...</main>;
  if (mode === "mobile") return <MobileFriendSourceLinksApp />;
  return <ApplicationWorkspace initialSection="friend-source-links" />;
}
