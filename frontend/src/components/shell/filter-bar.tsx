"use client";

import React from "react";

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchSlot?: React.ReactNode;
  filterSlot?: React.ReactNode;
  filtersSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
}

export function FilterBar({
  searchSlot,
  filterSlot,
  filtersSlot,
  actionSlot,
  className = "",
  children,
  ...rest
}: FilterBarProps) {
  const resolvedFilterSlot = filterSlot ?? filtersSlot;
  if (children) {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-card)] ${className}`}
        {...rest}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-card)] ${className}`}
      {...rest}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-0">
        {searchSlot && <div className="w-full sm:w-64 max-w-sm">{searchSlot}</div>}
        {resolvedFilterSlot && <div className="flex flex-wrap items-center gap-2">{resolvedFilterSlot}</div>}
      </div>
      {actionSlot && (
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {actionSlot}
        </div>
      )}
    </div>
  );
}
