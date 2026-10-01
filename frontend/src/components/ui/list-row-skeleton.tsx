"use client";

import React from "react";
import { Skeleton } from "./loading-state";

/**
 * Placeholder for a list row while data loads. Shows an avatar on the left
 * and text lines on the right.
 */
export function ListRowSkeleton({
  lineCount = 2,
  className = "",
  ...rest
}: {
  lineCount?: number;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-start gap-3 p-3 border-b border-[var(--app-border-subtle)] last:border-b-0 ${className}`}
      {...rest}
      aria-hidden="true"
    >
      <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
      <div className="flex-1 min-w-0 space-y-2">
        {Array.from({ length: lineCount }).map((_, index) => (
          <Skeleton
            key={index}
            className={`h-3.5 ${index === 0 ? "w-40 max-w-full" : "w-32 max-w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}
