"use client";

import { useEffect, useState } from "react";
import { AuthorizedSection, AuthorizedWorkspace } from "../authorized-workspace";
import { pickLanguageText, useAppLanguage } from "../language";
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

  // The monthly dashboard is translated through the metrics translation table; it needs no
  // phrase-matching boundary (which also rewrote its Gregorian dates into Buddhist years).
  return workspace;
}
