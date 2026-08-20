"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageContainer, PageHeader, FilterBar } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  MetricCard,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableEmptyState,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { api } from "@/lib/api";
import { AUTH_UNAUTHORIZED_EVENT } from "@/lib/auth-session";
import type { ApiStore, PurchaseAnalyticsResponse } from "@/types/api";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type AudienceStatus = "PURCHASED" | "INTERESTED" | "NOT_SPECIFIED";
type PurchaseAudienceItem = {
  customerId: string;
  customerName: string;
  lineUserId: string | null;
  preferredLanguage: string | null;
  conversationId: string;
  lineOaId: string;
  lineOaName: string;
  lineOaBasicId: string | null;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  customerStatus: string | null;
  purchaseChannels: string[];
  paymentMethods: string[];
  products: Array<{
    modelId: string;
    modelName: string;
    seriesName: string;
    variantId: string | null;
    ram: string | null;
    rom: string | null;
    color: string | null;
    customProductName: string | null;
    quantity: number;
  }>;
  recordedById: string | null;
  recordedByName: string | null;
  lastPurchaseAt: string;
  lastMessageAt: string;
  canMessage: boolean;
  excludeReason: string | null;
};
type PurchaseAudienceResponse = {
  filters: { from: string | null; to: string | null; storeId: string | null };
  summary: { customers: number; messageableCustomers: number; excludedCustomers: number };
  messageabilityDefinition: string;
  audience: PurchaseAudienceItem[];
};
type PurchaseBroadcastDraftResult = {
  id: string;
  campaignRequestId: string;
  title: string | null;
  status: "DRAFT";
  recipientCount: number;
  storeCount: number;
  lineOaCount: number;
  createdAt: string;
  duplicate: boolean;
};

const number = new Intl.NumberFormat("en-US");
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

