"use client";

import { useEffect, useState } from "react";
import { AuthorizedSection, AuthorizedWorkspace } from "../authorized-workspace";
import { MobileStoresApp } from "./mobile-stores-app";

type ViewportMode = "loading" | "mobile" | "desktop";

export default function StoresPage() {
  const [mode, setMode] = useState<ViewportMode>("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMode(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mode === "loading") {
    return <main className="flex h-dvh w-full items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิดข้อมูลร้านค้า...</main>;
  }

  if (mode === "mobile") {
    return <AuthorizedSection section="stores"><MobileStoresApp /></AuthorizedSection>;
  }
  return <AuthorizedWorkspace section="stores" />;
}
