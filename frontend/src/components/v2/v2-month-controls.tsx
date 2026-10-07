"use client";

import { useAppLanguage } from "@/app/language";
import { languageLocale } from "@/app/language-utils";
import { v2Text } from "@/lib/v2/v2-translations";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { monthLongLabel, periodLabel, selectableMonths } from "@/lib/v2/month";
import { coverageText, previousCoverage } from "@/lib/v2/monthly-model";
import { withMonth } from "@/lib/v2/month-url";
import { responseKpis } from "@/lib/v2/response-model";
import { useV2Data } from "./v2-data";
import { useV2Month } from "./v2-month-data";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40";

/** The shared month selector (?month=YYYY-MM); the same months /chats offers, without "ทั้งหมด". */
export function MonthSelector() {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const { month, now } = useV2Month();
  const router = useRouter();
  const pathname = usePathname() || "/v2";
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
      <span>{t("month")}</span>
      <select
        data-v2-month-select
        value={month}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          next.set("month", event.target.value);
          next.delete("store");
          router.replace(`${pathname}?${next.toString()}`, { scroll: false });
        }}
        className={`${focusRing} h-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-medium text-[var(--app-text-primary)]`}
      >
        {selectableMonths(now).map((value, index) => (
          <option key={value} value={value}>{monthLongLabel(value, language)}{index === 0 ? t("thisMonth") : ""}</option>
        ))}
      </select>
    </label>
  );
}

/** ภาพรวมเดือน | ตอนนี้ — the monthly view first; the live list is the secondary tab. */
export function OverviewTabs({ active, month }: { active: "month" | "now"; month?: string }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const data = useV2Data();
  const followToday = data.active && data.waiting.data ? responseKpis(data.storeRows).followTodayStores : null;
  const tab = (key: "month" | "now", href: string, label: string, badge?: number | null) => (
    <Link
      href={href}
      role="tab"
      aria-selected={active === key}
      data-v2-overview-tab={key}
      className={`${focusRing} inline-flex items-center gap-2 rounded-[var(--app-radius-sm)] px-3 py-1.5 text-sm font-medium ${active === key ? "bg-[var(--app-surface)] text-[var(--app-text-primary)] shadow-[var(--app-shadow-card)]" : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"}`}
    >
      {label}
      {badge ? <span data-v2-follow-up-badge className="min-w-6 rounded-full bg-[var(--app-danger-soft)] px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-[var(--app-danger)]" aria-label={t("followBadge", { count: badge })}>{badge}</span> : null}
    </Link>
  );
  return (
    <div role="tablist" aria-label={t("overviewViews")} className="inline-flex gap-1 rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-1">
      {tab("month", month ? withMonth("/v2", month) : "/v2", t("monthOverview"))}
      {tab("now", "/v2/response", t("now"), followToday)}
    </div>
  );
}

/** "สาขาที่มีข้อมูลแชท N/M · เดือนนี้ยังไม่ปิด (ข้อมูลถึงวันที่ 7) · …" */
export function DataLine() {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const data = useV2Month();
  const parts = [
    data.stores.data && data.current.data
      ? coverageText({
        currentLabel: periodLabel(data.frame.current, language),
        previousLabel: periodLabel(data.frame.previous, language),
        current: data.coverage,
        previous: previousCoverage(data.rows),
        previousReason: data.frame.previousCollected ? (data.previous.error ? t("loadFailed") : data.previous.loading ? t("loading") : null) : t("notCollected"),
      }, language)
      : null,
    data.statusText,
    data.closeError ? t("closeError", { error: data.closeError }) : null,
    data.placeholders.length > 0 ? t("excludedStores", { count: data.placeholders.length, names: data.placeholders.map((store) => store.name).join(", ") }) : null,
    data.unattributed ? t("unattributed", { count: data.unattributed.toLocaleString(languageLocale(language)) }) : null,
  ].filter(Boolean);
  return <p data-v2-data-line className="text-xs text-[var(--app-text-secondary)]">{parts.join(" · ")}</p>;
}
