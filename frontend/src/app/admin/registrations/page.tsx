"use client";

import { useEffect, useState } from "react";
import AdminRegistrationsDesktop from "./admin-registrations-desktop";
import { MobileAdminRegistrationsApp } from "./mobile-admin-registrations-app";

type ViewportMode = "loading" | "mobile" | "desktop";

export default function AdminRegistrationsPage() {
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
        กำลังเปิด Account Management...
      </main>
    );
  }

  if (mode === "mobile") return <MobileAdminRegistrationsApp />;
  return <AdminRegistrationsDesktop />;
}
