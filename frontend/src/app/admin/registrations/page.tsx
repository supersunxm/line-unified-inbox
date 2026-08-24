"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthorizedSection } from "../../authorized-workspace";
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

  return (
    <AuthorizedSection section="admin-registrations">
      <Link
        href="/admin/registrations/hq"
        className="fixed right-4 top-4 z-[80] rounded-full bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white shadow-lg"
      >
        HQ Approvals
      </Link>
      {mode === "mobile" ? <MobileAdminRegistrationsApp /> : <AdminRegistrationsDesktop />}
    </AuthorizedSection>
  );
}
