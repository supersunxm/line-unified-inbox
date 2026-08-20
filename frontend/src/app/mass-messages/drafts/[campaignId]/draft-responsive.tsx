"use client";

import { useEffect, useState } from "react";
import { MobilePurchaseBroadcastComposer } from "../../mobile-purchase-broadcast-composer";
import { PurchaseBroadcastComposer } from "../../purchase-broadcast-composer";

type ViewportMode = "loading" | "mobile" | "desktop";

export function PurchaseBroadcastDraftResponsive({ campaignId }: { campaignId: string }) {
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
        กำลังเปิด Campaign Draft...
      </main>
    );
  }

  if (mode === "mobile") return <MobilePurchaseBroadcastComposer campaignId={campaignId} />;
  return <PurchaseBroadcastComposer campaignId={campaignId} />;
}
