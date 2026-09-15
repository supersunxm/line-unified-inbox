"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell, PageContainer } from "@/components/shell";
import { api, isAbortError } from "@/lib/api";
import type { AuthUser } from "@/lib/authorization";
import type {
  ApiStore,
  StoreInsightsCustomerVoiceDimension,
  StoreInsightsCustomerVoiceDrilldownResponse,
  StoreInsightsCustomerVoiceEvidence,
} from "@/types/api";
import { useAppLanguage } from "../../language";
import {
  resolveAuthorizedStoreId,
  withStore360Timeout,
} from "../store-360-bootstrap";
import {
  CUSTOMER_VOICE_DIMENSIONS,
  customerVoiceDrilldownHref,
} from "../customer-voice-utils";

const TIMEZONE = "Asia/Bangkok";
const PAGE_SIZE = 25;

function todayInBangkok() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDate(value: string, days: number) {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function validDimension(
  value: string | null,
): value is StoreInsightsCustomerVoiceDimension {
  return (
    value !== null &&
    CUSTOMER_VOICE_DIMENSIONS.some((item) => item.value === value)
  );
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function formatPercentage(value: number | null) {
  return value === null ? "No data available" : Math.round(value * 100) + "%";
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function surfaceClass(extra = "") {
  return (
    "rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)] " +
    extra
  );
}

function statusClass(
  status: StoreInsightsCustomerVoiceEvidence["responseStatus"],
) {
  return status === "REPLIED"
    ? "bg-[var(--app-success-soft)] text-[var(--app-success)]"
    : "bg-[var(--app-warning-soft)] text-[var(--app-warning)]";
}

function SummaryCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "green" | "blue" | "amber" | "neutral";
}) {
  const toneClass =
    tone === "green"
      ? "text-[var(--app-success)]"
      : tone === "blue"
        ? "text-[var(--app-info)]"
        : tone === "amber"
          ? "text-[var(--app-warning)]"
          : "text-[var(--app-text-primary)]";
  return (
    <article className={surfaceClass("p-4")}>
      <p className="text-[11px] font-semibold text-[var(--app-text-secondary)]">
        {label}
      </p>
      <p className={"mt-2 text-2xl font-bold tracking-[-0.04em] " + toneClass}>
        {value}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-[var(--app-text-tertiary)]">
        {helper}
      </p>
    </article>
  );
}

function EvidenceRow({
  item,
  onOpen,
}: {
  item: StoreInsightsCustomerVoiceEvidence;
  onOpen: (id: string) => void;
}) {
  const topics = item.topics.join(", ") || "Unclassified";
  const products = item.products.join(", ") || "—";
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="grid w-full grid-cols-[minmax(130px,1fr)_minmax(150px,1.2fr)_minmax(100px,0.8fr)_minmax(95px,0.7fr)_minmax(120px,1fr)_24px] items-center gap-3 border-b border-[var(--app-border-subtle)] px-4 py-3 text-left transition-colors last:border-0 hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-accent)]/40"
      aria-label={item.customer.displayName + " — open conversation"}
    >
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-[var(--app-text-primary)]">
          {item.customer.displayName}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-[var(--app-text-tertiary)]">
          Inbound {formatDateTime(item.firstInboundAt)}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] text-[var(--app-text-secondary)]">
          {topics}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-[var(--app-text-tertiary)]">
          Intent: {item.intent || "—"}
        </span>
      </span>
      <span className="min-w-0 truncate text-[11px] text-[var(--app-text-secondary)]">
        {products}
      </span>
      <span
        className={
          "inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-semibold " +
          statusClass(item.responseStatus)
        }
      >
        {item.responseStatus === "REPLIED" ? "Replied" : "Unanswered"}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] text-[var(--app-text-secondary)]">
          {item.salesTagged ? "Sales tagged" : "Not sales tagged"}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-[var(--app-text-tertiary)]">
          {item.source ?? "Not analyzed"} · {formatDateTime(item.lastActivity)}
        </span>
      </span>
      <span aria-hidden="true" className="text-sm text-[var(--app-accent)]">
        →
      </span>
    </button>
  );
}

