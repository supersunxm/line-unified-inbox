"use client";

import React from "react";
import { useAppLanguage } from "@/app/language";
import { languageLocale, type AppLanguage } from "@/app/language-utils";
import { THAI_MONTHS_SHORT } from "@/lib/metrics/month";
import { v2Text } from "@/lib/metrics/translations";

export type FollowerTrendPoint = { date: string; followers: number };

/** "1 ต.ค. 2026" (Gregorian year) / "Oct 1, 2026". */
export function shortDate(dateKey: string, language: AppLanguage): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (language === "th") return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${year}`;
  return new Intl.DateTimeFormat(languageLocale(language), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Daily followers as a small line chart (the Dashboard's network trend, Store 360's one store). */
export function FollowerChart({ points, title }: { points: FollowerTrendPoint[]; title: string }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  if (points.length < 2) return null;
  const width = 640;
  const height = 140;
  const pad = 8;
  const values = points.map((point) => point.followers);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const xy = points.map((point, index) => [pad + (index / (points.length - 1)) * (width - pad * 2), pad + ((max - point.followers) / range) * (height - pad * 2)] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const locale = languageLocale(language);
  return (
    <figure className="space-y-1">
      <figcaption className="text-xs font-medium text-[var(--app-text-secondary)]">{title}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label={`${title}: ${shortDate(points[0].date, language)} ${points[0].followers.toLocaleString(locale)} → ${shortDate(points[points.length - 1].date, language)} ${points[points.length - 1].followers.toLocaleString(locale)}`}>
        <polygon points={`${pad},${height - pad} ${line} ${width - pad},${height - pad}`} fill="var(--app-accent-soft)" />
        <polyline points={line} fill="none" stroke="var(--app-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {xy.map(([x, y], index) => <circle key={points[index].date} cx={x} cy={y} r="2.5" fill="var(--app-accent)" vectorEffect="non-scaling-stroke"><title>{`${shortDate(points[index].date, language)}: ${t("followersPeople", { count: points[index].followers.toLocaleString(locale) })}`}</title></circle>)}
      </svg>
      <div className="flex justify-between text-[11px] text-[var(--app-text-tertiary)]"><span>{shortDate(points[0].date, language)}</span><span>{shortDate(points[points.length - 1].date, language)}</span></div>
    </figure>
  );
}

