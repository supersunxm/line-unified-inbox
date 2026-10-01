"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import type { PrimarySection } from "./primary-navigation";
import { ApplicationWorkspace } from "./page";
import { ApiError } from "@/lib/api";
import { canAccessPrimarySection, defaultRouteForUser, type AuthUser } from "@/lib/authorization";
import { beginLoginRedirect, isLoginRedirectStarted } from "@/lib/auth-session";
import { authUserStore, getAuthUser, useAuthUserSnapshot } from "@/lib/auth-user-store";
import { ShellSkeleton } from "@/components/shell/shell-skeleton";
import { WorkspaceSkeleton } from "@/components/ui/workspace-skeleton";
import { useDeferredLoading } from "@/components/ui/use-deferred-loading";
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

const AuthorizedUserContext = createContext<AuthUser | null>(null);

/** The signed-in user resolved by the nearest AuthorizedSection, or null outside one. */
export function useAuthorizedUser(): AuthUser | null {
  return useContext(AuthorizedUserContext);
}

export function AuthorizedSection({ section, children }: { section: PrimarySection; children: ReactNode }) {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, accessTranslations);
  const snapshot = useAuthUserSnapshot();
  // Freshness is judged once, when this gate mounts: a cached user up to five
  // minutes old renders immediately; an older one waits for the refetch.
  const [blockedVersion] = useState(() => (authUserStore.peekUsable() ? null : authUserStore.getSnapshot().version));
  const [error, setError] = useState<string | null>(null);
  const user = snapshot.user && snapshot.version !== blockedVersion ? snapshot.user : null;
  const allowed = user !== null && canAccessPrimarySection(user, section);
  const deniedUser = user !== null && !allowed ? user : null;
  // A cache hit is allowed on the first render, so no skeleton ever shows. A real
  // wait shows the bare frame for 200ms, then the skeleton for at least 400ms.
  const showSkeleton = useDeferredLoading(!allowed && !error);

  useEffect(() => {
    let cancelled = false;
    void getAuthUser()
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof ApiError && reason.status === 401) {
          beginLoginRedirect();
          window.location.replace("/login");
          return;
        }
        setError(reason instanceof Error ? reason.message : t.unable);
      });
    return () => { cancelled = true; };
  }, [section, t.unable]);

  // Runs for the first answer and for any background revalidation that changes access.
  useEffect(() => {
    const user = deniedUser;
    if (!user || isLoginRedirectStarted()) return;
    window.location.replace(defaultRouteForUser(user));
  }, [deniedUser]);

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

  if (!allowed || showSkeleton) {
    return (
      <ShellSkeleton placeholders={showSkeleton}>
        {showSkeleton && <WorkspaceSkeleton label={t.checking} />}
      </ShellSkeleton>
    );
  }

  return <AuthorizedUserContext.Provider value={user}>{children}</AuthorizedUserContext.Provider>;
}

/** Hands the gate's user to the workspace so it skips its own setup-status and /auth/me calls. */
function GatedApplicationWorkspace({ section }: { section: PrimarySection }) {
  const user = useAuthorizedUser();
  return <ApplicationWorkspace initialSection={section} initialAuthUser={user} />;
}

export function AuthorizedWorkspace({ section }: { section: PrimarySection }) {
  return (
    <AuthorizedSection section={section}>
      <GatedApplicationWorkspace section={section} />
    </AuthorizedSection>
  );
}
