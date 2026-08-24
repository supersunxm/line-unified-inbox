"use client";

import { useEffect, useState } from "react";
import { AuthorizedSection, AuthorizedWorkspace } from "../authorized-workspace";
import { MobileMassMessagesApp } from "./mobile-mass-messages-app";
import { PurchaseBroadcastDraftBanner } from "./purchase-broadcast-draft-banner";

type ViewportMode = "loading" | "mobile" | "desktop";

export default function MassMessagesPage() {
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
        กำลังเปิด Mass Message...
      </main>
    );
  }

  if (mode === "mobile") return <AuthorizedSection section="mass-messages"><MobileMassMessagesApp /></AuthorizedSection>;

  return (
    <>
      <AuthorizedWorkspace section="mass-messages" />
      <AuthorizedSection section="mass-messages"><PurchaseBroadcastDraftBanner /></AuthorizedSection>
    </>
  );
}
