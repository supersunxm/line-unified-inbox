"use client";

import React from "react";
import { Skeleton } from "./loading-state";
import { kpiGridClass } from "./kpi-strip-model";

/**
 * Placeholder for KpiStrip while data loads. Shows 4 items in the default layout.
 */
export function KpiStripSkeleton({
  itemCount = 4,
  className = "",
  ...rest
}: {
  itemCount?: number;
  className?: string;
} & React.HTMLAttributes<HTMLDListElement>) {
  return (
    <dl className={`${kpiGridClass(4)} ${className}`} {...rest} aria-hidden="true">
      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={index} className="min-w-0 bg-[var(--app-surface)] px-4 py-3.5 space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </dl>
  );
}
