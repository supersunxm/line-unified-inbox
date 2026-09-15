"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageContainer } from "@/components/shell";
import { api, isAbortError } from "@/lib/api";
import type { AuthUser } from "@/lib/authorization";
import type {
  ApiStore,
  StoreInsightsResponseCase,
  StoreInsightsResponseCasesResponse,
  StoreInsightsResponseSegment,
  StoreInsightsResponseSort,
} from "@/types/api";
import { resolveAuthorizedStoreId, withStore360Timeout } from "../store-360-bootstrap";
import { useAppLanguage } from "../../language";
import { RESPONSE_SEGMENTS, RESPONSE_SEGMENT_LABELS, responseDrilldownHref, responseSegmentLabel } from "../response-utils";

const TIMEZONE = "Asia/Bangkok";
const PAGE_SIZE = 25;

function todayInBangkok() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function shiftDate(value: string, days: number) {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function validSegment(value: string | null): value is StoreInsightsResponseSegment {
  return value !== null && RESPONSE_SEGMENTS.includes(value as StoreInsightsResponseSegment);
}

function validSort(value: string | null): value is StoreInsightsResponseSort {
  return value === "date-desc" || value === "date-asc" || value === "response-time-desc" || value === "response-time-asc";
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function formatPercentage(value: number | null) {
  return value === null ? "No data available" : Math.round(value * 100) + "%";
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "Unanswered";
  if (seconds < 60) return Math.round(seconds) + "s";
  if (seconds < 3600) return Math.round(seconds / 60) + "m";
  return (seconds / 3600).toFixed(1) + "h";
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function surfaceClass(extra = "") {
  return "rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)] " + extra;
}

function bandClass(band: StoreInsightsResponseCase["responseBand"]) {
  return band === "unanswered" || band === "after-24h"
    ? "bg-[var(--app-warning-soft)] text-[var(--app-warning)]"
    : "bg-[var(--app-success-soft)] text-[var(--app-success)]";
}

function EvidenceRow({ item, onOpen }: { item: StoreInsightsResponseCase; onOpen: (conversationId: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(item.id)} className="grid w-full grid-cols-[minmax(130px,1.2fr)_minmax(112px,1fr)_minmax(105px,0.8fr)_minmax(105px,0.8fr)_minmax(120px,1fr)_24px] items-center gap-3 border-b border-[var(--app-border-subtle)] px-4 py-3 text-left transition-colors last:border-0 hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-accent)]/40" aria-label={item.customer.displayName + " — open conversation"}>
      <span className="min-w-0"><span className="block truncate text-xs font-semibold text-[var(--app-text-primary)]">{item.customer.displayName}</span><span className="mt-0.5 block truncate text-[10px] text-[var(--app-text-tertiary)]">Inbound {formatDateTime(item.firstInboundAt)}</span></span>
      <span className="min-w-0 text-[11px] text-[var(--app-text-secondary)]"><span className="block truncate">{formatDuration(item.firstResponseSeconds)}</span><span className="mt-0.5 block truncate text-[10px] text-[var(--app-text-tertiary)]">First response {formatDateTime(item.firstResponseAt)}</span></span>
      <span className={"inline-flex w-fit max-w-full truncate rounded-full px-2 py-1 text-[10px] font-semibold " + bandClass(item.responseBand)}>{responseSegmentLabel(item.responseBand)}</span>
      <span className="truncate text-[11px] text-[var(--app-text-secondary)]">{item.responder?.displayName ?? "No human reply"}</span>
      <span className="min-w-0"><span className="block truncate text-[11px] text-[var(--app-text-secondary)]">{item.topic || item.salesProduct || "No topic recorded"}</span><span className="mt-0.5 block text-[10px] text-[var(--app-text-tertiary)]">{item.salesTagged ? "Sales tagged" : "Not sales tagged"} · Last {formatDateTime(item.lastActivity)}</span></span>
      <span aria-hidden="true" className="text-sm text-[var(--app-accent)]">→</span>
    </button>
  );
}

function EvidenceCard({ item, onOpen }: { item: StoreInsightsResponseCase; onOpen: (conversationId: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(item.id)} className="block w-full border-b border-[var(--app-border-subtle)] p-4 text-left last:border-0 hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-accent)]/40" aria-label={item.customer.displayName + " — open conversation"}>
      <span className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[var(--app-text-primary)]">{item.customer.displayName}</span><span className="mt-1 block text-[10px] text-[var(--app-text-tertiary)]">First inbound {formatDateTime(item.firstInboundAt)}</span></span><span className={"shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold " + bandClass(item.responseBand)}>{responseSegmentLabel(item.responseBand)}</span></span>
      <span className="mt-3 grid grid-cols-2 gap-3 text-[11px]"><span><span className="block text-[10px] text-[var(--app-text-tertiary)]">Response</span><span className="mt-0.5 block font-semibold text-[var(--app-text-primary)]">{formatDuration(item.firstResponseSeconds)}</span></span><span><span className="block text-[10px] text-[var(--app-text-tertiary)]">First response</span><span className="mt-0.5 block font-semibold text-[var(--app-text-primary)]">{formatDateTime(item.firstResponseAt)}</span></span><span><span className="block text-[10px] text-[var(--app-text-tertiary)]">Responder</span><span className="mt-0.5 block truncate font-semibold text-[var(--app-text-primary)]">{item.responder?.displayName ?? "No human reply"}</span></span><span><span className="block text-[10px] text-[var(--app-text-tertiary)]">Sales</span><span className="mt-0.5 block font-semibold text-[var(--app-text-primary)]">{item.salesTagged ? "Tagged" : "Not tagged"}</span></span></span>
      <span className="mt-3 flex items-center justify-between gap-3 text-[11px]"><span className="truncate text-[var(--app-text-secondary)]">{item.topic || item.salesProduct || "No topic recorded"}</span><span aria-hidden="true" className="text-[var(--app-accent)]">Open →</span></span>
    </button>
  );
}

function SummaryCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: "green" | "blue" | "amber" | "neutral" }) {
  const toneClass = tone === "green" ? "bg-[var(--app-success-soft)] text-[var(--app-success)]" : tone === "blue" ? "bg-[var(--app-info-soft)] text-[var(--app-info)]" : tone === "amber" ? "bg-[var(--app-warning-soft)] text-[var(--app-warning)]" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-primary)]";
  return <article className={surfaceClass("p-4")}><p className="text-[11px] font-semibold text-[var(--app-text-secondary)]">{label}</p><p className={"mt-2 text-2xl font-bold tracking-[-0.04em] " + toneClass.split(" ")[1]}>{value}</p><p className="mt-1 text-[10px] leading-4 text-[var(--app-text-tertiary)]">{helper}</p></article>;
}