function EvidenceCard({
  item,
  onOpen,
}: {
  item: StoreInsightsCustomerVoiceEvidence;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="w-full border-b border-[var(--app-border-subtle)] p-4 text-left last:border-0 hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-accent)]/40"
      aria-label={item.customer.displayName + " — open conversation"}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-[var(--app-text-primary)]">
            {item.customer.displayName}
          </span>
          <span className="mt-1 block text-[10px] text-[var(--app-text-tertiary)]">
            Inbound {formatDateTime(item.firstInboundAt)}
          </span>
        </span>
        <span
          className={
            "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold " +
            statusClass(item.responseStatus)
          }
        >
          {item.responseStatus === "REPLIED" ? "Replied" : "Unanswered"}
        </span>
      </span>
      <span className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
        <span>
          <span className="block text-[10px] text-[var(--app-text-tertiary)]">
            Topics
          </span>
          <span className="mt-0.5 block truncate font-semibold text-[var(--app-text-primary)]">
            {item.topics.join(", ") || "Unclassified"}
          </span>
        </span>
        <span>
          <span className="block text-[10px] text-[var(--app-text-tertiary)]">
            Intent
          </span>
          <span className="mt-0.5 block truncate font-semibold text-[var(--app-text-primary)]">
            {item.intent || "—"}
          </span>
        </span>
        <span>
          <span className="block text-[10px] text-[var(--app-text-tertiary)]">
            Product interest
          </span>
          <span className="mt-0.5 block truncate font-semibold text-[var(--app-text-primary)]">
            {item.products.join(", ") || "—"}
          </span>
        </span>
        <span>
          <span className="block text-[10px] text-[var(--app-text-tertiary)]">
            Provenance
          </span>
          <span className="mt-0.5 block truncate font-semibold text-[var(--app-text-primary)]">
            {item.source ?? "Not analyzed"}
          </span>
        </span>
      </span>
      <span className="mt-3 flex items-center justify-between gap-3 text-[11px]">
        <span className="text-[var(--app-text-secondary)]">
          {item.salesTagged ? "Sales tagged" : "Not sales tagged"} · Last{" "}
          {formatDateTime(item.lastActivity)}
        </span>
        <span aria-hidden="true" className="text-[var(--app-accent)]">
          Open →
        </span>
      </span>
    </button>
  );
}

function SearchForm({
  initialValue,
  onSubmit,
}: {
  initialValue: string;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <form
      className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value.trim());
      }}
    >
      <label className="sr-only" htmlFor="customer-voice-evidence-search">
        Search Customer Voice evidence
      </label>
      <input
        id="customer-voice-evidence-search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search customers, topics, products…"
        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--input-background)] px-3 text-xs text-[var(--app-text-primary)] outline-none placeholder:text-[var(--app-text-tertiary)] focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent)]/20 sm:w-64"
      />
      <button
        type="submit"
        className="h-9 rounded-lg bg-[var(--app-accent)] px-3 text-xs font-semibold text-white hover:bg-[var(--app-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40"
      >
        Search
      </button>
    </form>
  );
}

function buildQueryHref(
  state: {
    storeId: string;
    from: string;
    to: string;
    dimension: StoreInsightsCustomerVoiceDimension;
    value: string;
    search: string;
    salesTagged?: boolean;
    responseStatus: string;
    sort: string;
    unclassified: boolean;
    notAnalyzed: boolean;
    page: number;
  },
  updates: Record<string, string | undefined>,
) {
  const params = new URLSearchParams({
    storeId: state.storeId,
    from: state.from,
    to: state.to,
    dimension: state.dimension,
  });
  const values: Record<string, string | undefined> = {
    value: state.value || undefined,
    search: state.search || undefined,
    salesTagged:
      state.salesTagged === undefined ? undefined : String(state.salesTagged),
    responseStatus: state.responseStatus || undefined,
    sort: state.sort === "date-desc" ? undefined : state.sort,
    unclassified: state.unclassified ? "true" : undefined,
    notAnalyzed: state.notAnalyzed ? "true" : undefined,
    page: state.page > 1 ? String(state.page) : undefined,
    ...updates,
  };
  for (const [key, value] of Object.entries(values))
    if (value) params.set(key, value);
    else params.delete(key);
  return "/store-360/customer-voice?" + params.toString();
}

