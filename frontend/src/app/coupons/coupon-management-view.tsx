"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, PageContainer } from "@/components/shell";
import { api } from "@/lib/api";
import { couponApi } from "@/lib/coupon-api";
import type { ApiStore } from "@/types/api";
import type {
  CouponCampaign,
  CouponCampaignDetail,
  CouponInput,
  CouponPreview,
  CouponPriceType,
  CouponRewardType,
  CouponStoreMode,
} from "@/types/coupons";

type Language = "th" | "en" | "zh";
type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type ViewMode = "create" | "campaigns" | "detail";

const text = {
  th: {
    title: "จัดการคูปอง",
    subtitle: "สร้างคูปองครั้งเดียวและกระจายไปยัง LINE OA ของร้านที่เลือก",
    create: "สร้างคูปอง",
    campaigns: "ประวัติคูปอง",
    couponInfo: "ข้อมูลคูปอง",
    benefit: "สิทธิประโยชน์",
    validity: "ระยะเวลาใช้งาน",
    stores: "ร้านค้า",
    titleLabel: "ชื่อคูปอง",
    description: "รายละเอียด",
    rewardType: "ประเภทสิทธิประโยชน์",
    amount: "มูลค่า",
    percentage: "เปอร์เซ็นต์",
    fixed: "ส่วนลดจำนวนเงิน",
    percent: "ส่วนลดเปอร์เซ็นต์",
    start: "เริ่มใช้งาน",
    end: "สิ้นสุด",
    visibility: "การมองเห็น",
    public: "สาธารณะ",
    unlisted: "เฉพาะลิงก์/ข้อความ",
    usageCondition: "เงื่อนไขการใช้",
    couponCode: "รหัสคูปอง (ไม่บังคับ)",
    imageUrl: "URL รูปคูปอง (HTTPS)",
    allStores: "ทุกร้าน",
    selectedStores: "เลือกร้าน",
    searchStore: "ค้นหาร้านค้า",
    preview: "ตรวจสอบก่อนสร้าง",
    previewing: "กำลังตรวจสอบ...",
    createNow: "สร้างคูปอง",
    creating: "กำลังสร้าง...",
    eligible: "พร้อมสร้าง",
    skipped: "ข้าม",
    total: "ทั้งหมด",
    noCampaigns: "ยังไม่มีคูปองที่สร้างจากระบบนี้",
    retry: "ลองร้านที่ล้มเหลวอีกครั้ง",
    discontinue: "ยกเลิกคูปองทุกสาขา",
    back: "กลับ",
    store: "ร้าน",
    lineOa: "LINE OA",
    status: "สถานะ",
    couponId: "Coupon ID",
    error: "ข้อผิดพลาด",
    refresh: "รีเฟรช",
    previewRequired: "ต้องตรวจสอบ Preview ล่าสุดก่อนสร้าง",
    adminOnly: "เมนูนี้ใช้งานได้เฉพาะผู้ดูแลระบบ",
  },
  en: {
    title: "Coupon Management",
    subtitle: "Create once and distribute the same coupon configuration across store LINE OAs.",
    create: "Create Coupon",
    campaigns: "Campaign History",
    couponInfo: "Coupon information",
    benefit: "Benefit",
    validity: "Validity",
    stores: "Stores",
    titleLabel: "Coupon title",
    description: "Description",
    rewardType: "Reward type",
    amount: "Amount",
    percentage: "Percentage",
    fixed: "Fixed discount",
    percent: "Percentage discount",
    start: "Start",
    end: "End",
    visibility: "Visibility",
    public: "Public",
    unlisted: "Unlisted",
    usageCondition: "Usage condition",
    couponCode: "Coupon code (optional)",
    imageUrl: "Coupon image URL (HTTPS)",
    allStores: "All Stores",
    selectedStores: "Select Stores",
    searchStore: "Search stores",
    preview: "Preview before create",
    previewing: "Previewing...",
    createNow: "Create Coupon",
    creating: "Creating...",
    eligible: "Eligible",
    skipped: "Skipped",
    total: "Total",
    noCampaigns: "No coupon campaigns created from this system yet.",
    retry: "Retry failed stores",
    discontinue: "Discontinue all store coupons",
    back: "Back",
    store: "Store",
    lineOa: "LINE OA",
    status: "Status",
    couponId: "Coupon ID",
    error: "Error",
    refresh: "Refresh",
    previewRequired: "Run a fresh preview before creating.",
    adminOnly: "This tool is available to administrators only.",
  },
  zh: {
    title: "优惠券管理",
    subtitle: "一次创建，并将相同优惠券配置分发到所选门店的 LINE OA。",
    create: "创建优惠券",
    campaigns: "优惠券记录",
    couponInfo: "优惠券信息",
    benefit: "优惠内容",
    validity: "有效期",
    stores: "门店",
    titleLabel: "优惠券名称",
    description: "说明",
    rewardType: "优惠类型",
    amount: "金额",
    percentage: "百分比",
    fixed: "固定金额折扣",
    percent: "百分比折扣",
    start: "开始",
    end: "结束",
    visibility: "可见性",
    public: "公开",
    unlisted: "非公开",
    usageCondition: "使用条件",
    couponCode: "优惠码（可选）",
    imageUrl: "优惠券图片 URL (HTTPS)",
    allStores: "所有门店",
    selectedStores: "选择门店",
    searchStore: "搜索门店",
    preview: "创建前预览",
    previewing: "正在检查...",
    createNow: "创建优惠券",
    creating: "正在创建...",
    eligible: "可创建",
    skipped: "跳过",
    total: "总数",
    noCampaigns: "尚未通过本系统创建优惠券。",
    retry: "重试失败门店",
    discontinue: "停用所有门店优惠券",
    back: "返回",
    store: "门店",
    lineOa: "LINE OA",
    status: "状态",
    couponId: "Coupon ID",
    error: "错误",
    refresh: "刷新",
    previewRequired: "创建前必须重新运行预览。",
    adminOnly: "此功能仅限管理员使用。",
  },
} as const;

