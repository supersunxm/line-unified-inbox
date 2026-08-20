"use client";

import React, { forwardRef } from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "elevated" | "flat";
  noPadding?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", noPadding = false, className = "", children, ...rest },
  ref
) {
  const variantStyles = {
    default:
      "bg-[var(--app-surface)] border border-[var(--app-border)] shadow-[var(--app-shadow-card)]",
    subtle:
      "bg-[var(--app-surface-subtle)] border border-[var(--app-border-subtle)]",
    elevated:
      "bg-[var(--app-surface)] border border-[var(--app-border)] shadow-[var(--app-shadow-elevated)]",
    flat:
      "bg-[var(--app-surface)] border border-[var(--app-border)] shadow-none",
  }[variant];

  return (
    <div
      ref={ref}
      className={`rounded-[var(--app-radius-xl)] ${variantStyles} ${noPadding ? "" : "p-4 sm:p-5"} text-[var(--app-text-primary)] transition-colors duration-120 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
});

export function CardHeader({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center justify-between gap-3 mb-3 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-sm sm:text-[15px] font-semibold text-[var(--app-text-primary)] tracking-tight ${className}`} {...rest}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-[var(--app-text-secondary)] mt-0.5 ${className}`} {...rest}>
      {children}
    </p>
  );
}

export function CardContent({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`space-y-3 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mt-4 pt-3 border-t border-[var(--app-border-subtle)] flex items-center justify-between gap-2 text-xs text-[var(--app-text-secondary)] ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionHeader({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mb-3 mt-7 text-xs font-bold uppercase tracking-[0.05em] text-[var(--app-text-tertiary)] first:mt-0 select-none ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  subtext?: string;
  delta?: {
    value: string | number;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  tone?: "default" | "success" | "warning" | "danger" | "accent" | "info";
  rightSlot?: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  subtext,
  delta,
  tone = "default",
  rightSlot,
  className = "",
  ...rest
}: MetricCardProps) {
  const toneBorder = {
    default: "",
    success: "border-l-4 border-l-[var(--app-success)]",
    warning: "border-l-4 border-l-[var(--app-warning)]",
    danger: "border-l-4 border-l-[var(--app-danger)]",
    accent: "border-l-4 border-l-[var(--app-accent)]",
    info: "border-l-4 border-l-[var(--app-info)]",
  }[tone];

  return (
    <Card className={`${toneBorder} ${className}`} {...rest}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-[var(--app-text-secondary)]">{label}</span>
        {rightSlot}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-bold font-tabular text-[var(--app-text-primary)] tracking-tight">
          {value}
        </span>
        {delta && (
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded-[var(--app-radius-sm)] ${
              delta.isNeutral
                ? "bg-[var(--app-neutral-soft)] text-[var(--app-text-secondary)]"
                : delta.isPositive
                ? "bg-[var(--app-success-soft)] text-[var(--app-success)]"
                : "bg-[var(--app-danger-soft)] text-[var(--app-danger)]"
            }`}
          >
            {delta.value}
          </span>
        )}
      </div>
      {subtext && (
        <p className="mt-1.5 text-xs text-[var(--app-text-tertiary)]">{subtext}</p>
      )}
    </Card>
  );
}
