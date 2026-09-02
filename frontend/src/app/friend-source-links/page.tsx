"use client";

import { useEffect, useState } from "react";
import { AuthorizedSection, AuthorizedWorkspace } from "../authorized-workspace";
import { LegacyI18nBoundary } from "../legacy-i18n-boundary";
import { pickLanguageText, useAppLanguage } from "../language";
import { friendSourceLinksPhrases, friendSourceLinksTemplates } from "./friend-source-links-i18n";
import { MobileFriendSourceLinksApp } from "./mobile-friend-source-links-app";

type ViewportMode = "loading" | "mobile" | "desktop";

export default function FriendSourceLinksPage() {
  const { language } = useAppLanguage();
  const [mode, setMode] = useState<ViewportMode>("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMode(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mode === "loading") return <main className="flex h-dvh w-full items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">{pickLanguageText(language, { th: "กำลังเปิด Friend Source Links...", en: "Opening Friend Source Links...", zh: "正在打开好友来源链接..." })}</main>;
  if (mode === "mobile") return <AuthorizedSection section="friend-source-links"><LegacyI18nBoundary phrases={friendSourceLinksPhrases} templates={friendSourceLinksTemplates}><MobileFriendSourceLinksApp /></LegacyI18nBoundary></AuthorizedSection>;
  return <AuthorizedWorkspace section="friend-source-links" />;
}
