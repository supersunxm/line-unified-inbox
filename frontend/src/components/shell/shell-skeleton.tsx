"use client";

import React, { useSyncExternalStore } from "react";
import { Skeleton } from "@/components/ui/loading-state";
import { SIDEBAR_STORAGE_KEY } from "./app-sidebar";

function subscribeToNothing() {
  return () => undefined;
}

function readSidebarCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Static frame matching AppShell (sidebar + top bar) for use before the
 * signed-in user is known. It contains no navigation items and no data: the
 * real sidebar is permission-filtered and only renders once a user exists.
 */
export function ShellSkeleton({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(subscribeToNothing, readSidebarCollapsed, () => false);
  const sidebarWidth = collapsed ? "4.25rem" : "16rem";

  return (
    <div data-shell-skeleton className="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--app-text-primary)]">
      <aside
        aria-hidden="true"
        className="fixed inset-y-0 left-0 hidden flex-col gap-2 border-r border-[var(--app-border)] bg-[var(--app-surface)] p-3 md:flex"
        style={{ width: sidebarWidth }}
      >
        <Skeleton className="mb-3 h-8" />
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-8" />
        ))}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:ml-[var(--shell-skeleton-sidebar)]" style={{ ["--shell-skeleton-sidebar" as string]: sidebarWidth }}>
        <div aria-hidden="true" className="flex h-14 min-h-14 shrink-0 items-center gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 sm:px-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="ml-auto h-8 w-8 rounded-full" />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
