"use client";

import React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center select-none ${className}`}>
      {icon ? (
        <div className="mb-3 text-[var(--app-text-tertiary)] flex items-center justify-center">
          {icon}
        </div>
      ) : (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-[var(--app-text-tertiary)] border border-[var(--app-border-subtle)]">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
      )}
      <h4 className="text-sm font-semibold text-[var(--app-text-primary)]">{title}</h4>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-[var(--app-text-secondary)] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
