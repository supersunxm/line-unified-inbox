"use client";

import React from "react";
import { Skeleton } from "./loading-state";

export interface ListRowSkeletonProps {
  count?: number;
  label?: string;
  /** Classes for the list that holds the rows (dividers, pulse). */
  listClassName?: string;
  rowClassName?: string;
  /** Row content; defaults to a 40px avatar and two text lines. */
  renderRow?: (index: number) => React.ReactNode;
  className?: string;
}

function DefaultRow() {
  return (
    <>
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <Skeleton className="h-3.5 w-40 max-w-full" />
        <Skeleton className="h-3 w-28 max-w-full" />
      </div>
    </>
  );
}

/**
 * A list of placeholder rows. The outer element announces the loading state;
 * the row list itself is aria-hidden because it contains only grey blocks.
 */
export function ListRowSkeleton({
  count = 5,
  label = "กำลังโหลด…",
  listClassName = "divide-y divide-[var(--app-border-subtle)]",
  rowClassName = "flex items-start gap-3 px-4 py-3",
  renderRow,
  className = "",
}: ListRowSkeletonProps) {
  return (
    <div role="status" aria-busy="true" className={className || undefined}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className={listClassName}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className={rowClassName}>
            {renderRow ? renderRow(index) : <DefaultRow />}
          </div>
        ))}
      </div>
    </div>
  );
}
