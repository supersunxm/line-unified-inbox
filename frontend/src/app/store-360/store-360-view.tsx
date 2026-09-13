"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppShell, PageContainer } from "@/components/shell";
import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/authorization";
import type {
  ApiStore,
  StoreInsightsConversation,
  StoreInsightsCustomerVoice,
  StoreInsightsResponder,
  StoreInsightsSummary,
} from "@/types/api";
import { UnifiedPeriodPicker } from "@/components/date-range/unified-period-picker";
import { useAppLanguage } from "../language";
import { StoreSearchCombobox } from "./store-search-combobox";
import { CustomerVoicePanel } from "./customer-voice-panel";
import { resolveAuthorizedStoreId, withStore360Timeout } from "./store-360-bootstrap";
import { Store360ExportControl } from "./store-360-export-control";

type Preset = "7d" | "30d" | "month" | "custom";
type ComparisonMode = "previous" | "none";
type ResponseFilter = "ALL" | "REPLIED" | "UNANSWERED";
type SalesFilter = "ALL" | "TAGGED" | "UNTAGGED";

const TIMEZONE = "Asia/Bangkok";

function todayInBangkok() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function shiftDate(value: string, days: number) {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function rangeForPreset(preset: Exclude<Preset, "custom">, now = todayInBangkok()) {
  if (preset === "7d") return { from: shiftDate(now, -6), to: now };
  if (preset === "month") return { from: now.slice(0, 7) + "-01", to: now };
  return { from: shiftDate(now, -29), to: now };
}

function comparisonFor(from: string, to: string) {
  const days = Math.round((new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86_400_000) + 1;
  const compareTo = shiftDate(from, -1);
  return { compareFrom: shiftDate(compareTo, -(days - 1)), compareTo };
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "No data available" : value.toLocaleString("en-US");
}

function formatPercentage(value: number | null | undefined) {
  return value === null || value === undefined ? "No data available" : Math.round(value * 100) + "%";
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "No data available";
  if (seconds < 60) return Math.round(seconds) + "s";
  if (seconds < 3600) return Math.round(seconds / 60) + "m";
  return (seconds / 3600).toFixed(1) + "h";
}

function comparisonCountDelta(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined) return undefined;
  const delta = current - previous;
  return delta === 0 ? "No change" : (delta > 0 ? "+" : "") + formatNumber(delta) + " vs previous period";
}

function comparisonPercentagePoints(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined) return undefined;
  const delta = Math.round((current - previous) * 100);
  return delta === 0 ? "No change" : Math.abs(delta) + "pp " + (delta > 0 ? "higher" : "lower");
}

function comparisonResponseTime(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined) return undefined;
  const delta = current - previous;
  return delta === 0 ? "No change" : formatDuration(Math.abs(delta)) + (delta < 0 ? " faster" : " slower");
}

function comparisonUnanswered(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined) return undefined;
  const delta = current - previous;
  return delta === 0 ? "No change" : Math.abs(delta).toLocaleString("en-US") + (delta < 0 ? " fewer" : " more") + " than previous period";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function surfaceClass(extra = "") {
  return "rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)] " + extra;
}

function BiIcon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...common}>
      {name === "store" && <><path d="M4 9h16l-1.5-4h-13L4 9Z" /><path d="M5 10v9h14v-9" /><path d="M3.5 9c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3" /><path d="M9 19v-5h6v5" /></>}
      {name === "insight" && <><path d="M9 18h6" /><path d="M10 21h4" /><path d="M8.5 14.5C7.5 13.7 7 12.5 7 11a5 5 0 0 1 10 0c0 1.5-.5 2.7-1.5 3.5-.8.6-1.5 1.5-1.5 2.5h-4c0-1-.7-1.9-1.5-2.5Z" /></>}
      {name === "customers" && <><circle cx="12" cy="8" r="3" /><path d="M5 20c.7-4.3 3-6.5 7-6.5s6.3 2.2 7 6.5" /></>}
      {name === "reply" && <><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 9h8m-8 3h5" /></>}
      {name === "clock" && <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>}
      {name === "sales" && <><path d="M5 7h14l-1 13H6L5 7Z" /><path d="M9 7c0-2.7 1.2-4 3-4s3 1.3 3 4" /><path d="M9 13h6" /></>}
      {name === "alert" && <><path d="m12 4 9 16H3L12 4Z" /><path d="M12 9v5m0 3h.01" /></>}
      {name === "voice" && <><path d="M4 5h16v12H8l-4 3V5Z" /><path d="M8 9h8m-8 4h5" /></>}
      {name === "calendar" && <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4m8-4v4M4 10h16" /></>}
      {name === "download" && <><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></>}
      {name === "chevron" && <path d="m9 5 7 7-7 7" />}
      {name === "arrow" && <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>}
      {name === "search" && <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>}
      {name === "team" && <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.6-4 2.6-6 5.5-6 2.1 0 3.8 1.1 4.8 3" /><path d="M16 8a2.5 2.5 0 1 1 2 4m-2 2c2.3.3 3.7 2 4.2 4" /></>}
    </svg>
  );
}

function SectionHeading({ title, description, action, headingId }: { title: string; description?: string; action?: ReactNode; headingId?: string }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={headingId} className="text-[17px] font-bold tracking-[-0.02em] text-[var(--app-text-primary)]">{title}</h2>
        {description && <p className="mt-1 text-xs text-[var(--app-text-tertiary)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, helper, comparison, icon, tone = "blue" }: { label: string; value: string; helper?: string; comparison?: string; icon: string; tone?: "blue" | "green" | "purple" | "red" | "amber" }) {
  const toneClass = {
    blue: "bg-[var(--app-info-soft)] text-[var(--app-info)]",
    green: "bg-[var(--app-success-soft)] text-[var(--app-success)]",
    purple: "bg-[var(--app-purple-soft)] text-[var(--app-purple)]",
    red: "bg-[var(--app-danger-soft)] text-[var(--app-danger)]",
    amber: "bg-[var(--app-warning-soft)] text-[var(--app-warning)]",
  }[tone];
  return (
    <article className={surfaceClass("min-h-[138px] p-4 sm:p-5")}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium leading-5 text-[var(--app-text-secondary)]">{label}</span>
        <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " + toneClass}><BiIcon name={icon} size={18} /></span>
      </div>
      <div className={"mt-4 break-words text-[28px] font-bold leading-none tracking-[-0.04em] text-[var(--app-text-primary)] " + (value === "No data available" ? "text-sm leading-5" : "")}>{value}</div>
      {helper && <div className="mt-2 text-[11px] leading-4 text-[var(--app-text-tertiary)]">{helper}</div>}
      {comparison && <div className="mt-1 text-[11px] font-semibold text-[var(--app-accent)]">{comparison}</div>}
    </article>
  );
}

function StatusPill({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "warning" | "neutral" }) {
  const className = tone === "success" ? "bg-[var(--app-success-soft)] text-[var(--app-success)]" : tone === "warning" ? "bg-[var(--app-warning-soft)] text-[var(--app-warning)]" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)]";
  return <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold " + className}><span className="h-1.5 w-1.5 rounded-full bg-current" />{children}</span>;
}

