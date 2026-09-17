"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UnifiedPeriodPicker } from "@/components/date-range/unified-period-picker";
import { AppShell } from "@/components/shell/app-shell";
import { FilterBar, PageContainer, PageHeader } from "@/components/shell";
import { Button, Card, LoadingState } from "@/components/ui";
import { api } from "@/lib/api";
import { AUTH_UNAUTHORIZED_EVENT } from "@/lib/auth-session";
import type { ApiStore, PurchaseAnalyticsResponse } from "@/types/api";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type TrendMetric = "purchases" | "products" | "customers";
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
  summary: { customers: number; messageableCustomers: number; excludedCustomers: number };
  audience: PurchaseAudienceItem[];
};

const number = new Intl.NumberFormat("en-US");
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const dateTime = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function pct(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function csvCell(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportAudienceCsv(items: PurchaseAudienceItem[]) {
  const headers = [
    "customer_name", "line_user_id", "conversation_id", "preferred_language", "line_oa_id", "line_oa_name",
    "store_id", "store_name", "store_code", "customer_status", "products", "product_series", "variants", "colors",
    "total_quantity", "purchase_channels", "payment_methods", "last_purchase_at", "last_message_at", "recorded_by_name", "can_message",
  ];
  const rows = items.map((item) => {
    const products = item.products.map((product) => {
      const variant = [product.ram, product.rom, product.color].filter(Boolean).join(" / ");
      return `${product.customProductName || product.modelName}${variant ? ` (${variant})` : ""} x${product.quantity}`;
    }).join(" | ");
    const series = [...new Set(item.products.map((product) => product.seriesName).filter(Boolean))].join(" | ");
    const variants = item.products.map((product) => [product.ram, product.rom].filter(Boolean).join(" / ")).filter(Boolean).join(" | ");
    const colors = [...new Set(item.products.map((product) => product.color).filter((value): value is string => Boolean(value)))].join(" | ");
    const quantity = item.products.reduce((sum, product) => sum + product.quantity, 0);
    return [
      item.customerName, item.lineUserId, item.conversationId, item.preferredLanguage, item.lineOaId, item.lineOaName,
      item.storeId, item.storeName, item.storeCode, item.customerStatus, products, series, variants, colors, quantity,
      item.purchaseChannels.join(" | "), item.paymentMethods.join(" | "), item.lastPurchaseAt, item.lastMessageAt,
      item.recordedByName, item.canMessage ? "TRUE" : "FALSE",
    ].map(csvCell).join(",");
  });
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${rows.join("\r\n")}\r\n`;
}

function DashboardCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <Card className={`overflow-hidden border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm ${className}`}>{children}</Card>;
}

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4.5 pb-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-[-0.015em] text-[var(--app-text-primary)]">{title}</h2>
        {description ? <p className="mt-0.5 text-[11px] text-[var(--app-text-tertiary)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function ViewAllButton({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-[10px] font-semibold text-[var(--app-text-secondary)] transition hover:bg-[var(--app-surface-subtle)]">
      {expanded ? "Show less" : "View all"}
    </button>
  );
}

function MetricTile({ label, value, tone, icon, helper }: { label: string; value: string; tone: "green" | "blue" | "purple"; icon: React.ReactNode; helper: string }) {
  const toneClasses = {
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-violet-50 text-violet-600",
  }[tone];
  return (
    <DashboardCard className="p-4.5">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses}`}>{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-[var(--app-text-secondary)]">{label}</p>
          <p className="mt-0.5 text-[26px] font-bold leading-tight tracking-[-0.035em] text-[var(--app-text-primary)]">{value}</p>
          <p className="mt-1 text-[10px] text-[var(--app-text-tertiary)]">{helper}</p>
        </div>
      </div>
    </DashboardCard>
  );
}

function BagIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 8.5h14l-1 11H6l-1-11Z"/><path d="M9 9V6.5a3 3 0 0 1 6 0V9"/></svg>;
}
function BoxIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></svg>;
}
function StoreIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 10h16M5 10v10h14V10M3 10l2-6h14l2 6"/><path d="M9 20v-6h6v6"/></svg>;
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6"/></svg>;
}

