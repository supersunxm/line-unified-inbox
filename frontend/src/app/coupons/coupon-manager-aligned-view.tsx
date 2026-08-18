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
  CouponPayload,
  CouponPreview,
  CouponPriceType,
  CouponRewardType,
  CouponStoreMode,
} from "@/types/coupons";

type Language = "th" | "en" | "zh";
type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type ViewMode = "create" | "campaigns" | "detail";
type ExecutionMode = "pilot" | "full";
type AcquisitionType = "normal" | "lottery";

type UploadImageResult = { url: string; previewUrl?: string };

const DEFAULT_GUIDELINES = `- To redeem your coupon, present this screen at checkout.\n- Redeemable once only, even if previously redeemed only unintentionally by the customer.\n- The validity period of this coupon may change or it may be canceled without notice.`;

const copy = {
  th: {
    title: "Coupon",
    subtitle: "ตั้งค่าให้สอดคล้องกับ LINE Official Account Manager และสร้างพร้อมกันผ่าน Messaging API",
    createTab: "สร้างคูปอง",
    historyTab: "ประวัติคูปอง",
    mainSettings: "การตั้งค่าหลัก",
    couponConditions: "เงื่อนไขการรับคูปอง",
    noConditions: "ไม่มีเงื่อนไข",
    lottery: "จับรางวัล",
    friendReferral: "แนะนำเพื่อน",
    managerOnly: "ใช้ได้เฉพาะ LINE OA Manager",
    titleLabel: "ชื่อคูปอง",
    couponSettings: "การตั้งค่าคูปอง",
    validity: "ระยะเวลาใช้งาน",
    from: "จาก",
    till: "ถึง",
    timezone: "เขตเวลา",
    image: "รูปภาพ",
    uploadImage: "อัปโหลดรูป",
    uploading: "กำลังอัปโหลด...",
    imageHint: "JPG / JPEG / PNG สูงสุด 10 MB (แนะนำไม่เกิน 1 MB)",
    guidelines: "คำแนะนำการใช้คูปอง",
    lyServices: "แสดงคูปองในบริการ LY",
    dontInclude: "ไม่แสดงคูปอง",
    include: "แสดงคูปอง",
    usageLimit: "จำนวนครั้งที่ใช้ได้",
    onlyOnce: "ใช้ได้ครั้งเดียว",
    noLimit: "ไม่จำกัด",
    couponCode: "รหัสคูปอง",
    dontShow: "ไม่แสดง",
    show: "แสดง",
    couponType: "ประเภทคูปอง",
    discount: "ส่วนลด",
    free: "ฟรี",
    gift: "ของขวัญ",
    cashback: "เงินคืน",
    others: "อื่น ๆ",
    thbDiscount: "ส่วนลด THB",
    percentDiscount: "% ส่วนลด",
    strikethrough: "ราคาเดิมขีดฆ่า",
    beforeDiscount: "ราคาก่อนลด",
    afterDiscount: "ราคาหลังลด",
    conditionsUse: "เงื่อนไขการใช้",
    stores: "ร้านค้า",
    allStores: "ทุกร้าน",
    selectedStores: "เลือกร้าน",
    searchStore: "ค้นหาร้าน",
    selectVisible: "เลือกที่มองเห็น",
    clear: "ล้าง",
    pilotNotice: "Pilot mode: สร้างได้ครั้งละ 1 ร้านเท่านั้น",
    fullNotice: "Full mode: สามารถสร้างหลายร้านหรือทุกร้านได้",
    preview: "ตรวจสอบก่อนสร้าง",
    previewing: "กำลังตรวจสอบ...",
    save: "บันทึก / สร้างคูปอง",
    saving: "กำลังสร้าง...",
    saveDraft: "บันทึกร่าง",
    draftUnavailable: "Messaging API ไม่รองรับ Draft",
    ready: "พร้อมสร้าง",
    skipped: "ข้าม",
    total: "ทั้งหมด",
    storeReadiness: "ความพร้อมของร้าน",
    previewRequired: "ต้อง Preview ล่าสุดก่อนสร้าง",
    campaigns: "ประวัติคูปอง",
    noCampaigns: "ยังไม่มีคูปองที่สร้างจากระบบนี้",
    back: "กลับ",
    retry: "ลองร้านที่ล้มเหลวอีกครั้ง",
    discontinue: "ยกเลิกคูปอง",
    adminOnly: "เมนูนี้ใช้งานได้เฉพาะผู้ดูแลระบบ",
    probability: "โอกาสชนะ (%)",
    winnerLimit: "จำนวนผู้ชนะสูงสุด",
    unlimitedWinners: "ไม่จำกัด (-1)",
  },
  en: {
    title: "Coupon",
    subtitle: "Settings aligned with LINE Official Account Manager and created through the Messaging API.",
    createTab: "Create coupon",
    historyTab: "Coupon history",
    mainSettings: "Main settings",
    couponConditions: "Coupon conditions",
    noConditions: "No conditions applied",
    lottery: "Lottery",
    friendReferral: "Friend referral",
    managerOnly: "LINE OA Manager only",
    titleLabel: "Title",
    couponSettings: "Coupon settings",
    validity: "Validity period",
    from: "From",
    till: "Till",
    timezone: "Time zone",
    image: "Image",
    uploadImage: "Upload image",
    uploading: "Uploading...",
    imageHint: "JPG / JPEG / PNG up to 10 MB (1 MB or less recommended)",
    guidelines: "Coupon guidelines",
    lyServices: "Display coupon in LY services",
    dontInclude: "Don't include coupon",
    include: "Include coupon",
    usageLimit: "Usage limit",
    onlyOnce: "Only once",
    noLimit: "No limit",
    couponCode: "Coupon code",
    dontShow: "Don't show",
    show: "Show",
    couponType: "Coupon type",
    discount: "Discount",
    free: "Free",
    gift: "Gift",
    cashback: "Cashback",
    others: "Others",
    thbDiscount: "THB discount",
    percentDiscount: "% discount",
    strikethrough: "Strikethrough",
    beforeDiscount: "Before discount",
    afterDiscount: "After discount",
    conditionsUse: "Conditions for use",
    stores: "Stores",
    allStores: "All Stores",
    selectedStores: "Select Stores",
    searchStore: "Search stores",
    selectVisible: "Select visible",
    clear: "Clear",
    pilotNotice: "Pilot mode: exactly one store per campaign",
    fullNotice: "Full mode: multiple stores and All Stores are enabled",
    preview: "Preview before create",
    previewing: "Previewing...",
    save: "Save / Create coupon",
    saving: "Creating...",
    saveDraft: "Save draft",
    draftUnavailable: "Drafts aren't supported by the Messaging API",
    ready: "Ready",
    skipped: "Skipped",
    total: "Total",
    storeReadiness: "Store readiness",
    previewRequired: "Run a fresh preview before creating",
    campaigns: "Coupon history",
    noCampaigns: "No coupon campaigns created from this system yet.",
    back: "Back",
    retry: "Retry failed stores",
    discontinue: "Discontinue coupon",
    adminOnly: "This tool is available to administrators only.",
    probability: "Winning probability (%)",
    winnerLimit: "Maximum winners",
    unlimitedWinners: "Unlimited (-1)",
  },
  zh: {
    title: "优惠券",
    subtitle: "设置与 LINE Official Account Manager 对齐，并通过 Messaging API 创建。",
    createTab: "创建优惠券",
    historyTab: "优惠券记录",
    mainSettings: "主要设置",
    couponConditions: "领取条件",
    noConditions: "无条件",
    lottery: "抽奖",
    friendReferral: "好友推荐",
    managerOnly: "仅 LINE OA Manager",
    titleLabel: "标题",
    couponSettings: "优惠券设置",
    validity: "有效期",
    from: "开始",
    till: "结束",
    timezone: "时区",
    image: "图片",
    uploadImage: "上传图片",
    uploading: "上传中...",
    imageHint: "JPG / JPEG / PNG，最大 10 MB（建议不超过 1 MB）",
    guidelines: "优惠券说明",
    lyServices: "在 LY 服务中显示",
    dontInclude: "不显示",
    include: "显示",
    usageLimit: "使用次数",
    onlyOnce: "仅一次",
    noLimit: "不限",
    couponCode: "优惠码",
    dontShow: "不显示",
    show: "显示",
    couponType: "优惠券类型",
    discount: "折扣",
    free: "免费",
    gift: "礼品",
    cashback: "返现",
    others: "其他",
    thbDiscount: "THB 折扣",
    percentDiscount: "% 折扣",
    strikethrough: "划线价",
    beforeDiscount: "原价",
    afterDiscount: "折后价",
    conditionsUse: "使用条件",
    stores: "门店",
    allStores: "所有门店",
    selectedStores: "选择门店",
    searchStore: "搜索门店",
    selectVisible: "选择当前结果",
    clear: "清除",
    pilotNotice: "Pilot 模式：每次只能选择 1 家门店",
    fullNotice: "Full 模式：可选择多家或所有门店",
    preview: "创建前预览",
    previewing: "检查中...",
    save: "保存 / 创建优惠券",
    saving: "创建中...",
    saveDraft: "保存草稿",
    draftUnavailable: "Messaging API 不支持草稿",
    ready: "可创建",
    skipped: "跳过",
    total: "总数",
    storeReadiness: "门店准备情况",
    previewRequired: "创建前必须重新预览",
    campaigns: "优惠券记录",
    noCampaigns: "尚未通过本系统创建优惠券。",
    back: "返回",
    retry: "重试失败门店",
    discontinue: "停用优惠券",
    adminOnly: "此功能仅限管理员使用。",
    probability: "中奖概率 (%)",
    winnerLimit: "最多中奖人数",
    unlimitedWinners: "不限 (-1)",
  },
} as const;

