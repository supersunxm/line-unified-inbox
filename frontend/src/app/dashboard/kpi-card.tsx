"use client";

import React from "react";
import Link from "next/link";

export type KpiVariant = "healthy" | "warning" | "critical" | "info" | "neutral";

interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: "up" | "down" | "flat";
    label: string;
    positive?: boolean; // true = green, false = red (depends on metric)
  };
  variant?: KpiVariant;
  href?: string;
  icon?: string; // emoji or svg path
  onClick?: () => void;
}

const variantStyles: Record<KpiVariant, { border: string; glow: string; bg: string; badge: string }> = {
  healthy: {
    border: "border-emerald-500/30",
    glow: "shadow-emerald-500/10",
    bg: "bg-[var(--surface)]",
    badge: "bg-emerald-500/10 text-emerald-400",
  },
  warning: {
    border: "border-amber-500/40",
    glow: "shadow-amber-500/10",
    bg: "bg-amber-500/[0.02]",
    badge: "bg-amber-500/10 text-amber-400",
  },
  critical: {
    border: "border-red-500/50",
    glow: "shadow-red-500/15",
    bg: "bg-red-500/[0.04]",
    badge: "bg-red-500/15 text-red-400 font-semibold",
  },
  info: {
    border: "border-blue-500/30",
    glow: "shadow-blue-500/10",
    bg: "bg-[var(--surface)]",
    badge: "bg-blue-500/10 text-blue-400",
  },
  neutral: {
    border: "border-[var(--border)]",
    glow: "shadow-slate-700/5",
    bg: "bg-[var(--surface)]",
    badge: "bg-slate-700/50 text-[var(--muted)]",
  },
};

export function KpiCard({ label, value, subtitle, trend, variant = "neutral", href, icon, onClick }: KpiCardProps) {
  const styles = variantStyles[variant];

  const body = (
    <div
      className={`relative overflow-hidden rounded-2xl border ${styles.bg} p-4 sm:p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${styles.border} ${styles.glow}`}
      style={{ cursor: href || onClick ? "pointer" : "default" }}
    >
      {/* Top accent bar */}
      <div
        className={`absolute inset-x-0 top-0 h-0.5 ${
          variant === "critical"
            ? "bg-red-500"
            : variant === "warning"
            ? "bg-amber-500"
            : variant === "healthy"
            ? "bg-emerald-500"
            : variant === "info"
            ? "bg-blue-500"
            : "bg-[var(--border)]"
        }`}
      />

      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">{label}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {variant === "critical" && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
          )}
          {icon && <span className="text-base sm:text-lg leading-none opacity-80">{icon}</span>}
        </div>
      </div>

      <p className="mt-2.5 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)] tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
              trend.positive === true
                ? "bg-emerald-500/10 text-emerald-400"
                : trend.positive === false
                ? "bg-red-500/10 text-red-400"
                : "bg-slate-700/50 text-[var(--muted)]"
            }`}
          >
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}
            {trend.label}
          </span>
        )}
        {subtitle && (
          <p className="text-xs font-medium text-[var(--muted)] truncate" title={subtitle}>{subtitle}</p>
        )}
      </div>
    </div>
  );

  if (href) return <Link href={href} aria-label={`${label}: ${value}`}>{body}</Link>;
  if (onClick) return <button type="button" className="block w-full text-left" onClick={onClick} aria-label={`${label}: ${value}`}>{body}</button>;
  return body;
}