function StoreContext({ summary, stores, activeStoreId, selectStore, from, to, language }: { summary: StoreInsightsSummary; stores: ApiStore[]; activeStoreId: string; selectStore: (storeId: string) => void; from: string; to: string; language: "th" | "en" | "zh" }) {
  const isConnected = summary.store.lineOas.some((oa) => oa.connectionStatus === "CONNECTED" || oa.connectionStatus === "READY");
  return (
    <section className={surfaceClass("p-4 sm:p-5")} aria-labelledby="store-context-title">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-text-primary)] text-white shadow-sm"><BiIcon name="store" size={23} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--app-text-tertiary)]">Store context</p>
          <div className="mt-1"><StoreSearchCombobox stores={stores} selectedStoreId={activeStoreId} onSelect={selectStore} /></div>
          <div className="mt-2 flex flex-wrap items-center gap-2"><StatusPill tone={isConnected ? "success" : "warning"}>{isConnected ? "Active" : "No data available"}</StatusPill><span className="text-[11px] text-[var(--app-text-secondary)]">{summary.store.province || summary.store.region || "Location data not available"}</span></div>
        </div>
      </div>
      <p className="mt-3 border-t border-[var(--app-border-subtle)] pt-3 text-[10px] leading-4 text-[var(--app-text-tertiary)]">{summary.store.lineOas.length ? summary.store.lineOas.length + " active STORE LINE OA" + (summary.store.lineOas.length === 1 ? "" : "s") : "No LINE OA data"} · {summary.period.from || from} → {summary.period.to || to} · {language === "th" ? "เวลา Bangkok" : "Bangkok time"}</p>
    </section>
  );
}

function KeyInsight({ summary }: { summary: StoreInsightsSummary }) {
  const replyRate = summary.response.repliedWithin24Hours.percentage;
  const messageCount = formatNumber(summary.response.totalInboundMessages);
  const text = replyRate === null ? formatNumber(summary.customers) + " unique customers and " + messageCount + " inbound messages were recorded in this period." : formatNumber(summary.customers) + " unique customers generated " + messageCount + " inbound messages; " + formatPercentage(replyRate) + " received a human reply within 24 hours.";
  return (
    <section className="flex min-h-[112px] items-center gap-3 rounded-2xl border border-[var(--app-insight-border)] bg-[var(--app-insight-soft)] p-4 shadow-[var(--app-shadow-sm)] sm:p-5" aria-labelledby="key-insight-title">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-[var(--app-insight)]"><BiIcon name="insight" size={22} /></span>
      <div className="min-w-0 flex-1"><p id="key-insight-title" className="text-xs font-semibold text-[var(--app-insight)]">Key Insight</p><p className="mt-1.5 text-sm font-medium leading-5 text-[var(--app-text-primary)]">{text}</p><p className="mt-1.5 text-[10px] text-[var(--app-text-tertiary)]">Deterministic summary from the selected Store 360 period.</p></div>
      <span className="hidden shrink-0 text-[var(--app-insight)] sm:block"><BiIcon name="chevron" size={20} /></span>
    </section>
  );
}

