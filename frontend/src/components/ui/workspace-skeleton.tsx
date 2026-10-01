"use client";

import React from "react";
import { Skeleton } from "./loading-state";
import { useDeferredLoading } from "./use-deferred-loading";

/**
 * Placeholder for a page body while its data (or the signed-in user) is not
 * available yet. Shows layout only — never real content. Deferred by 200ms
 * to avoid flickering on fast networks.
 */
export function WorkspaceSkeleton({
  label = "กำลังโหลด…",
  className = "",
  delay = 200,
  isLoading = true,
}: {
  /** Announced to screen readers; not shown visually. */
  label?: string;
  className?: string;
  /** Milliseconds to wait before showing; defaults to 200. */
  delay?: number;
  /** Whether to defer; set to false to show immediately. Defaults to true. */
  isLoading?: boolean;
}) {
  const show = useDeferredLoading(delay, isLoading);
  if (!show) return null;
  return (
    <div role="status" aria-busy="true" className={`flex min-w-0 flex-col gap-5 p-4 sm:p-6 ${className}`}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
      <div aria-hidden="true" className="space-y-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border-subtle)] bg-[var(--app-surface)] p-4">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-3.5" />
        ))}
      </div>
    </div>
  );
}
