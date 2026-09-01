"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { PrimarySection } from "./primary-navigation";
import { ApplicationWorkspace } from "./page";
import { ApiError, api } from "@/lib/api";
import { canAccessPrimarySection, defaultRouteForUser, type AuthUser } from "@/lib/authorization";
import { LanguageControl, pickLanguageText, useAppLanguage } from "./language";

const accessTranslations = {
  th: {
    unable: "ไม่สามารถตรวจสอบสิทธิ์การเข้าถึง Workspace ได้",
    retry: "ลองอีกครั้ง",
    checking: "กำลังตรวจสอบสิทธิ์การเข้าถึง Workspace…",
  },
  en: {
    unable: "Unable to verify workspace access",
    retry: "Retry",
    checking: "Checking workspace access…",
  },
  zh: {
    unable: "无法验证工作区访问权限",
    retry: "重试",
    checking: "正在检查工作区访问权限…",
  },
};

export function AuthorizedSection({ section, children }: { section: PrimarySection; children: ReactNode }) {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, accessTranslations);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.me()
      .then((rawUser) => {
        if (cancelled) return;
        const user = rawUser as AuthUser;
        if (!canAccessPrimarySection(user, section)) {
          window.location.replace(defaultRouteForUser(user));
          return;
        }
        setAllowed(true);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof ApiError && reason.status === 401) {
          window.location.replace("/login");
          return;
        }
        setError(reason instanceof Error ? reason.message : t.unable);
      });
    return () => { cancelled = true; };
  }, [section, t.unable]);

  if (error) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-[var(--app-bg)] p-6 text-[var(--app-text-primary)]">
        <LanguageControl className="absolute right-4 top-4" />
        <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-center shadow-[var(--app-shadow-sm)]">
          <h1 className="text-lg font-semibold">{t.unable}</h1>
          <p className="mt-2 text-sm text-[var(--app-danger)]">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white">{t.retry}</button>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">
        <LanguageControl className="absolute right-4 top-4" />
        {t.checking}
      </main>
    );
  }

  return children;
}

export function AuthorizedWorkspace({ section }: { section: PrimarySection }) {
  return (
    <AuthorizedSection section={section}>
      <ApplicationWorkspace initialSection={section} />
    </AuthorizedSection>
  );
}
