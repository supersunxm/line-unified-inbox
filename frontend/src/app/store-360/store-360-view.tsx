"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageContainer } from "@/components/shell";
import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/authorization";
import type { ApiStore, StoreInsightsConversation, StoreInsightsCustomerVoice, StoreInsightsResponder, StoreInsightsSummary } from "@/types/api";
import { UnifiedPeriodPicker } from "@/components/date-range/unified-period-picker";
import { useAppLanguage } from "../language";
import { StoreSearchCombobox } from "./store-search-combobox";
import { CustomerVoicePanel } from "./customer-voice-panel";

type Preset = "7d" | "30d" | "month" | "custom";
type ComparisonMode = "previous" | "none";
type ResponseFilter = "ALL" | "REPLIED" | "UNANSWERED";
type SalesFilter = "ALL" | "TAGGED" | "UNTAGGED";

const TIMEZONE = "Asia/Bangkok";

function todayInBangkok() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function rangeForPreset(preset: Exclude<Preset, "custom">, now = todayInBangkok()) {
  if (preset === "7d") return { from: shiftDate(now, -6), to: now };
  if (preset === "month") return { from: `${now.slice(0, 7)}-01`, to: now };
  return { from: shiftDate(now, -29), to: now };
}

function comparisonFor(from: string, to: string) {
  const days = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;
  const compareTo = shiftDate(from, -1);
  return { compareFrom: shiftDate(compareTo, -(days - 1)), compareTo };
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "No data available" : value.toLocaleString("en-US");
}

function formatPercentage(value: number | null | undefined) {
  return value === null || value === undefined ? "No data available" : `${Math.round(value * 100)}%`;
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "No data available";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function comparisonDelta(current: number | null | undefined, previous: number | null | undefined, formatter: (value: number) => string) {
  if (current === null || current === undefined || previous === null || previous === undefined) return undefined;
  const delta = current - previous;
  return `vs previous: ${delta > 0 ? "+" : ""}${formatter(delta)}`;
}

function comparisonPercentagePoints(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined) return undefined;
  const delta = Math.round((current - previous) * 100);
  return `vs previous: ${delta > 0 ? "+" : ""}${delta}pp`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function surfaceClass() {
  return "rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)]";
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-[var(--app-text-primary)]">{title}</h2>
        {description && <p className="mt-1 text-xs text-[var(--app-text-tertiary)]">{description}</p>}
      </div>
    </div>
  );
}

function MetricCard({ label, value, helper, comparison, accent = "var(--app-accent)" }: { label: string; value: string; helper?: string; comparison?: string; accent?: string }) {
  return (
    <article className={`${surfaceClass()} min-h-[122px] p-4`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[var(--app-text-secondary)]">{label}</span>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <div className={`mt-4 break-words text-2xl font-bold tracking-[-0.03em] text-[var(--app-text-primary)] ${value === "No data available" ? "text-sm leading-5" : ""}`}>{value}</div>
      {helper && <div className="mt-1.5 text-[11px] text-[var(--app-text-tertiary)]">{helper}</div>}
      {comparison && <div className="mt-1 text-[11px] font-medium text-[var(--app-accent)]">{comparison}</div>}
    </article>
  );
}

function ResponseBars({ summary }: { summary: StoreInsightsSummary }) {
  const response = summary.response;
  const metrics = [
    ["Within 15 minutes", response.repliedWithin15Minutes],
    ["Within 1 hour", response.repliedWithin1Hour],
    ["Within 24 hours", response.repliedWithin24Hours],
    ["Unanswered", response.unanswered],
  ] as const;
  const maxVolume = Math.max(1, ...response.volumeByHour);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
      <div>
        <div className="space-y-3">
          {metrics.map(([label, metric]) => (
            <div key={label}>
              <div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="text-[var(--app-text-secondary)]">{label}</span><span className="font-semibold tabular-nums text-[var(--app-text-primary)]">{metric.count.toLocaleString()} · {formatPercentage(metric.percentage)}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]"><div className={`h-full rounded-full ${label === "Unanswered" ? "bg-[var(--app-warning)]" : "bg-[var(--app-accent)]"}`} style={{ width: `${metric.percentage === null ? 0 : Math.max(3, metric.percentage * 100)}%` }} /></div>
            </div>
          ))}
        </div>
        {!response.available && <p className="mt-4 rounded-xl border border-[var(--app-warning)]/30 bg-[var(--app-warning-soft)] p-3 text-xs text-[var(--app-warning)]">Response KPIs unavailable: some outbound messages do not identify a human responder or an automated response.</p>}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold text-[var(--app-text-primary)]">Inbound volume by hour</h3><span className="text-[11px] text-[var(--app-text-tertiary)]">Bangkok time</span></div>
        <div className="flex h-28 items-end gap-1 rounded-xl bg-[var(--app-surface-subtle)] px-2 pb-2 pt-4">
          {response.volumeByHour.map((count, hour) => <div key={hour} className="group relative flex h-full flex-1 items-end" title={`${String(hour).padStart(2, "0")}:00 · ${count}`}><div className="w-full rounded-t bg-[var(--app-accent)]/70 transition-colors group-hover:bg-[var(--app-accent)]" style={{ height: `${Math.max(count > 0 ? 5 : 1, count / maxVolume * 100)}%` }} /></div>)}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-[var(--app-text-tertiary)]"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      </div>
    </div>
  );
}

