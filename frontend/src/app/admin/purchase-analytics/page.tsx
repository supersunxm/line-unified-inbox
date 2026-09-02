"use client";

import { useEffect, useState } from "react";
import { AuthorizedSection } from "../../authorized-workspace";
import { LegacyI18nBoundary } from "../../legacy-i18n-boundary";
import { pickLanguageText, useAppLanguage } from "../../language";
import PurchaseAnalyticsDesktopPage from "./purchase-analytics-desktop";
import { purchaseAnalyticsPhrases, purchaseAnalyticsTemplates } from "./purchase-analytics-i18n";
import { MobilePurchaseAnalyticsApp } from "./mobile-purchase-analytics-app";

type ViewportMode = "loading" | "mobile" | "desktop";

const loadingText = {
  th: { opening: "กำลังเปิดข้อมูลการซื้อ..." },
  en: { opening: "Opening purchase intelligence..." },
  zh: { opening: "正在打开购买数据分析..." },
};

export default function PurchaseAnalyticsPage() {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, loadingText);
  const [mode, setMode] = useState<ViewportMode>("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMode(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mode === "loading") {
    return <main className="flex h-dvh w-full items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">{t.opening}</main>;
  }

  return (
    <LegacyI18nBoundary phrases={purchaseAnalyticsPhrases} templates={purchaseAnalyticsTemplates}>
      <AuthorizedSection section="purchase-analytics">
        {mode === "mobile" ? <MobilePurchaseAnalyticsApp /> : <PurchaseAnalyticsDesktopPage />}
      </AuthorizedSection>
    </LegacyI18nBoundary>
  );
}
