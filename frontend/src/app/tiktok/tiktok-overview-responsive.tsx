"use client";

import { useEffect, useState } from "react";
import { useAppLanguage } from "../language";
import { getTikTokOverviewText } from "./tiktok-overview-translations";
import type { TikTokAccountListItem, TikTokBulkMetricsSummaryResponse, TikTokHistoricalMetricsData, TikTokStoreData } from "./tiktok-types";
import { MobileTikTokOverviewView } from "./mobile-tiktok-overview-view";
import { TikTokOverviewView } from "./tiktok-overview-view";

type Props = {
  accounts?: TikTokAccountListItem[];
  singleAccountData?: TikTokStoreData | null;
  historicalMetrics?: TikTokHistoricalMetricsData | null;
  bulkMetricsSummary?: TikTokBulkMetricsSummaryResponse | null;
  data?: TikTokStoreData | null;
};

type ViewportMode = "loading" | "mobile" | "desktop";

export function TikTokOverviewResponsive(props: Props) {
  const { language } = useAppLanguage();
  const t = getTikTokOverviewText(language);
  const [mode, setMode] = useState<ViewportMode>("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMode(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mode === "loading") return <main className="flex h-dvh items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">{t.opening}</main>;
  if (mode === "mobile") return <MobileTikTokOverviewView {...props} />;
  return <TikTokOverviewView {...props} />;
}