function ResponseEvidenceSearch({ initialValue, onSubmit }: { initialValue: string; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  return <form className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto" onSubmit={(event) => { event.preventDefault(); onSubmit(value.trim()); }}><label className="sr-only" htmlFor="response-evidence-search">Search response evidence</label><input id="response-evidence-search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search customers, topics, responders…" className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--input-background)] px-3 text-xs text-[var(--app-text-primary)] outline-none placeholder:text-[var(--app-text-tertiary)] focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent)]/20 sm:w-64" /><button type="submit" className="h-9 rounded-lg bg-[var(--app-accent)] px-3 text-xs font-semibold text-white hover:bg-[var(--app-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40">Search</button></form>;
}

function ResponseDistribution({ data }: { data: StoreInsightsResponseCasesResponse }) {
  const metrics = [["Within 15 minutes", data.summary.repliedWithin15Minutes], ["Within 1 hour", data.summary.repliedWithin1Hour], ["Within 24 hours", data.summary.repliedWithin24Hours], ["After 24 hours", data.summary.after24Hours], ["Unanswered", data.summary.unanswered]] as const;
  return <section className={surfaceClass("p-5 sm:p-6")} aria-labelledby="response-distribution-title"><div className="flex items-start justify-between gap-3"><div><h2 id="response-distribution-title" className="text-base font-bold tracking-[-0.02em] text-[var(--app-text-primary)]">Response distribution</h2><p className="mt-1 text-xs text-[var(--app-text-tertiary)]">Cumulative thresholds are preserved in the canonical Store 360 definitions.</p></div><span className="rounded-full bg-[var(--app-surface-subtle)] px-2.5 py-1 text-[10px] font-semibold text-[var(--app-text-secondary)]">{formatNumber(data.summary.totalCases)} cases</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{metrics.map(([label, metric]) => { const width = metric.percentage === null ? 0 : Math.max(metric.count > 0 ? 4 : 0, metric.percentage * 100); const warning = label === "After 24 hours" || label === "Unanswered"; return <div key={label} className="rounded-xl bg-[var(--app-surface-subtle)] p-3"><div className="flex items-center justify-between gap-2 text-[10px]"><span className="truncate text-[var(--app-text-secondary)]">{label}</span><span className="font-semibold tabular-nums text-[var(--app-text-primary)]">{formatNumber(metric.count)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--app-border-subtle)]"><div className={"h-full rounded-full " + (warning ? "bg-[var(--app-warning)]" : "bg-[var(--app-accent)]")} style={{ width: Math.min(100, width) + "%" }} /></div><p className="mt-1 text-[10px] text-[var(--app-text-tertiary)]">{formatPercentage(metric.percentage)}</p></div>; })}</div><p className="mt-4 text-[10px] leading-5 text-[var(--app-text-tertiary)]">Within 15 minutes ⊂ within 1 hour ⊂ within 24 hours. After 24 hours is answered later than the 24-hour threshold; Unanswered means no valid human reply in the existing look-ahead window.</p></section>;
}

export function ResponseDrilldownView() {
  const { language, setLanguage } = useAppLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStoreId = searchParams.get("storeId") ?? "";
  const defaultTo = todayInBangkok();
  const from = searchParams.get("from") ?? shiftDate(defaultTo, -29);
  const to = searchParams.get("to") ?? defaultTo;
  const segment = validSegment(searchParams.get("segment")) ? searchParams.get("segment") as StoreInsightsResponseSegment : "all";
  const search = searchParams.get("search") ?? "";
  const responderId = searchParams.get("responder") ?? "";
  const salesTagged = searchParams.get("salesTagged") === "true" ? true : searchParams.get("salesTagged") === "false" ? false : undefined;
  const sort = validSort(searchParams.get("sort")) ? searchParams.get("sort") as StoreInsightsResponseSort : "date-desc";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [activeStoreId, setActiveStoreId] = useState("");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [data, setData] = useState<StoreInsightsResponseCasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const requestId = useRef(0);
  const bootstrapRequestController = useRef<AbortController | null>(null);
  const requestController = useRef<AbortController | null>(null);

  const updateQuery = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams({ storeId: activeStoreId || requestedStoreId, from, to, segment });
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, value);
    }
    router.replace("/store-360/response?" + params.toString(), { scroll: false });
  }, [activeStoreId, from, requestedStoreId, router, segment, to]);

  useEffect(() => {
    bootstrapRequestController.current?.abort();
    const controller = new AbortController();
    let active = true;
    bootstrapRequestController.current = controller;
    void withStore360Timeout(Promise.all([api.me({ signal: controller.signal }), api.stores(false, { signal: controller.signal })])).then(([user, storeRows]) => {
      if (!active || controller.signal.aborted) return;
      const authorizedStores = storeRows ?? [];
      const resolvedStoreId = resolveAuthorizedStoreId(requestedStoreId, authorizedStores);
      setAuthUser(user as AuthUser);
      setStores(authorizedStores);
      setActiveStoreId(resolvedStoreId);
      setBootstrapped(true);
      if (resolvedStoreId !== requestedStoreId) {
        const params = new URLSearchParams({ storeId: resolvedStoreId, from, to, segment });
        if (search) params.set("search", search);
        if (responderId) params.set("responder", responderId);
        if (salesTagged !== undefined) params.set("salesTagged", String(salesTagged));
        if (sort !== "date-desc") params.set("sort", sort);
        if (page > 1) params.set("page", String(page));
        router.replace("/store-360/response?" + params.toString(), { scroll: false });
      }
    }).catch((reason: unknown) => {
      if (active && !controller.signal.aborted && !isAbortError(reason)) setBootstrapError(reason instanceof Error ? reason.message : "Unable to load authorized stores");
    });
    return () => {
      active = false;
      controller.abort();
      if (bootstrapRequestController.current === controller) bootstrapRequestController.current = null;
    };
  }, [from, page, requestedStoreId, responderId, router, salesTagged, search, segment, sort, to]);

  const loadCases = useCallback(async () => {
    if (!bootstrapped || !activeStoreId) { if (bootstrapped) setLoading(false); return; }
    requestController.current?.abort();
    const controller = new AbortController();
    const currentRequest = ++requestId.current;
    requestController.current = controller;
    setLoading(true);
    setError(null);
    try {
      const value = await api.storeInsightsResponseCases(activeStoreId, { from, to, segment, search: search || undefined, responderId: responderId || undefined, salesTagged, sort, page, pageSize: PAGE_SIZE }, { signal: controller.signal });
      if (!controller.signal.aborted && currentRequest === requestId.current) setData(value);
    } catch (reason) {
      if (!controller.signal.aborted && !isAbortError(reason) && currentRequest === requestId.current) setError(reason instanceof Error ? reason.message : "Unable to load response evidence");
    } finally {
      if (requestController.current === controller) requestController.current = null;
      if (!controller.signal.aborted && currentRequest === requestId.current) setLoading(false);
    }
  }, [activeStoreId, bootstrapped, from, page, responderId, salesTagged, search, segment, sort, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCases(); }, 0);
    return () => {
      window.clearTimeout(timer);
      requestController.current?.abort();
    };
  }, [loadCases]);

  const store = data?.store ?? stores.find((item) => item.id === activeStoreId) ?? null;
  const overviewHref = responseDrilldownHref(activeStoreId || requestedStoreId, from, to, "all").replace("/store-360/response", "/store-360");
  const openConversation = (conversationId: string) => router.push("/chats?storeId=" + encodeURIComponent(activeStoreId) + "&conversationId=" + encodeURIComponent(conversationId));
  const retry = () => { setError(null); void loadCases(); };
  const noAuthorizedStores = bootstrapped && stores.length === 0;
  const currentSummary = data?.summary;
  const segmentOptions = useMemo(() => RESPONSE_SEGMENTS.map((value) => ({ value, label: RESPONSE_SEGMENT_LABELS[value] })), []);

  if (bootstrapError) return <main className="store360-workspace flex min-h-screen items-center justify-center bg-[var(--app-bg)] p-6"><div className={surfaceClass("max-w-md p-6 text-center")}><h1 className="text-base font-semibold text-[var(--app-text-primary)]">Unable to open Response Analysis</h1><p className="mt-2 text-sm text-[var(--app-text-secondary)]">{bootstrapError}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white">Try again</button></div></main>;
  if (!authUser || !bootstrapped) return <main className="store360-workspace flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">Opening Response Analysis…</main>;

  return <AppShell currentSection="store-360" authUser={authUser} text={{ appName: "OPPO LINE OA Monitor", searchPlaceholder: "Search customers, stores, or messages" }} language={language} changeLanguage={setLanguage} searchText={search} setSearchText={() => undefined} logout={async () => { await api.logout().catch(() => undefined); router.replace("/login"); }} showGlobalHeader={false} isLoading={loading && !data} apiError={null}>
    <PageContainer variant="wide" className="store360-workspace min-w-0 bg-[var(--app-bg)]"><div className="space-y-5">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><Link href={overviewHref} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--app-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40">← Store 360</Link><p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)]">Response Analysis</p><h1 className="mt-1 text-[30px] font-bold leading-tight tracking-[-0.045em] text-[var(--app-text-primary)]">Response Performance</h1><p className="mt-1 text-sm text-[var(--app-text-secondary)]">Evidence behind the selected Store 360 response segment.</p></div><div className="text-left xl:text-right"><p className="text-sm font-semibold text-[var(--app-text-primary)]">{store?.name ?? "Store context"}</p><p className="mt-1 text-xs text-[var(--app-text-tertiary)]">{store?.externalStoreId || store?.code ? "Store ID: " + (store.externalStoreId || store.code) : "Authorized store"}</p><p className="mt-1 text-xs text-[var(--app-text-tertiary)]">{from} → {to} · {language === "th" ? "เวลา Bangkok" : "Bangkok time"}</p></div></header>
      {noAuthorizedStores ? <div className={surfaceClass("p-8 text-center text-sm text-[var(--app-text-secondary)]")}>No authorized stores available.</div> : error && !data ? <div role="alert" className={surfaceClass("border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] p-5")}><p className="text-sm font-semibold text-[var(--app-danger)]">Response evidence is temporarily unavailable.</p><p className="mt-1 text-xs text-[var(--app-text-secondary)]">{error}</p><button type="button" onClick={retry} className="mt-4 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-xs font-semibold text-white">Retry</button></div> : currentSummary ? <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Eligible response cases" value={formatNumber(currentSummary.totalCases)} helper="One case per conversation with eligible inbound activity" tone="neutral" /><SummaryCard label="Reply within 24h" value={formatNumber(currentSummary.repliedWithin24Hours.count)} helper={formatPercentage(currentSummary.repliedWithin24Hours.percentage) + " of eligible cases"} tone="green" /><SummaryCard label="Median first response" value={formatDuration(currentSummary.medianFirstResponseSeconds)} helper="First valid human response" tone="blue" /><SummaryCard label="Unanswered" value={formatNumber(currentSummary.unanswered.count)} helper="No valid human response in look-ahead window" tone="amber" /></section><ResponseDistribution data={data} /><section className={surfaceClass("p-4 sm:p-5")} aria-labelledby="response-evidence-title"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><h2 id="response-evidence-title" className="text-base font-bold tracking-[-0.02em] text-[var(--app-text-primary)]">Conversation evidence</h2><p className="mt-1 text-xs text-[var(--app-text-tertiary)]">{formatNumber(data.total)} cases match {responseSegmentLabel(segment).toLocaleLowerCase()}. Select a row to open the existing conversation experience.</p></div><ResponseEvidenceSearch key={search} initialValue={search} onSubmit={(value) => updateQuery({ search: value, page: undefined })} /></div><div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Response segment filter">{segmentOptions.map((option) => <Link key={option.value} href={responseDrilldownHref(activeStoreId, from, to, option.value)} aria-current={segment === option.value ? "page" : undefined} className={"rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40 " + (segment === option.value ? "bg-[var(--app-accent)] text-white" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]")}>{option.label}</Link>)}<select aria-label="Responder filter" value={responderId} onChange={(event) => updateQuery({ responder: event.target.value, page: undefined })} className="h-8 max-w-[180px] rounded-lg border border-[var(--app-border)] bg-[var(--input-background)] px-2 text-[11px] text-[var(--app-text-primary)]"><option value="">All responders</option>{data.responders.map((responder) => <option key={responder.id} value={responder.id}>{responder.displayName}</option>)}</select><select aria-label="Sales tag filter" value={salesTagged === undefined ? "" : String(salesTagged)} onChange={(event) => updateQuery({ salesTagged: event.target.value || undefined, page: undefined })} className="h-8 rounded-lg border border-[var(--app-border)] bg-[var(--input-background)] px-2 text-[11px] text-[var(--app-text-primary)]"><option value="">All sales</option><option value="true">Sales tagged</option><option value="false">Not sales tagged</option></select><select aria-label="Response evidence sort" value={sort} onChange={(event) => updateQuery({ sort: event.target.value, page: undefined })} className="h-8 rounded-lg border border-[var(--app-border)] bg-[var(--input-background)] px-2 text-[11px] text-[var(--app-text-primary)]"><option value="date-desc">Newest inbound</option><option value="date-asc">Oldest inbound</option><option value="response-time-desc">Longest response</option><option value="response-time-asc">Shortest response</option></select></div><div className="mt-4 overflow-hidden rounded-xl border border-[var(--app-border-subtle)]"><div className="hidden md:block">{loading ? <div className="space-y-3 p-4">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-[var(--app-surface-subtle)]" />)}</div> : data.items.length === 0 ? <div className="p-8 text-center text-xs text-[var(--app-text-tertiary)]">No response cases match these filters.</div> : data.items.map((item) => <EvidenceRow key={item.id} item={item} onOpen={openConversation} />)}</div><div className="md:hidden">{loading ? <div className="space-y-3 p-4">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-lg bg-[var(--app-surface-subtle)]" />)}</div> : data.items.length === 0 ? <div className="p-8 text-center text-xs text-[var(--app-text-tertiary)]">No response cases match these filters.</div> : data.items.map((item) => <EvidenceCard key={item.id} item={item} onOpen={openConversation} />)}</div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-[11px] text-[var(--app-text-tertiary)]">Page {data.page} · {formatNumber(data.total)} total matching cases</span><div className="flex items-center gap-2"><button type="button" disabled={data.page <= 1 || loading} onClick={() => updateQuery({ page: String(data.page - 1) })} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-text-secondary)] disabled:cursor-not-allowed disabled:opacity-40">Previous</button><button type="button" disabled={!data.hasNextPage || loading} onClick={() => updateQuery({ page: String(data.page + 1) })} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-text-secondary)] disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></div>{error && <p role="alert" className="mt-3 text-xs text-[var(--app-danger)]">{error}</p>}</section></> : <div className={surfaceClass("p-8 text-center text-sm text-[var(--app-text-secondary)]")}>No response data available for this period.</div>}
    </div></PageContainer>
  </AppShell>;
}
