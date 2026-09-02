"use client";

import { useEffect, useState } from "react";
import { AuthorizedSection, AuthorizedWorkspace } from "../authorized-workspace";
import { LegacyI18nBoundary } from "../legacy-i18n-boundary";
import { pickLanguageText, useAppLanguage } from "../language";
import { dashboardLegacyPhrases, dashboardLegacyTemplates } from "./dashboard-legacy-i18n";
import { MobileDashboardApp } from "./mobile-dashboard-app";

type ViewportMode = "loading" | "mobile" | "desktop";

const dashboardRouteTranslations = {
  th: { opening: "กำลังเปิดแดชบอร์ด..." },
  en: { opening: "Opening dashboard..." },
  zh: { opening: "正在打开仪表板..." },
};

export default function DashboardPage() {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, dashboardRouteTranslations);
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
        {t.opening}
      </main>
    );
  }

  const workspace = mode === "mobile" ? (
    <AuthorizedSection section="dashboard">
      <MobileDashboardApp />
    </AuthorizedSection>
  ) : (
    <AuthorizedWorkspace section="dashboard" />
  );

  return (
    <LegacyI18nBoundary
      phrases={dashboardLegacyPhrases}
      templates={dashboardLegacyTemplates}
      showControl={false}
    >
      {workspace}
    </LegacyI18nBoundary>
  );
}
