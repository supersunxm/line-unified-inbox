"use client";

import React, { forwardRef } from "react";

export type IconButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<IconButtonVariant, string> = {
  primary:
    "bg-[var(--app-accent)] text-white hover:bg-[var(--app-accent-hover)] active:translate-y-[1px] disabled:bg-[var(--disabled-background)] disabled:text-[var(--disabled-foreground)]",
  secondary:
    "bg-[var(--app-surface)] text-[var(--app-text-primary)] border border-[var(--app-border)] hover:bg-[var(--app-surface-hover)] active:bg-[var(--app-surface-active)] disabled:bg-[var(--disabled-background)] disabled:text-[var(--disabled-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
  ghost:
    "bg-transparent text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)] active:bg-[var(--app-surface-active)] border border-transparent disabled:opacity-50",
  danger:
    "bg-[var(--app-danger-soft)] text-[var(--app-danger)] border border-[var(--app-danger)]/20 hover:bg-[var(--app-danger)] hover:text-white disabled:opacity-50",
};

const sizeStyles: Record<IconButtonSize, string> = {
  sm: "h-7 w-7 text-xs rounded-[var(--app-radius-sm)]",
  md: "h-9 w-9 text-sm rounded-[var(--app-radius-md)]",
  lg: "h-11 w-11 text-base rounded-[var(--app-radius-md)]",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    variant = "ghost",
    size = "md",
    isLoading = false,
    children,
    className = "",
    disabled,
    type = "button",
    ...rest
  },
  ref
) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium transition-all duration-120 select-none cursor-pointer disabled:cursor-not-allowed shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40 focus-visible:ring-offset-1";

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...rest}
    >
      {isLoading ? (
        <svg
          className="h-3.5 w-3.5 animate-spin text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
        children
      )}
    </button>
  );
});
