"use client";

import React from "react";

export type BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"
  | "outline";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral: "bg-[var(--app-neutral-soft)] text-[var(--app-text-secondary)] border border-[var(--app-border-subtle)]",
  success: "bg-[var(--app-success-soft)] text-[#1E8E3E] dark:text-[#6ee7a0] border border-[var(--app-success)]/20",
  warning: "bg-[var(--app-warning-soft)] text-[#B25E00] dark:text-[#f6c65b] border border-[var(--app-warning)]/20",
  danger: "bg-[var(--app-danger-soft)] text-[#C62828] dark:text-[#f87171] border border-[var(--app-danger)]/20",
  info: "bg-[var(--app-info-soft)] text-[#0062CC] dark:text-[#8ac5ff] border border-[var(--app-info)]/20",
  accent: "bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent)]/20 font-semibold",
  outline: "bg-transparent text-[var(--app-text-secondary)] border border-[var(--app-border)]",
};

const dotColors: Record<BadgeVariant, string> = {
  neutral: "bg-[var(--app-neutral)]",
  success: "bg-[var(--app-success)]",
  warning: "bg-[var(--app-warning)]",
  danger: "bg-[var(--app-danger)]",
  info: "bg-[var(--app-info)]",
  accent: "bg-[var(--app-accent)]",
  outline: "bg-[var(--app-text-secondary)]",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "text-[11px] px-1.5 py-0.5 rounded-[var(--app-radius-sm)] gap-1",
  md: "text-xs px-2 py-0.5 rounded-[var(--app-radius-sm)] gap-1.5",
};

export function Badge({
  variant = "neutral",
  size = "md",
  dot = false,
  children,
  className = "",
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium leading-none select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...rest}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColors[variant]}`} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
