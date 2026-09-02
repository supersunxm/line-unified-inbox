"use client";

import { useEffect, useState } from "react";
import { AuthorizedSection, AuthorizedWorkspace } from "../authorized-workspace";
import { LegacyI18nBoundary } from "../legacy-i18n-boundary";
import { pickLanguageText, useAppLanguage } from "../language";
import { mobileMassMessagesPhrases, mobileMassMessagesTemplates } from "../mobile-route-i18n";
import { MobileMassMessagesApp } from "./mobile-mass-messages-app";
import { PurchaseBroadcastDraftBanner } from "./purchase-broadcast-draft-banner";

type ViewportMode = "loading" | "mobile" | "desktop";

export default function MassMessagesPage() {
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
        {pickLanguageText(language, { th: "กำลังเปิด Mass Message...", en: "Opening mass messages...", zh: "正在打开群发消息..." })}
      </main>
    );
  }

  if (mode === "mobile") {
    return (
      <AuthorizedSection section="mass-messages">
        <LegacyI18nBoundary phrases={mobileMassMessagesPhrases} templates={mobileMassMessagesTemplates}>
          <MobileMassMessagesApp />
        </LegacyI18nBoundary>
      </AuthorizedSection>
    );
  }

  return (
    <>
      <AuthorizedWorkspace section="mass-messages" />
      <AuthorizedSection section="mass-messages">
        <PurchaseBroadcastDraftBanner />
      </AuthorizedSection>
    </>
  );
}