function ResponderTable({ responders }: { responders: StoreInsightsResponder[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-left text-xs">
        <thead><tr className="border-b border-[var(--app-border)] text-[10px] uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]"><th className="px-4 py-3 font-semibold">Staff</th><th className="px-4 py-3 font-semibold">Conversations handled</th><th className="px-4 py-3 font-semibold">Replied within 24h</th><th className="px-4 py-3 font-semibold">Median response</th><th className="px-4 py-3 font-semibold">Follow-ups</th><th className="px-4 py-3 font-semibold">Sales tagged</th></tr></thead>
        <tbody>{responders.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--app-text-tertiary)]">No data available</td></tr> : responders.map((responder) => <tr key={responder.id} className="border-b border-[var(--app-border-subtle)] last:border-0"><td className="px-4 py-3 font-semibold text-[var(--app-text-primary)]">{responder.displayName}</td><td className="px-4 py-3 tabular-nums">{responder.conversationsHandled.toLocaleString()}</td><td className="px-4 py-3 tabular-nums">{formatPercentage(responder.repliedWithin24HoursPercentage)}</td><td className="px-4 py-3 tabular-nums">{formatDuration(responder.medianResponseSeconds)}</td><td className="px-4 py-3 tabular-nums">{responder.followUpCount === null ? "No data available" : responder.followUpCount.toLocaleString()}</td><td className="px-4 py-3 tabular-nums">{responder.salesTaggedCount === null ? "No data available" : responder.salesTaggedCount.toLocaleString()}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Store360Skeleton() {
  return <div className="space-y-5 animate-pulse"><div className="h-24 rounded-2xl bg-[var(--app-surface-subtle)]" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-[var(--app-surface-subtle)]" />)}</div><div className="h-72 rounded-2xl bg-[var(--app-surface-subtle)]" /></div>;
}

export function Store360View() {
  const { language, setLanguage } = useAppLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [storeId, setStoreId] = useState(searchParams.get("storeId") ?? "");
  const initialRange = useMemo(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    return from && to ? { from, to, preset: "custom" as Preset } : { ...rangeForPreset("30d"), preset: "30d" as Preset };
  }, [searchParams]);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [preset, setPreset] = useState<Preset>(initialRange.preset);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("previous");
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
  const [searchText, setSearchText] = useState("");
  const bootstrapped = useRef(false);
  const summaryRequestId = useRef(0);
  const customerVoiceRequestId = useRef(0);
  const conversationsRequestId = useRef(0);

  const activeStoreId = storeId || stores[0]?.id || "";
  const updateUrl = useCallback((nextStoreId: string, nextFrom: string, nextTo: string) => {
    const params = new URLSearchParams();
    if (nextStoreId) params.set("storeId", nextStoreId);
    params.set("from", nextFrom);
    params.set("to", nextTo);
    router.replace(`/store-360?${params.toString()}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    let active = true;
    void Promise.all([api.me(), api.stores()])
      .then(([user, storeRows]) => {
        if (!active) return;
        setAuthUser(user as AuthUser);
        setStores(storeRows ?? []);
        if (!storeId && storeRows[0]) {
          setStoreId(storeRows[0].id);
          updateUrl(storeRows[0].id, from, to);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load authorized stores");
      });
    return () => { active = false; };
  }, [from, initialRange.from, initialRange.to, storeId, to, updateUrl]);

  const loadSummary = useCallback(async () => {
    if (!activeStoreId) { setLoading(false); return; }
    const requestId = ++summaryRequestId.current;
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const compare = comparisonMode === "previous" ? comparisonFor(from, to) : {};
      const value = await api.storeInsightsSummary(activeStoreId, { from, to, ...compare });
      if (requestId === summaryRequestId.current) setSummary(value);
    } catch (reason) {
      if (requestId === summaryRequestId.current) setError(reason instanceof Error ? reason.message : "Unable to load Store 360");
    } finally {
      if (requestId === summaryRequestId.current) setLoading(false);
    }
  }, [activeStoreId, comparisonMode, from, to]);

  const loadConversations = useCallback(async () => {
    if (!activeStoreId) return;
    const requestId = ++conversationsRequestId.current;
    setConversationLoading(true);
    setConversations([]);
    setConversationTotal(0);
    try {
      const value = await api.storeInsightsConversations(activeStoreId, {
        from,
        to,
        responseStatus: responseFilter === "ALL" ? undefined : responseFilter,
        responderId: responderFilter === "ALL" ? undefined : responderFilter,
        salesTagged: salesFilter === "ALL" ? undefined : salesFilter === "TAGGED",
        customerVoiceTopic: customerVoiceTopic ?? undefined,
      });
      if (requestId === conversationsRequestId.current) {
        setConversations(value.items);
        setConversationTotal(value.total);
      }
    } catch (reason) {
      if (requestId === conversationsRequestId.current) setError(reason instanceof Error ? reason.message : "Unable to load conversations");
    } finally {
      if (requestId === conversationsRequestId.current) setConversationLoading(false);
    }
  }, [activeStoreId, customerVoiceTopic, from, responseFilter, responderFilter, salesFilter, to]);

  const loadCustomerVoice = useCallback(async () => {
    if (!activeStoreId) { setCustomerVoiceLoading(false); return; }
    const requestId = ++customerVoiceRequestId.current;
    setCustomerVoiceLoading(true);
    setCustomerVoice(null);
    try {
      const compare = comparisonMode === "previous" ? comparisonFor(from, to) : {};
      const value = await api.storeInsightsCustomerVoice(activeStoreId, { from, to, ...compare });
      if (requestId === customerVoiceRequestId.current) setCustomerVoice(value);
    } catch (reason) {
      if (requestId === customerVoiceRequestId.current) setError(reason instanceof Error ? reason.message : "Unable to load Customer Voice");
    } finally {
      if (requestId === customerVoiceRequestId.current) setCustomerVoiceLoading(false);
    }
  }, [activeStoreId, comparisonMode, from, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSummary(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadConversations(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConversations]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCustomerVoice(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCustomerVoice]);

  const invalidateInsights = () => {
    summaryRequestId.current += 1;
    customerVoiceRequestId.current += 1;
    conversationsRequestId.current += 1;
    setSummary(null);
    setCustomerVoice(null);
    setCustomerVoiceTopic(null);
    setConversations([]);
    setConversationTotal(0);
  };
  const selectStore = (next: string) => {
    if (next === activeStoreId) return;
    invalidateInsights();
    setStoreId(next);
    updateUrl(next, from, to);
  };
  const selectPreset = (next: Preset) => {
    setPreset(next);
    if (next === "custom") {
      setCustomPickerOpen(true);
      return;
    }
    setCustomPickerOpen(false);
    const range = rangeForPreset(next);
    invalidateInsights();
    setFrom(range.from); setTo(range.to); updateUrl(activeStoreId, range.from, range.to);
  };
  const applyCustomRange = (nextFrom: string, nextTo: string) => {
    if (!nextFrom || !nextTo || nextFrom > nextTo || nextTo > todayInBangkok()) return;
    invalidateInsights();
    setFrom(nextFrom);
    setTo(nextTo);
    updateUrl(activeStoreId, nextFrom, nextTo);
  };
  const selectCustomerVoiceTopic = (topic: string) => {
    const nextTopic = customerVoiceTopic === topic ? null : topic;
    setCustomerVoiceTopic(nextTopic);
    conversationsRequestId.current += 1;
    setConversations([]);
    setConversationTotal(0);
  };
  const logout = async () => { await api.logout().catch(() => undefined); router.replace("/login"); };
  const responders = summary?.responders ?? [];
  const visibleConversations = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase();
    return q ? conversations.filter((item) => item.customer.displayName.toLocaleLowerCase().includes(q) || item.salesProduct?.toLocaleLowerCase().includes(q)) : conversations;
  }, [conversations, searchText]);

  if (!authUser) return <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">Opening Store 360…</main>;

  return (
    <AppShell currentSection="store-360" authUser={authUser} language={language} changeLanguage={setLanguage} searchText={searchText} setSearchText={setSearchText} logout={logout} isLoading={loading} apiError={error} loadApplicationData={() => { void loadSummary(); void loadCustomerVoice(); }} text={{ appName: "OPPO LINE OA Monitor", searchPlaceholder: "Search customers, stores, or messages" }}>
      <PageContainer variant="wide">
        {!stores.length && !loading ? <div className={`${surfaceClass()} p-8 text-center text-sm text-[var(--app-text-secondary)]`}>No authorized stores available.</div> : loading && !summary ? <Store360Skeleton /> : summary ? <>
          <section className={`${surfaceClass()} overflow-hidden p-5 sm:p-6`}>
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-accent)]">Store 360</div><h1 className="mt-1 truncate text-2xl font-bold tracking-[-0.03em] text-[var(--app-text-primary)]">{summary.store.name}</h1><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--app-text-secondary)]"><span>Store ID: {summary.store.externalStoreId || summary.store.code || summary.store.id}</span>{summary.store.province && <span>{summary.store.province}</span>}<span>{summary.store.lineOas.length ? `${summary.store.lineOas.length} LINE OA${summary.store.lineOas.length === 1 ? "" : "s"}` : "No LINE OA data"}</span></div></div>
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"><span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--app-success-soft)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--app-success)]"><span className="h-1.5 w-1.5 rounded-full bg-current" />{summary.store.lineOas.some((oa) => oa.connectionStatus === "CONNECTED" || oa.connectionStatus === "READY") ? "Connected" : "No data available"}</span><StoreSearchCombobox stores={stores} selectedStoreId={activeStoreId} onSelect={selectStore} /></div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--app-border-subtle)] pt-4">
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--app-text-secondary)]">Date range <select value={preset} onChange={(event) => selectPreset(event.target.value as Preset)} className="h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)]"><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="month">This Month</option><option value="custom">Custom</option></select></label>
              {preset === "custom" && <UnifiedPeriodPicker dateFrom={from} dateTo={to} language={language} defaultOpen={customPickerOpen} deferQuickRanges showOutsideQuickRanges={false} onApply={applyCustomRange} />}
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--app-text-secondary)]">Compare <select value={comparisonMode} onChange={(event) => { invalidateInsights(); setComparisonMode(event.target.value as ComparisonMode); }} className="h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)]"><option value="previous">Previous Period</option><option value="none">None</option></select></label>
            </div><span className="text-xs text-[var(--app-text-tertiary)]">{comparisonMode === "previous" ? "Previous period comparison" : "Comparison disabled"} · {summary.period.from} → {summary.period.to}</span>
          </section>

          <section><SectionTitle title="Store performance" description="Real data from the selected store and Bangkok-calendar period." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><MetricCard label="Followers" value={formatNumber(summary.followers.current)} helper={summary.followers.growth === null ? "Historical follower data not available" : `${summary.followers.growth >= 0 ? "+" : ""}${summary.followers.growth.toLocaleString()} in period`} comparison={comparisonDelta(summary.followers.current, summary.comparison?.followers.current, formatNumber)} accent="var(--app-info)" /><MetricCard label="Customers" value={formatNumber(summary.customers)} helper="Unique customers with inbound activity" comparison={comparisonDelta(summary.customers, summary.comparison?.customers, formatNumber)} /><MetricCard label="Replied within 24h" value={summary.response.available ? formatPercentage(summary.response.repliedWithin24Hours.percentage) : "No data available"} helper={summary.response.available ? `${summary.response.repliedWithin24Hours.count.toLocaleString()} conversations` : "Human/bot attribution incomplete"} comparison={comparisonPercentagePoints(summary.response.repliedWithin24Hours.percentage, summary.comparison?.response.repliedWithin24Hours.percentage)} accent="var(--app-success)" /><MetricCard label="Median first response" value={summary.response.available ? formatDuration(summary.response.medianFirstResponseSeconds) : "No data available"} helper="First valid human response" comparison={comparisonDelta(summary.response.medianFirstResponseSeconds, summary.comparison?.response.medianFirstResponseSeconds, formatDuration)} accent="var(--app-info)" /><MetricCard label="Sales tagged" value={formatPercentage(summary.sales.salesTaggedCustomerPercentage)} helper={`${summary.sales.salesTaggedCustomers.toLocaleString()} / ${summary.sales.totalCustomers.toLocaleString()} customers`} comparison={comparisonPercentagePoints(summary.sales.salesTaggedCustomerPercentage, summary.comparison?.sales.salesTaggedCustomerPercentage)} accent="var(--app-warning)" /><MetricCard label="Unanswered" value={summary.response.available ? formatNumber(summary.response.unanswered.count) : "No data available"} helper="Inbound conversation with no valid human response" comparison={comparisonDelta(summary.response.unanswered.count, summary.comparison?.response.unanswered.count, formatNumber)} accent="var(--app-danger)" /></div></section>

          <section className={`${surfaceClass()} p-5 sm:p-6`}><SectionTitle title="Response performance" description="SLA buckets use the same first-inbound → first-valid-human-response definition as the KPI row." /><ResponseBars summary={summary} /></section>

          <CustomerVoicePanel data={customerVoice} loading={customerVoiceLoading} selectedTopic={customerVoiceTopic} onTopicSelect={selectCustomerVoiceTopic} />

          <section className={`${surfaceClass()} p-5 sm:p-6`}><SectionTitle title="Who responded" description="Only staff identities connected to real outbound messages are included." /><ResponderTable responders={responders} />{responders.length === 0 && <p className="mt-3 text-xs text-[var(--app-text-tertiary)]">Unknown responders are retained in the conversation explorer; no attributable staff rows are available for this period.</p>}</section>

          <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><div className={`${surfaceClass()} p-5 sm:p-6`}><SectionTitle title="Sales / tag overview" description="Existing structured sales and product records only." /><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[var(--app-surface-subtle)] p-3"><div className="text-[11px] text-[var(--app-text-tertiary)]">Sales tagged conversations</div><div className="mt-1 text-xl font-bold">{summary.sales.salesTaggedConversations.toLocaleString()}</div></div><div className="rounded-xl bg-[var(--app-surface-subtle)] p-3"><div className="text-[11px] text-[var(--app-text-tertiary)]">Missing sales information</div><div className="mt-1 text-xl font-bold">{summary.sales.missingSalesInformation.toLocaleString()}</div></div><div className="rounded-xl bg-[var(--app-surface-subtle)] p-3"><div className="text-[11px] text-[var(--app-text-tertiary)]">Payment tags</div><div className="mt-1 text-xl font-bold">{summary.sales.paymentMethods.reduce((sum, item) => sum + item.count, 0).toLocaleString()}</div></div></div><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 className="mb-2 text-xs font-semibold">Product / model tags</h3>{summary.sales.productModels.length ? <ul className="space-y-2">{summary.sales.productModels.slice(0, 8).map((item) => <li key={item.name} className="flex justify-between gap-3 text-xs"><span className="truncate text-[var(--app-text-secondary)]">{item.name}</span><span className="font-semibold tabular-nums">{item.count.toLocaleString()}</span></li>)}</ul> : <p className="text-xs text-[var(--app-text-tertiary)]">No data available</p>}</div><div><h3 className="mb-2 text-xs font-semibold">Payment-method tags</h3>{summary.sales.paymentMethods.length ? <ul className="space-y-2">{summary.sales.paymentMethods.map((item) => <li key={item.name} className="flex justify-between gap-3 text-xs"><span className="text-[var(--app-text-secondary)]">{item.name.replaceAll("_", " ")}</span><span className="font-semibold tabular-nums">{item.count.toLocaleString()}</span></li>)}</ul> : <p className="text-xs text-[var(--app-text-tertiary)]">No data available</p>}</div></div></div><div className={`${surfaceClass()} p-5 sm:p-6`}><SectionTitle title="Data limitations" description="Visible provenance boundaries for this period." />{summary.limitations.length ? <ul className="space-y-3">{summary.limitations.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-[var(--app-text-secondary)]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-warning)]" />{item}</li>)}</ul> : <p className="text-xs text-[var(--app-success)]">No known data limitations for the selected period.</p>}</div></section>

          <section className={`${surfaceClass()} overflow-hidden`}><div className="p-5 pb-3 sm:p-6 sm:pb-3"><SectionTitle title="Conversation explorer" description="Select a row to open the existing Store Chats detail flow." /><div className="flex flex-wrap gap-2"><select value={responseFilter} onChange={(event) => setResponseFilter(event.target.value as ResponseFilter)} className="h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 text-xs"><option value="ALL">All response statuses</option><option value="REPLIED">Replied</option><option value="UNANSWERED">Unanswered</option></select><select value={responderFilter} onChange={(event) => setResponderFilter(event.target.value)} className="h-9 max-w-[220px] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 text-xs"><option value="ALL">All responders</option>{responders.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select><select value={salesFilter} onChange={(event) => setSalesFilter(event.target.value as SalesFilter)} className="h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 text-xs"><option value="ALL">All sales tags</option><option value="TAGGED">Sales tagged</option><option value="UNTAGGED">Not sales tagged</option></select>{customerVoiceTopic && <button type="button" onClick={() => selectCustomerVoiceTopic(customerVoiceTopic)} className="rounded-lg border border-[var(--app-accent)] bg-[var(--app-accent-soft)] px-2.5 text-xs font-semibold text-[var(--app-accent)]">Topic: {customerVoiceTopic} ×</button>}<span className="self-center text-xs text-[var(--app-text-tertiary)]">{conversationLoading ? "Loading…" : `${conversationTotal.toLocaleString()} conversations`}</span></div></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead><tr className="border-y border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[10px] uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]"><th className="px-5 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Topic</th><th className="px-4 py-3 font-semibold">Response status</th><th className="px-4 py-3 font-semibold">Responder</th><th className="px-4 py-3 font-semibold">First response</th><th className="px-4 py-3 font-semibold">Sales / product</th><th className="px-4 py-3 font-semibold">Last activity</th></tr></thead><tbody>{visibleConversations.length === 0 ? <tr><td colSpan={7} className="px-5 py-10 text-center text-[var(--app-text-tertiary)]">No data available</td></tr> : visibleConversations.map((item) => <tr key={item.id} onClick={() => router.push(`/chats?storeId=${encodeURIComponent(activeStoreId)}&conversationId=${encodeURIComponent(item.id)}`)} className="cursor-pointer border-b border-[var(--app-border-subtle)] transition-colors last:border-0 hover:bg-[var(--app-surface-hover)]"><td className="px-5 py-3 font-semibold text-[var(--app-text-primary)]">{item.customer.displayName}</td><td className="max-w-[180px] truncate px-4 py-3 text-[var(--app-text-tertiary)]" title={item.topic ?? "No persisted topic"}>{item.topic ?? "No data available"}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.responseStatus === "REPLIED" ? "bg-[var(--app-success-soft)] text-[var(--app-success)]" : "bg-[var(--app-warning-soft)] text-[var(--app-warning)]"}`}>{item.responseStatus === "REPLIED" ? "Replied" : "Unanswered"}</span></td><td className="px-4 py-3">{item.responder?.displayName ?? "Unknown"}</td><td className="px-4 py-3 tabular-nums">{formatDuration(item.firstResponseSeconds)}</td><td className="max-w-[180px] truncate px-4 py-3">{item.salesProduct ?? (item.salesTagged ? "Tagged" : "Not tagged")}</td><td className="px-4 py-3 whitespace-nowrap text-[var(--app-text-secondary)]">{formatDateTime(item.lastActivity)}</td></tr>)}</tbody></table></div><div className="flex items-center justify-between gap-3 px-5 py-3 text-[11px] text-[var(--app-text-tertiary)]"><span>Showing {visibleConversations.length.toLocaleString()} of {conversationTotal.toLocaleString()}</span><Link href={`/chats?storeId=${encodeURIComponent(activeStoreId)}`} className="font-semibold text-[var(--app-accent)] hover:underline">Open Store Chats →</Link></div></section>
        </> : <div className={`${surfaceClass()} p-8 text-center text-sm text-[var(--app-text-secondary)]`}>No data available</div>}
      </PageContainer>
    </AppShell>
  );
}
