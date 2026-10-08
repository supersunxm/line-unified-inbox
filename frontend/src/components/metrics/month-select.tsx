"use client";

// The month selector of the metrics pages: /chats's own month list (getChatPeriodOptions, without
// "ทั้งหมด") and /chats's URL parameter (?month=YYYY-MM). Changing it rewrites only ?month=.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { getChatPeriodOptions } from "@/app/chat-period";
import { useAppLanguage } from "@/app/language";
import { v2Text } from "@/lib/metrics/translations";

export function MetricsMonthSelect({ month }: { month: string }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const router = useRouter();
  const pathname = usePathname() || "/";
  const params = useSearchParams();
  const options = getChatPeriodOptions(language).filter((option) => option.value !== "all");
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
      <span>{t("monthSelectLabel")}</span>
      <select
        data-metrics-month-select
        value={month}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          next.set("month", event.target.value);
          router.replace(`${pathname}?${next.toString()}${typeof window !== "undefined" ? window.location.hash : ""}`, { scroll: false });
        }}
        className="h-9 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-medium text-[var(--app-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40"
      >
        {options.map((option, index) => (
          <option key={option.value} value={option.value}>{option.label}{index === 0 ? t("thisMonth") : ""}</option>
        ))}
      </select>
    </label>
  );
}
