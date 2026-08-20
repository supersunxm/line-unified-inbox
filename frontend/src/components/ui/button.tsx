"use client";

import React, { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--app-accent)] text-white hover:bg-[var(--app-accent-hover)] active:translate-y-[1px] disabled:bg-[var(--disabled-background)] disabled:text-[var(--disabled-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-transparent",
  secondary:
    "bg-[var(--app-surface)] text-[var(--app-text-primary)] border border-[var(--app-border)] hover:bg-[var(--app-surface-hover)] active:bg-[var(--app-surface-active)] disabled:bg-[var(--disabled-background)] disabled:text-[var(--disabled-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
  outline:
    "bg-transparent text-[var(--app-text-primary)] border border-[var(--app-border-strong)] hover:bg-[var(--app-surface-hover)] active:bg-[var(--app-surface-active)] disabled:opacity-50",
  ghost:
    "bg-transparent text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)] active:bg-[var(--app-surface-active)] border border-transparent disabled:opacity-50",
  danger:
    "bg-[var(--app-danger)] text-white hover:bg-[#e02e24] active:translate-y-[1px] disabled:bg-[var(--disabled-background)] disabled:text-[var(--disabled-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-transparent",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs rounded-[var(--app-radius-sm)] gap-1.5",
  md: "h-9 px-3.5 text-xs font-medium rounded-[var(--app-radius-md)] gap-2",
  lg: "h-11 px-5 text-sm font-medium rounded-[var(--app-radius-md)] gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    isLoading = false,
    leftIcon,
    rightIcon,
    children,
    className = "",
    disabled,
    type = "button",
    ...rest
  },
  ref
) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium transition-all duration-120 select-none cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40 focus-visible:ring-offset-1";
  const variantClass = variantStyles[variant];
  const sizeClass = sizeStyles[size];

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClass} ${sizeClass} ${className}`}
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
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      ) : (
        leftIcon && <span className="shrink-0 leading-none">{leftIcon}</span>
      )}
      {children && <span className="truncate">{children}</span>}
      {!isLoading && rightIcon && (
        <span className="shrink-0 leading-none">{rightIcon}</span>
      )}
    </button>
  );
});
