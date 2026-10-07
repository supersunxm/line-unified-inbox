"use client";

import { useAppLanguage } from "@/app/language";
import { v2Text } from "@/lib/v2/v2-translations";

import React from "react";
import { KPI_TARGETS, targetLabel, targetState, type KpiKey } from "@/lib/v2/kpi";
import type { MonthWindow } from "@/lib/v2/month";
import { periodLabel } from "@/lib/v2/month";
import type { GroupTotals } from "@/lib/v2/monthly-model";
import { formatValue, numericValue, type ValueState } from "@/lib/v2/value-state";
import { DeltaValue, StateValue } from "./v2-ui";

const KPI_LABELS: Record<KpiKey, string> = { replied: "ตอบแล้ว %", rate24: "ตอบใน 24 ชม. %" };

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

function KpiCard({ kpi, value, previous, delta, frame }: { kpi: KpiKey; value: ValueState; previous: ValueState; delta: ValueState; frame: MonthWindow }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const target = KPI_TARGETS[kpi];
  const previousText = formatValue(previous, "percent", language);
  return (
    <div data-v2-kpi-card={kpi} className="flex flex-col gap-1.5 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--app-text-primary)]">{t(kpi === "replied" ? "repliedRate" : "rate24")}</h2>
        <span className="rounded-full bg-[var(--app-surface-subtle)] px-2 py-0.5 text-[11px] text-[var(--app-text-secondary)]">{periodLabel(frame.current, language)}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-semibold"><StateValue state={value} format="percent" target={target ?? undefined} showN /></span>
        {numericValue(delta) !== null && <DeltaValue state={delta} kind="points" worseWhen="down" />}
      </div>
      <TargetText kpi={kpi} value={value} />
      <p className="text-xs text-[var(--app-text-secondary)]">
        {periodLabel(frame.previous, language)}: {previousText.text === "—" ? `— (${previousText.reason})` : previousText.text}
      </p>
      <HowCounted kpi={kpi} />
    </div>
  );
}

/** The two official KPIs side by side, each with its own target, plus why they can differ. */
export function TwoKpiCards({ totals, frame }: { totals: GroupTotals; frame: MonthWindow }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  return (
    <section aria-label={t("mainKpis")} className="space-y-2">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard kpi="replied" value={totals.replyRate} previous={totals.previousReplyRate} delta={totals.replyRateDelta} frame={frame} />
        <KpiCard kpi="rate24" value={totals.rate24} previous={totals.previousRate24} delta={totals.rate24Delta} frame={frame} />
      </div>
      <p data-v2-kpi-difference className="text-xs text-[var(--app-text-secondary)]">{t("kpiDifference")}</p>
    </section>
  );
}

/** Volume, neutral: แชท and ยังไม่ตอบ with their change, no red/green (they follow chat volume). */
export function VolumeLine({ totals, frame }: { totals: GroupTotals; frame: MonthWindow }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const item = (label: string, value: ValueState, previous: ValueState, delta: ValueState) => (
    <span className="whitespace-nowrap">
      {label} <span className="font-semibold text-[var(--app-text-primary)]"><StateValue state={value} /></span>
      {" "}<span className="text-[var(--app-text-secondary)]">({periodLabel(frame.previous, language)} {formatValue(previous, "count", language).text}{numericValue(delta) !== null ? <>, <DeltaValue state={delta} kind="count" worseWhen="up" /></> : null})</span>
    </span>
  );
  return (
    <p data-v2-volume className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--app-text-secondary)]">
      {item(t("chats"), totals.chats, totals.previousChats, deltaOf(totals.chats, totals.previousChats))}
      {item(t("unanswered"), totals.unreplied, totals.previousUnreplied, totals.unrepliedDelta)}
    </p>
  );
}

function deltaOf(current: ValueState, previous: ValueState): ValueState {
  const a = numericValue(current);
  const b = numericValue(previous);
  if (a === null || b === null) return { kind: "no-activity" };
  return a === b ? { kind: "true-zero", value: 0 } : { kind: "value", value: a - b };
}

export { KPI_LABELS };

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
