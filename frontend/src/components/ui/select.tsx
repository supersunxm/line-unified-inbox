"use client";

import React, { forwardRef } from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error = false, children, className = "", disabled, ...rest },
  ref
) {
  const baseClasses =
    "w-full h-9 pl-3 pr-8 text-xs bg-[var(--input-background)] text-[var(--app-text-primary)] border rounded-[var(--app-radius-md)] appearance-none transition-colors duration-120 outline-none cursor-pointer disabled:bg-[var(--disabled-background)] disabled:text-[var(--disabled-foreground)] disabled:cursor-not-allowed";
  const borderClasses = error
    ? "border-[var(--app-danger)] focus:border-[var(--app-danger)] focus:ring-2 focus:ring-[var(--app-danger)]/20"
    : "border-[var(--app-border)] focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent)]/30";

  return (
    <div className="relative inline-flex items-center w-full">
      <select
        ref={ref}
        disabled={disabled}
        className={`${baseClasses} ${borderClasses} ${className}`}
        {...rest}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2.5 text-[var(--app-text-tertiary)] flex items-center" aria-hidden="true">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>
  );
});