function ResponseBars({ summary }: { summary: StoreInsightsSummary }) {
  const response = summary.response;
  const metrics = [["Within 15 minutes", response.repliedWithin15Minutes], ["Within 1 hour", response.repliedWithin1Hour], ["Within 24 hours", response.repliedWithin24Hours], ["Unanswered", response.unanswered]] as const;
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(230px,0.95fr)]">
      <div className="space-y-4">{metrics.map(([label, metric]) => { const width = metric.percentage === null ? 0 : Math.min(100, Math.max(metric.percentage * 100, metric.count > 0 ? 3 : 0)); const isUnanswered = label === "Unanswered"; return <div key={label}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="text-[var(--app-text-secondary)]">{label}</span><span className="font-semibold tabular-nums text-[var(--app-text-primary)]">{metric.count.toLocaleString()} · {formatPercentage(metric.percentage)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]"><div className={"h-full rounded-full " + (isUnanswered ? "bg-[var(--app-warning)]" : "bg-[var(--app-accent)]")} style={{ width: width + "%" }} /></div></div>; })}{!response.available && <p className="rounded-xl bg-[var(--app-warning-soft)] p-3 text-xs leading-5 text-[var(--app-warning)]">Response percentages are unavailable because some outbound messages do not identify a human responder or automated response.</p>}</div>
      <div className="rounded-xl bg-[var(--app-surface-subtle)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-xs font-semibold text-[var(--app-text-primary)]">Response context</h3><span className="text-[10px] text-[var(--app-text-tertiary)]">{formatNumber(response.totalConversations)} conversations</span></div><div className="mt-4 grid grid-cols-2 gap-3"><div><p className="text-[10px] text-[var(--app-text-tertiary)]">Median first response</p><p className="mt-1 text-lg font-bold tabular-nums text-[var(--app-text-primary)]">{formatDuration(response.medianFirstResponseSeconds)}</p></div><div><p className="text-[10px] text-[var(--app-text-tertiary)]">Inbound messages</p><p className="mt-1 text-lg font-bold tabular-nums text-[var(--app-text-primary)]">{formatNumber(response.totalInboundMessages)}</p></div></div><p className="mt-4 text-[11px] leading-5 text-[var(--app-text-tertiary)]">Definitions match the existing Store 360 response service and use Bangkok reporting boundaries.</p></div>
    </div>
  );
}

function formatTrendDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, month: "short", day: "numeric" }).format(new Date(value + "T12:00:00Z"));
}

function BusinessPerformance({ summary }: { summary: StoreInsightsSummary }) {
  const trend = summary.response.dailyTrend ?? [];
  const hasTrend = trend.some((point) => point.customers > 0 || point.salesTaggedCustomers > 0 || point.replyRate !== null);
  const maxCustomers = Math.max(1, ...trend.map((point) => point.customers));
  const chartStep = trend.length > 1 ? 620 / (trend.length - 1) : 620;
  const chartBarStep = trend.length > 0 ? 620 / trend.length : 620;
  const customerHeight = (value: number) => value / maxCustomers * 110;
  const replyPoints = trend.filter((point) => point.replyRate !== null).map((point) => {
    const index = trend.indexOf(point);
    return `${18 + index * chartStep},${160 - (point.replyRate ?? 0) * 110}`;
  }).join(" ");
  return (
    <section className={surfaceClass("flex min-h-[360px] flex-col p-4 sm:p-5")} aria-labelledby="business-performance-title">
      <SectionHeading title="Business Performance" description="Customer, sales and response trend." action={<span className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--app-text-primary)]">Daily⌄</span>} headingId="business-performance-title" />
      <div className="mt-2 flex flex-1 flex-col"><div className="flex items-start justify-between gap-3"><div><h3 className="text-xs font-semibold text-[var(--app-text-primary)]">Daily activity</h3><p className="mt-1 text-[11px] text-[var(--app-text-tertiary)]">Bangkok time · selected period</p></div><span className="shrink-0 text-[11px] font-medium text-[var(--app-text-tertiary)]">{summary.period.from} → {summary.period.to}</span></div>{!hasTrend ? <div className="mt-4 flex h-44 items-center justify-center rounded-xl bg-[var(--app-surface-subtle)] text-xs text-[var(--app-text-tertiary)]">Daily trend data is not available for this period.</div> : <div className="relative mt-3 h-44 overflow-hidden rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-subtle)] px-2 pb-1 pt-2 sm:h-48"><svg className="h-full w-full text-[var(--app-text-tertiary)]" viewBox="0 0 656 174" preserveAspectRatio="none" role="img" aria-label="Daily customers, sales-tagged customers, and reply rate trend"><g opacity="0.75">{[50, 95, 140, 160].map((y) => <line key={y} x1="18" x2="638" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.16" strokeWidth="1" />)}</g><g>{trend.map((point, index) => { const x = 18 + index * chartBarStep; const customers = customerHeight(point.customers); const sales = customerHeight(point.salesTaggedCustomers); return <g key={point.date}><rect x={x} y={160 - customers} width={Math.max(3, chartBarStep * 0.46)} height={customers} rx="2" fill="var(--store360-chart-customers)" fillOpacity="0.78"><title>{formatTrendDate(point.date)} · {point.customers.toLocaleString()} customers</title></rect><rect x={x + Math.max(3, chartBarStep * 0.46) * 0.44} y={160 - sales} width={Math.max(2, chartBarStep * 0.24)} height={sales} rx="2" fill="var(--store360-chart-sales)" fillOpacity="0.82"><title>{formatTrendDate(point.date)} · {point.salesTaggedCustomers.toLocaleString()} sales-tagged customers</title></rect></g>; })}</g>{replyPoints && <polyline points={replyPoints} fill="none" stroke="var(--store360-chart-reply)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}</svg></div>}<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[var(--app-text-secondary)]"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--store360-chart-customers)]" />Customers</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--store360-chart-sales)]" />Sales-tagged</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--store360-chart-reply)]" />Reply rate (%)</span><span className="ml-auto hidden text-[9px] text-[var(--app-text-tertiary)] sm:inline">{trend.length} days</span></div></div>
    </section>
  );
}