export function CustomerVoiceDrilldownView() {
  const { language, setLanguage } = useAppLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStoreId = searchParams.get("storeId") ?? "";
  const defaultTo = todayInBangkok();
  const from = searchParams.get("from") ?? shiftDate(defaultTo, -29);
  const to = searchParams.get("to") ?? defaultTo;
  const dimension = validDimension(searchParams.get("dimension"))
    ? (searchParams.get("dimension") as StoreInsightsCustomerVoiceDimension)
    : "topic";
  const value = searchParams.get("value") ?? "";
  const search = searchParams.get("search") ?? "";
  const salesTagged =
    searchParams.get("salesTagged") === "true"
      ? true
      : searchParams.get("salesTagged") === "false"
        ? false
        : undefined;
  const responseStatus =
    searchParams.get("responseStatus") === "REPLIED" ||
    searchParams.get("responseStatus") === "UNANSWERED"
      ? searchParams.get("responseStatus")!
      : "";
  const sort =
    searchParams.get("sort") === "date-asc" ? "date-asc" : "date-desc";
  const unclassified = searchParams.get("unclassified") === "true";
  const notAnalyzed = searchParams.get("notAnalyzed") === "true";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [activeStoreId, setActiveStoreId] = useState("");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [data, setData] =
    useState<StoreInsightsCustomerVoiceDrilldownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestId = useRef(0);
  const bootstrapRequestController = useRef<AbortController | null>(null);
  const requestController = useRef<AbortController | null>(null);

  const queryState = {
    storeId: activeStoreId || requestedStoreId,
    from,
    to,
    dimension,
    value,
    search,
    salesTagged,
    responseStatus,
    sort,
    unclassified,
    notAnalyzed,
    page,
  };
  const updateQuery = (updates: Record<string, string | undefined>) => {
    const href = buildQueryHref(
      {
        storeId: activeStoreId || requestedStoreId,
        from,
        to,
        dimension,
        value,
        search,
        salesTagged,
        responseStatus,
        sort,
        unclassified,
        notAnalyzed,
        page,
      },
      updates,
    );
    window.location.assign(href);
  };

  useEffect(() => {
    bootstrapRequestController.current?.abort();
    const controller = new AbortController();
    bootstrapRequestController.current = controller;
    let active = true;
    void withStore360Timeout(Promise.all([api.me({ signal: controller.signal }), api.stores(false, { signal: controller.signal })]))
      .then(([user, storeRows]) => {
        if (!active || controller.signal.aborted) return;
        const authorizedStores = storeRows ?? [];
        const resolvedStoreId = resolveAuthorizedStoreId(
          requestedStoreId,
          authorizedStores,
        );
        setAuthUser(user as AuthUser);
        setStores(authorizedStores);
        setActiveStoreId(resolvedStoreId);
        setBootstrapped(true);
        if (resolvedStoreId !== requestedStoreId)
          router.replace(
            buildQueryHref(
              {
                storeId: resolvedStoreId,
                from,
                to,
                dimension,
                value,
                search,
                salesTagged,
                responseStatus,
                sort,
                unclassified,
                notAnalyzed,
                page,
              },
              {},
            ),
            { scroll: false },
          );
      })
      .catch((reason: unknown) => {
        if (active && !controller.signal.aborted && !isAbortError(reason))
          setBootstrapError(
            reason instanceof Error
              ? reason.message
              : "Unable to load authorized stores",
          );
      });
    return () => {
      active = false;
      controller.abort();
      if (bootstrapRequestController.current === controller) bootstrapRequestController.current = null;
    };
  }, [
    dimension,
    from,
    notAnalyzed,
    page,
    requestedStoreId,
    responseStatus,
    router,
    salesTagged,
    search,
    sort,
    to,
    unclassified,
    value,
  ]);

  useEffect(() => {
    if (!bootstrapped || !activeStoreId) return;
    requestController.current?.abort();
    const controller = new AbortController();
    const currentRequest = ++requestId.current;
    requestController.current = controller;
    let active = true;
    void api
      .storeInsightsCustomerVoiceDrilldown(activeStoreId, {
        from,
        to,
        dimension,
        value: value || undefined,
        search: search || undefined,
        responseStatus: responseStatus as "REPLIED" | "UNANSWERED" | undefined,
        salesTagged,
        sort,
        unclassified: unclassified || undefined,
        notAnalyzed: notAnalyzed || undefined,
        page,
        pageSize: PAGE_SIZE,
      }, { signal: controller.signal })
      .then((result) => {
        if (active && !controller.signal.aborted && currentRequest === requestId.current) setData(result);
      })
      .catch((reason: unknown) => {
        if (active && !controller.signal.aborted && !isAbortError(reason) && currentRequest === requestId.current)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load Customer Voice evidence",
          );
      })
      .finally(() => {
        if (requestController.current === controller) requestController.current = null;
        if (active && !controller.signal.aborted && currentRequest === requestId.current) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    activeStoreId,
    bootstrapped,
    dimension,
    from,
    notAnalyzed,
    page,
    responseStatus,
    retryNonce,
    salesTagged,
    search,
    sort,
    to,
    unclassified,
    value,
  ]);

  const store = data?.store ?? null;
  const overviewHref = customerVoiceDrilldownHref(
    activeStoreId || requestedStoreId,
    from,
    to,
  ).replace("/store-360/customer-voice", "/store-360");
  const openConversation = (conversationId: string) =>
    router.push(
      "/chats?storeId=" +
        encodeURIComponent(activeStoreId) +
        "&conversationId=" +
        encodeURIComponent(conversationId),
    );
  const retry = () => {
    setError(null);
    setRetryNonce((current) => current + 1);
  };
  const noAuthorizedStores = bootstrapped && stores.length === 0;
  const storeIdLabel =
    store?.externalStoreId || store?.code || "Authorized store";

  if (bootstrapError)
    return (
      <main className="store360-workspace flex min-h-screen items-center justify-center bg-[var(--app-bg)] p-6">
        <div className={surfaceClass("max-w-md p-6 text-center")}>
          <h1 className="text-base font-semibold text-[var(--app-text-primary)]">
            Unable to open Customer Voice
          </h1>
          <p className="mt-2 text-sm text-[var(--app-text-secondary)]">
            {bootstrapError}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      </main>
    );
  if (!authUser || !bootstrapped)
    return (
      <main className="store360-workspace flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">
        Opening Customer Voice…
      </main>
    );

  return (
    <AppShell
      currentSection="store-360"
      authUser={authUser}
      text={{
        appName: "OPPO LINE OA Monitor",
        searchPlaceholder: "Search customers, stores, or messages",
      }}
      language={language}
      changeLanguage={setLanguage}
      searchText={search}
      setSearchText={() => undefined}
      logout={async () => {
        await api.logout().catch(() => undefined);
        router.replace("/login");
      }}
      showGlobalHeader={false}
      isLoading={loading && !data}
      apiError={null}
    >
      <PageContainer
        variant="wide"
        className="store360-workspace min-w-0 bg-[var(--app-bg)]"
      >
        <div className="space-y-5">
          <header className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <Link
                href={overviewHref}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--app-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40"
              >
                ← Store 360
              </Link>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)]">
                Customer Voice
              </p>
              <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-[-0.045em] text-[var(--app-text-primary)]">
                Customer Voice Drill-down
              </h1>
              <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
                Explore the current-version evidence behind Store 360 voice
                coverage.
              </p>
            </div>
            <div className="text-left xl:text-right">
              <p className="text-sm font-semibold text-[var(--app-text-primary)]">
                {store?.name ?? "Store context"}
              </p>
              <p className="mt-1 text-xs text-[var(--app-text-tertiary)]">
                {storeIdLabel}
              </p>
              <p className="mt-1 text-xs text-[var(--app-text-tertiary)]">
                {from} → {to} ·{" "}
                {language === "th" ? "เวลา Bangkok" : "Bangkok time"}
              </p>
            </div>
          </header>
          {noAuthorizedStores ? (
            <div
              className={surfaceClass(
                "p-8 text-center text-sm text-[var(--app-text-secondary)]",
              )}
            >
              No authorized stores available.
            </div>
          ) : error && !data ? (
            <div
              role="alert"
              className={surfaceClass(
                "border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] p-5",
              )}
            >
              <p className="text-sm font-semibold text-[var(--app-danger)]">
                Customer Voice evidence is temporarily unavailable.
              </p>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                {error}
              </p>
              <button
                type="button"
                onClick={retry}
                className="mt-4 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-xs font-semibold text-white"
              >
                Retry
              </button>
            </div>
          ) : data ? (
            <>
              <div
                role="status"
                className="rounded-xl border border-[var(--app-warning)]/20 bg-[var(--app-warning-soft)] px-4 py-3 text-xs text-[var(--app-text-secondary)]"
              >
                {data.coverage.classifiedConversations <
                data.coverage.totalConversations
                  ? "Partial current-version coverage: unclassified and not-analyzed conversations remain available for inspection."
                  : "Current-version coverage is complete for this period."}
              </div>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <SummaryCard
                  label="Eligible conversations"
                  value={formatNumber(data.coverage.totalConversations)}
                  helper="Eligible inbound activity in the selected period"
                  tone="neutral"
                />
                <SummaryCard
                  label="Analyzed current-version"
                  value={formatNumber(data.coverage.analyzedConversations)}
                  helper={
                    formatPercentage(data.coverage.analyzedPercentage) +
                    " of eligible conversations"
                  }
                  tone="blue"
                />
                <SummaryCard
                  label="Classified"
                  value={formatNumber(data.coverage.classifiedConversations)}
                  helper="Usable topic, intent, or product analysis"
                  tone="green"
                />
                <SummaryCard
                  label="Coverage"
                  value={formatPercentage(data.coverage.classifiedPercentage)}
                  helper="Classified / eligible"
                  tone="green"
                />
                <SummaryCard
                  label="Unclassified"
                  value={formatNumber(data.coverage.unclassifiedConversations)}
                  helper="Analyzed, but no usable classification"
                  tone="amber"
                />
                <SummaryCard
                  label="Not analyzed"
                  value={formatNumber(data.coverage.notAnalyzedConversations)}
                  helper="No current-version analysis row"
                  tone="neutral"
                />
              </section>
              <section
                className={surfaceClass("p-5 sm:p-6")}
                aria-labelledby="customer-voice-distribution-title"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2
                      id="customer-voice-distribution-title"
                      className="text-base font-bold tracking-[-0.02em] text-[var(--app-text-primary)]"
                    >
                      Customer Voice distribution
                    </h2>
                    <p className="mt-1 text-xs text-[var(--app-text-tertiary)]">
                      Current-version categories use eligible conversations as
                      the denominator; counts are not recomputed in the browser.
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--app-surface-subtle)] px-2.5 py-1 text-[10px] font-semibold text-[var(--app-text-secondary)]">
                    {data.analysisVersion}
                  </span>
                </div>
                <div
                  className="mt-4 flex flex-wrap gap-2"
                  role="tablist"
                  aria-label="Customer Voice dimensions"
                >
                  {CUSTOMER_VOICE_DIMENSIONS.map((item) => (
                    <Link
                      key={item.value}
                      href={buildQueryHref(queryState, {
                        dimension: item.value,
                        value: undefined,
                        unclassified: undefined,
                        notAnalyzed: undefined,
                        page: undefined,
                      })}
                      role="tab"
                      aria-selected={dimension === item.value}
                      className={
                        "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40 " +
                        (dimension === item.value
                          ? "bg-[var(--app-accent)] text-white"
                          : "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]")
                      }
                    >
                      {item.label}
                    </Link>
                  ))}
                  <Link
                    href={buildQueryHref(queryState, {
                      value: undefined,
                      unclassified: unclassified ? undefined : "true",
                      notAnalyzed: undefined,
                      page: undefined,
                    })}
                    aria-current={unclassified ? "page" : undefined}
                    className={
                      "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40 " +
                      (unclassified
                        ? "bg-[var(--app-warning)] text-white"
                        : "bg-[var(--app-warning-soft)] text-[var(--app-warning)] hover:ring-1 hover:ring-[var(--app-warning)]/40")
                    }
                  >
                    Unclassified (
                    {formatNumber(data.coverage.unclassifiedConversations)})
                  </Link>
                  <Link
                    href={buildQueryHref(queryState, {
                      value: undefined,
                      unclassified: undefined,
                      notAnalyzed: notAnalyzed ? undefined : "true",
                      page: undefined,
                    })}
                    aria-current={notAnalyzed ? "page" : undefined}
                    className={
                      "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40 " +
                      (notAnalyzed
                        ? "bg-[var(--app-warning)] text-white"
                        : "bg-[var(--app-warning-soft)] text-[var(--app-warning)] hover:ring-1 hover:ring-[var(--app-warning)]/40")
                    }
                  >
                    Not analyzed ({formatNumber(data.coverage.notAnalyzedConversations)})
                  </Link>
                </div>
                {value && (
                  <p className="mt-3 text-xs text-[var(--app-text-secondary)]">
                    Filtered to{" "}
                    <span className="font-semibold text-[var(--app-text-primary)]">
                      {value}
                    </span>{" "}
                    ·{" "}
                    <Link
                      href={buildQueryHref(queryState, {
                        value: undefined,
                        page: undefined,
                      })}
                      className="font-semibold text-[var(--app-accent)] hover:underline"
                    >
                      Clear value
                    </Link>
                  </p>
                )}
                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.distribution.length === 0 ? (
                    <p className="text-xs text-[var(--app-text-tertiary)]">
                      No classified categories are available for this period.
                    </p>
                  ) : (
                    data.distribution.map((item) => (
                      <Link
                        key={item.label}
                        href={buildQueryHref(queryState, {
                          value: item.label,
                          unclassified: undefined,
                          notAnalyzed: undefined,
                          page: undefined,
                        })}
                        className="rounded-xl bg-[var(--app-surface-subtle)] p-3 transition-colors hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40"
                      >
                        <span className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="truncate font-semibold text-[var(--app-text-primary)]">
                            {item.label}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-[var(--app-text-secondary)]">
                            {formatNumber(item.count)} ·{" "}
                            {formatPercentage(item.percentage)}
                          </span>
                        </span>
                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--app-border-subtle)]">
                          <span
                            className="block h-full rounded-full bg-[var(--app-accent)]"
                            style={{
                              width:
                                Math.max(
                                  item.count > 0 ? 5 : 0,
                                  item.percentage * 100,
                                ) + "%",
                            }}
                          />
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </section>
              <section
                className={surfaceClass("p-4 sm:p-5")}
                aria-labelledby="customer-voice-evidence-title"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <h2
                      id="customer-voice-evidence-title"
                      className="text-base font-bold tracking-[-0.02em] text-[var(--app-text-primary)]"
                    >
                      Conversation evidence
                    </h2>
                    <p className="mt-1 text-xs text-[var(--app-text-tertiary)]">
                      {formatNumber(data.total)} conversations match the current
                      filters. Select a row to open the existing conversation
                      experience.
                    </p>
                  </div>
                  <SearchForm
                    key={search}
                    initialValue={search}
                    onSubmit={(next) =>
                      updateQuery({ search: next, page: undefined })
                    }
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <select
                    aria-label="Response status filter"
                    value={responseStatus}
                    onChange={(event) =>
                      updateQuery({
                        responseStatus: event.target.value || undefined,
                        page: undefined,
                      })
                    }
                    className="h-8 rounded-lg border border-[var(--app-border)] bg-[var(--input-background)] px-2 text-[11px] text-[var(--app-text-primary)]"
                  >
                    <option value="">All response statuses</option>
                    <option value="REPLIED">Replied</option>
                    <option value="UNANSWERED">Unanswered</option>
                  </select>
                  <select
                    aria-label="Sales tag filter"
                    value={salesTagged === undefined ? "" : String(salesTagged)}
                    onChange={(event) =>
                      updateQuery({
                        salesTagged: event.target.value || undefined,
                        page: undefined,
                      })
                    }
                    className="h-8 rounded-lg border border-[var(--app-border)] bg-[var(--input-background)] px-2 text-[11px] text-[var(--app-text-primary)]"
                  >
                    <option value="">All sales</option>
                    <option value="true">Sales tagged</option>
                    <option value="false">Not sales tagged</option>
                  </select>
                  <select
                    aria-label="Customer Voice evidence sort"
                    value={sort}
                    onChange={(event) =>
                      updateQuery({ sort: event.target.value, page: undefined })
                    }
                    className="h-8 rounded-lg border border-[var(--app-border)] bg-[var(--input-background)] px-2 text-[11px] text-[var(--app-text-primary)]"
                  >
                    <option value="date-desc">Newest inbound</option>
                    <option value="date-asc">Oldest inbound</option>
                  </select>
                  {unclassified && (
                    <Link
                      href={buildQueryHref(queryState, {
                        unclassified: undefined,
                        notAnalyzed: undefined,
                        page: undefined,
                      })}
                      className="inline-flex h-8 items-center rounded-lg border border-[var(--app-warning)]/40 bg-[var(--app-warning-soft)] px-3 text-[11px] font-semibold text-[var(--app-warning)]"
                    >
                      Showing unclassified · Clear
                    </Link>
                  )}
                  {notAnalyzed && (
                    <Link
                      href={buildQueryHref(queryState, {
                        unclassified: undefined,
                        notAnalyzed: undefined,
                        page: undefined,
                      })}
                      className="inline-flex h-8 items-center rounded-lg border border-[var(--app-warning)]/40 bg-[var(--app-warning-soft)] px-3 text-[11px] font-semibold text-[var(--app-warning)]"
                    >
                      Showing not analyzed · Clear
                    </Link>
                  )}
                </div>
                <div className="mt-4 overflow-hidden rounded-xl border border-[var(--app-border-subtle)]">
                  <div className="hidden md:block">
                    {loading ? (
                      <div className="space-y-3 p-4">
                        {Array.from({ length: 5 }, (_, index) => (
                          <div
                            key={index}
                            className="h-12 animate-pulse rounded-lg bg-[var(--app-surface-subtle)]"
                          />
                        ))}
                      </div>
                    ) : data.items.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--app-text-tertiary)]">
                        No Customer Voice evidence matches these filters.
                      </div>
                    ) : (
                      data.items.map((item) => (
                        <EvidenceRow
                          key={item.id}
                          item={item}
                          onOpen={openConversation}
                        />
                      ))
                    )}
                  </div>
                  <div className="md:hidden">
                    {loading ? (
                      <div className="space-y-3 p-4">
                        {Array.from({ length: 3 }, (_, index) => (
                          <div
                            key={index}
                            className="h-40 animate-pulse rounded-lg bg-[var(--app-surface-subtle)]"
                          />
                        ))}
                      </div>
                    ) : data.items.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--app-text-tertiary)]">
                        No Customer Voice evidence matches these filters.
                      </div>
                    ) : (
                      data.items.map((item) => (
                        <EvidenceCard
                          key={item.id}
                          item={item}
                          onOpen={openConversation}
                        />
                      ))
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] text-[var(--app-text-tertiary)]">
                    Page {data.page} · {formatNumber(data.total)} total matching
                    conversations
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={data.page <= 1 || loading}
                      onClick={() =>
                        updateQuery({ page: String(data.page - 1) })
                      }
                      className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={!data.hasNextPage || loading}
                      onClick={() =>
                        updateQuery({ page: String(data.page + 1) })
                      }
                      className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
                {error && (
                  <p
                    role="alert"
                    className="mt-3 text-xs text-[var(--app-danger)]"
                  >
                    {error}
                  </p>
                )}
              </section>
            </>
          ) : (
            <div
              className={surfaceClass(
                "p-8 text-center text-sm text-[var(--app-text-secondary)]",
              )}
            >
              No Customer Voice data available for this period.
            </div>
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}