function bangkokTimestamp(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute] = match;
  return Math.floor((Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 7, Number(minute))) / 1000);
}

function localInputValue(offsetHours: number): string {
  const bangkokNow = new Date(Date.now() + 7 * 60 * 60 * 1000 + offsetHours * 60 * 60 * 1000);
  return bangkokNow.toISOString().slice(0, 16);
}

function statusBadge(status: string): string {
  if (["SUCCESS", "DISCONTINUED"].includes(status)) return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
  if (["FAILED", "DISCONTINUE_FAILED"].includes(status)) return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
  if (["PARTIAL", "PARTIAL_DISCONTINUE"].includes(status)) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800";
}

export function CouponManagementView() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [language, setLanguage] = useState<Language>("th");
  const [viewMode, setViewMode] = useState<ViewMode>("create");
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [storeSearch, setStoreSearch] = useState("");
  const [storeMode, setStoreMode] = useState<CouponStoreMode>("ALL");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [couponTitle, setCouponTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardType, setRewardType] = useState<CouponRewardType>("discount");
  const [priceType, setPriceType] = useState<CouponPriceType>("fixed");
  const [rewardValue, setRewardValue] = useState("500");
  const [startAt, setStartAt] = useState(() => localInputValue(1));
  const [endAt, setEndAt] = useState(() => localInputValue(24 * 7));
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED">("UNLISTED");
  const [usageCondition, setUsageCondition] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState<CouponPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [campaigns, setCampaigns] = useState<CouponCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [detail, setDetail] = useState<CouponCampaignDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = text[language];
  const isAdmin = authUser?.role === "ADMIN";

  useEffect(() => {
    let active = true;
    api.me()
      .then((user) => {
        if (active) setAuthUser(user);
      })
      .catch(() => {
        if (typeof window !== "undefined") window.location.replace("/login");
      })
      .finally(() => {
        if (active) setAuthChecked(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    api.stores()
      .then((items) => { if (active) setStores(items ?? []); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Unable to load stores"); });
    return () => { active = false; };
  }, [isAdmin]);

  const invalidatePreview = useCallback(() => setPreview(null), []);

  const filteredStores = useMemo(() => {
    const query = storeSearch.trim().toLowerCase();
    if (!query) return stores;
    return stores.filter((store) =>
      store.name.toLowerCase().includes(query) ||
      store.code?.toLowerCase().includes(query) ||
      store.storeId?.toLowerCase().includes(query),
    );
  }, [stores, storeSearch]);

  const buildInput = useCallback((): CouponInput => {
    const numericValue = Number(rewardValue);
    const reward = rewardType === "discount" || rewardType === "cashBack"
      ? priceType === "fixed"
        ? { type: rewardType, priceInfo: { type: "fixed" as const, fixedAmount: numericValue } }
        : { type: rewardType, priceInfo: { type: "percentage" as const, percentage: numericValue } }
      : { type: rewardType };

    return {
      coupon: {
        title: couponTitle.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        reward,
        acquisitionCondition: { type: "normal" },
        startTimestamp: bangkokTimestamp(startAt),
        endTimestamp: bangkokTimestamp(endAt),
        timezone: "ASIA_BANGKOK",
        visibility,
        maxUseCountPerTicket: 1,
        ...(usageCondition.trim() ? { usageCondition: usageCondition.trim() } : {}),
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      },
      storeSelection: {
        mode: storeMode,
        ...(storeMode === "SELECTED" ? { storeIds: selectedStoreIds } : {}),
      },
    };
  }, [couponCode, couponTitle, description, endAt, imageUrl, priceType, rewardType, rewardValue, selectedStoreIds, startAt, storeMode, usageCondition, visibility]);

  const runPreview = async () => {
    setPreviewLoading(true);
    setError(null);
    try {
      setPreview(await couponApi.preview(buildInput()));
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const createCoupon = async () => {
    if (!preview || preview.eligibleStores < 1) {
      setError(t.previewRequired);
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(`${t.createNow}: ${couponTitle}\n${preview.eligibleStores} ${t.stores}`)) return;
    setCreating(true);
    setError(null);
    try {
      const result = await couponApi.create(buildInput());
      setDetail(result);
      setViewMode("detail");
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coupon creation failed");
    } finally {
      setCreating(false);
    }
  };

  const loadCampaigns = useCallback(async () => {
    if (!isAdmin) return;
    setCampaignsLoading(true);
    setError(null);
    try {
      const result = await couponApi.list(50, 0);
      setCampaigns(result.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load coupon history");
    } finally {
      setCampaignsLoading(false);
    }
  }, [isAdmin]);

  const openCampaign = async (id: string) => {
    setActionLoading(true);
    setError(null);
    try {
      setDetail(await couponApi.detail(id));
      setViewMode("detail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load coupon campaign");
    } finally {
      setActionLoading(false);
    }
  };

  const retryFailed = async () => {
    if (!detail) return;
    setActionLoading(true);
    setError(null);
    try {
      setDetail(await couponApi.retryFailed(detail.campaign.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setActionLoading(false);
    }
  };

  const discontinue = async () => {
    if (!detail) return;
    if (typeof window !== "undefined" && !window.confirm(`${t.discontinue}?\n${detail.campaign.title}`)) return;
    setActionLoading(true);
    setError(null);
    try {
      setDetail(await couponApi.discontinue(detail.campaign.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discontinue failed");
    } finally {
      setActionLoading(false);
    }
  };

  const logout = async () => {
    try { await api.logout(); } finally { window.location.replace("/login"); }
  };

  if (!authChecked) {
    return <main className="app-shell flex min-h-screen items-center justify-center"><p className="app-muted text-sm">Loading…</p></main>;
  }
  if (!authUser) return null;

  return (
    <AppShell
      currentSection="coupons"
      authUser={authUser}
      text={{ appName: "OPPO LINE OA Monitor", appDescription: "LINE OA monitoring", dashboard: language === "th" ? "แดชบอร์ด" : "Dashboard", language: language === "th" ? "ภาษา" : "Language", searchPlaceholder: language === "th" ? "ค้นหา" : "Search" }}
      language={language}
      changeLanguage={setLanguage}
      searchText=""
      setSearchText={() => undefined}
      logout={logout}
    >
      <PageContainer variant="full">
        <section className="app-content-section col-span-2 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{t.title}</h2>
                <p className="app-muted mt-1 text-sm">{t.subtitle}</p>
              </div>
              {isAdmin && (
                <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 p-1">
                  <button type="button" onClick={() => setViewMode("create")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${viewMode === "create" ? "bg-slate-900 text-white dark:bg-emerald-600" : "app-muted"}`}>{t.create}</button>
                  <button type="button" onClick={() => { setViewMode("campaigns"); void loadCampaigns(); }} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${viewMode === "campaigns" ? "bg-slate-900 text-white dark:bg-emerald-600" : "app-muted"}`}>{t.campaigns}</button>
                </div>
              )}
            </div>

            {error && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}

            {!isAdmin ? (
              <div className="app-surface mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm app-muted">{t.adminOnly}</div>
            ) : viewMode === "create" ? (
              <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
                <div className="space-y-5">
                  <section className="app-surface rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <h3 className="font-semibold">{t.couponInfo}</h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-medium sm:col-span-2">{t.titleLabel}<input value={couponTitle} maxLength={60} onChange={(e) => { setCouponTitle(e.target.value); invalidatePreview(); }} className="app-input mt-1.5 w-full rounded-lg border px-3 py-2" /></label>
                      <label className="text-sm font-medium sm:col-span-2">{t.description}<textarea value={description} maxLength={1000} onChange={(e) => { setDescription(e.target.value); invalidatePreview(); }} rows={3} className="app-input mt-1.5 w-full rounded-lg border px-3 py-2" /></label>
                      <label className="text-sm font-medium">{t.imageUrl}<input value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); invalidatePreview(); }} placeholder="https://…" className="app-input mt-1.5 w-full rounded-lg border px-3 py-2" /></label>
                      <label className="text-sm font-medium">{t.couponCode}<input value={couponCode} maxLength={16} onChange={(e) => { setCouponCode(e.target.value); invalidatePreview(); }} className="app-input mt-1.5 w-full rounded-lg border px-3 py-2" /></label>
                      <label className="text-sm font-medium sm:col-span-2">{t.usageCondition}<input value={usageCondition} maxLength={100} onChange={(e) => { setUsageCondition(e.target.value); invalidatePreview(); }} className="app-input mt-1.5 w-full rounded-lg border px-3 py-2" /></label>
                    </div>
                  </section>

                  <section className="app-surface rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <h3 className="font-semibold">{t.benefit}</h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <label className="text-sm font-medium">{t.rewardType}<select value={rewardType} onChange={(e) => { setRewardType(e.target.value as CouponRewardType); invalidatePreview(); }} className="app-input mt-1.5 w-full rounded-lg border px-3 py-2"><option value="discount">Discount</option><option value="gift">Gift</option><option value="free">Free</option><option value="cashBack">Cashback</option><option value="others">Other</option></select></label>
                      {(rewardType === "discount" || rewardType === "cashBack") && <label className="text-sm font-medium">{priceType === "fixed" ? t.amount : t.percentage}<select value={priceType} onChange={(e) => { setPriceType(e.target.value as CouponPriceType); invalidatePreview(); }} className="app-input mt-1.5 w-full rounded-lg border px-3 py-2"><option value="fixed">{t.fixed}</option><option value="percentage">{t.percent}</option></select></label>}
                      {(rewardType === "discount" || rewardType === "cashBack") && <label className="text-sm font-medium">{priceType === "fixed" ? "THB" : "%"}<input type="number" min="1" max={priceType === "percentage" ? 99 : undefined} value={rewardValue} onChange={(e) => { setRewardValue(e.target.value); invalidatePreview(); }} className="app-input mt-1.5 w-full rounded-lg border px-3 py-2" /></label>}
                    </div>
                  </section>

                  <section className="app-surface rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <h3 className="font-semibold">{t.validity}</h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <label className="text-sm font-medium">{t.start}<input type="datetime-local" value={startAt} onChange={(e) => { setStartAt(e.target.value); invalidatePreview(); }} className="app-input mt-1.5 w-full rounded-lg border px-3 py-2" /></label>
                      <label className="text-sm font-medium">{t.end}<input type="datetime-local" value={endAt} onChange={(e) => { setEndAt(e.target.value); invalidatePreview(); }} className="app-input mt-1.5 w-full rounded-lg border px-3 py-2" /></label>
                      <label className="text-sm font-medium">{t.visibility}<select value={visibility} onChange={(e) => { setVisibility(e.target.value as "PUBLIC" | "UNLISTED"); invalidatePreview(); }} className="app-input mt-1.5 w-full rounded-lg border px-3 py-2"><option value="UNLISTED">{t.unlisted}</option><option value="PUBLIC">{t.public}</option></select></label>
                    </div>
                    <p className="app-muted mt-2 text-xs">Asia/Bangkok (UTC+7)</p>
                  </section>

                  <section className="app-surface rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{t.stores}</h3><span className="app-muted text-xs">{storeMode === "ALL" ? stores.length : selectedStoreIds.length} selected</span></div>
                    <div className="mt-4 flex gap-2"><button type="button" onClick={() => { setStoreMode("ALL"); invalidatePreview(); }} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${storeMode === "ALL" ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-800"}`}>{t.allStores}</button><button type="button" onClick={() => { setStoreMode("SELECTED"); invalidatePreview(); }} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${storeMode === "SELECTED" ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-800"}`}>{t.selectedStores}</button></div>
                    {storeMode === "SELECTED" && <div className="mt-4"><input type="search" value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} placeholder={t.searchStore} className="app-input w-full rounded-lg border px-3 py-2" /><div className="mt-2 flex gap-2 text-xs"><button type="button" onClick={() => { setSelectedStoreIds(filteredStores.map((s) => s.id)); invalidatePreview(); }} className="font-semibold text-emerald-700">Select visible</button><button type="button" onClick={() => { setSelectedStoreIds([]); invalidatePreview(); }} className="font-semibold text-rose-600">Clear</button></div><div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">{filteredStores.map((store) => <label key={store.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0 dark:border-slate-900"><input type="checkbox" checked={selectedStoreIds.includes(store.id)} onChange={() => { setSelectedStoreIds((current) => current.includes(store.id) ? current.filter((id) => id !== store.id) : [...current, store.id]); invalidatePreview(); }} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{store.name}</span><span className="app-muted text-xs">{store.code ?? store.storeId ?? "—"}</span></span></label>)}</div></div>}
                  </section>
                </div>

                <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
                  <section className="app-surface rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                    <h3 className="font-semibold">Preview</h3>
                    {preview ? <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-100 p-3 text-center dark:bg-slate-900"><div className="text-xl font-bold">{preview.totalStores}</div><div className="app-muted text-xs">{t.total}</div></div><div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-950/30"><div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{preview.eligibleStores}</div><div className="text-xs text-emerald-700 dark:text-emerald-300">{t.eligible}</div></div><div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-950/30"><div className="text-xl font-bold text-amber-700 dark:text-amber-300">{preview.skippedStores}</div><div className="text-xs text-amber-700 dark:text-amber-300">{t.skipped}</div></div></div> : <p className="app-muted mt-3 text-sm">{t.previewRequired}</p>}
                    {preview && Object.keys(preview.skipReasons).length > 0 && <div className="mt-3 space-y-1 text-xs">{Object.entries(preview.skipReasons).map(([reason, count]) => <div key={reason} className="flex justify-between"><span className="app-muted">{reason}</span><span className="font-semibold">{count}</span></div>)}</div>}
                    <button type="button" disabled={previewLoading || creating} onClick={() => void runPreview()} className="mt-5 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900">{previewLoading ? t.previewing : t.preview}</button>
                    <button type="button" disabled={!preview || preview.eligibleStores < 1 || creating || previewLoading} onClick={() => void createCoupon()} className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">{creating ? t.creating : t.createNow}</button>
                  </section>
                  {preview && <section className="app-surface rounded-2xl border border-slate-200 dark:border-slate-800 p-4"><h4 className="text-sm font-semibold">Store readiness</h4><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{preview.stores.map((store) => <div key={store.storeId} className="flex items-start justify-between gap-3 text-xs"><div className="min-w-0"><div className="truncate font-medium">{store.storeName}</div><div className="app-muted truncate">{store.lineOaName ?? "No LINE OA"}</div></div><span className={store.isEligible ? "text-emerald-600" : "text-amber-600"}>{store.isEligible ? "Ready" : store.skipReason}</span></div>)}</div></section>}
                </aside>
              </div>
            ) : viewMode === "campaigns" ? (
              <section className="app-surface mt-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800"><h3 className="font-semibold">{t.campaigns}</h3><button type="button" onClick={() => void loadCampaigns()} className="text-sm font-semibold text-emerald-700">{t.refresh}</button></div>
                {campaignsLoading ? <p className="app-muted p-6 text-sm">Loading…</p> : campaigns.length === 0 ? <p className="app-muted p-8 text-center text-sm">{t.noCampaigns}</p> : <div className="divide-y divide-slate-100 dark:divide-slate-900">{campaigns.map((campaign) => <button key={campaign.id} type="button" onClick={() => void openCampaign(campaign.id)} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-900/60"><div><div className="font-semibold">{campaign.title}</div><div className="app-muted mt-1 text-xs">{new Date(campaign.createdAt).toLocaleString()} · {campaign.id.slice(0, 8)}</div></div><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge(campaign.status)}`}>{campaign.status}</span></button>)}</div>}
              </section>
            ) : detail ? (
              <div className="mt-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => { setViewMode("campaigns"); void loadCampaigns(); }} className="text-sm font-semibold text-emerald-700">← {t.back}</button><div className="flex gap-2"><button type="button" disabled={actionLoading || !(detail.summary.FAILED > 0)} onClick={() => void retryFailed()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-slate-700">{t.retry}</button><button type="button" disabled={actionLoading || detail.campaign.status === "DISCONTINUED"} onClick={() => void discontinue()} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300">{t.discontinue}</button></div></div>
                <section className="app-surface rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-xl font-bold">{detail.campaign.title}</h3><p className="app-muted mt-1 text-sm">{detail.campaign.description ?? "—"}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge(detail.campaign.status)}`}>{detail.campaign.status}</span></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(detail.summary).map(([key, value]) => <div key={key} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-900"><div className="text-lg font-bold">{value}</div><div className="app-muted text-xs">{key}</div></div>)}</div></section>
                <section className="app-surface overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase app-muted dark:bg-slate-900"><tr><th className="px-4 py-3">{t.store}</th><th className="px-4 py-3">{t.lineOa}</th><th className="px-4 py-3">{t.status}</th><th className="px-4 py-3">{t.couponId}</th><th className="px-4 py-3">{t.error}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-900">{detail.stores.map((store) => <tr key={store.id}><td className="px-4 py-3 font-medium">{store.storeName}</td><td className="px-4 py-3 app-muted">{store.lineOaName ?? "—"}</td><td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusBadge(store.status)}`}>{store.status}</span></td><td className="px-4 py-3 font-mono text-xs">{store.lineCouponId ?? "—"}</td><td className="max-w-xs px-4 py-3 text-xs text-rose-600">{store.errorMessage ?? store.skipReason ?? "—"}</td></tr>)}</tbody></table></div></section>
              </div>
            ) : null}
          </div>
        </section>
      </PageContainer>
    </AppShell>
  );
}