function ProductThumb() {
  return <span className="flex h-8 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-b from-[var(--store360-thumb-from)] to-[var(--store360-thumb-to)] text-[8px] text-white shadow-sm" aria-hidden="true">▯</span>;
}

function SalesPerformance({ summary }: { summary: StoreInsightsSummary }) {
  const products = summary.sales.productModels.slice(0, 5);
  const maxCount = Math.max(1, ...products.map((item) => item.count));
  return (
    <section className={surfaceClass("flex min-h-[360px] flex-col p-4 sm:p-5")} aria-labelledby="sales-performance-title">
      <SectionHeading title="Sales Performance" description="Recorded sales and product metadata from conversations." headingId="sales-performance-title" />
      <div className="mt-4 flex items-center justify-between gap-3"><h3 className="text-xs font-semibold text-[var(--app-text-primary)]">Top recorded products</h3><span className="text-[10px] text-[var(--app-text-tertiary)]">Sales metadata</span></div>
      {products.length === 0 ? <div className="mt-3 rounded-xl bg-[var(--app-surface-subtle)] p-5 text-center text-xs text-[var(--app-text-tertiary)]">No sales product data available.</div> : <ol className="mt-3 space-y-2.5">{products.map((item, index) => <li key={item.name} className="flex items-center gap-2.5"><span className="w-4 shrink-0 text-xs font-bold text-[var(--app-text-tertiary)]">{index + 1}</span><ProductThumb /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-semibold text-[var(--app-text-primary)]">{item.name}</span><span className="shrink-0 font-semibold tabular-nums text-[var(--app-text-secondary)]">{item.count.toLocaleString()}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]"><div className="h-full rounded-full bg-emerald-400" style={{ width: Math.max(7, item.count / maxCount * 100) + "%" }} /></div></div></li>)}</ol>}
      <Link href="/admin/purchase-analytics" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--app-accent)] hover:underline">View all products <BiIcon name="arrow" size={14} /></Link>
      <p className="mt-2 text-[10px] leading-4 text-[var(--app-text-tertiary)]">Customer Voice product interest is separate from confirmed sales.</p>
    </section>
  );
}

function ResponderList({ responders, storeId }: { responders: StoreInsightsResponder[]; storeId: string }) {
  return (
    <section className={surfaceClass("p-5 sm:p-6")} aria-labelledby="team-performance-title">
      <SectionHeading title="Team Performance" description="Human responder attribution from outbound messages." headingId="team-performance-title" />
      {responders.length === 0 ? <div className="rounded-xl bg-[var(--app-surface-subtle)] p-6 text-center text-xs text-[var(--app-text-tertiary)]">No responder data available for this period.</div> : <ol className="space-y-1">{responders.slice(0, 5).map((responder, index) => <li key={responder.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5"><span className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold " + (index === 0 ? "bg-[var(--app-success-soft)] text-[var(--app-success)]" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-tertiary)]")}>{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[var(--app-text-primary)]">{responder.displayName}</p><p className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">{responder.conversationsHandled.toLocaleString()} conversations · {formatPercentage(responder.repliedWithin24HoursPercentage)} within 24h</p></div><span className="shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--app-text-secondary)]">{formatDuration(responder.medianResponseSeconds)}<span className="block text-[9px] font-normal text-[var(--app-text-tertiary)]">median</span></span></li>)}</ol>}
      {responders.length > 0 && <Link href={"/chats?storeId=" + encodeURIComponent(storeId)} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--app-accent)] hover:underline">View team details <BiIcon name="arrow" size={14} /></Link>}
    </section>
  );
}

