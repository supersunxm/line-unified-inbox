"use client";

// The two official KPIs: how each is counted, its target state, and the KPI-vs-comparison table.
// Shared by Dashboard, Store 360 and /v2/report.

import React from "react";
import { useAppLanguage } from "@/app/language";
import { KPI_TARGETS, targetLabel, targetState, type KpiKey } from "@/lib/metrics/kpi";
import { periodLabel, type MonthWindow } from "@/lib/metrics/month";
import type { GroupTotals } from "@/lib/metrics/store-model";
import { v2Text } from "@/lib/metrics/translations";
import { numericValue, type ValueState } from "@/lib/metrics/value-state";
import { DeltaValue, StateValue } from "./value-ui";

/** "นับยังไง" — a one-line disclosure, readable without hovering. */
export function HowCounted({ kpi }: { kpi: KpiKey }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  return (
    <details data-v2-how-counted={kpi} className="text-xs text-[var(--app-text-secondary)]">
      <summary className="cursor-pointer select-none font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]">{t("howCounted")}</summary>
      <p className="mt-1 leading-relaxed">{t(kpi === "replied" ? "howReplied" : "howRate24")}</p>
    </details>
  );
}

/** Target state of a KPI value: "เป้า 90% · ต่ำกว่าเป้า 3.1 จุด" or "ยังไม่กำหนดเป้า". */
export function TargetText({ kpi, value }: { kpi: KpiKey; value: ValueState }) {
  const { language } = useAppLanguage();
  const target = KPI_TARGETS[kpi];
  const state = targetState(value, target);
  return (
    <span data-v2-target-state={state.kind} className={`text-xs ${state.kind === "below" ? "font-medium text-[var(--app-danger)]" : "text-[var(--app-text-secondary)]"}`}>
      {targetLabel(state, target, language)}
    </span>
  );
}

export function deltaOf(current: ValueState, previous: ValueState): ValueState {
  const a = numericValue(current);
  const b = numericValue(previous);
  if (a === null || b === null) return { kind: "no-activity" };
  return a === b ? { kind: "true-zero", value: 0 } : { kind: "value", value: a - b };
}

/**
 * The period's KPIs vs the comparison period and each KPI's own target. Rates carry the
 * semantic colour (change in points, target state); counts and their change stay neutral.
 * Used by the scorecard drawer and the report.
 */
export function KpiCompareTable({ totals, frame, dense = false }: { totals: GroupTotals; frame: MonthWindow; dense?: boolean }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const cell = dense ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-xs whitespace-nowrap";
  const head = `${cell} border-b border-[var(--app-border)] text-[11px] font-medium text-[var(--app-text-secondary)]`;
  const rows: Array<{ label: string; current: ValueState; previous: ValueState; delta: ValueState | null; format: "count" | "percent"; kpi: KpiKey | null }> = [
    { label: t("repliedRate"), current: totals.replyRate, previous: totals.previousReplyRate, delta: totals.replyRateDelta, format: "percent", kpi: "replied" },
    { label: t("rate24"), current: totals.rate24, previous: totals.previousRate24, delta: totals.rate24Delta, format: "percent", kpi: "rate24" },
    { label: t("chats"), current: totals.chats, previous: totals.previousChats, delta: deltaOf(totals.chats, totals.previousChats), format: "count", kpi: null },
    { label: t("unanswered"), current: totals.unreplied, previous: totals.previousUnreplied, delta: totals.unrepliedDelta, format: "count", kpi: null },
  ];
  return (
    <table data-v2-kpi-compare className="w-full text-left">
      <thead>
        <tr>
          <th scope="col" className={`${head} text-left`}>{t("metric")}</th>
          <th scope="col" className={`${head} text-right`}>{periodLabel(frame.current, language)}</th>
          <th scope="col" className={`${head} text-right`}>{periodLabel(frame.previous, language)}</th>
          <th scope="col" className={`${head} text-right`}>{t("change")}</th>
          <th scope="col" className={`${head} text-right`}>{t("target")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--app-border-subtle)]">
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row" className={`${cell} text-left font-medium`}>{row.label}</th>
            <td className={`${cell} text-right font-semibold`}><StateValue state={row.current} format={row.format} target={row.kpi ? KPI_TARGETS[row.kpi] ?? undefined : undefined} showN={row.format === "percent"} /></td>
            <td className={`${cell} text-right`}><StateValue state={row.previous} format={row.format} /></td>
            <td className={`${cell} text-right`}>{row.delta ? <DeltaValue state={row.delta} kind={row.format === "percent" ? "points" : "count"} worseWhen="down" /> : null}</td>
            <td className={`${cell} text-right`}>{row.kpi ? <TargetText kpi={row.kpi} value={row.current} /> : <span className="text-[var(--app-text-secondary)]">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
