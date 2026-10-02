"use client";

import React, { useEffect } from "react";
import type { PrimarySection } from "@/app/primary-navigation";
import { useAppLanguage } from "@/app/language";
import { api } from "@/lib/api";
import { getAuthUser, useAuthUserSnapshot } from "@/lib/auth-user-store";
import { AppShell } from "./app-shell";

/**
 * AppShell (sidebar + top bar) around an internal page that renders its own body.
 * The user comes from the shared auth store: inside AuthorizedSection it is already
 * cached, so this makes no extra request; elsewhere getAuthUser() loads it once.
 * `section` only drives the mobile "More" highlight and the fallback page title;
 * the sidebar picks its active item from the pathname.
 */
export function InternalPageShell({ section, children }: { section: PrimarySection; children: React.ReactNode }) {
  const { language, setLanguage } = useAppLanguage();
  const { user } = useAuthUserSnapshot();

  useEffect(() => {
    void getAuthUser().catch(() => undefined);
  }, []);

  const logout = async () => {
    await api.logout().catch(() => undefined);
    window.location.replace("/");
  };

  return (
    <AppShell
      currentSection={section}
      authUser={user}
      text={{ appName: "OPPO LINE OA Monitor" }}
      language={language}
      changeLanguage={setLanguage}
      searchText=""
      setSearchText={() => undefined}
      logout={logout}
    >
      {children}
    </AppShell>
  );
}