function ConversationExplorer({ conversations, total, loading, activeStoreId, searchText, setSearchText, responseFilter, setResponseFilter, responderFilter, setResponderFilter, salesFilter, setSalesFilter, responders, customerVoiceTopic, selectCustomerVoiceTopic, onOpenConversation }: { conversations: StoreInsightsConversation[]; total: number; loading: boolean; activeStoreId: string; searchText: string; setSearchText: (value: string) => void; responseFilter: ResponseFilter; setResponseFilter: (value: ResponseFilter) => void; responderFilter: string; setResponderFilter: (value: string) => void; salesFilter: SalesFilter; setSalesFilter: (value: SalesFilter) => void; responders: StoreInsightsResponder[]; customerVoiceTopic: string | null; selectCustomerVoiceTopic: (topic: string) => void; onOpenConversation: (conversationId: string) => void }) {
  return (
    <section className={surfaceClass("overflow-hidden p-5 sm:p-6")} aria-labelledby="conversation-explorer-title">
      <SectionHeading title="Conversation Explorer" description="A compact preview of recent conversations." action={<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-info-soft)] text-[var(--app-info)]"><BiIcon name="search" size={17} /></span>} headingId="conversation-explorer-title" />
      <label className="relative mb-3 block"><span className="sr-only">Search conversations, topics, or keywords</span><span className="pointer-events-none absolute left-3 top-2.5 text-[var(--app-text-tertiary)]"><BiIcon name="search" size={15} /></span><input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search conversations, topics, or keywords..." aria-label="Search conversations, topics, or keywords" className="h-9 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] pl-9 pr-3 text-xs text-[var(--app-text-primary)] outline-none placeholder:text-[var(--app-text-tertiary)] focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent)]/20" /></label>
      <div className="flex flex-wrap gap-2"><select aria-label="Response status filter" value={responseFilter} onChange={(event) => setResponseFilter(event.target.value as ResponseFilter)} className="h-8 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2 text-[11px] text-[var(--app-text-primary)]"><option value="ALL">All statuses</option><option value="REPLIED">Replied</option><option value="UNANSWERED">Unanswered</option></select><select aria-label="Responder filter" value={responderFilter} onChange={(event) => setResponderFilter(event.target.value)} className="h-8 max-w-[150px] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2 text-[11px] text-[var(--app-text-primary)]"><option value="ALL">All responders</option>{responders.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select><select aria-label="Sales tag filter" value={salesFilter} onChange={(event) => setSalesFilter(event.target.value as SalesFilter)} className="h-8 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2 text-[11px] text-[var(--app-text-primary)]"><option value="ALL">All sales</option><option value="TAGGED">Sales tagged</option><option value="UNTAGGED">Not tagged</option></select>{customerVoiceTopic && <button type="button" onClick={() => selectCustomerVoiceTopic(customerVoiceTopic)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--app-accent-soft)] px-2 text-[11px] font-semibold text-[var(--app-accent)]">{customerVoiceTopic} ×</button>}</div>
      <div className="mt-4 divide-y divide-[var(--app-border-subtle)]">{loading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="flex animate-pulse items-center gap-3 py-3"><span className="h-8 w-8 rounded-full bg-[var(--app-surface-subtle)]" /><span className="h-8 flex-1 rounded-lg bg-[var(--app-surface-subtle)]" /></div>) : conversations.length === 0 ? <div className="rounded-xl bg-[var(--app-surface-subtle)] p-6 text-center text-xs text-[var(--app-text-tertiary)]">No conversations available for these filters.</div> : conversations.slice(0, 4).map((item) => <button key={item.id} type="button" onClick={() => onOpenConversation(item.id)} className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[var(--app-surface-hover)]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--app-success-soft)] text-[var(--app-success)]"><BiIcon name="reply" size={15} /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-[var(--app-text-primary)]">{item.customer.displayName}</span><span className="shrink-0 text-[10px] text-[var(--app-text-tertiary)]">{formatDateTime(item.lastActivity)}</span></span><span className="mt-1 flex min-w-0 items-center gap-2"><span className="truncate text-[11px] text-[var(--app-text-secondary)]">{item.topic || item.salesProduct || "Conversation activity"}</span><span className={"shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold " + (item.responseStatus === "REPLIED" ? "bg-[var(--app-success-soft)] text-[var(--app-success)]" : "bg-[var(--app-warning-soft)] text-[var(--app-warning)]")}>{item.responseStatus === "REPLIED" ? "Replied" : "Pending"}</span></span></span><BiIcon name="chevron" size={15} /></button>)}</div>
      <div className="mt-4 flex items-center justify-between gap-3"><span className="text-[11px] text-[var(--app-text-tertiary)]">{loading ? "Loading…" : Math.min(conversations.length, 4).toLocaleString() + " shown of " + total.toLocaleString()}</span><Link href={"/chats?storeId=" + encodeURIComponent(activeStoreId)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--app-accent)] hover:underline">View all conversations <BiIcon name="arrow" size={14} /></Link></div>
    </section>
  );
}

function Store360Skeleton() {
  return <div className="space-y-5 animate-pulse"><div className="h-16 rounded-2xl bg-[var(--app-surface-subtle)]" /><div className="grid gap-5 lg:grid-cols-[0.9fr_1.35fr]"><div className="h-44 rounded-2xl bg-[var(--app-surface-subtle)]" /><div className="h-44 rounded-2xl bg-[var(--app-surface-subtle)]" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-36 rounded-2xl bg-[var(--app-surface-subtle)]" />)}</div><div className="grid gap-5 lg:grid-cols-3"><div className="h-80 rounded-2xl bg-[var(--app-surface-subtle)] lg:col-span-2" /><div className="h-80 rounded-2xl bg-[var(--app-surface-subtle)]" /></div></div>;
}

