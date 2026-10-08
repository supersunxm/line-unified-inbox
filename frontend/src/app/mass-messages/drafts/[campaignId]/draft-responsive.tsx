"use client";

import { useEffect, useState } from "react";
import { MobilePurchaseBroadcastComposer } from "../../mobile-purchase-broadcast-composer";
import { PurchaseBroadcastComposer } from "../../purchase-broadcast-composer";
import { useAppLanguage, pickLanguageText } from "../../../language";

const translations = {
  th: { opening: "กำลังเปิดฉบับร่างแคมเปญ..." },
  en: { opening: "Opening campaign draft..." },
  zh: { opening: "正在打开群发草稿..." },
};

type ViewportMode = "loading" | "mobile" | "desktop";

export function PurchaseBroadcastDraftResponsive({ campaignId }: { campaignId: string }) {
  const { language } = useAppLanguage();
  const text = pickLanguageText(language, translations);
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
        {text.opening}
      </main>
    );
  }

  if (mode === "mobile") return <MobilePurchaseBroadcastComposer campaignId={campaignId} />;
  return <PurchaseBroadcastComposer campaignId={campaignId} />;
}
