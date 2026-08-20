"use client";

import React from "react";

export interface SegmentedItem<T extends string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  items: Array<SegmentedItem<T>>;
  value: T;
  onChange: (value: T) => void;
  variant?: "accent" | "surface";
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  variant = "accent",
  size = "md",
  className = "",
  "aria-label": ariaLabel = "Segmented control",
}: SegmentedControlProps<T>) {
  const sizeStyles = {
    sm: "px-2.5 py-1 text-[11px]",
    md: "px-3.5 py-1.5 text-xs",
  }[size];

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-surface)] p-[3px] select-none ${className}`}
    >
      {items.map((item) => {
        const isSelected = item.id === value;
        let activeClass = "";
        if (isSelected) {
          activeClass =
            variant === "accent"
              ? "bg-[var(--app-accent)] text-white font-semibold shadow-xs"
              : "bg-[var(--app-surface-hover)] text-[var(--app-text-primary)] font-semibold shadow-xs";
        } else {
          activeClass =
            "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]";
        }

        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-[7px] font-medium transition-all duration-120 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40 ${sizeStyles} ${activeClass}`}
          >
            {item.icon && <span className="shrink-0 leading-none">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
