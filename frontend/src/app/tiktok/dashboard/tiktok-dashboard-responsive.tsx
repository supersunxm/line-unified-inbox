"use client";

import { useEffect, useState } from "react";
import { useAppLanguage } from "../../language";
import type { TikTokAccountListItem, TikTokHistoricalMetricsData, TikTokStoreData } from "../tiktok-types";
import { MobileTikTokDashboardView } from "./mobile-tiktok-dashboard-view";
import { getTikTokDashboardText } from "./tiktok-dashboard-translations";
import { TikTokDashboardView } from "./tiktok-dashboard-view";

type Props = {
  data: TikTokStoreData | null;
  historicalMetrics?: TikTokHistoricalMetricsData | null;
  accounts?: TikTokAccountListItem[];
  currentAccountId?: string;
};

type ViewportMode = "loading" | "mobile" | "desktop";

export function TikTokDashboardResponsive(props: Props) {
  const { language } = useAppLanguage();
  const t = getTikTokDashboardText(language);
  const [mode, setMode] = useState<ViewportMode>("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMode(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mode === "loading") return <main className="flex h-dvh items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">{t.opening}</main>;
  if (mode === "mobile") return <MobileTikTokDashboardView {...props} />;
  return <TikTokDashboardView {...props} />;
}
