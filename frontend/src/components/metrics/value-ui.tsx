"use client";

// How a monthly number renders: its value state, its change, a rate or count table cell.
// Shared by Home, Dashboard, Store 360 and /v2/report.

import React from "react";
import { useAppLanguage } from "@/app/language";
import { languageLocale } from "@/app/language-utils";
import { v2Text } from "@/lib/metrics/translations";
import { formatValue, numericValue, valueReason, type ValueState } from "@/lib/metrics/value-state";

/**
 * A monthly number from its value state. "—" and muted values always carry their reason:
 * as a tooltip and as screen-reader text. `showN` adds "(n=…)" for rates.
 */
export function StateValue({ state, format = "count", target, showN = false, className = "" }: { state: ValueState; format?: "count" | "percent"; target?: number; showN?: boolean; className?: string }) {
  const { language } = useAppLanguage();
  const formatted = formatValue(state, format, language);
  const value = numericValue(state);
  const belowTarget = target !== undefined && !formatted.muted && value !== null && value < target;
  const n = "n" in state && typeof state.n === "number" ? state.n : null;
  return (
    <span data-v2-value-state={state.kind} title={formatted.reason ?? undefined} className={`whitespace-nowrap tabular-nums ${formatted.muted ? "text-[var(--app-text-secondary)]" : belowTarget ? "text-[var(--app-danger)]" : ""} ${className}`}>
      {formatted.text}
      {showN && n !== null && <span className="ml-1 text-xs font-normal text-[var(--app-text-secondary)]">(n={n.toLocaleString(languageLocale(language))})</span>}
      {formatted.reason && <span className="sr-only"> ({formatted.reason})</span>}
    </span>
  );
}

/**
 * Change vs the comparison period. kind "count": "+3" / "−2", always neutral (counts follow
 * chat volume). kind "points": "+1.2 จุด" / "−3.4 จุด", coloured (a rate: down is worse).
 */
export function DeltaValue({ state, kind, worseWhen }: { state: ValueState; kind: "count" | "points"; worseWhen: "up" | "down" }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const reason = valueReason(state, language);
  const value = numericValue(state);
  if (value === null || state.kind === "loading") {
    return <span data-v2-value-state={state.kind} title={reason ?? undefined} className="whitespace-nowrap text-xs text-[var(--app-text-secondary)]">—{reason && <span className="sr-only"> ({reason})</span>}</span>;
  }
  // Only rate changes (points) carry meaning: a count moves with chat volume, so it stays neutral.
  const muted = kind === "count" || state.kind === "low-sample" || state.kind === "stale";
  const worse = !muted && value !== 0 && (worseWhen === "up" ? value > 0 : value < 0);
  const better = !muted && value !== 0 && !worse;
  const number = `${value > 0 ? "+" : "−"}${kind === "points" ? Math.abs(value).toFixed(1) : Math.abs(value).toLocaleString(languageLocale(language))}`;
  const text = value === 0 ? t("unchanged") : kind === "points" ? t("points", { value: number }) : number;
  return (
    <span data-v2-value-state={state.kind} title={reason ?? undefined} className={`whitespace-nowrap text-xs font-medium tabular-nums ${worse ? "text-[var(--app-danger)]" : better ? "text-[var(--app-accent)] dark:text-[var(--app-success)]" : "text-[var(--app-text-secondary)]"}`}>
      {text}
      {reason && <span className="sr-only"> ({reason})</span>}
    </span>
  );
}

/** A KPI rate in a table: the value (target colour only when a target is set) and its change in points. */
export function RateCell({ value, delta, target, showN = false }: { value: ValueState; delta: ValueState; target: number | null; showN?: boolean }) {
  return (
    <span className="inline-flex flex-col items-end">
      <StateValue state={value} format="percent" target={target ?? undefined} showN={showN} />
      {numericValue(delta) !== null && <DeltaValue state={delta} kind="points" worseWhen="down" />}
    </span>
  );
}

/** A count in a table with its change, both neutral: counts follow chat volume. */
export function CountCell({ value, delta, strong = false }: { value: ValueState; delta?: ValueState; strong?: boolean }) {
  return (
    <span className="inline-flex flex-col items-end">
      <StateValue state={value} className={strong ? "font-semibold" : ""} />
      {delta && numericValue(delta) !== null && <DeltaValue state={delta} kind="count" worseWhen="up" />}
    </span>
  );
}
