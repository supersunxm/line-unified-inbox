"use client";

import { useEffect, useState } from "react";
import { AuthorizedSection } from "../../authorized-workspace";
import PurchaseAnalyticsDesktopPage from "./purchase-analytics-desktop";
import { MobilePurchaseAnalyticsApp } from "./mobile-purchase-analytics-app";

type ViewportMode = "loading" | "mobile" | "desktop";

export default function PurchaseAnalyticsPage() {
  const [mode, setMode] = useState<ViewportMode>("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMode(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mode === "loading") {
    return <main className="flex h-dvh w-full items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิดข้อมูลการซื้อ...</main>;
  }

  return (
    <AuthorizedSection section="purchase-analytics">
      {mode === "mobile" ? <MobilePurchaseAnalyticsApp /> : <PurchaseAnalyticsDesktopPage />}
    </AuthorizedSection>
  );
}
