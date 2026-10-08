"use client";

import { useAppLanguage } from "@/app/language";
import { v2Text } from "@/lib/v2/v2-translations";

import React from "react";
import { KPI_TARGETS, type KpiKey } from "@/lib/v2/kpi";
import type { MonthWindow } from "@/lib/v2/month";
import { periodLabel } from "@/lib/v2/month";
import type { GroupTotals } from "@/lib/v2/monthly-model";
import { formatValue, numericValue, type ValueState } from "@/lib/v2/value-state";
import { DeltaValue, StateValue } from "./v2-ui";
import { HowCounted, TargetText, deltaOf } from "@/components/metrics/kpi-ui";

const KPI_LABELS: Record<KpiKey, string> = { replied: "ตอบแล้ว %", rate24: "ตอบใน 24 ชม. %" };

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

export { KPI_LABELS };
export { HowCounted, KpiCompareTable, TargetText, deltaOf } from "@/components/metrics/kpi-ui";


