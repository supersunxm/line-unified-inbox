"use client";

import { useEffect, useState } from "react";
import { ApplicationWorkspace } from "../page";
import { MobileClassificationInsightsApp } from "./mobile-classification-insights-app";

type ViewportMode = "loading" | "mobile" | "desktop";

export default function ClassificationInsightsPage() {
  const [mode, setMode] = useState<ViewportMode>("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMode(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mode === "loading") return <main className="flex h-dvh w-full items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิด Classification Insights...</main>;
  if (mode === "mobile") return <MobileClassificationInsightsApp />;
  return <ApplicationWorkspace initialSection="classification-insights" />;
}
