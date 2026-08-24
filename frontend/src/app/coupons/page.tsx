"use client";

import { useEffect, useState } from "react";
import { AuthorizedSection } from "../authorized-workspace";
import { CouponManagerAlignedView } from "./coupon-manager-aligned-view";
import { MobileCouponsApp } from "./mobile-coupons-app";

type ViewportMode = "loading" | "mobile" | "desktop";

export default function CouponsPage() {
  const [mode, setMode] = useState<ViewportMode>("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMode(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mode === "loading") {
    return <main className="flex h-dvh w-full items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิดคูปอง...</main>;
  }

  return (
    <AuthorizedSection section="coupons">
      {mode === "mobile" ? <MobileCouponsApp /> : <CouponManagerAlignedView />}
    </AuthorizedSection>
  );
}
