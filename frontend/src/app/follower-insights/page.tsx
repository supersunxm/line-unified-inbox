"use client";

import { useEffect, useState } from "react";
import { AuthorizedSection, AuthorizedWorkspace } from "../authorized-workspace";
import { pickLanguageText, useAppLanguage } from "../language";
import { MobileFollowerInsightsApp } from "./mobile-follower-insights-app";
import styles from "./follower-insights-modern.module.css";
import polish from "./follower-insights-polish.module.css";

type ViewportMode = "loading" | "mobile" | "desktop";

export default function FollowerInsightsPage() {
  const { language } = useAppLanguage();
  const [mode, setMode] = useState<ViewportMode>("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMode(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mode === "loading") {
    return <main className="flex h-dvh w-full items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">{pickLanguageText(language, { th: "กำลังเปิดข้อมูลผู้ติดตาม...", en: "Opening follower insights...", zh: "正在打开关注者数据..." })}</main>;
  }

  if (mode === "mobile") {
    return <AuthorizedSection section="follower-insights"><MobileFollowerInsightsApp /></AuthorizedSection>;
  }

  return (
    <AuthorizedSection section="follower-insights">
      <div className={`${styles.scope} ${polish.scope}`}>
        <AuthorizedWorkspace section="follower-insights" />
      </div>
    </AuthorizedSection>
  );
}
