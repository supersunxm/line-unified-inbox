"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MobileBottomNav,
  MobileCard,
  MobileEmptyState,
  MobileListCard,
  MobileMetricCard,
  MobileMetricGrid,
  MobileMoreSheet,
  MobilePageHeader,
  MobilePageShell,
  MobileSection,
  MobileSectionTabs,
} from "@/components/mobile/adaptive-mobile";
import { api } from "@/lib/api";
import type { ApiStore, PurchaseAnalyticsResponse } from "@/types/api";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type MobileTab = "overview" | "products" | "stores" | "audience";
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
const inputClass = "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3 text-[16px] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]";

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

export function MobilePurchaseAnalyticsApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [analytics, setAnalytics] = useState<PurchaseAnalyticsResponse | null>(null);
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [tab, setTab] = useState<MobileTab>("overview");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [storeId, setStoreId] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const [audience, setAudience] = useState<PurchaseAudienceResponse | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [onlyMessageable, setOnlyMessageable] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<AudienceStatus>>(new Set(["PURCHASED", "INTERESTED", "NOT_SPECIFIED"]));
  const [audienceLimit, setAudienceLimit] = useState(30);
  const [draftCreating, setDraftCreating] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [createdDraft, setCreatedDraft] = useState<PurchaseBroadcastDraftResult | null>(null);
  const [draftRequestId, setDraftRequestId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api.me()
      .then((value) => { if (active) setUser(value); })
      .catch(() => { if (typeof window !== "undefined") window.location.replace("/login"); })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  const loadAnalytics = useCallback(async (viewer?: AuthUser) => {
    setLoading(true);
    setError(null);
    try {
      const [result, availableStores] = await Promise.all([
        api.purchaseAnalytics({ from: from || undefined, to: to || undefined, storeId: storeId || undefined }),
        viewer?.role === "ADMIN" ? api.stores(false) : Promise.resolve([] as ApiStore[]),
      ]);
      setAnalytics(result);
      setStores(availableStores);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลดข้อมูลการซื้อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [from, storeId, to]);

  useEffect(() => { if (user) void loadAnalytics(user); }, [loadAnalytics, user]);

  const loadAudience = useCallback(async () => {
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
        throw new Error(message || `โหลดกลุ่มลูกค้าไม่สำเร็จ (${response.status})`);
      }
      setAudience(await response.json() as PurchaseAudienceResponse);
      setAudienceLimit(30);
    } catch (reason) {
      setAudienceError(reason instanceof Error ? reason.message : "โหลดกลุ่มลูกค้าไม่สำเร็จ");
    } finally {
      setAudienceLoading(false);
    }
  }, [from, storeId, to]);

  useEffect(() => {
    if (tab === "audience" && !audience && !audienceLoading) void loadAudience();
  }, [audience, audienceLoading, loadAudience, tab]);

  const filteredAudience = useMemo(() => {
    if (!audience) return [];
    return audience.audience.filter((item) => selectedStatuses.has(audienceStatus(item)) && (!onlyMessageable || item.canMessage));
  }, [audience, onlyMessageable, selectedStatuses]);

  const selectedStoreLabel = useMemo(() => stores.find((store) => store.id === storeId)?.name ?? "ทุกร้าน", [storeId, stores]);

  const applyFilters = async () => {
    setFilterOpen(false);
    setAudience(null);
    setCreatedDraft(null);
    await loadAnalytics(user ?? undefined);
    if (tab === "audience") await loadAudience();
  };

  const toggleStatus = (status: AudienceStatus) => {
    setSelectedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
    setCreatedDraft(null);
    setDraftRequestId(null);
  };

  const downloadAudience = () => {
    if (filteredAudience.length === 0) return;
    const blob = new Blob([exportAudienceCsv(filteredAudience)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `purchase-audience_${from || "all"}_to_${to || "all"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const createBroadcastDraft = async () => {
    if (user?.role !== "ADMIN" || draftCreating || !onlyMessageable || selectedStatuses.size === 0 || filteredAudience.length === 0) return;
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
        body: JSON.stringify({ campaignRequestId, from: from || undefined, to: to || undefined, storeId: storeId || undefined, statuses: [...selectedStatuses].sort(), onlyMessageable: true }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
        throw new Error(message || `สร้าง Broadcast Draft ไม่สำเร็จ (${response.status})`);
      }
      setCreatedDraft(await response.json() as PurchaseBroadcastDraftResult);
    } catch (reason) {
      setDraftError(reason instanceof Error ? reason.message : "สร้าง Broadcast Draft ไม่สำเร็จ");
    } finally {
      setDraftCreating(false);
    }
  };

  if (!authChecked || !user) {
    return <main className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิดข้อมูลการซื้อ...</main>;
  }

  return (
    <MobilePageShell bottomNav={<MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />}>
      <MobilePageHeader
        eyebrow="Operations · Purchase Intelligence"
        title="ข้อมูลการซื้อ"
        description="วิเคราะห์สินค้าที่ซื้อ ร้านค้า และกลุ่มลูกค้าจากข้อมูลที่บันทึกแล้ว"
        action={<button type="button" onClick={() => setFilterOpen(true)} className="flex h-10 items-center rounded-xl border border-[var(--app-border)] px-3 text-[11px] font-bold">ตัวกรอง</button>}
      />
      <MobileSectionTabs<MobileTab>
        value={tab}
        items={[
          { value: "overview", label: "ภาพรวม" },
          { value: "products", label: "สินค้า" },
          { value: "stores", label: "ร้านค้า" },
          { value: "audience", label: "ลูกค้า" },
        ]}
        onChange={setTab}
      />

      <div className="space-y-4 px-4 py-4 pb-8">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--app-surface-subtle)] px-3 py-2 text-[10px] text-[var(--app-text-secondary)]">
          <span className="truncate">{from || "ทั้งหมด"} → {to || "ปัจจุบัน"}</span>
          <span className="shrink-0 font-semibold">{selectedStoreLabel}</span>
        </div>

        {error && <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs leading-5 text-rose-600 dark:text-rose-400">{error}</div>}

        {loading && !analytics ? <MobileCard><p className="py-10 text-center text-xs text-[var(--app-text-secondary)]">กำลังโหลดข้อมูล...</p></MobileCard> : analytics && (
          <>
            {tab === "overview" && <Overview analytics={analytics} />}
            {tab === "products" && <Products analytics={analytics} />}
            {tab === "stores" && <Stores analytics={analytics} />}
          </>
        )}

        {tab === "audience" && (
          <Audience
            user={user}
            audience={audience}
            loading={audienceLoading}
            error={audienceError}
            onlyMessageable={onlyMessageable}
            selectedStatuses={selectedStatuses}
            filtered={filteredAudience}
            limit={audienceLimit}
            draftCreating={draftCreating}
            draftError={draftError}
            createdDraft={createdDraft}
            onReload={loadAudience}
            onToggleStatus={toggleStatus}
            onMessageable={(value) => { setOnlyMessageable(value); setCreatedDraft(null); setDraftRequestId(null); }}
            onMore={() => setAudienceLimit((value) => value + 30)}
            onDownload={downloadAudience}
            onCreateDraft={createBroadcastDraft}
          />
        )}
      </div>

      {filterOpen && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/40" onClick={() => setFilterOpen(false)}>
          <div className="w-full rounded-t-[1.6rem] bg-[var(--app-surface)] px-4 pt-3 shadow-2xl" style={{ paddingBottom: "max(1rem,env(safe-area-inset-bottom))" }} onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--app-border)]" />
            <div className="flex items-center justify-between"><div><h2 className="text-base font-bold">ตัวกรอง</h2><p className="mt-0.5 text-[11px] text-[var(--app-text-secondary)]">ช่วงวันที่และร้านค้า</p></div><button type="button" onClick={() => setFilterOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-lg">×</button></div>
            <div className="mt-4 space-y-3">
              <label><span className="mb-1 block text-[11px] font-semibold text-[var(--app-text-secondary)]">จากวันที่</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={inputClass} /></label>
              <label><span className="mb-1 block text-[11px] font-semibold text-[var(--app-text-secondary)]">ถึงวันที่</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={inputClass} /></label>
              {user.role === "ADMIN" && <label><span className="mb-1 block text-[11px] font-semibold text-[var(--app-text-secondary)]">ร้านค้า</span><select value={storeId} onChange={(event) => setStoreId(event.target.value)} className={inputClass}><option value="">ทุกร้านที่มีสิทธิ์</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}{store.code ? ` (${store.code})` : ""}</option>)}</select></label>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setFrom(""); setTo(""); setStoreId(""); }} className="min-h-12 rounded-xl border border-[var(--app-border)] text-sm font-bold">ล้าง</button><button type="button" onClick={() => void applyFilters()} className="min-h-12 rounded-xl bg-[var(--app-accent)] text-sm font-bold text-white">นำไปใช้</button></div>
          </div>
        </div>
      )}

      {moreOpen && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
    </MobilePageShell>
  );
}

function Overview({ analytics }: { analytics: PurchaseAnalyticsResponse }) {
  return <div className="space-y-4">
    <MobileMetricGrid>
      <MobileMetricCard label="Purchase Records" value={number.format(analytics.overview.verifiedPurchaseRecords)} tone="accent" wide />
      <MobileMetricCard label="สินค้าที่บันทึก" value={number.format(analytics.overview.recordedProducts)} />
      <MobileMetricCard label="ร้านค้า" value={number.format(analytics.overview.stores)} />
      <MobileMetricCard label="BM ผู้บันทึก" value={number.format(analytics.overview.recordingBms)} tone="info" wide />
    </MobileMetricGrid>
    <Ranking title="ช่องทางการซื้อ" items={analytics.channels} />
    <Ranking title="วิธีชำระเงิน" items={analytics.paymentMethods} />
    <Ranking title="สีที่บันทึก" items={analytics.colors} />
    <MobileSection title="กิจกรรมการบันทึกของ BM" description={`${analytics.recordingActivity.length} คน`}>
      {analytics.recordingActivity.length === 0 ? <MobileEmptyState title="ยังไม่มีกิจกรรม" /> : <div className="space-y-2.5">{analytics.recordingActivity.map((item) => <MobileListCard key={item.userId ?? item.displayName} title={item.displayName} subtitle={`ล่าสุด ${new Date(item.lastRecordedAt).toLocaleString("th-TH")}`} trailing={<span className="text-sm font-bold tabular-nums">{number.format(item.recordCount)}</span>} />)}</div>}
    </MobileSection>
  </div>;
}

function Products({ analytics }: { analytics: PurchaseAnalyticsResponse }) {
  return <div className="space-y-4">
    <MobileSection title="รุ่นสินค้าที่ถูกบันทึก" description={`${analytics.products.length} รุ่น`}>
      {analytics.products.length === 0 ? <MobileEmptyState title="ยังไม่มีข้อมูลสินค้า" /> : <div className="space-y-2.5">{analytics.products.map((item, index) => <MobileListCard key={item.productModelId} title={item.name} subtitle={item.seriesName} leading={<span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${index === 0 ? "bg-[var(--app-accent)] text-white" : "bg-[var(--app-surface-subtle)]"}`}>#{index + 1}</span>} trailing={<span className="text-sm font-bold tabular-nums">{number.format(item.count)}</span>} />)}</div>}
    </MobileSection>
    <MobileSection title="Variants" description={`${analytics.variants.length} รายการ`}>
      {analytics.variants.length === 0 ? <MobileEmptyState title="ยังไม่มีข้อมูล Variant" /> : <div className="space-y-2.5">{analytics.variants.map((item, index) => <MobileListCard key={item.productVariantId} title={item.modelName} subtitle={`${item.variant}${item.color ? ` · ${item.color}` : ""}`} leading={<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-surface-subtle)] text-[10px] font-bold">#{index + 1}</span>} trailing={<span className="text-sm font-bold tabular-nums">{number.format(item.count)}</span>} />)}</div>}
    </MobileSection>
  </div>;
}

function Stores({ analytics }: { analytics: PurchaseAnalyticsResponse }) {
  return <MobileSection title="Store Performance" description="เรียงตามจำนวน Purchase Record">
    {analytics.stores.length === 0 ? <MobileEmptyState title="ยังไม่มีข้อมูลร้าน" /> : <div className="space-y-2.5">{analytics.stores.map((item, index) => <MobileListCard key={item.storeId} title={item.storeName} subtitle={item.storeCode ?? "ไม่มี Store ID"} leading={<span className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold ${index < 3 ? "bg-[var(--app-accent)]/10 text-[var(--app-accent)]" : "bg-[var(--app-surface-subtle)]"}`}>#{index + 1}</span>} trailing={<span className="text-base font-bold tabular-nums">{number.format(item.recordCount)}</span>}><div className="grid grid-cols-2 gap-2"><MiniStat label="Records" value={item.recordCount} /><MiniStat label="ลูกค้า/แชท" value={item.uniqueConversations} /></div></MobileListCard>)}</div>}
  </MobileSection>;
}

function Ranking({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  return <MobileSection title={title}>{items.length === 0 ? <MobileEmptyState title="ยังไม่มีข้อมูล" /> : <MobileCard className="space-y-3">{items.map((item, index) => <div key={`${item.label}-${item.count}`} className="flex items-center justify-between gap-3 border-b border-[var(--app-border-subtle)] pb-3 last:border-0 last:pb-0"><div className="flex min-w-0 items-center gap-2"><span className="w-5 text-[10px] font-bold text-[var(--app-text-tertiary)]">{index + 1}.</span><span className="truncate text-xs font-semibold">{item.label}</span></div><span className="shrink-0 text-sm font-bold tabular-nums">{number.format(item.count)}</span></div>)}</MobileCard>}</MobileSection>;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-[var(--app-surface-subtle)] px-2.5 py-2"><p className="text-[9px] text-[var(--app-text-tertiary)]">{label}</p><p className="mt-0.5 text-sm font-bold tabular-nums">{number.format(Number(value))}</p></div>;
}

function Audience({ user, audience, loading, error, onlyMessageable, selectedStatuses, filtered, limit, draftCreating, draftError, createdDraft, onReload, onToggleStatus, onMessageable, onMore, onDownload, onCreateDraft }: {
  user: AuthUser;
  audience: PurchaseAudienceResponse | null;
  loading: boolean;
  error: string | null;
  onlyMessageable: boolean;
  selectedStatuses: Set<AudienceStatus>;
  filtered: PurchaseAudienceItem[];
  limit: number;
  draftCreating: boolean;
  draftError: string | null;
  createdDraft: PurchaseBroadcastDraftResult | null;
  onReload: () => void;
  onToggleStatus: (status: AudienceStatus) => void;
  onMessageable: (value: boolean) => void;
  onMore: () => void;
  onDownload: () => void;
  onCreateDraft: () => void;
}) {
  if (loading && !audience) return <MobileCard><p className="py-10 text-center text-xs text-[var(--app-text-secondary)]">กำลังเตรียมกลุ่มลูกค้า...</p></MobileCard>;
  if (error) return <div className="space-y-3"><div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-600">{error}</div><button type="button" onClick={onReload} className="min-h-11 w-full rounded-xl border border-[var(--app-border)] text-xs font-bold">ลองใหม่</button></div>;
  if (!audience) return <MobileEmptyState title="ยังไม่มีกลุ่มลูกค้า" />;
  return <div className="space-y-4">
    <MobileMetricGrid>
      <MobileMetricCard label="ลูกค้าทั้งหมด" value={number.format(audience.summary.customers)} wide />
      <MobileMetricCard label="ส่งข้อความได้" value={number.format(audience.summary.messageableCustomers)} tone="success" />
      <MobileMetricCard label="ถูกตัดออก" value={number.format(audience.summary.excludedCustomers)} tone="warning" />
    </MobileMetricGrid>

    <MobileCard className="space-y-3">
      <div><p className="text-[11px] font-bold">Customer Status</p><div className="mt-2 grid grid-cols-3 gap-1.5">{(["PURCHASED", "INTERESTED", "NOT_SPECIFIED"] as AudienceStatus[]).map((status) => <button key={status} type="button" onClick={() => onToggleStatus(status)} className={`min-h-10 rounded-xl border px-2 text-[10px] font-bold ${selectedStatuses.has(status) ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5 text-[var(--app-accent)]" : "border-[var(--app-border)] text-[var(--app-text-secondary)]"}`}>{status === "NOT_SPECIFIED" ? "ไม่ระบุ" : status === "PURCHASED" ? "ซื้อแล้ว" : "สนใจ"}</button>)}</div></div>
      <button type="button" onClick={() => onMessageable(!onlyMessageable)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left ${onlyMessageable ? "border-emerald-500/30 bg-emerald-500/5" : "border-[var(--app-border)]"}`}><span><span className="block text-xs font-bold">เฉพาะลูกค้าที่ส่งข้อความได้</span><span className="mt-0.5 block text-[10px] text-[var(--app-text-tertiary)]">ต้องมี LINE User ID และ OA พร้อมใช้งาน</span></span><span className={`flex h-6 w-10 items-center rounded-full p-0.5 ${onlyMessageable ? "justify-end bg-emerald-500" : "justify-start bg-[var(--app-border)]"}`}><span className="h-5 w-5 rounded-full bg-white" /></span></button>
    </MobileCard>

    <div className="grid grid-cols-2 gap-2"><button type="button" disabled={filtered.length === 0} onClick={onDownload} className="min-h-11 rounded-xl border border-[var(--app-border)] text-xs font-bold disabled:opacity-35">ดาวน์โหลด CSV</button><button type="button" onClick={onReload} className="min-h-11 rounded-xl border border-[var(--app-border)] text-xs font-bold">รีเฟรช Audience</button></div>

    {user.role === "ADMIN" && <MobileSection title="Broadcast Audience" description="สร้าง DRAFT recipient snapshot เท่านั้น — ยังไม่ส่งข้อความ"><MobileCard className="space-y-3"><p className="text-xs leading-5 text-[var(--app-text-secondary)]">ระบบจะบันทึก recipient snapshot แบบ idempotent เพื่อไปใช้ต่อใน Mass Message โดยยังไม่สร้าง delivery และไม่ส่งอะไรไป LINE</p>{draftError && <p className="rounded-xl bg-rose-500/10 p-3 text-[10px] text-rose-600">{draftError}</p>}{createdDraft ? <div className="rounded-xl bg-emerald-500/10 p-3"><p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">สร้าง Draft แล้ว</p><div className="mt-2 grid grid-cols-3 gap-2"><MiniStat label="Recipients" value={createdDraft.recipientCount} /><MiniStat label="Stores" value={createdDraft.storeCount} /><MiniStat label="LINE OA" value={createdDraft.lineOaCount} /></div></div> : <button type="button" disabled={draftCreating || !onlyMessageable || selectedStatuses.size === 0 || filtered.length === 0} onClick={onCreateDraft} className="min-h-12 w-full rounded-xl bg-[var(--app-accent)] px-3 text-sm font-bold text-white disabled:opacity-35">{draftCreating ? "กำลังสร้าง Draft..." : `สร้าง Broadcast Draft (${filtered.length})`}</button>}</MobileCard></MobileSection>}

    <MobileSection title="รายชื่อลูกค้า" description={`${filtered.length} คนตามตัวกรอง`}>
      {filtered.length === 0 ? <MobileEmptyState title="ไม่พบลูกค้า" description="ลองเปลี่ยน status หรือปิด Only messageable" /> : <div className="space-y-2.5">{filtered.slice(0, limit).map((item) => <MobileListCard key={item.customerId} title={item.customerName || "ไม่ระบุชื่อ"} subtitle={`${item.storeName} · ${item.lineOaName}`} trailing={<span className={`rounded-full px-2 py-1 text-[9px] font-bold ${item.canMessage ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{item.canMessage ? "ส่งได้" : "Excluded"}</span>}><div className="space-y-2"><div className="flex flex-wrap gap-1">{item.products.slice(0, 4).map((product, index) => <span key={`${item.customerId}-${product.modelId}-${index}`} className="rounded-lg bg-[var(--app-surface-subtle)] px-2 py-1 text-[9px] font-semibold">{productLabel(product)}</span>)}</div><div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[var(--app-text-tertiary)]"><span>{audienceStatus(item) === "PURCHASED" ? "ซื้อแล้ว" : audienceStatus(item) === "INTERESTED" ? "สนใจ" : "ไม่ระบุสถานะ"}</span><span>{item.purchaseChannels.join(", ") || "ไม่ระบุช่องทาง"}</span><span>{new Date(item.lastPurchaseAt).toLocaleDateString("th-TH")}</span></div>{item.excludeReason && <p className="text-[9px] text-amber-600">{item.excludeReason}</p>}</div></MobileListCard>)}</div>}
      {limit < filtered.length && <button type="button" onClick={onMore} className="min-h-11 w-full rounded-xl border border-[var(--app-border)] text-xs font-bold">แสดงเพิ่มอีก {Math.min(30, filtered.length - limit)} คน</button>}
    </MobileSection>
  </div>;
}