function bangkokTimestamp(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute] = match;
  return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 7, Number(minute)) / 1000);
}

function localInputValue(offsetHours: number): string {
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000 + offsetHours * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

function badge(status: string): string {
  if (["SUCCESS", "DISCONTINUED"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (["FAILED", "DISCONTINUE_FAILED"].includes(status)) return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300";
  if (["PARTIAL", "PARTIAL_DISCONTINUE"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
}

export function CouponManagerAlignedView() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [language, setLanguage] = useState<Language>("th");
  const [viewMode, setViewMode] = useState<ViewMode>("create");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("pilot");
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [storeSearch, setStoreSearch] = useState("");
  const [storeMode, setStoreMode] = useState<CouponStoreMode>("SELECTED");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [acquisitionType, setAcquisitionType] = useState<AcquisitionType>("normal");
  const [lotteryProbability, setLotteryProbability] = useState("50");
  const [maxAcquireCount, setMaxAcquireCount] = useState("-1");
  const [couponTitle, setCouponTitle] = useState("");
  const [startAt, setStartAt] = useState(() => localInputValue(1));
  const [endAt, setEndAt] = useState(() => localInputValue(24 * 7));
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [guidelines, setGuidelines] = useState(DEFAULT_GUIDELINES);
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED">("UNLISTED");
  const [maxUseCount, setMaxUseCount] = useState<1 | -1>(1);
  const [showCouponCode, setShowCouponCode] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [rewardType, setRewardType] = useState<CouponRewardType>("discount");
  const [priceType, setPriceType] = useState<CouponPriceType>("fixed");
  const [fixedAmount, setFixedAmount] = useState("100");
  const [percentage, setPercentage] = useState("10");
  const [originalPrice, setOriginalPrice] = useState("1200");
  const [discountedPrice, setDiscountedPrice] = useState("1000");
  const [usageCondition, setUsageCondition] = useState("");
  const [preview, setPreview] = useState<CouponPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [campaigns, setCampaigns] = useState<CouponCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [detail, setDetail] = useState<CouponCampaignDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = copy[language];
  const isAdmin = authUser?.role === "ADMIN";
  const pilot = executionMode === "pilot";
  const invalidatePreview = useCallback(() => setPreview(null), []);

  useEffect(() => {
    let active = true;
    api.me()
      .then((user) => { if (active) setAuthUser(user); })
      .catch(() => { if (typeof window !== "undefined") window.location.replace("/login"); })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    Promise.all([
      api.stores(),
      fetch("/api-backend/coupons/execution-mode", { credentials: "include" }).then(async (response) => {
        if (!response.ok) throw new Error("Unable to load coupon execution mode");
        return response.json() as Promise<{ mode: ExecutionMode }>;
      }),
    ])
      .then(([items, mode]) => {
        if (!active) return;
        setStores(items ?? []);
        setExecutionMode(mode.mode);
        if (mode.mode === "pilot") setStoreMode("SELECTED");
      })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Unable to load coupon settings"); });
    return () => { active = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (rewardType === "cashBack" && priceType === "explicit") setPriceType("fixed");
  }, [priceType, rewardType]);

  const filteredStores = useMemo(() => {
    const query = storeSearch.trim().toLowerCase();
    if (!query) return stores;
    return stores.filter((store) =>
      store.name.toLowerCase().includes(query) ||
      store.code?.toLowerCase().includes(query) ||
      store.storeId?.toLowerCase().includes(query),
    );
  }, [stores, storeSearch]);

  const toggleStore = (storeId: string) => {
    setSelectedStoreIds((current) => {
      if (pilot) return current.includes(storeId) ? [] : [storeId];
      return current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId];
    });
    invalidatePreview();
  };

  const buildReward = (): CouponPayload["reward"] => {
    if (rewardType === "free" || rewardType === "gift" || rewardType === "others") return { type: rewardType };
    if (priceType === "percentage") {
      return { type: rewardType, priceInfo: { type: "percentage", percentage: Number(percentage) } };
    }
    if (priceType === "explicit" && rewardType === "discount") {
      return {
        type: "discount",
        priceInfo: { type: "explicit", originalPrice: Number(originalPrice), priceAfterDiscount: Number(discountedPrice) },
      };
    }
    return { type: rewardType, priceInfo: { type: "fixed", fixedAmount: Number(fixedAmount) } };
  };

  const buildInput = useCallback((): CouponInput => {
    const acquisitionCondition: CouponPayload["acquisitionCondition"] = acquisitionType === "lottery"
      ? { type: "lottery", lotteryProbability: Number(lotteryProbability), maxAcquireCount: Number(maxAcquireCount) }
      : { type: "normal" };
    return {
      coupon: {
        title: couponTitle.trim(),
        ...(guidelines.trim() ? { description: guidelines.trim() } : {}),
        reward: buildReward(),
        acquisitionCondition,
        startTimestamp: bangkokTimestamp(startAt),
        endTimestamp: bangkokTimestamp(endAt),
        timezone: "ASIA_BANGKOK",
        visibility,
        maxUseCountPerTicket: maxUseCount,
        ...(imageUrl ? { imageUrl } : {}),
        ...(showCouponCode && couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
        ...(usageCondition.trim() ? { usageCondition: usageCondition.trim() } : {}),
      },
      storeSelection: {
        mode: storeMode,
        ...(storeMode === "SELECTED" ? { storeIds: selectedStoreIds } : {}),
      },
    };
  }, [acquisitionType, couponCode, couponTitle, discountedPrice, endAt, fixedAmount, guidelines, imageUrl, lotteryProbability, maxAcquireCount, maxUseCount, originalPrice, percentage, priceType, rewardType, selectedStoreIds, showCouponCode, startAt, storeMode, usageCondition, visibility]);

  const uploadImage = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError("Image exceeds the 10 MB limit");
      return;
    }
    setImageUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api-backend/mass-messages/upload-image", {
        method: "POST",
        credentials: "include",
        body,
      });
      const result = (await response.json()) as UploadImageResult & { message?: string };
      if (!response.ok || !result.url) throw new Error(result.message ?? "Image upload failed");
      setImageUrl(result.url);
      invalidatePreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setImageUploading(false);
    }
  };

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
    if (typeof window !== "undefined" && !window.confirm(`${t.save}: ${couponTitle}\n${preview.eligibleStores} ${t.stores}`)) return;
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
    try { setDetail(await couponApi.retryFailed(detail.campaign.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Retry failed"); }
    finally { setActionLoading(false); }
  };

  const discontinue = async () => {
    if (!detail) return;
    if (typeof window !== "undefined" && !window.confirm(`${t.discontinue}?\n${detail.campaign.title}`)) return;
    setActionLoading(true);
    setError(null);
    try { setDetail(await couponApi.discontinue(detail.campaign.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Discontinue failed"); }
    finally { setActionLoading(false); }
  };

  const logout = async () => {
    try { await api.logout(); } finally { window.location.replace("/login"); }
  };

  if (!authChecked) return <main className="app-shell flex min-h-screen items-center justify-center"><p className="app-muted text-sm">Loading…</p></main>;
  if (!authUser) return null;

  const radioClass = "h-4 w-4 accent-emerald-600";
  const fieldClass = "app-input mt-1.5 w-full rounded-lg border px-3 py-2";

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
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{t.title}</h2>
                <p className="app-muted mt-1 text-sm">{t.subtitle}</p>
              </div>
              {isAdmin && <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-800">
                <button type="button" onClick={() => setViewMode("create")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${viewMode === "create" ? "bg-slate-900 text-white dark:bg-emerald-600" : "app-muted"}`}>{t.createTab}</button>
                <button type="button" onClick={() => { setViewMode("campaigns"); void loadCampaigns(); }} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${viewMode === "campaigns" ? "bg-slate-900 text-white dark:bg-emerald-600" : "app-muted"}`}>{t.historyTab}</button>
              </div>}
            </div>

            {error && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}

            {!isAdmin ? <div className="app-surface mt-6 rounded-2xl border border-slate-200 p-8 text-center text-sm app-muted dark:border-slate-800">{t.adminOnly}</div> : viewMode === "create" ? (
              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-6">
                  <section className="app-surface rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                    <h3 className="text-lg font-semibold">{t.mainSettings}</h3>
                    <div className="mt-5 grid gap-5 md:grid-cols-[11rem_minmax(0,1fr)] md:items-start">
                      <div className="text-sm font-medium">{t.couponConditions}</div>
                      <div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <label className="flex items-center gap-2"><input className={radioClass} type="radio" checked={acquisitionType === "normal"} onChange={() => { setAcquisitionType("normal"); invalidatePreview(); }} />{t.noConditions}</label>
                          <label className="flex items-center gap-2"><input className={radioClass} type="radio" checked={acquisitionType === "lottery"} onChange={() => { setAcquisitionType("lottery"); invalidatePreview(); }} />{t.lottery}</label>
                          <span className="app-muted flex items-center gap-2">○ {t.friendReferral} <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-900">{t.managerOnly}</span></span>
                        </div>
                        {acquisitionType === "lottery" && <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="text-sm">{t.probability}<input type="number" min="1" max="99" value={lotteryProbability} onChange={(e) => { setLotteryProbability(e.target.value); invalidatePreview(); }} className={fieldClass} /></label>
                          <label className="text-sm">{t.winnerLimit}<input type="number" min="-1" max="999999" value={maxAcquireCount} onChange={(e) => { setMaxAcquireCount(e.target.value); invalidatePreview(); }} className={fieldClass} /><span className="app-muted mt-1 block text-xs">{t.unlimitedWinners}</span></label>
                        </div>}
                      </div>

                      <label className="text-sm font-medium">{t.titleLabel}</label>
                      <div><input value={couponTitle} maxLength={60} onChange={(e) => { setCouponTitle(e.target.value); invalidatePreview(); }} placeholder="Ex: LINE friend exclusive coupon" className={fieldClass} /><div className="app-muted mt-1 text-right text-xs">{couponTitle.length}/60</div></div>
                    </div>
                  </section>

                  <section className="app-surface rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                    <h3 className="text-lg font-semibold">{t.couponSettings}</h3>
                    <div className="mt-5 grid gap-x-5 gap-y-6 md:grid-cols-[11rem_minmax(0,1fr)] md:items-start">
                      <div className="text-sm font-medium">{t.validity}</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs app-muted">{t.from}<input type="datetime-local" value={startAt} onChange={(e) => { setStartAt(e.target.value); invalidatePreview(); }} className={fieldClass} /></label>
                        <label className="text-xs app-muted">{t.till}<input type="datetime-local" value={endAt} onChange={(e) => { setEndAt(e.target.value); invalidatePreview(); }} className={fieldClass} /></label>
                        <label className="text-xs app-muted sm:col-span-2">{t.timezone}<select value="ASIA_BANGKOK" disabled className={fieldClass}><option value="ASIA_BANGKOK">(UTC+07:00) Asia/Bangkok, Jakarta</option></select></label>
                      </div>

                      <div className="text-sm font-medium">{t.image}</div>
                      <div>
                        <label className="flex h-44 w-44 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm font-semibold text-blue-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                          {imageUrl ? <img src={imageUrl} alt="Coupon" className="h-full w-full object-cover" /> : imageUploading ? t.uploading : t.uploadImage}
                          <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={imageUploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file); e.currentTarget.value = ""; }} />
                        </label>
                        <p className="app-muted mt-2 text-xs">{t.imageHint}</p>
                        {imageUrl && <button type="button" onClick={() => { setImageUrl(""); invalidatePreview(); }} className="mt-2 text-xs font-semibold text-rose-600">{t.clear}</button>}
                      </div>

                      <div className="text-sm font-medium">{t.guidelines}</div>
                      <div><textarea value={guidelines} maxLength={500} rows={6} onChange={(e) => { setGuidelines(e.target.value); invalidatePreview(); }} className={fieldClass} /><div className="app-muted mt-1 text-right text-xs">{guidelines.length}/500</div></div>

                      <div className="text-sm font-medium">{t.lyServices}</div>
                      <div className="space-y-2 text-sm">
                        <label className="flex items-center gap-2"><input className={radioClass} type="radio" checked={visibility === "UNLISTED"} onChange={() => { setVisibility("UNLISTED"); invalidatePreview(); }} />{t.dontInclude}</label>
                        <label className="flex items-center gap-2"><input className={radioClass} type="radio" checked={visibility === "PUBLIC"} onChange={() => { setVisibility("PUBLIC"); invalidatePreview(); }} />{t.include}</label>
                      </div>

                      <div className="text-sm font-medium">{t.usageLimit}</div>
                      <div className="space-y-2 text-sm">
                        <label className="flex items-center gap-2"><input className={radioClass} type="radio" checked={maxUseCount === 1} onChange={() => { setMaxUseCount(1); invalidatePreview(); }} />{t.onlyOnce}</label>
                        <label className="flex items-center gap-2"><input className={radioClass} type="radio" checked={maxUseCount === -1} onChange={() => { setMaxUseCount(-1); invalidatePreview(); }} />{t.noLimit}</label>
                      </div>

                      <div className="text-sm font-medium">{t.couponCode}</div>
                      <div className="space-y-2 text-sm">
                        <label className="flex items-center gap-2"><input className={radioClass} type="radio" checked={!showCouponCode} onChange={() => { setShowCouponCode(false); invalidatePreview(); }} />{t.dontShow}</label>
                        <label className="flex items-center gap-2"><input className={radioClass} type="radio" checked={showCouponCode} onChange={() => { setShowCouponCode(true); invalidatePreview(); }} />{t.show}</label>
                        {showCouponCode && <div><input value={couponCode} maxLength={16} onChange={(e) => { setCouponCode(e.target.value); invalidatePreview(); }} className={fieldClass} /><div className="app-muted mt-1 text-right text-xs">{couponCode.length}/16</div></div>}
                      </div>

                      <div className="text-sm font-medium">{t.couponType}</div>
                      <div>
                        <select value={rewardType} onChange={(e) => { setRewardType(e.target.value as CouponRewardType); invalidatePreview(); }} className={`${fieldClass} max-w-xs`}>
                          <option value="discount">{t.discount}</option><option value="free">{t.free}</option><option value="gift">{t.gift}</option><option value="cashBack">{t.cashback}</option><option value="others">{t.others}</option>
                        </select>
                        {(rewardType === "discount" || rewardType === "cashBack") && <div className="mt-4 space-y-3 text-sm">
                          <label className="flex items-center gap-2"><input className={radioClass} type="radio" checked={priceType === "fixed"} onChange={() => { setPriceType("fixed"); invalidatePreview(); }} />{rewardType === "cashBack" ? t.cashback : t.thbDiscount}<input type="number" min="1" value={fixedAmount} onChange={(e) => { setFixedAmount(e.target.value); invalidatePreview(); }} disabled={priceType !== "fixed"} className="app-input ml-2 w-32 rounded-lg border px-3 py-2 disabled:opacity-50" /> THB</label>
                          <label className="flex items-center gap-2"><input className={radioClass} type="radio" checked={priceType === "percentage"} onChange={() => { setPriceType("percentage"); invalidatePreview(); }} />{t.percentDiscount}<input type="number" min="1" max="99" value={percentage} onChange={(e) => { setPercentage(e.target.value); invalidatePreview(); }} disabled={priceType !== "percentage"} className="app-input ml-2 w-24 rounded-lg border px-3 py-2 disabled:opacity-50" /> %</label>
                          {rewardType === "discount" && <label className="flex flex-wrap items-center gap-2"><input className={radioClass} type="radio" checked={priceType === "explicit"} onChange={() => { setPriceType("explicit"); invalidatePreview(); }} />{t.strikethrough}<span className="ml-2">{t.beforeDiscount}</span><input type="number" min="1" value={originalPrice} onChange={(e) => { setOriginalPrice(e.target.value); invalidatePreview(); }} disabled={priceType !== "explicit"} className="app-input w-28 rounded-lg border px-3 py-2 disabled:opacity-50" /><span>{t.afterDiscount}</span><input type="number" min="1" value={discountedPrice} onChange={(e) => { setDiscountedPrice(e.target.value); invalidatePreview(); }} disabled={priceType !== "explicit"} className="app-input w-28 rounded-lg border px-3 py-2 disabled:opacity-50" /> THB</label>}
                        </div>}
                      </div>

                      <div className="text-sm font-medium">{t.conditionsUse}</div>
                      <div><input value={usageCondition} maxLength={30} onChange={(e) => { setUsageCondition(e.target.value); invalidatePreview(); }} placeholder="Ex: Usable for payments of ฿1,000 or more" className={fieldClass} /><div className="app-muted mt-1 text-right text-xs">{usageCondition.length}/30</div></div>
                    </div>
                  </section>

                  <section className="app-surface rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">{t.stores}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pilot ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>{pilot ? t.pilotNotice : t.fullNotice}</span></div>
                    <div className="mt-4 flex gap-2">
                      <button type="button" disabled={pilot} onClick={() => { setStoreMode("ALL"); invalidatePreview(); }} className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${storeMode === "ALL" ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-800"}`}>{t.allStores}</button>
                      <button type="button" onClick={() => { setStoreMode("SELECTED"); invalidatePreview(); }} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${storeMode === "SELECTED" ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-800"}`}>{t.selectedStores}</button>
                    </div>
                    {storeMode === "SELECTED" && <div className="mt-4">
                      <input type="search" value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} placeholder={t.searchStore} className="app-input w-full rounded-lg border px-3 py-2" />
                      {!pilot && <div className="mt-2 flex gap-3 text-xs"><button type="button" onClick={() => { setSelectedStoreIds(filteredStores.map((store) => store.id)); invalidatePreview(); }} className="font-semibold text-emerald-700">{t.selectVisible}</button><button type="button" onClick={() => { setSelectedStoreIds([]); invalidatePreview(); }} className="font-semibold text-rose-600">{t.clear}</button></div>}
                      <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">{filteredStores.map((store) => <label key={store.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0 dark:border-slate-900"><input type={pilot ? "radio" : "checkbox"} name={pilot ? "coupon-pilot-store" : undefined} checked={selectedStoreIds.includes(store.id)} onChange={() => toggleStore(store.id)} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{store.name}</span><span className="app-muted text-xs">{store.code ?? store.storeId ?? "—"}</span></span></label>)}</div>
                    </div>}
                  </section>
                </div>

                <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
                  <section className="app-surface rounded-2xl border border-slate-200 p-5 shadow-sm dark:border-slate-800">
                    <h3 className="font-semibold">Preview</h3>
                    {preview ? <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-100 p-3 text-center dark:bg-slate-900"><div className="text-xl font-bold">{preview.totalStores}</div><div className="app-muted text-xs">{t.total}</div></div><div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-950/30"><div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{preview.eligibleStores}</div><div className="text-xs text-emerald-700 dark:text-emerald-300">{t.ready}</div></div><div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-950/30"><div className="text-xl font-bold text-amber-700 dark:text-amber-300">{preview.skippedStores}</div><div className="text-xs text-amber-700 dark:text-amber-300">{t.skipped}</div></div></div> : <p className="app-muted mt-3 text-sm">{t.previewRequired}</p>}
                    <button type="button" disabled={previewLoading || creating || imageUploading} onClick={() => void runPreview()} className="mt-5 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900">{previewLoading ? t.previewing : t.preview}</button>
                    <button type="button" disabled={!preview || preview.eligibleStores < 1 || creating || previewLoading || imageUploading} onClick={() => void createCoupon()} className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">{creating ? t.saving : t.save}</button>
                    <button type="button" disabled title={t.draftUnavailable} className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold opacity-40 dark:border-slate-800">{t.saveDraft}</button>
                    <p className="app-muted mt-2 text-center text-[11px]">{t.draftUnavailable}</p>
                  </section>
                  {preview && <section className="app-surface rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><h4 className="text-sm font-semibold">{t.storeReadiness}</h4><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{preview.stores.map((store) => <div key={store.storeId} className="flex items-start justify-between gap-3 text-xs"><div className="min-w-0"><div className="truncate font-medium">{store.storeName}</div><div className="app-muted truncate">{store.lineOaName ?? "No LINE OA"}</div></div><span className={store.isEligible ? "text-emerald-600" : "text-amber-600"}>{store.isEligible ? t.ready : store.skipReason}</span></div>)}</div></section>}
                </aside>
              </div>
            ) : viewMode === "campaigns" ? (
              <section className="app-surface mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800"><h3 className="font-semibold">{t.campaigns}</h3><button type="button" onClick={() => void loadCampaigns()} className="text-sm font-semibold text-emerald-700">Refresh</button></div>
                {campaignsLoading ? <p className="app-muted p-6 text-sm">Loading…</p> : campaigns.length === 0 ? <p className="app-muted p-8 text-center text-sm">{t.noCampaigns}</p> : <div className="divide-y divide-slate-100 dark:divide-slate-900">{campaigns.map((campaign) => <button key={campaign.id} type="button" onClick={() => void openCampaign(campaign.id)} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-900/60"><div><div className="font-semibold">{campaign.title}</div><div className="app-muted mt-1 text-xs">{new Date(campaign.createdAt).toLocaleString()} · {campaign.id.slice(0, 8)}</div></div><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badge(campaign.status)}`}>{campaign.status}</span></button>)}</div>}
              </section>
            ) : detail ? (
              <div className="mt-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => { setViewMode("campaigns"); void loadCampaigns(); }} className="text-sm font-semibold text-emerald-700">← {t.back}</button><div className="flex gap-2"><button type="button" disabled={actionLoading || !(detail.summary.FAILED > 0)} onClick={() => void retryFailed()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-slate-700">{t.retry}</button><button type="button" disabled={actionLoading || detail.campaign.status === "DISCONTINUED"} onClick={() => void discontinue()} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300">{t.discontinue}</button></div></div>
                <section className="app-surface rounded-2xl border border-slate-200 p-5 dark:border-slate-800"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-xl font-bold">{detail.campaign.title}</h3><p className="app-muted mt-1 whitespace-pre-line text-sm">{detail.campaign.description ?? "—"}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge(detail.campaign.status)}`}>{detail.campaign.status}</span></div></section>
                <section className="app-surface overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase app-muted dark:bg-slate-900"><tr><th className="px-4 py-3">Store</th><th className="px-4 py-3">LINE OA</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Coupon ID</th><th className="px-4 py-3">Error</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-900">{detail.stores.map((store) => <tr key={store.id}><td className="px-4 py-3 font-medium">{store.storeName}</td><td className="px-4 py-3 app-muted">{store.lineOaName ?? "—"}</td><td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${badge(store.status)}`}>{store.status}</span></td><td className="px-4 py-3 font-mono text-xs">{store.lineCouponId ?? "—"}</td><td className="max-w-xs px-4 py-3 text-xs text-rose-600">{store.errorMessage ?? store.skipReason ?? "—"}</td></tr>)}</tbody></table></div></section>
              </div>
            ) : null}
          </div>
        </section>
      </PageContainer>
    </AppShell>
  );
}
