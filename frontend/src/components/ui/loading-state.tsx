"use client";

import React from "react";

export function Skeleton({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--app-surface-subtle)] border border-[var(--app-border-subtle)]/50 ${className}`}
      {...rest}
    />
  );
}

export function LoadingSpinner({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-3",
  }[size];

  return (
    <div
      className={`animate-spin rounded-full border-[var(--app-border)] border-t-[var(--app-accent)] ${sizeClass} ${className}`}
      role="status"
      aria-label="กำลังโหลด..."
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 space-y-4 animate-pulse">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-48" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] overflow-hidden">
      <div className="border-b border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-[var(--app-border-subtle)] p-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 p-3 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadingState({
  message = "กำลังโหลด...",
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center text-xs text-[var(--app-text-secondary)] ${className}`}
      role="status"
    >
      <LoadingSpinner size="md" className="mb-3" />
      <span>{message}</span>
    </div>
  );
}
