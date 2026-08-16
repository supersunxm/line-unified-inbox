"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { api } from "@/lib/api";
import { AUTH_UNAUTHORIZED_EVENT } from "@/lib/auth-session";
import type { ApiStore, PurchaseAnalyticsResponse } from "@/types/api";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };

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
            <button type="button" onClick={() => void load(authUser)} disabled={loading} className="app-button-secondary rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60">Refresh</button>
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
    </AppShell>
  );
}