function HorizontalBar({ value, max, className = "bg-emerald-400" }: { value: number; max: number; className?: string }) {
  const width = max > 0 ? Math.max(5, (value / max) * 100) : 0;
  return <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${className}`} style={{ width: `${width}%` }} /></div>;
}

function TrendChart({ data, metric }: { data: Array<{ date: string; purchases: number; products: number; customers: number }>; metric: TrendMetric }) {
  if (data.length === 0) {
    return <div className="flex h-44 items-center justify-center text-xs text-[var(--app-text-tertiary)]">No trend data for the selected filters.</div>;
  }
  const values = data.map((item) => item[metric]);
  const max = Math.max(...values, 1);
  const width = 900;
  const height = 190;
  const padX = 28;
  const padTop = 16;
  const padBottom = 28;
  const chartHeight = height - padTop - padBottom;
  const usableWidth = width - padX * 2;
  const points = data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : padX + (index / (data.length - 1)) * usableWidth;
    const y = padTop + chartHeight - (item[metric] / max) * chartHeight;
    return { x, y, item };
  });
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${(height - padBottom).toFixed(1)} L${points[0].x.toFixed(1)},${(height - padBottom).toFixed(1)} Z`;
  const labelIndexes = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);
  return (
    <div className="w-full overflow-hidden px-2 pb-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[190px] w-full" role="img" aria-label={`${metric} trend`}>
        <defs><linearGradient id={`purchaseArea-${metric}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity="0.24"/><stop offset="100%" stopColor="#10b981" stopOpacity="0.02"/></linearGradient></defs>
        {[0, 0.33, 0.66, 1].map((ratio) => <line key={ratio} x1={padX} x2={width - padX} y1={padTop + chartHeight * ratio} y2={padTop + chartHeight * ratio} stroke="currentColor" className="text-slate-100" strokeWidth="1" />)}
        <path d={area} fill={`url(#purchaseArea-${metric})`} />
        <path d={line} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => <circle key={`${point.item.date}-${index}`} cx={point.x} cy={point.y} r="3.5" fill="#059669" stroke="white" strokeWidth="2" />)}
        {points.map((point, index) => labelIndexes.has(index) ? <text key={`label-${point.item.date}`} x={point.x} y={height - 8} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} fontSize="10" fill="#94a3b8">{shortDate.format(new Date(`${point.item.date}T00:00:00`))}</text> : null)}
      </svg>
    </div>
  );
}

function DistributionBar({ items, colors }: { items: Array<{ label: string; count: number }>; colors: string[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="px-5 pb-5">
      {items.length === 0 ? <p className="py-4 text-xs text-[var(--app-text-tertiary)]">No recorded information.</p> : <>
        <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
          {items.map((item, index) => <div key={item.label} style={{ width: `${pct(item.count, total)}%`, backgroundColor: colors[index % colors.length] }} title={`${item.label}: ${item.count}`} />)}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.slice(0, 4).map((item, index) => <div key={item.label} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--app-surface-subtle)] px-3 py-2 text-xs"><div className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} /><span className="truncate text-[var(--app-text-secondary)]">{item.label}</span></div><span className="font-semibold tabular-nums text-[var(--app-text-primary)]">{Math.round(pct(item.count, total))}%</span></div>)}
        </div>
      </>}
    </div>
  );
}

