"use client";

import { useEffect, useState } from "react";
import { AuthorizedSection } from "../authorized-workspace";
import { LegacyI18nBoundary } from "../legacy-i18n-boundary";
import { pickLanguageText, useAppLanguage } from "../language";
import { CouponManagerAlignedView } from "./coupon-manager-aligned-view";
import { couponPhrases, couponTemplates } from "./coupons-i18n";
import { MobileCouponsApp } from "./mobile-coupons-app";

type ViewportMode = "loading" | "mobile" | "desktop";

const routeText = {
  th: { opening: "กำลังเปิดคูปอง..." },
  en: { opening: "Opening coupons..." },
  zh: { opening: "正在打开优惠券..." },
};

export default function CouponsPage() {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, routeText);
  const [mode, setMode] = useState<ViewportMode>("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMode(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mode === "loading") {
    return <main className="flex h-dvh w-full items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">{t.opening}</main>;
  }

  return (
    <AuthorizedSection section="coupons">
      {mode === "mobile" ? (
        <LegacyI18nBoundary phrases={couponPhrases} templates={couponTemplates}>
          <MobileCouponsApp />
        </LegacyI18nBoundary>
      ) : (
        <CouponManagerAlignedView />
      )}
    </AuthorizedSection>
  );
}
