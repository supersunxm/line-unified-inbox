"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
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
    <section className="app-surface rounded-xl border p-5 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      {items.length === 0 ? <p className="app-muted mt-4 text-sm">No recorded purchase information.</p> : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={`${item.label}-${item.count}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{item.label}</span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">{number.format(item.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
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

  if (!authChecked) return <main className="flex min-h-screen items-center justify-center app-shell app-muted">Loading…</main>;
  if (!authUser) return <main className="flex min-h-screen items-center justify-center app-shell p-6"><div role="alert" className="app-surface rounded-xl border p-6 text-center"><h1 className="text-xl font-bold">Authentication required</h1><p className="app-muted mt-2">Please sign in to view purchase intelligence.</p></div></main>;

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
      <main className="app-shell min-h-screen p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="app-muted text-sm font-semibold">Operations</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Purchase Intelligence</h1>
              <p className="app-muted mt-2">Verified Purchase Records and Recorded Purchase Information.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void openAudience()} disabled={audienceLoading} className="app-button-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">Export audience</button>
              <button type="button" onClick={() => void load(authUser)} disabled={loading} className="app-button-secondary rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60">Refresh</button>
            </div>
          </div>

          <section className="app-surface mb-6 flex flex-wrap items-end gap-4 rounded-xl border p-4 shadow-sm">
            <label className="text-sm font-medium"><span className="mb-1 block app-muted">From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="app-input h-9 rounded-lg border px-3" /></label>
            <label className="text-sm font-medium"><span className="mb-1 block app-muted">To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="app-input h-9 rounded-lg border px-3" /></label>
            {authUser.role === "ADMIN" && <label className="min-w-56 text-sm font-medium"><span className="mb-1 block app-muted">Store</span><select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="app-input h-9 w-full rounded-lg border px-3"><option value="">All authorized stores</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}{store.code ? ` (${store.code})` : ""}</option>)}</select></label>}
            <button type="button" onClick={() => void load(authUser)} className="app-button-primary h-9 rounded-lg px-4 text-sm font-semibold">Apply filters</button>
          </section>

          {error && <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
          {loading && !analytics ? <div className="app-muted p-10 text-center">Loading recorded purchase information…</div> : analytics && (
            <>
              <section aria-label="Overview" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[["Verified Purchase Records", analytics.overview.verifiedPurchaseRecords], ["Recorded Products", analytics.overview.recordedProducts], ["Stores", analytics.overview.stores], ["BM Recorders", analytics.overview.recordingBms]].map(([label, value]) => <div key={String(label)} className="app-surface rounded-xl border p-5 shadow-sm"><p className="app-muted text-xs font-semibold uppercase tracking-wide">{label}</p><p className="mt-2 text-3xl font-bold">{number.format(Number(value))}</p></div>)}
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="app-surface rounded-xl border p-5 shadow-sm"><h2 className="text-base font-semibold">Products</h2>{analytics.products.length === 0 ? <p className="app-muted mt-4 text-sm">No recorded purchase information.</p> : <ul className="mt-4 space-y-3">{analytics.products.map((item) => <li key={item.productModelId} className="flex justify-between gap-3 text-sm"><span className="truncate">{item.name}<span className="app-muted ml-2">{item.seriesName}</span></span><span className="font-semibold">{number.format(item.count)}</span></li>)}</ul>}</section>
                <section className="app-surface rounded-xl border p-5 shadow-sm"><h2 className="text-base font-semibold">Variants</h2>{analytics.variants.length === 0 ? <p className="app-muted mt-4 text-sm">No recorded variants.</p> : <ul className="mt-4 space-y-3">{analytics.variants.map((item) => <li key={item.productVariantId} className="flex justify-between gap-3 text-sm"><span className="truncate">{item.modelName} · {item.variant}{item.color ? ` · ${item.color}` : ""}</span><span className="font-semibold">{number.format(item.count)}</span></li>)}</ul>}</section>
                <Ranking title="Channels" items={analytics.channels} />
                <Ranking title="Payment" items={analytics.paymentMethods} />
                <Ranking title="Colors" items={analytics.colors} />
                <section className="app-surface rounded-xl border p-5 shadow-sm"><h2 className="text-base font-semibold">Store Performance</h2>{analytics.stores.length === 0 ? <p className="app-muted mt-4 text-sm">No authorized store records.</p> : <ul className="mt-4 space-y-3">{analytics.stores.map((item) => <li key={item.storeId} className="flex justify-between gap-3 text-sm"><span className="truncate">{item.storeName}{item.storeCode ? ` · ${item.storeCode}` : ""}</span><span className="font-semibold">{number.format(item.recordCount)}</span></li>)}</ul>}</section>
              </div>

              <section className="app-surface mt-5 rounded-xl border p-5 shadow-sm"><h2 className="text-base font-semibold">BM Recording Activity</h2>{analytics.recordingActivity.length === 0 ? <p className="app-muted mt-4 text-sm">No recording activity in this range.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide app-muted"><tr><th className="px-2 py-2">Recorder</th><th className="px-2 py-2">Records</th><th className="px-2 py-2">Latest recorded</th></tr></thead><tbody className="divide-y">{analytics.recordingActivity.map((item) => <tr key={item.userId ?? "unknown"}><td className="px-2 py-3">{item.displayName}</td><td className="px-2 py-3">{number.format(item.recordCount)}</td><td className="px-2 py-3">{dateTime.format(new Date(item.lastRecordedAt))}</td></tr>)}</tbody></table></div>}</section>
            </>
          )}
        </div>
      </main>

      {audienceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="audience-title">
          <div className="app-surface max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="audience-title" className="text-xl font-bold">Customer Audience</h2><p className="app-muted mt-1 text-sm">One row per customer. Current date and store filters are applied automatically.</p></div>
              <button type="button" onClick={() => setAudienceOpen(false)} className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm">Close</button>
            </div>

            {audienceLoading ? <div className="app-muted py-10 text-center">Preparing customer audience…</div> : audienceError ? <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{audienceError}</div> : audience && (
              <div className="mt-5 space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border p-3"><p className="app-muted text-xs uppercase">Customers</p><p className="mt-1 text-2xl font-bold">{number.format(audience.summary.customers)}</p></div>
                  <div className="rounded-xl border p-3"><p className="app-muted text-xs uppercase">Messageable</p><p className="mt-1 text-2xl font-bold">{number.format(audience.summary.messageableCustomers)}</p></div>
                  <div className="rounded-xl border p-3"><p className="app-muted text-xs uppercase">Excluded</p><p className="mt-1 text-2xl font-bold">{number.format(audience.summary.excludedCustomers)}</p></div>
                </div>

                <fieldset><legend className="text-sm font-semibold">Customer Status</legend><div className="mt-2 flex flex-wrap gap-3">{(["PURCHASED", "INTERESTED", "NOT_SPECIFIED"] as AudienceStatus[]).map((status) => <label key={status} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedStatuses.has(status)} onChange={() => toggleStatus(status)} />{status === "NOT_SPECIFIED" ? "Not specified" : status.charAt(0) + status.slice(1).toLowerCase()}</label>)}</div></fieldset>

                <label className="flex items-start gap-3 rounded-xl border p-4"><input type="checkbox" className="mt-1" checked={onlyMessageable} onChange={(event) => handleMessageableChange(event.target.checked)} /><span><span className="block text-sm font-semibold">Only messageable users</span><span className="app-muted mt-1 block text-xs">Requires a LINE User ID and an active LINE OA in READY/CONNECTED state. This is operational eligibility, not a guarantee that the customer has not blocked the OA.</span></span></label>

                <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-900"><span className="font-semibold">{number.format(filteredAudience.length)} customers</span> match the current audience selection. Multiple purchases and products are aggregated into one customer row to prevent duplicate recipients.</div>

                {!onlyMessageable && authUser.role === "ADMIN" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Re-enable <strong>Only messageable users</strong> to create a Broadcast Audience draft. CSV export can still include excluded customers.</div>}

                {draftError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{draftError}</div>}

                {createdDraft && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"><p className="font-semibold">Broadcast Audience draft created</p><p className="mt-1">{number.format(createdDraft.recipientCount)} customers · {number.format(createdDraft.storeCount)} stores · {number.format(createdDraft.lineOaCount)} LINE OAs</p><p className="mt-2 text-xs">Status: DRAFT. No message has been sent. The selected customer snapshot is saved in Mass Message for the next campaign-composer phase.</p><button type="button" onClick={() => window.location.assign("/mass-messages")} className="mt-3 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-semibold dark:border-emerald-800">Open Mass Message</button></div>}

                <div><p className="text-sm font-semibold">CSV includes</p><p className="app-muted mt-1 text-sm">Customer name, LINE User ID, conversation, language, LINE OA, store, current sales status, products, variants, colors, quantities, purchase channels, payment methods, last purchase/message dates, BM recorder, and messageability status.</p></div>

                <div className="rounded-xl border p-4 text-sm"><p className="font-semibold">Broadcast Audience safety</p><p className="app-muted mt-1 text-xs">Create Broadcast Audience saves an idempotent DRAFT recipient snapshot only. It does not create store deliveries, start the Mass Message processor, or send anything to LINE.</p></div>

                <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setAudienceOpen(false)} className="app-button-secondary rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={downloadAudience} disabled={filteredAudience.length === 0} className="app-button-secondary rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Download CSV</button>{authUser.role === "ADMIN" && <button type="button" onClick={() => void createBroadcastDraft()} disabled={draftCreating || !onlyMessageable || selectedStatuses.size === 0 || filteredAudience.length === 0 || Boolean(createdDraft)} className="app-button-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">{draftCreating ? "Creating draft…" : createdDraft ? "Draft created" : "Create Broadcast Audience"}</button>}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
