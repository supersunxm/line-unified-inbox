"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  MobileBottomNav,
  MobileMoreSheet,
  MobilePageShell,
} from "@/components/mobile/adaptive-mobile";
import { DashboardView } from "./dashboard-view";

type MobileUser = {
  displayName: string;
  role: "ADMIN" | "VIEWER";
};

export function MobileDashboardApp() {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let active = true;
    void api
      .me()
      .then((value) => {
        if (!active) return;
        setUser({ displayName: value.displayName, role: value.role });
      })
      .catch(() => undefined);

    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <MobilePageShell
      bottomNav={
        <MobileBottomNav current="dashboard" onMore={() => setMoreOpen(true)} />
      }
    >
      <div className="min-h-full overflow-x-hidden bg-[var(--app-bg)]">
        <DashboardView
          language="th"
          getStoreDisplayName={(name) => name}
          onOpenStore={(storeId) => {
            const params = new URLSearchParams({ store: storeId });
            window.location.assign(`/chats?${params.toString()}`);
          }}
          lastUpdatedAt={null}
        />
      </div>

      {moreOpen && user ? (
        <MobileMoreSheet
          displayName={user.displayName}
          role={user.role}
          onClose={() => setMoreOpen(false)}
        />
      ) : null}
    </MobilePageShell>
  );
}