function Store360UserMenu({ authUser, language, changeLanguage, logout }: { authUser: AuthUser; language: "th" | "en" | "zh"; changeLanguage: (language: "th" | "en" | "zh") => void; logout: () => Promise<void> | void }) {
  return (
    <details className="relative shrink-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[var(--app-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--store360-avatar)] text-xs font-bold text-white">{authUser.displayName.charAt(0).toUpperCase()}</span>
        <span className="hidden text-left sm:block"><span className="block text-xs font-semibold text-[var(--app-text-primary)]">{authUser.displayName}</span><span className="block text-[10px] text-[var(--app-text-tertiary)]">OPPO Thailand</span></span>
        <span className="text-xs text-[var(--app-text-secondary)]">⌄</span>
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-[var(--app-shadow-elevated)]">
        <p className="truncate text-xs font-semibold text-[var(--app-text-primary)]">{authUser.displayName}</p>
        <p className="mt-0.5 truncate text-[10px] text-[var(--app-text-tertiary)]">{authUser.email}</p>
        <label className="mt-3 block text-[10px] font-semibold text-[var(--app-text-secondary)]">Language<select value={language} onChange={(event) => changeLanguage(event.target.value as "th" | "en" | "zh")} className="mt-1 h-8 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2 text-xs text-[var(--app-text-primary)]"><option value="th">ไทย</option><option value="en">English</option><option value="zh">中文</option></select></label>
        <button type="button" onClick={() => void logout()} className="mt-3 w-full rounded-lg bg-[var(--app-danger-soft)] px-2 py-2 text-left text-xs font-semibold text-[var(--app-danger)]">Log out</button>
      </div>
    </details>
  );
}