function Ranking({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-[var(--app-text-tertiary)] italic py-2">No recorded purchase information.</p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((item, index) => (
              <li key={`${item.label}-${item.count}`} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] text-[var(--app-text-tertiary)] w-4 shrink-0">
                    {index + 1}.
                  </span>
                  <span className="truncate text-[var(--app-text-primary)] font-medium">{item.label}</span>
                </div>
                <Badge size="sm" variant={index === 0 ? "accent" : "neutral"} className="shrink-0 font-tabular font-semibold">
                  {number.format(item.count)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function csvCell(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function audienceStatus(item: PurchaseAudienceItem): AudienceStatus {
  if (item.customerStatus === "PURCHASED") return "PURCHASED";
  if (item.customerStatus === "INTERESTED") return "INTERESTED";
  return "NOT_SPECIFIED";
}

function productLabel(product: PurchaseAudienceItem["products"][number]) {
  const variant = [product.ram, product.rom, product.color].filter(Boolean).join(" / ");
  const name = product.customProductName || product.modelName;
  return `${name}${variant ? ` (${variant})` : ""} x${product.quantity}`;
}

function exportAudienceCsv(items: PurchaseAudienceItem[]) {
  const headers = [
    "customer_name", "line_user_id", "conversation_id", "preferred_language", "line_oa_id", "line_oa_name", "line_oa_basic_id",
    "store_id", "store_name", "store_code", "customer_status", "products", "product_series", "variants", "colors", "total_quantity",
    "purchase_channels", "payment_methods", "last_purchase_at", "last_message_at", "recorded_by_id", "recorded_by_name", "can_message", "exclude_reason",
  ];
  const lines = items.map((item) => {
    const products = item.products.map(productLabel).join(" | ");
    const series = [...new Set(item.products.map((product) => product.seriesName).filter(Boolean))].join(" | ");
    const variants = item.products.map((product) => [product.ram, product.rom].filter(Boolean).join(" / ")).filter(Boolean).join(" | ");
    const colors = [...new Set(item.products.map((product) => product.color).filter((color): color is string => Boolean(color)))].join(" | ");
    const quantity = item.products.reduce((sum, product) => sum + product.quantity, 0);
    return [
      item.customerName, item.lineUserId, item.conversationId, item.preferredLanguage, item.lineOaId, item.lineOaName, item.lineOaBasicId,
      item.storeId, item.storeName, item.storeCode, item.customerStatus, products, series, variants, colors, quantity,
      item.purchaseChannels.join(" | "), item.paymentMethods.join(" | "), item.lastPurchaseAt, item.lastMessageAt,
      item.recordedById, item.recordedByName, item.canMessage ? "TRUE" : "FALSE", item.excludeReason,
    ].map(csvCell).join(",");
  });
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${lines.join("\r\n")}\r\n`;
}

export default function PurchaseAnalyticsPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [analytics, setAnalytics] = useState<PurchaseAnalyticsResponse | null>(null);
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [storeId, setStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<PurchaseAudienceResponse | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [onlyMessageable, setOnlyMessageable] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<AudienceStatus>>(new Set(["PURCHASED", "INTERESTED", "NOT_SPECIFIED"]));
  const [draftCreating, setDraftCreating] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [createdDraft, setCreatedDraft] = useState<PurchaseBroadcastDraftResult | null>(null);
  const [draftRequestId, setDraftRequestId] = useState<string | null>(null);

  const load = useCallback(async (viewer?: AuthUser) => {
    setLoading(true);
    setError(null);
    try {
      const [result, availableStores] = await Promise.all([
        api.purchaseAnalytics({ from: from || undefined, to: to || undefined, storeId: storeId || undefined }),
        viewer?.role === "ADMIN" ? api.stores(false) : Promise.resolve([] as ApiStore[]),
      ]);
      setAnalytics(result);
      setStores(availableStores);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load purchase intelligence.");
    } finally {
      setLoading(false);
    }
  }, [from, storeId, to]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await api.me();
        setAuthUser(user);
        await load(user);
      } catch {
        setAuthUser(null);
      } finally {
        setAuthChecked(true);
      }
    };
    void checkAuth();
    const handleUnauthorized = () => setAuthUser(null);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [load]);

  const openAudience = async () => {
    setAudienceOpen(true);
    setAudienceLoading(true);
    setAudienceError(null);
    setDraftError(null);
    setCreatedDraft(null);
    setDraftRequestId(null);
    try {
      const query = new URLSearchParams();
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      if (storeId) query.set("storeId", storeId);
      const response = await fetch(`/api-backend/admin/purchase-analytics/audience${query.size ? `?${query.toString()}` : ""}`, { credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
        throw new Error(message || `Unable to load audience (${response.status}).`);
      }
      setAudience(await response.json() as PurchaseAudienceResponse);
    } catch (err) {
      setAudienceError(err instanceof Error ? err.message : "Unable to load customer audience.");
    } finally {
      setAudienceLoading(false);
    }
  };

  const filteredAudience = useMemo(() => {
    if (!audience) return [];
    return audience.audience.filter((item) => selectedStatuses.has(audienceStatus(item)) && (!onlyMessageable || item.canMessage));
  }, [audience, onlyMessageable, selectedStatuses]);

  const resetDraftSelection = () => {
    setCreatedDraft(null);
    setDraftError(null);
    setDraftRequestId(null);
  };

  const toggleStatus = (status: AudienceStatus) => {
    setSelectedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
    resetDraftSelection();
  };

  const handleMessageableChange = (checked: boolean) => {
    setOnlyMessageable(checked);
    resetDraftSelection();
  };

  const createBroadcastDraft = async () => {
    if (
      authUser?.role !== "ADMIN" ||
      draftCreating ||
      !onlyMessageable ||
      selectedStatuses.size === 0 ||
      filteredAudience.length === 0
    ) return;

    setDraftCreating(true);
    setDraftError(null);
    setCreatedDraft(null);
    const campaignRequestId = draftRequestId ?? crypto.randomUUID();
    if (!draftRequestId) setDraftRequestId(campaignRequestId);

    try {
      const response = await fetch("/api-backend/admin/purchase-analytics/audience/broadcast-draft", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignRequestId,
          from: from || undefined,
          to: to || undefined,
          storeId: storeId || undefined,
          statuses: [...selectedStatuses].sort(),
          onlyMessageable: true,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
        throw new Error(message || `Unable to create broadcast audience (${response.status}).`);
      }
      setCreatedDraft(await response.json() as PurchaseBroadcastDraftResult);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Unable to create broadcast audience draft.");
    } finally {
      setDraftCreating(false);
    }
  };

  const downloadAudience = () => {
    if (filteredAudience.length === 0) return;
    const csv = exportAudienceCsv(filteredAudience);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const range = [from || "all", to || "all"].join("_to_");
    anchor.href = url;
    anchor.download = `purchase-audience_${range}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setAuthUser(null);
    window.location.replace("/");
  };

  if (!authChecked) return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-[var(--app-text-secondary)]">
      <LoadingState message="Loading…" />
    </main>
  );
  if (!authUser) return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-[var(--app-bg)]">
      <Card className="max-w-md p-6 text-center" role="alert">
        <h1 className="text-xl font-bold text-[var(--app-text-primary)]">Authentication required</h1>
        <p className="text-xs text-[var(--app-text-secondary)] mt-2">Please sign in to view purchase intelligence.</p>
      </Card>
    </main>
  );

  return (
    <AppShell
      currentSection="purchase-analytics"
      authUser={authUser}
      text={{ appName: "OPPO LINE OA Monitor", appDescription: "LINE OA monitoring", language: "Language", loadingData: "Loading…", retry: "Retry", apiError: "Data service error" }}
      language="en"
      changeLanguage={() => undefined}
      searchText=""
      setSearchText={() => undefined}
      logout={logout}
    >
      <PageContainer>
        <div className="mx-auto max-w-7xl space-y-6">
          <PageHeader
            tag="Operations · Purchase Intelligence"
            title="Purchase Intelligence"
            description="Verified Purchase Records and Recorded Purchase Information."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void openAudience()}
                  disabled={audienceLoading}
                >
                  Export audience
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void load(authUser)}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </div>
            }
          />

          <FilterBar>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-medium text-[var(--app-text-secondary)] flex items-center gap-1.5">
                <span>From</span>
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                />
              </label>
              <label className="text-xs font-medium text-[var(--app-text-secondary)] flex items-center gap-1.5">
                <span>To</span>
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                />
              </label>
              {authUser.role === "ADMIN" && (
                <label className="min-w-48 text-xs font-medium text-[var(--app-text-secondary)] flex items-center gap-1.5">
                  <span>Store</span>
                  <select
                    value={storeId}
                    onChange={(event) => setStoreId(event.target.value)}
                    className="h-8 flex-1 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                  >
                    <option value="">All authorized stores</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}{store.code ? ` (${store.code})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => void load(authUser)}
              >
                Apply filters
              </Button>
            </div>
          </FilterBar>

          {error && (
            <div role="alert" className="rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/40 bg-[var(--app-danger-soft)] p-4 text-xs text-[var(--app-danger)]">
              {error}
            </div>
          )}

          {loading && !analytics ? (
            <LoadingState message="Loading recorded purchase information…" />
          ) : analytics && (
            <>
              <section aria-label="Overview" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Verified Purchase Records"
                  value={number.format(Number(analytics.overview.verifiedPurchaseRecords))}
                  tone="accent"
                />
                <MetricCard
                  label="Recorded Products"
                  value={number.format(Number(analytics.overview.recordedProducts))}
                  tone="default"
                />
                <MetricCard
                  label="Stores"
                  value={number.format(Number(analytics.overview.stores))}
                  tone="default"
                />
                <MetricCard
                  label="BM Recorders"
                  value={number.format(Number(analytics.overview.recordingBms))}
                  tone="info"
                />
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.products.length === 0 ? (
                      <p className="text-xs text-[var(--app-text-tertiary)] italic py-2">No recorded purchase information.</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {analytics.products.map((item, idx) => (
                          <li key={item.productModelId} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[10px] text-[var(--app-text-tertiary)] w-4 shrink-0">{idx + 1}.</span>
                              <span className="truncate text-[var(--app-text-primary)] font-medium">
                                {item.name}
                                <span className="text-[var(--app-text-tertiary)] ml-1.5 font-normal">({item.seriesName})</span>
                              </span>
                            </div>
                            <Badge size="sm" variant={idx === 0 ? "accent" : "neutral"} className="shrink-0 font-tabular font-semibold">
                              {number.format(item.count)}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Variants</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.variants.length === 0 ? (
                      <p className="text-xs text-[var(--app-text-tertiary)] italic py-2">No recorded variants.</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {analytics.variants.map((item, idx) => (
                          <li key={item.productVariantId} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[10px] text-[var(--app-text-tertiary)] w-4 shrink-0">{idx + 1}.</span>
                              <span className="truncate text-[var(--app-text-primary)] font-medium">
                                {item.modelName} · {item.variant}{item.color ? ` · ${item.color}` : ""}
                              </span>
                            </div>
                            <Badge size="sm" variant={idx === 0 ? "accent" : "neutral"} className="shrink-0 font-tabular font-semibold">
                              {number.format(item.count)}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Ranking title="Channels" items={analytics.channels} />
                <Ranking title="Payment" items={analytics.paymentMethods} />
                <Ranking title="Colors" items={analytics.colors} />

                <Card>
                  <CardHeader>
                    <CardTitle>Store Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.stores.length === 0 ? (
                      <p className="text-xs text-[var(--app-text-tertiary)] italic py-2">No authorized store records.</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {analytics.stores.map((item, idx) => (
                          <li key={item.storeId} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[10px] text-[var(--app-text-tertiary)] w-4 shrink-0">{idx + 1}.</span>
                              <span className="truncate text-[var(--app-text-primary)] font-medium">
                                {item.storeName}{item.storeCode ? ` · ${item.storeCode}` : ""}
                              </span>
                            </div>
                            <Badge size="sm" variant={idx === 0 ? "accent" : "neutral"} className="shrink-0 font-tabular font-semibold">
                              {number.format(item.recordCount)}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-5">
                <CardHeader>
                  <CardTitle>BM Recording Activity</CardTitle>
                  <CardDescription>Activity details for recording staff members</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.recordingActivity.length === 0 ? (
                    <EmptyState title="No recording activity" description="No recorded activities found in the selected range." />
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Recorder</TableHead>
                            <TableHead align="right">Records</TableHead>
                            <TableHead>Latest recorded</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics.recordingActivity.map((item) => (
                            <TableRow key={item.userId ?? "unknown"}>
                              <TableCell className="font-medium text-[var(--app-text-primary)]">
                                {item.displayName}
                              </TableCell>
                              <TableCell align="right" className="font-mono font-medium text-[var(--app-text-primary)]">
                                {number.format(item.recordCount)}
                              </TableCell>
                              <TableCell className="text-[var(--app-text-secondary)] font-mono text-[11px]">
                                {dateTime.format(new Date(item.lastRecordedAt))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </PageContainer>

      {audienceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" role="dialog" aria-modal="true" aria-labelledby="audience-title">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-shadow-modal)] space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="audience-title" className="text-lg font-bold text-[var(--app-text-primary)]">
                  Customer Audience
                </h2>
                <p className="text-xs text-[var(--app-text-secondary)] mt-1">
                  One row per customer. Current date and store filters are applied automatically.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAudienceOpen(false)}
              >
                Close
              </Button>
            </div>

            {audienceLoading ? (
              <LoadingState message="Preparing customer audience…" />
            ) : audienceError ? (
              <div role="alert" className="rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/40 bg-[var(--app-danger-soft)] p-3 text-xs text-[var(--app-danger)]">
                {audienceError}
              </div>
            ) : audience && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard label="Customers" value={number.format(audience.summary.customers)} tone="default" />
                  <MetricCard label="Messageable" value={number.format(audience.summary.messageableCustomers)} tone="success" />
                  <MetricCard label="Excluded" value={number.format(audience.summary.excludedCustomers)} tone="warning" />
                </div>

                <fieldset className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] p-3.5 bg-[var(--app-surface-subtle)]">
                  <legend className="text-xs font-semibold text-[var(--app-text-primary)] px-1">Customer Status</legend>
                  <div className="mt-1.5 flex flex-wrap gap-4">
                    {(["PURCHASED", "INTERESTED", "NOT_SPECIFIED"] as AudienceStatus[]).map((status) => (
                      <label key={status} className="flex items-center gap-2 text-xs text-[var(--app-text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedStatuses.has(status)}
                          onChange={() => toggleStatus(status)}
                          className="h-3.5 w-3.5 rounded accent-[var(--app-accent)]"
                        />
                        <span>{status === "NOT_SPECIFIED" ? "Not specified" : status.charAt(0) + status.slice(1).toLowerCase()}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="flex items-start gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] p-3.5 bg-[var(--app-surface-subtle)] cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded accent-[var(--app-accent)]"
                    checked={onlyMessageable}
                    onChange={(event) => handleMessageableChange(event.target.checked)}
                  />
                  <span>
                    <span className="block text-xs font-semibold text-[var(--app-text-primary)]">Only messageable users</span>
                    <span className="mt-0.5 block text-[11px] text-[var(--app-text-secondary)] leading-relaxed">
                      Requires a LINE User ID and an active LINE OA in READY/CONNECTED state. This is operational eligibility, not a guarantee that the customer has not blocked the OA.
                    </span>
                  </span>
                </label>

                <div className="rounded-[var(--app-radius-md)] bg-[var(--app-accent-soft)]/20 border border-[var(--app-accent)]/30 p-3 text-xs text-[var(--app-text-primary)]">
                  <span className="font-semibold">{number.format(filteredAudience.length)} customers</span> match the current audience selection. Multiple purchases and products are aggregated into one customer row to prevent duplicate recipients.
                </div>

                {!onlyMessageable && authUser.role === "ADMIN" && (
                  <div className="rounded-[var(--app-radius-md)] border border-[var(--app-warning)]/40 bg-[var(--app-warning-soft)] p-3 text-xs text-[var(--app-warning)]">
                    Re-enable <strong>Only messageable users</strong> to create a Broadcast Audience draft. CSV export can still include excluded customers.
                  </div>
                )}

                {draftError && (
                  <div role="alert" className="rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/40 bg-[var(--app-danger-soft)] p-3 text-xs text-[var(--app-danger)]">
                    {draftError}
                  </div>
                )}

                {createdDraft && (
                  <div className="rounded-[var(--app-radius-md)] border border-[var(--app-success)]/40 bg-[var(--app-success-soft)] p-4 text-xs text-[var(--app-success)] space-y-2">
                    <p className="font-bold">Broadcast Audience draft created</p>
                    <p>{number.format(createdDraft.recipientCount)} customers · {number.format(createdDraft.storeCount)} stores · {number.format(createdDraft.lineOaCount)} LINE OAs</p>
                    <p className="text-[11px] opacity-90">
                      Status: DRAFT. No message has been sent. The selected customer snapshot is saved in Mass Message for the next campaign-composer phase.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => window.location.assign("/mass-messages")}
                    >
                      Open Mass Message
                    </Button>
                  </div>
                )}

                <div className="space-y-1 text-xs text-[var(--app-text-secondary)]">
                  <p className="font-semibold text-[var(--app-text-primary)]">CSV includes</p>
                  <p className="text-[11px] leading-relaxed">
                    Customer name, LINE User ID, conversation, language, LINE OA, store, current sales status, products, variants, colors, quantities, purchase channels, payment methods, last purchase/message dates, BM recorder, and messageability status.
                  </p>
                </div>

                <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] p-3 text-xs text-[var(--app-text-secondary)] bg-[var(--app-surface-subtle)]">
                  <p className="font-semibold text-[var(--app-text-primary)]">Broadcast Audience safety</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed">
                    Create Broadcast Audience saves an idempotent DRAFT recipient snapshot only. It does not create store deliveries, start the Mass Message processor, or send anything to LINE.
                  </p>
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setAudienceOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={downloadAudience}
                    disabled={filteredAudience.length === 0}
                  >
                    Download CSV
                  </Button>
                  {authUser.role === "ADMIN" && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => void createBroadcastDraft()}
                      disabled={draftCreating || !onlyMessageable || selectedStatuses.size === 0 || filteredAudience.length === 0 || Boolean(createdDraft)}
                    >
                      {draftCreating ? "Creating draft…" : createdDraft ? "Draft created" : "Create Broadcast Audience"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
