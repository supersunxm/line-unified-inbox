"use client";

import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error = false, leftIcon, rightSlot, className = "", disabled, ...rest },
  ref
) {
  const baseClasses =
    "w-full h-9 px-3 text-xs bg-[var(--input-background)] text-[var(--app-text-primary)] border rounded-[var(--app-radius-md)] transition-colors duration-120 outline-none placeholder:text-[var(--app-text-tertiary)] disabled:bg-[var(--disabled-background)] disabled:text-[var(--disabled-foreground)] disabled:cursor-not-allowed";
  const borderClasses = error
    ? "border-[var(--app-danger)] focus:border-[var(--app-danger)] focus:ring-2 focus:ring-[var(--app-danger)]/20"
    : "border-[var(--app-border)] focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent)]/30";

  if (leftIcon || rightSlot) {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <span className="absolute left-2.5 text-[var(--app-text-tertiary)] pointer-events-none flex items-center">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={`${baseClasses} ${borderClasses} ${leftIcon ? "pl-8" : ""} ${rightSlot ? "pr-8" : ""} ${className}`}
          {...rest}
        />
        {rightSlot && (
          <span className="absolute right-2.5 flex items-center">
            {rightSlot}
          </span>
        )}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      disabled={disabled}
      className={`${baseClasses} ${borderClasses} ${className}`}
      {...rest}
    />
  );
});

export interface SearchInputProps extends Omit<InputProps, "leftIcon" | "rightSlot"> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, onClear, placeholder = "ค้นหา...", className = "", ...rest },
  ref
) {
  const hasValue = Boolean(value && String(value).length > 0);

  return (
    <Input
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      leftIcon={
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      }
      rightSlot={
        hasValue && onClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="rounded-full p-0.5 text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)] transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : undefined
      }
      {...rest}
    />
  );
});
