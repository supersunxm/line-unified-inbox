"use client";

import React from "react";

export interface PageHeaderProps {
  tag?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  actionSlot?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  tag,
  title,
  description,
  actions,
  actionSlot,
  className = "",
}: PageHeaderProps) {
  const resolvedActions = actions ?? actionSlot;
  return (
    <header className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-1 select-none ${className}`}>
      <div>
        {tag && (
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--app-text-tertiary)]">
            {tag}
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--app-text-primary)]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-xs text-[var(--app-text-secondary)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {resolvedActions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
          {resolvedActions}
        </div>
      )}
    </header>
  );
}
