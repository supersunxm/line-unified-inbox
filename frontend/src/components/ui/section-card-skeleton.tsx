"use client";

import React from "react";
import { Skeleton } from "./loading-state";

/**
 * Placeholder for SectionCard while data loads.
 */
export function SectionCardSkeleton({
  lineCount = 5,
  className = "",
  ...rest
}: {
  lineCount?: number;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`overflow-hidden rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] flex flex-col ${className}`}
      {...rest}
      aria-hidden="true"
    >
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--app-border-subtle)] px-4">
        <Skeleton className="h-4 w-32" />
      </header>
      <div className="flex-1 space-y-3 p-4">
        {Array.from({ length: lineCount }).map((_, index) => (
          <Skeleton
            key={index}
            className={`h-3.5 ${index === lineCount - 1 ? "w-48 max-w-full" : "w-full"}`}
          />
        ))}
      </div>
    </section>
  );
}