export function Store360View() {
  const { language, setLanguage } = useAppLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [storeId, setStoreId] = useState(searchParams.get("storeId") ?? "");
  const initialRange = useMemo(() => { const from = searchParams.get("from"); const to = searchParams.get("to"); return from && to ? { from, to, preset: "custom" as Preset } : { ...rangeForPreset("30d"), preset: "30d" as Preset }; }, [searchParams]);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [preset, setPreset] = useState<Preset>(initialRange.preset);
  const [comparisonMode] = useState<ComparisonMode>("previous");
  const [summary, setSummary] = useState<StoreInsightsSummary | null>(null);
  const [customerVoice, setCustomerVoice] = useState<StoreInsightsCustomerVoice | null>(null);
  const [customerVoiceLoading, setCustomerVoiceLoading] = useState(false);
  const [customerVoiceTopic, setCustomerVoiceTopic] = useState<string | null>(null);
  const [conversations, setConversations] = useState<StoreInsightsConversation[]>([]);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("ALL");
  const [responderFilter, setResponderFilter] = useState("ALL");
  const [salesFilter, setSalesFilter] = useState<SalesFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [bootstrapComplete, setBootstrapComplete] = useState(false);
  const [customerVoiceError, setCustomerVoiceError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const initialSelection = useRef({ storeId, from, to });
  const summaryRequestId = useRef(0);
  const customerVoiceRequestId = useRef(0);
  const conversationsRequestId = useRef(0);

  const activeStoreId = bootstrapComplete ? storeId || stores[0]?.id || "" : "";
  const updateUrl = useCallback((nextStoreId: string, nextFrom: string, nextTo: string) => { const params = new URLSearchParams(); if (nextStoreId) params.set("storeId", nextStoreId); params.set("from", nextFrom); params.set("to", nextTo); router.replace("/store-360?" + params.toString(), { scroll: false }); }, [router]);

  useEffect(() => {
    let active = true;
    void withStore360Timeout(Promise.all([api.me(), api.stores()])).then(([user, storeRows]) => { if (!active) return; const authorizedStores = storeRows ?? []; const resolvedStoreId = resolveAuthorizedStoreId(initialSelection.current.storeId, authorizedStores); setAuthUser(user as AuthUser); setStores(authorizedStores); setStoreId(resolvedStoreId); setBootstrapComplete(true); if (resolvedStoreId !== initialSelection.current.storeId) updateUrl(resolvedStoreId, initialSelection.current.from, initialSelection.current.to); }).catch((reason: unknown) => { if (active) setBootstrapError(reason instanceof Error ? reason.message : "Unable to load authorized stores"); });
    return () => { active = false; };
  }, [bootstrapAttempt, updateUrl]);

  const loadSummary = useCallback(async () => {
    if (!activeStoreId) { setLoading(false); return; }
    const requestId = ++summaryRequestId.current;
    setLoading(true); setError(null); setSummary(null);
    try { const compare = comparisonMode === "previous" ? comparisonFor(from, to) : {}; const value = await api.storeInsightsSummary(activeStoreId, { from, to, ...compare }); if (requestId === summaryRequestId.current) setSummary(value); }
    catch (reason) { if (requestId === summaryRequestId.current) setError(reason instanceof Error ? reason.message : "Unable to load Store 360"); }
    finally { if (requestId === summaryRequestId.current) setLoading(false); }
  }, [activeStoreId, comparisonMode, from, to]);

  const loadConversations = useCallback(async () => {
    if (!activeStoreId) return;
    const requestId = ++conversationsRequestId.current;
    setConversationLoading(true); setConversations([]); setConversationTotal(0);
    try { const value = await api.storeInsightsConversations(activeStoreId, { from, to, responseStatus: responseFilter === "ALL" ? undefined : responseFilter, responderId: responderFilter === "ALL" ? undefined : responderFilter, salesTagged: salesFilter === "ALL" ? undefined : salesFilter === "TAGGED", customerVoiceTopic: customerVoiceTopic ?? undefined }); if (requestId === conversationsRequestId.current) { setConversations(value.items); setConversationTotal(value.total); } }
    catch (reason) { if (requestId === conversationsRequestId.current) setError(reason instanceof Error ? reason.message : "Unable to load conversations"); }
    finally { if (requestId === conversationsRequestId.current) setConversationLoading(false); }
  }, [activeStoreId, customerVoiceTopic, from, responseFilter, responderFilter, salesFilter, to]);

  const loadCustomerVoice = useCallback(async () => {
    if (!activeStoreId) { setCustomerVoiceLoading(false); return; }
    const requestId = ++customerVoiceRequestId.current;
    setCustomerVoiceLoading(true); setCustomerVoiceError(null); setCustomerVoice(null);
    try { const compare = comparisonMode === "previous" ? comparisonFor(from, to) : {}; const value = await api.storeInsightsCustomerVoice(activeStoreId, { from, to, ...compare }); if (requestId === customerVoiceRequestId.current) setCustomerVoice(value); }
    catch (reason) { if (requestId === customerVoiceRequestId.current) setCustomerVoiceError(reason instanceof Error ? reason.message : "Unable to load Customer Voice"); }
    finally { if (requestId === customerVoiceRequestId.current) setCustomerVoiceLoading(false); }
  }, [activeStoreId, comparisonMode, from, to]);

  useEffect(() => { const timer = window.setTimeout(() => { void loadSummary(); }, 0); return () => window.clearTimeout(timer); }, [loadSummary]);
  useEffect(() => { const timer = window.setTimeout(() => { void loadConversations(); }, 0); return () => window.clearTimeout(timer); }, [loadConversations]);
  useEffect(() => { const timer = window.setTimeout(() => { void loadCustomerVoice(); }, 0); return () => window.clearTimeout(timer); }, [loadCustomerVoice]);

  const invalidateInsights = () => { summaryRequestId.current += 1; customerVoiceRequestId.current += 1; conversationsRequestId.current += 1; setSummary(null); setCustomerVoice(null); setCustomerVoiceTopic(null); setConversations([]); setConversationTotal(0); };
  const selectStore = (next: string) => { if (next === activeStoreId) return; invalidateInsights(); setStoreId(next); updateUrl(next, from, to); };
  const applyCustomRange = (nextFrom: string, nextTo: string) => { if (!nextFrom || !nextTo || nextFrom > nextTo || nextTo > todayInBangkok()) return; invalidateInsights(); setPreset("custom"); setFrom(nextFrom); setTo(nextTo); updateUrl(activeStoreId, nextFrom, nextTo); };
  const selectCustomerVoiceTopic = (topic: string) => { const nextTopic = customerVoiceTopic === topic ? null : topic; setCustomerVoiceTopic(nextTopic); conversationsRequestId.current += 1; setConversations([]); setConversationTotal(0); };
  const logout = async () => { await api.logout().catch(() => undefined); router.replace("/login"); };
  const responders = summary?.responders ?? [];
  const visibleConversations = useMemo(() => { const q = searchText.trim().toLocaleLowerCase(); return q ? conversations.filter((item) => item.customer.displayName.toLocaleLowerCase().includes(q) || item.salesProduct?.toLocaleLowerCase().includes(q)) : conversations; }, [conversations, searchText]);

  if (bootstrapError) return <main className="store360-workspace flex min-h-screen items-center justify-center bg-[var(--app-bg)] p-6"><div className={surfaceClass("max-w-md p-6 text-center")}><h1 className="text-base font-semibold text-[var(--app-text-primary)]">Unable to open Store 360</h1><p className="mt-2 text-sm text-[var(--app-text-secondary)]">{bootstrapError}</p><button type="button" onClick={() => { setBootstrapError(null); setBootstrapAttempt((value) => value + 1); }} className="mt-4 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white">Try again</button></div></main>;
  if (!bootstrapComplete || !authUser) return <main className="store360-workspace flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">Opening Store 360…</main>;

  return (
    <AppShell currentSection="store-360" authUser={authUser} text={{ appName: "OPPO LINE OA Monitor", searchPlaceholder: "Search customers, stores, or messages" }} language={language} changeLanguage={setLanguage} searchText={searchText} setSearchText={setSearchText} logout={logout} showGlobalHeader={false} isLoading={loading && !summary} apiError={error} loadApplicationData={() => { void loadSummary(); void loadCustomerVoice(); void loadConversations(); }}>
      <PageContainer variant="wide" className="store360-workspace min-w-0 bg-[var(--app-bg)]">
        {!stores.length && !loading ? <div className={surfaceClass("p-8 text-center text-sm text-[var(--app-text-secondary)]")}>No authorized stores available.</div> : loading && !summary ? <Store360Skeleton /> : summary ? <div className="space-y-5">
          <header className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)]">Store 360</p><h1 className="mt-1 text-[30px] font-bold leading-tight tracking-[-0.045em] text-[var(--app-text-primary)]">Store 360</h1><p className="mt-1 text-sm text-[var(--app-text-secondary)]">Turn conversations into business impact</p></div><div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:flex-nowrap xl:justify-end"><UnifiedPeriodPicker key={"store-360-period-picker-" + preset} className="w-full sm:w-auto" dateFrom={from} dateTo={to} language={language} deferQuickRanges showOutsideQuickRanges={false} onApply={applyCustomRange} /><Store360ExportControl stores={stores} selectedStoreId={activeStoreId} startDate={from} endDate={to} language={language} /><Store360UserMenu authUser={authUser} language={language} changeLanguage={setLanguage} logout={logout} /></div></header>
          <section className="grid gap-5 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.45fr)]"><StoreContext summary={summary} stores={stores} activeStoreId={activeStoreId} selectStore={selectStore} from={from} to={to} language={language} /><KeyInsight summary={summary} /></section>
          <section aria-labelledby="store-kpis-title"><div className="sr-only"><h2 id="store-kpis-title">Store performance KPIs</h2></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><MetricCard label="Customers" value={formatNumber(summary.customers)} helper="Unique customers with inbound activity" comparison={comparisonCountDelta(summary.customers, summary.comparison?.customers)} icon="customers" tone="blue" /><MetricCard label="Reply within 24h" value={summary.response.available ? formatPercentage(summary.response.repliedWithin24Hours.percentage) : "No data available"} helper={summary.response.available ? summary.response.repliedWithin24Hours.count.toLocaleString() + " conversations" : "Human/bot attribution incomplete"} comparison={comparisonPercentagePoints(summary.response.repliedWithin24Hours.percentage, summary.comparison?.response.repliedWithin24Hours.percentage)} icon="reply" tone="green" /><MetricCard label="Median response time" value={summary.response.available ? formatDuration(summary.response.medianFirstResponseSeconds) : "No data available"} helper="First valid human response" comparison={comparisonResponseTime(summary.response.medianFirstResponseSeconds, summary.comparison?.response.medianFirstResponseSeconds)} icon="clock" tone="blue" /><MetricCard label="Sales-tagged customers" value={formatNumber(summary.sales.salesTaggedCustomers)} helper={summary.sales.salesTaggedCustomerPercentage === null ? "Percentage unavailable" : formatPercentage(summary.sales.salesTaggedCustomerPercentage) + " of customers"} comparison={comparisonCountDelta(summary.sales.salesTaggedCustomers, summary.comparison?.sales.salesTaggedCustomers)} icon="sales" tone="purple" /><MetricCard label="Unanswered customers" value={summary.response.available ? formatNumber(summary.response.unanswered.count) : "No data available"} helper="No valid human response" comparison={comparisonUnanswered(summary.response.unanswered.count, summary.comparison?.response.unanswered.count)} icon="alert" tone="red" /><MetricCard label="Customer Voice coverage" value={customerVoice ? formatPercentage(customerVoice.coverage.classifiedPercentage) : "No data available"} helper={customerVoice ? customerVoice.coverage.classifiedConversations.toLocaleString() + " / " + customerVoice.coverage.totalConversations.toLocaleString() + " classified" : "Current analysis data unavailable"} icon="voice" tone="purple" /></div></section>
          <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(270px,0.95fr)_minmax(250px,0.85fr)]"><BusinessPerformance summary={summary} /><CustomerVoicePanel data={customerVoice} loading={customerVoiceLoading} error={customerVoiceError} selectedTopic={customerVoiceTopic} onTopicSelect={selectCustomerVoiceTopic} /><SalesPerformance summary={summary} /></section>
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(250px,0.95fr)_minmax(0,1.2fr)]"><section className={surfaceClass("h-full p-5 sm:p-6")} aria-labelledby="response-performance-title"><SectionHeading title="Response Performance" description="How quickly are customers receiving a valid human response?" headingId="response-performance-title" /><div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[var(--app-success-soft)] p-3"><p className="text-[10px] text-[var(--app-text-secondary)]">Within 24h</p><p className="mt-1 text-xl font-bold tabular-nums text-[var(--app-success)]">{formatPercentage(summary.response.repliedWithin24Hours.percentage)}</p></div><div className="rounded-xl bg-[var(--app-info-soft)] p-3"><p className="text-[10px] text-[var(--app-text-secondary)]">Median first response</p><p className="mt-1 text-xl font-bold tabular-nums text-[var(--app-info)]">{formatDuration(summary.response.medianFirstResponseSeconds)}</p></div><div className="rounded-xl bg-[var(--app-warning-soft)] p-3"><p className="text-[10px] text-[var(--app-text-secondary)]">Unanswered</p><p className="mt-1 text-xl font-bold tabular-nums text-[var(--app-warning)]">{formatNumber(summary.response.unanswered.count)}</p></div></div><ResponseBars summary={summary} /></section><ResponderList responders={responders} storeId={activeStoreId} /><ConversationExplorer conversations={visibleConversations} total={conversationTotal} loading={conversationLoading} activeStoreId={activeStoreId} searchText={searchText} setSearchText={setSearchText} responseFilter={responseFilter} setResponseFilter={setResponseFilter} responderFilter={responderFilter} setResponderFilter={setResponderFilter} salesFilter={salesFilter} setSalesFilter={setSalesFilter} responders={responders} customerVoiceTopic={customerVoiceTopic} selectCustomerVoiceTopic={selectCustomerVoiceTopic} onOpenConversation={(conversationId) => router.push("/chats?storeId=" + encodeURIComponent(activeStoreId) + "&conversationId=" + encodeURIComponent(conversationId))} /></section>
        </div> : <div className={surfaceClass("p-8 text-center text-sm text-[var(--app-text-secondary)]")}>No data available for this period.</div>}
      </PageContainer>
    </AppShell>
  );
}