export default function PurchaseIntelligenceDashboard() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [analytics, setAnalytics] = useState<PurchaseAnalyticsResponse | null>(null);
  const [audience, setAudience] = useState<PurchaseAudienceResponse | null>(null);
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [storeId, setStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("purchases");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (viewer?: AuthUser) => {
    setLoading(true);
    setError(null);
    try {
      const params = { from: from || undefined, to: to || undefined, storeId: storeId || undefined };
      const query = new URLSearchParams();
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      if (storeId) query.set("storeId", storeId);
      const [result, availableStores, audienceResponse] = await Promise.all([
        api.purchaseAnalytics(params),
        viewer?.role === "ADMIN" ? api.stores(false) : Promise.resolve([] as ApiStore[]),
        fetch(`/api-backend/admin/purchase-analytics/audience${query.size ? `?${query.toString()}` : ""}`, { credentials: "include" }),
      ]);
      setAnalytics(result);
      setStores(availableStores);
      if (audienceResponse.ok) setAudience(await audienceResponse.json() as PurchaseAudienceResponse);
      else setAudience(null);
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

  const downloadAudience = async () => {
    if (!audience?.audience.length) return;
    setExporting(true);
    try {
      const blob = new Blob([exportAudienceCsv(audience.audience)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `purchase-audience_${from || "all"}_to_${to || "all"}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const productFamilies = useMemo(() => {
    if (!analytics) return [];
    const grouped = new Map<string, number>();
    for (const item of analytics.products) grouped.set(item.seriesName || "Other", (grouped.get(item.seriesName || "Other") || 0) + item.count);
    return [...grouped.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [analytics]);

  const trendData = useMemo(() => {
    if (!audience) return [];
    const grouped = new Map<string, { purchases: number; products: number; customers: Set<string> }>();
    for (const item of audience.audience) {
      const parsed = new Date(item.lastPurchaseAt);
      if (Number.isNaN(parsed.getTime())) continue;
      const date = parsed.toISOString().slice(0, 10);
      const current = grouped.get(date) || { purchases: 0, products: 0, customers: new Set<string>() };
      current.purchases += 1;
      current.products += item.products.reduce((sum, product) => sum + product.quantity, 0);
      current.customers.add(item.customerId);
      grouped.set(date, current);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-21).map(([date, value]) => ({ date, purchases: value.purchases, products: value.products, customers: value.customers.size }));
  }, [audience]);

  const recorderStoreCounts = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of audience?.audience || []) {
      if (!item.recordedByName) continue;
      const storesForRecorder = map.get(item.recordedByName) || new Set<string>();
      storesForRecorder.add(item.storeId);
      map.set(item.recordedByName, storesForRecorder);
    }
    return map;
  }, [audience]);

  const toggleExpanded = (key: string) => setExpanded((current) => ({ ...current, [key]: !current[key] }));

  if (!authChecked) return <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]"><LoadingState message="Loading…" /></main>;
  if (!authUser) return <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] p-6"><Card className="max-w-md p-6 text-center"><h1 className="text-xl font-bold">Authentication required</h1><p className="mt-2 text-xs text-[var(--app-text-secondary)]">Please sign in to view purchase intelligence.</p></Card></main>;

  const totalProducts = analytics?.products.reduce((sum, item) => sum + item.count, 0) || 0;
  const totalStoreRecords = analytics?.stores.reduce((sum, item) => sum + item.recordCount, 0) || 0;
  const familyTotal = productFamilies.reduce((sum, item) => sum + item.count, 0);
  const topFamily = productFamilies[0];
  const familyColors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#64748b", "#ec4899"];
  const donutStops = productFamilies.slice(0, 6).reduce<{ cursor: number; stops: string[] }>((acc, item, index) => {
    const share = pct(item.count, familyTotal);
    const end = acc.cursor + share;
    acc.stops.push(`${familyColors[index % familyColors.length]} ${acc.cursor}% ${end}%`);
    acc.cursor = end;
    return acc;
  }, { cursor: 0, stops: [] });

  return (
    <AppShell currentSection="purchase-analytics" authUser={authUser} text={{ appName: "OPPO LINE OA Monitor", appDescription: "LINE OA monitoring", language: "Language", loadingData: "Loading…", retry: "Retry", apiError: "Data service error" }} language="en" changeLanguage={() => undefined} searchText="" setSearchText={() => undefined} logout={logout}>
      <PageContainer>
        <div className="mx-auto max-w-[1380px] space-y-4.5 pb-8">
          <PageHeader
            tag="Operations · Purchase Intelligence"
            title="Purchase Intelligence"
            description="Understand what customers are buying across all stores"
            actions={<Button variant="secondary" size="sm" onClick={() => void downloadAudience()} disabled={!audience?.audience.length || exporting}>{exporting ? "Exporting…" : "Export audience"}</Button>}
          />

          <FilterBar>
            <div className="flex w-full flex-wrap items-center gap-3">
              <UnifiedPeriodPicker dateFrom={from} dateTo={to} language="en" onApply={(start, end) => { setFrom(start); setTo(end); }} />
              {authUser.role === "ADMIN" ? <label className="flex min-w-64 flex-1 items-center gap-2 text-xs font-medium text-[var(--app-text-secondary)]"><span>Store</span><select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-xs text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"><option value="">All authorized stores</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}{store.code ? ` (${store.code})` : ""}</option>)}</select></label> : null}
              <Button variant="primary" size="sm" onClick={() => void load(authUser)} disabled={loading}>Apply</Button>
            </div>
          </FilterBar>

          {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</div> : null}
          {loading && !analytics ? <LoadingState message="Loading purchase intelligence…" /> : analytics ? <>
            <section aria-label="Purchase overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Verified Purchase Records" value={number.format(analytics.overview.verifiedPurchaseRecords)} tone="green" icon={<BagIcon />} helper="Current filtered view" />
              <MetricTile label="Products Recorded" value={number.format(analytics.overview.recordedProducts)} tone="blue" icon={<BoxIcon />} helper="Current filtered view" />
              <MetricTile label="Active Stores" value={number.format(analytics.overview.stores)} tone="blue" icon={<StoreIcon />} helper="With recorded purchases" />
              <MetricTile label="BM Recorders" value={number.format(analytics.overview.recordingBms)} tone="purple" icon={<UserIcon />} helper="With recorded activity" />
            </section>

            <DashboardCard>
              <SectionHeader title="Purchase Trend" description="Recorded customer purchase activity over time" action={<div className="flex rounded-lg bg-[var(--app-surface-subtle)] p-1">{(["purchases", "products", "customers"] as TrendMetric[]).map((metric) => <button key={metric} type="button" onClick={() => setTrendMetric(metric)} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold capitalize transition ${trendMetric === metric ? "bg-emerald-600 text-white shadow-sm" : "text-[var(--app-text-secondary)] hover:bg-white"}`}>{metric}</button>)}</div>} />
              <TrendChart data={trendData} metric={trendMetric} />
            </DashboardCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <DashboardCard>
                <SectionHeader title="Top Products" description="See which products are selling the most" action={<ViewAllButton expanded={Boolean(expanded.products)} onClick={() => toggleExpanded("products")} />} />
                <div className="space-y-3 px-5 pb-5">{analytics.products.slice(0, expanded.products ? 15 : 5).map((item, index) => <div key={item.productModelId} className="grid grid-cols-[20px_minmax(0,1fr)_110px_34px] items-center gap-2 text-xs"><span className="text-[10px] text-[var(--app-text-tertiary)]">{index + 1}</span><div className="min-w-0"><span className="block truncate font-medium text-[var(--app-text-primary)]">{item.name}</span><span className="text-[10px] text-[var(--app-text-tertiary)]">{item.seriesName}</span></div><HorizontalBar value={item.count} max={analytics.products[0]?.count || 1} /><span className="text-right font-semibold tabular-nums">{number.format(item.count)}</span></div>)}</div>
              </DashboardCard>

              <DashboardCard>
                <SectionHeader title="Product Families" description="Share of total recorded products" />
                <div className="flex min-h-48 items-center gap-7 px-5 pb-5">
                  <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: donutStops.stops.length ? `conic-gradient(${donutStops.stops.join(",")})` : "#e2e8f0" }}><div className="absolute inset-[19px] flex flex-col items-center justify-center rounded-full bg-[var(--app-surface)]"><span className="text-xl font-bold">{number.format(totalProducts)}</span><span className="text-[10px] text-[var(--app-text-tertiary)]">Products</span></div></div>
                  <div className="min-w-0 flex-1 space-y-2.5">{productFamilies.slice(0, 5).map((item, index) => <div key={item.label} className="flex items-center justify-between gap-3 text-xs"><div className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: familyColors[index % familyColors.length] }} /><span className="truncate text-[var(--app-text-secondary)]">{item.label}</span></div><span className="font-semibold tabular-nums">{Math.round(pct(item.count, familyTotal))}%</span></div>)}</div>
                </div>
              </DashboardCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <DashboardCard><SectionHeader title="Purchase Channel" description="Where customers make their purchase" /><DistributionBar items={analytics.channels} colors={["#34d399", "#3b82f6", "#8b5cf6", "#f59e0b"]} /></DashboardCard>
              <DashboardCard><SectionHeader title="Payment Method" description="How customers pay" /><DistributionBar items={analytics.paymentMethods} colors={["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"]} /></DashboardCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <DashboardCard>
                <SectionHeader title="Top Stores" description="Stores with the most purchase records" action={<ViewAllButton expanded={Boolean(expanded.stores)} onClick={() => toggleExpanded("stores")} />} />
                <div className="px-5 pb-5"><div className="grid grid-cols-[28px_minmax(0,1fr)_80px_70px] gap-2 border-b border-[var(--app-border)] pb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]"><span>#</span><span>Store</span><span className="text-right">Purchases</span><span className="text-right">Share</span></div>{analytics.stores.slice(0, expanded.stores ? 15 : 5).map((item, index) => <div key={item.storeId} className="grid grid-cols-[28px_minmax(0,1fr)_80px_70px] items-center gap-2 border-b border-[var(--app-border)]/70 py-2.5 text-xs last:border-b-0"><span className="text-[10px] text-[var(--app-text-tertiary)]">{index + 1}</span><span className="truncate font-medium">{item.storeName}</span><span className="text-right font-semibold tabular-nums">{number.format(item.recordCount)}</span><span className="text-right font-medium tabular-nums text-[var(--app-text-secondary)]">{pct(item.recordCount, totalStoreRecords).toFixed(1)}%</span></div>)}</div>
              </DashboardCard>

              <DashboardCard>
                <SectionHeader title="Top Variants" description="Most popular product variants" action={<ViewAllButton expanded={Boolean(expanded.variants)} onClick={() => toggleExpanded("variants")} />} />
                <div className="space-y-3 px-5 pb-5">{analytics.variants.slice(0, expanded.variants ? 15 : 5).map((item, index) => <div key={item.productVariantId} className="grid grid-cols-[20px_minmax(0,1fr)_90px_34px] items-center gap-2 text-xs"><span className="text-[10px] text-[var(--app-text-tertiary)]">{index + 1}</span><span className="truncate font-medium">{item.modelName} · {item.variant}{item.color ? ` · ${item.color}` : ""}</span><HorizontalBar value={item.count} max={analytics.variants[0]?.count || 1} /><span className="text-right font-semibold tabular-nums">{number.format(item.count)}</span></div>)}</div>
              </DashboardCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <DashboardCard>
                <SectionHeader title="Top Colors" description="Popular color choices across all products" />
                <div className="space-y-3 px-5 pb-5">{(() => { const shown = analytics.colors.slice(0, 5); const visibleTotal = analytics.colors.reduce((sum, item) => sum + item.count, 0); const otherCount = analytics.colors.slice(5).reduce((sum, item) => sum + item.count, 0); const rows = otherCount > 0 ? [...shown, { label: "Others", count: otherCount }] : shown; return rows.map((item, index) => <div key={item.label} className="grid grid-cols-[12px_minmax(0,1fr)_110px_38px] items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ["#f8fafc", "#a78bfa", "#7c3aed", "#f6c86e", "#111827", "#94a3b8"][index % 6], border: index === 0 ? "1px solid #cbd5e1" : undefined }} /><span className="truncate text-[var(--app-text-secondary)]">{item.label}</span><HorizontalBar value={item.count} max={analytics.colors[0]?.count || 1} /><span className="text-right font-semibold tabular-nums">{Math.round(pct(item.count, visibleTotal))}%</span></div>); })()}</div>
              </DashboardCard>

              <DashboardCard>
                <SectionHeader title="BM Recording Activity" description="BM with the most purchase records" action={<ViewAllButton expanded={Boolean(expanded.bm)} onClick={() => toggleExpanded("bm")} />} />
                <div className="px-5 pb-5"><div className="grid grid-cols-[28px_minmax(0,1fr)_70px_60px_110px] gap-2 border-b border-[var(--app-border)] pb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]"><span>#</span><span>BM Name</span><span className="text-right">Records</span><span className="text-right">Stores</span><span className="text-right">Last Activity</span></div>{analytics.recordingActivity.slice(0, expanded.bm ? 15 : 5).map((item, index) => <div key={`${item.userId || item.displayName}-${index}`} className="grid grid-cols-[28px_minmax(0,1fr)_70px_60px_110px] items-center gap-2 border-b border-[var(--app-border)]/70 py-2.5 text-xs last:border-b-0"><span className="text-[10px] text-[var(--app-text-tertiary)]">{index + 1}</span><span className="truncate font-medium">{item.displayName}</span><span className="text-right font-semibold tabular-nums">{number.format(item.recordCount)}</span><span className="text-right tabular-nums text-[var(--app-text-secondary)]">{recorderStoreCounts.get(item.displayName)?.size || "—"}</span><span className="text-right text-[10px] text-[var(--app-text-secondary)]">{dateTime.format(new Date(item.lastRecordedAt))}</span></div>)}</div>
              </DashboardCard>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-green-50 px-5 py-4 text-xs text-emerald-900">
              <div className="flex min-w-0 items-center gap-3"><span className="text-lg">✦</span><p className="truncate"><span className="font-semibold">Insight:</span> {topFamily ? `${topFamily.label} accounts for ${Math.round(clamp(pct(topFamily.count, familyTotal)))}% of recorded products in this period.` : "Purchase insights will appear once product data is recorded."}</p></div>
              <button type="button" onClick={() => void downloadAudience()} disabled={!audience?.audience.length || exporting} className="shrink-0 font-semibold text-emerald-700 disabled:opacity-50">Export full report</button>
            </div>
          </> : null}
        </div>
      </PageContainer>
    </AppShell>
  );
}
