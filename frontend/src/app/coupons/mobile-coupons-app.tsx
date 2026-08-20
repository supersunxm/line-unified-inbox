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

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type ExecutionMode = "pilot" | "full";
type AcquisitionType = "normal" | "lottery";
type TopView = "create" | "history";
type WizardStep = 0 | 1 | 2 | 3;
type UploadImageResult = { url: string; message?: string };

const DEFAULT_GUIDELINES = `- To redeem your coupon, present this screen at checkout.\n- Redeemable once only.\n- The validity period of this coupon may change or it may be canceled without notice.`;
const steps = ["ข้อมูล", "สิทธิประโยชน์", "ร้านค้า", "ตรวจสอบ"] as const;

function bangkokTimestamp(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const [, y, m, d, h, min] = match;
  return Math.floor(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h) - 7, Number(min)) / 1000);
}

function localValue(hours: number): string {
  return new Date(Date.now() + (7 + hours) * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function statusClass(status: string) {
  if (["SUCCESS", "DISCONTINUED"].includes(status)) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (["FAILED", "DISCONTINUE_FAILED"].includes(status)) return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  if (["PARTIAL", "PARTIAL_DISCONTINUE"].includes(status)) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)]";
}

function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(status)}`}>{status}</span>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[11px] font-semibold text-[var(--app-text-secondary)]">{children}</span>;
}

const inputClass = "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-3 text-[16px] text-[var(--app-text-primary)] outline-none transition focus:border-[var(--app-accent)]";
const smallInputClass = "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-[16px] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]";

export function MobileCouponsApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("pilot");
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [topView, setTopView] = useState<TopView>("create");
  const [step, setStep] = useState<WizardStep>(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [acquisitionType, setAcquisitionType] = useState<AcquisitionType>("normal");
  const [lotteryProbability, setLotteryProbability] = useState("50");
  const [maxAcquireCount, setMaxAcquireCount] = useState("-1");
  const [couponTitle, setCouponTitle] = useState("");
  const [startAt, setStartAt] = useState(() => localValue(1));
  const [endAt, setEndAt] = useState(() => localValue(24 * 7));
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

  const [storeMode, setStoreMode] = useState<CouponStoreMode>("SELECTED");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [storeSearch, setStoreSearch] = useState("");

  const [preview, setPreview] = useState<CouponPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [campaigns, setCampaigns] = useState<CouponCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [detail, setDetail] = useState<CouponCampaignDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = user?.role === "ADMIN";
  const pilot = executionMode === "pilot";
  const invalidatePreview = useCallback(() => setPreview(null), []);

  useEffect(() => {
    let active = true;
    void api.me()
      .then((value) => { if (active) setUser(value); })
      .catch(() => { if (typeof window !== "undefined") window.location.replace("/login"); })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    void Promise.all([api.stores(), couponApi.executionMode()])
      .then(([storeRows, mode]) => {
        if (!active) return;
        setStores(storeRows ?? []);
        setExecutionMode(mode.mode);
        if (mode.mode === "pilot") setStoreMode("SELECTED");
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "โหลดการตั้งค่าคูปองไม่สำเร็จ"); });
    return () => { active = false; };
  }, [isAdmin]);

  const filteredStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((store) => store.name.toLowerCase().includes(q) || store.code?.toLowerCase().includes(q) || store.storeId?.toLowerCase().includes(q));
  }, [storeSearch, stores]);

  const selectedStores = useMemo(() => stores.filter((store) => selectedStoreIds.includes(store.id)), [selectedStoreIds, stores]);

  const changeRewardType = (next: CouponRewardType) => {
    setRewardType(next);
    if (next === "cashBack" && priceType === "explicit") setPriceType("fixed");
    invalidatePreview();
  };

  const toggleStore = (storeId: string) => {
    setSelectedStoreIds((current) => pilot
      ? (current.includes(storeId) ? [] : [storeId])
      : (current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId]));
    invalidatePreview();
  };

  const buildInput = useCallback((): CouponInput => {
    let reward: CouponPayload["reward"];
    if (["free", "gift", "others"].includes(rewardType)) {
      reward = { type: rewardType as "free" | "gift" | "others" };
    } else if (priceType === "percentage") {
      reward = { type: rewardType as "discount" | "cashBack", priceInfo: { type: "percentage", percentage: Number(percentage) } };
    } else if (priceType === "explicit" && rewardType === "discount") {
      reward = { type: "discount", priceInfo: { type: "explicit", originalPrice: Number(originalPrice), priceAfterDiscount: Number(discountedPrice) } };
    } else {
      reward = { type: rewardType as "discount" | "cashBack", priceInfo: { type: "fixed", fixedAmount: Number(fixedAmount) } };
    }
    const acquisitionCondition: CouponPayload["acquisitionCondition"] = acquisitionType === "lottery"
      ? { type: "lottery", lotteryProbability: Number(lotteryProbability), maxAcquireCount: Number(maxAcquireCount) }
      : { type: "normal" };
    return {
      coupon: {
        title: couponTitle.trim(),
        ...(guidelines.trim() ? { description: guidelines.trim() } : {}),
        reward,
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
      storeSelection: { mode: storeMode, ...(storeMode === "SELECTED" ? { storeIds: selectedStoreIds } : {}) },
    };
  }, [acquisitionType, couponCode, couponTitle, discountedPrice, endAt, fixedAmount, guidelines, imageUrl, lotteryProbability, maxAcquireCount, maxUseCount, originalPrice, percentage, priceType, rewardType, selectedStoreIds, showCouponCode, startAt, storeMode, usageCondition, visibility]);

  const validateStep = (target: WizardStep) => {
    setError(null);
    if (target === 0) {
      if (!couponTitle.trim()) { setError("กรุณาใส่ชื่อคูปอง"); return false; }
      const start = bangkokTimestamp(startAt);
      const end = bangkokTimestamp(endAt);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) { setError("ช่วงเวลาใช้งานคูปองไม่ถูกต้อง"); return false; }
      if (acquisitionType === "lottery" && (Number(lotteryProbability) < 1 || Number(lotteryProbability) > 99)) { setError("โอกาสชนะต้องอยู่ระหว่าง 1–99%"); return false; }
    }
    if (target === 1) {
      if ((rewardType === "discount" || rewardType === "cashBack") && priceType === "fixed" && Number(fixedAmount) <= 0) { setError("จำนวนส่วนลดต้องมากกว่า 0"); return false; }
      if ((rewardType === "discount" || rewardType === "cashBack") && priceType === "percentage" && (Number(percentage) <= 0 || Number(percentage) >= 100)) { setError("เปอร์เซ็นต์ต้องอยู่ระหว่าง 1–99"); return false; }
      if (rewardType === "discount" && priceType === "explicit" && (Number(originalPrice) <= Number(discountedPrice) || Number(discountedPrice) <= 0)) { setError("ราคาหลังลดต้องน้อยกว่าราคาก่อนลด"); return false; }
    }
    if (target === 2 && storeMode === "SELECTED" && selectedStoreIds.length === 0) { setError("กรุณาเลือกร้านอย่างน้อย 1 ร้าน"); return false; }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((Math.min(3, step + 1)) as WizardStep);
  };

  const uploadImage = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError("รูปภาพต้องมีขนาดไม่เกิน 10 MB"); return; }
    setImageUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api-backend/mass-messages/upload-image", { method: "POST", credentials: "include", body });
      const result = await response.json() as UploadImageResult;
      if (!response.ok || !result.url) throw new Error(result.message ?? "อัปโหลดรูปไม่สำเร็จ");
      setImageUrl(result.url);
      invalidatePreview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setImageUploading(false);
    }
  };

  const runPreview = async () => {
    if (![0, 1, 2].every((value) => validateStep(value as WizardStep))) return;
    setPreviewLoading(true);
    setError(null);
    try {
      setPreview(await couponApi.preview(buildInput()));
    } catch (reason) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : "ตรวจสอบความพร้อมไม่สำเร็จ");
    } finally {
      setPreviewLoading(false);
    }
  };

  const createCoupon = async () => {
    if (!preview || preview.eligibleStores < 1) { setError("กรุณาตรวจสอบความพร้อมล่าสุดก่อนสร้างคูปอง"); return; }
    if (!window.confirm(`สร้างคูปอง “${couponTitle}” สำหรับ ${preview.eligibleStores} ร้าน?`)) return;
    setCreating(true);
    setError(null);
    try {
      const result = await couponApi.create(buildInput());
      setDetail(result);
      setPreview(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "สร้างคูปองไม่สำเร็จ");
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลดประวัติคูปองไม่สำเร็จ");
    } finally {
      setCampaignsLoading(false);
    }
  }, [isAdmin]);

  const switchTopView = (next: TopView) => {
    setDetail(null);
    setTopView(next);
    setError(null);
    if (next === "history") void loadCampaigns();
  };

  const openCampaign = async (id: string) => {
    setActionLoading(true);
    setError(null);
    try {
      setDetail(await couponApi.detail(id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลดรายละเอียดคูปองไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  };

  const retryFailed = async () => {
    if (!detail) return;
    setActionLoading(true);
    setError(null);
    try { setDetail(await couponApi.retryFailed(detail.campaign.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Retry ไม่สำเร็จ"); }
    finally { setActionLoading(false); }
  };

  const discontinue = async () => {
    if (!detail || !window.confirm(`ยกเลิกคูปอง “${detail.campaign.title}”?`)) return;
    setActionLoading(true);
    setError(null);
    try { setDetail(await couponApi.discontinue(detail.campaign.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "ยกเลิกคูปองไม่สำเร็จ"); }
    finally { setActionLoading(false); }
  };

  const rewardSummary = useMemo(() => {
    if (["free", "gift", "others"].includes(rewardType)) return rewardType === "free" ? "ฟรี" : rewardType === "gift" ? "ของขวัญ" : "อื่น ๆ";
    if (priceType === "percentage") return `${percentage}%`;
    if (priceType === "explicit") return `฿${Number(originalPrice).toLocaleString()} → ฿${Number(discountedPrice).toLocaleString()}`;
    return `฿${Number(fixedAmount).toLocaleString()}`;
  }, [discountedPrice, fixedAmount, originalPrice, percentage, priceType, rewardType]);

  if (!authChecked || !user) {
    return <main className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิดคูปอง...</main>;
  }

  const bottomNav = <MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />;

  return (
    <MobilePageShell bottomNav={bottomNav}>
      <MobilePageHeader
        eyebrow="Marketing · LINE OA"
        title="คูปอง"
        description="สร้างและติดตามคูปองสำหรับร้านค้าแบบทีละขั้น"
      />

      {!detail && isAdmin && (
        <MobileSectionTabs<TopView>
          value={topView}
          items={[{ value: "create", label: "สร้างคูปอง" }, { value: "history", label: "ประวัติ", badge: campaigns.length || undefined }]}
          onChange={switchTopView}
        />
      )}

      <div className="space-y-4 px-4 py-4 pb-8">
        {error && <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs leading-5 text-rose-600 dark:text-rose-400">{error}</div>}

        {!isAdmin ? (
          <MobileEmptyState title="ไม่มีสิทธิ์ใช้งาน" description="เมนูคูปองเปิดให้ผู้ดูแลระบบเท่านั้น" />
        ) : detail ? (
          <CampaignDetail detail={detail} actionLoading={actionLoading} onBack={() => { setDetail(null); setTopView("history"); void loadCampaigns(); }} onRetry={retryFailed} onDiscontinue={discontinue} />
        ) : topView === "history" ? (
          <HistoryView campaigns={campaigns} loading={campaignsLoading || actionLoading} onRefresh={loadCampaigns} onOpen={openCampaign} />
        ) : (
          <>
            <WizardProgress step={step} onStep={(next) => { if (next <= step || (next > step && validateStep(step))) setStep(next); }} />

            {step === 0 && (
              <div className="space-y-4">
                <MobileSection title="ข้อมูลคูปอง" description="กำหนดชื่อ ระยะเวลา และวิธีที่ลูกค้าจะได้รับคูปอง">
                  <MobileCard className="space-y-4">
                    <label>
                      <FieldLabel>ชื่อคูปอง</FieldLabel>
                      <input value={couponTitle} maxLength={60} onChange={(event) => { setCouponTitle(event.target.value); invalidatePreview(); }} placeholder="เช่น ส่วนลดพิเศษเพื่อน LINE" className={inputClass} />
                      <div className="mt-1 text-right text-[10px] text-[var(--app-text-tertiary)]">{couponTitle.length}/60</div>
                    </label>

                    <div>
                      <FieldLabel>เงื่อนไขการรับคูปอง</FieldLabel>
                      <div className="grid grid-cols-2 gap-2">
                        <ChoiceCard active={acquisitionType === "normal"} title="ไม่มีเงื่อนไข" detail="ลูกค้ารับคูปองได้ตามปกติ" onClick={() => { setAcquisitionType("normal"); invalidatePreview(); }} />
                        <ChoiceCard active={acquisitionType === "lottery"} title="จับรางวัล" detail="กำหนดโอกาสชนะได้" onClick={() => { setAcquisitionType("lottery"); invalidatePreview(); }} />
                      </div>
                      {acquisitionType === "lottery" && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <label><FieldLabel>โอกาสชนะ (%)</FieldLabel><input type="number" min="1" max="99" value={lotteryProbability} onChange={(event) => { setLotteryProbability(event.target.value); invalidatePreview(); }} className={smallInputClass} /></label>
                          <label><FieldLabel>จำนวนผู้ชนะสูงสุด</FieldLabel><input type="number" min="-1" value={maxAcquireCount} onChange={(event) => { setMaxAcquireCount(event.target.value); invalidatePreview(); }} className={smallInputClass} /></label>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <label><FieldLabel>เริ่มใช้งาน</FieldLabel><input type="datetime-local" value={startAt} onChange={(event) => { setStartAt(event.target.value); invalidatePreview(); }} className={inputClass} /></label>
                      <label><FieldLabel>สิ้นสุด</FieldLabel><input type="datetime-local" value={endAt} onChange={(event) => { setEndAt(event.target.value); invalidatePreview(); }} className={inputClass} /></label>
                    </div>
                    <p className="text-[10px] text-[var(--app-text-tertiary)]">เวลาอ้างอิง Asia/Bangkok (UTC+7)</p>
                  </MobileCard>
                </MobileSection>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <MobileSection title="สิทธิประโยชน์" description="กำหนดประเภทคูปอง มูลค่า และเงื่อนไขการใช้งาน">
                  <MobileCard className="space-y-4">
                    <label>
                      <FieldLabel>ประเภทคูปอง</FieldLabel>
                      <select value={rewardType} onChange={(event) => changeRewardType(event.target.value as CouponRewardType)} className={inputClass}>
                        <option value="discount">ส่วนลด</option>
                        <option value="free">ฟรี</option>
                        <option value="gift">ของขวัญ</option>
                        <option value="cashBack">เงินคืน</option>
                        <option value="others">อื่น ๆ</option>
                      </select>
                    </label>

                    {(rewardType === "discount" || rewardType === "cashBack") && (
                      <div>
                        <FieldLabel>รูปแบบมูลค่า</FieldLabel>
                        <div className="space-y-2">
                          <ChoiceRow active={priceType === "fixed"} title="ส่วนลดเป็นจำนวนเงิน" onClick={() => { setPriceType("fixed"); invalidatePreview(); }}><input type="number" min="1" value={fixedAmount} onChange={(event) => { setFixedAmount(event.target.value); invalidatePreview(); }} className="w-24 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-2 text-right text-[16px]" /> <span className="text-xs">THB</span></ChoiceRow>
                          <ChoiceRow active={priceType === "percentage"} title="ส่วนลดเป็นเปอร์เซ็นต์" onClick={() => { setPriceType("percentage"); invalidatePreview(); }}><input type="number" min="1" max="99" value={percentage} onChange={(event) => { setPercentage(event.target.value); invalidatePreview(); }} className="w-20 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-2 text-right text-[16px]" /> <span className="text-xs">%</span></ChoiceRow>
                          {rewardType === "discount" && <ChoiceRow active={priceType === "explicit"} title="แสดงราคาก่อน–หลังลด" onClick={() => { setPriceType("explicit"); invalidatePreview(); }}><div className="grid grid-cols-2 gap-1"><input type="number" value={originalPrice} onChange={(event) => { setOriginalPrice(event.target.value); invalidatePreview(); }} className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-2 text-[16px]" /><input type="number" value={discountedPrice} onChange={(event) => { setDiscountedPrice(event.target.value); invalidatePreview(); }} className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-2 text-[16px]" /></div></ChoiceRow>}
                        </div>
                      </div>
                    )}

                    <label><FieldLabel>เงื่อนไขการใช้</FieldLabel><input value={usageCondition} maxLength={30} onChange={(event) => { setUsageCondition(event.target.value); invalidatePreview(); }} placeholder="เช่น ใช้เมื่อซื้อครบ ฿1,000" className={inputClass} /></label>

                    <div>
                      <FieldLabel>จำนวนครั้งที่ใช้ได้</FieldLabel>
                      <div className="grid grid-cols-2 gap-2"><ChoiceCard active={maxUseCount === 1} title="1 ครั้ง" detail="ใช้ได้ครั้งเดียว" onClick={() => { setMaxUseCount(1); invalidatePreview(); }} /><ChoiceCard active={maxUseCount === -1} title="ไม่จำกัด" detail="ใช้ซ้ำได้" onClick={() => { setMaxUseCount(-1); invalidatePreview(); }} /></div>
                    </div>

                    <div>
                      <FieldLabel>รหัสคูปอง</FieldLabel>
                      <button type="button" onClick={() => { setShowCouponCode((value) => !value); invalidatePreview(); }} className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-sm font-semibold ${showCouponCode ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5 text-[var(--app-accent)]" : "border-[var(--app-border)]"}`}><span>{showCouponCode ? "แสดงรหัสคูปอง" : "ไม่แสดงรหัสคูปอง"}</span><span>{showCouponCode ? "เปิด" : "ปิด"}</span></button>
                      {showCouponCode && <input value={couponCode} maxLength={16} onChange={(event) => { setCouponCode(event.target.value); invalidatePreview(); }} placeholder="COUPON2026" className={`${inputClass} mt-2`} />}
                    </div>

                    <div>
                      <FieldLabel>แสดงในบริการ LY</FieldLabel>
                      <div className="grid grid-cols-2 gap-2"><ChoiceCard active={visibility === "UNLISTED"} title="ไม่แสดง" detail="เฉพาะช่องทางที่แจก" onClick={() => { setVisibility("UNLISTED"); invalidatePreview(); }} /><ChoiceCard active={visibility === "PUBLIC"} title="แสดง" detail="ให้ค้นพบได้" onClick={() => { setVisibility("PUBLIC"); invalidatePreview(); }} /></div>
                    </div>
                  </MobileCard>
                </MobileSection>

                <MobileSection title="รูปและคำแนะนำ">
                  <MobileCard className="space-y-4">
                    <label className="block">
                      <FieldLabel>รูปคูปอง</FieldLabel>
                      <div className="overflow-hidden rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-subtle)]">
                        {imageUrl ? <div className="aspect-[16/9] bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(imageUrl)})` }} /> : <div className="flex aspect-[16/9] items-center justify-center text-xs text-[var(--app-text-tertiary)]">ยังไม่ได้อัปโหลดรูป</div>}
                        <div className="flex gap-2 p-3"><label className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl bg-[var(--app-accent)] px-3 text-xs font-bold text-white">{imageUploading ? "กำลังอัปโหลด..." : "เลือกรูป"}<input type="file" accept="image/jpeg,image/png" className="hidden" disabled={imageUploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.currentTarget.value = ""; }} /></label>{imageUrl && <button type="button" onClick={() => { setImageUrl(""); invalidatePreview(); }} className="min-h-11 rounded-xl border border-[var(--app-border)] px-4 text-xs font-bold text-rose-600">ลบ</button>}</div>
                      </div>
                    </label>
                    <label><FieldLabel>คำแนะนำการใช้คูปอง</FieldLabel><textarea value={guidelines} maxLength={500} rows={5} onChange={(event) => { setGuidelines(event.target.value); invalidatePreview(); }} className={`${inputClass} resize-none`} /></label>
                  </MobileCard>
                </MobileSection>
              </div>
            )}

            {step === 2 && (
              <MobileSection title="เลือกร้านค้า" description={pilot ? "Pilot mode: เลือกได้ครั้งละ 1 ร้าน" : "Full mode: เลือกหลายร้านหรือทุกร้านได้"}>
                <MobileCard className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <ChoiceCard active={storeMode === "ALL"} disabled={pilot} title="ทุกร้าน" detail={pilot ? "ปิดใน Pilot mode" : `${stores.length} ร้าน`} onClick={() => { if (!pilot) { setStoreMode("ALL"); invalidatePreview(); } }} />
                    <ChoiceCard active={storeMode === "SELECTED"} title="เลือกร้าน" detail={`${selectedStoreIds.length} ร้านที่เลือก`} onClick={() => { setStoreMode("SELECTED"); invalidatePreview(); }} />
                  </div>

                  {storeMode === "SELECTED" && (
                    <>
                      <input value={storeSearch} onChange={(event) => setStoreSearch(event.target.value)} placeholder="ค้นหาชื่อร้าน / Store ID" className={inputClass} />
                      <div className="space-y-2">
                        {filteredStores.map((store) => {
                          const active = selectedStoreIds.includes(store.id);
                          return <button key={store.id} type="button" onClick={() => toggleStore(store.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${active ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5" : "border-[var(--app-border)] bg-[var(--app-surface)]"}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${active ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white" : "border-[var(--app-border)]"}`}>{active ? "✓" : ""}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{store.name}</span><span className="mt-0.5 block truncate text-[10px] text-[var(--app-text-tertiary)]">{store.code ?? store.storeId ?? "—"}</span></span></button>;
                        })}
                        {filteredStores.length === 0 && <MobileEmptyState title="ไม่พบร้าน" description="ลองเปลี่ยนคำค้นหา" />}
                      </div>
                    </>
                  )}
                </MobileCard>
              </MobileSection>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <MobileSection title="สรุปก่อนสร้าง" description="ตรวจข้อมูลและความพร้อมของ LINE OA ก่อนสร้างจริง">
                  <MobileMetricGrid>
                    <MobileMetricCard label="สิทธิประโยชน์" value={rewardSummary} tone="accent" />
                    <MobileMetricCard label="ร้านเป้าหมาย" value={storeMode === "ALL" ? stores.length : selectedStoreIds.length} detail={storeMode === "ALL" ? "ทุกร้าน" : "ร้านที่เลือก"} />
                  </MobileMetricGrid>
                  <MobileCard className="space-y-3 text-xs">
                    <SummaryRow label="ชื่อคูปอง" value={couponTitle || "—"} />
                    <SummaryRow label="ช่วงเวลา" value={`${new Date(bangkokTimestamp(startAt) * 1000).toLocaleString("th-TH")} – ${new Date(bangkokTimestamp(endAt) * 1000).toLocaleString("th-TH")}`} />
                    <SummaryRow label="การรับคูปอง" value={acquisitionType === "normal" ? "ไม่มีเงื่อนไข" : `จับรางวัล ${lotteryProbability}%`} />
                    <SummaryRow label="การใช้งาน" value={maxUseCount === 1 ? "ใช้ได้ 1 ครั้ง" : "ไม่จำกัดครั้ง"} />
                    <SummaryRow label="รหัสคูปอง" value={showCouponCode ? couponCode || "เปิดแต่ยังไม่ได้ระบุ" : "ไม่แสดง"} />
                    <SummaryRow label="ร้านค้า" value={storeMode === "ALL" ? "ทุกร้าน" : selectedStores.map((store) => store.name).join(", ") || "—"} />
                  </MobileCard>
                </MobileSection>

                <MobileSection title="ความพร้อมของร้าน">
                  {!preview ? (
                    <MobileCard>
                      <p className="text-xs leading-5 text-[var(--app-text-secondary)]">กด “ตรวจสอบความพร้อม” เพื่อเช็กว่าร้านที่เลือกมี LINE OA และ token พร้อมสร้างคูปองหรือไม่</p>
                      <button type="button" disabled={previewLoading || imageUploading} onClick={() => void runPreview()} className="mt-4 min-h-12 w-full rounded-xl bg-[var(--app-accent)] px-4 text-sm font-bold text-white disabled:opacity-50">{previewLoading ? "กำลังตรวจสอบ..." : "ตรวจสอบความพร้อม"}</button>
                    </MobileCard>
                  ) : (
                    <>
                      <MobileMetricGrid>
                        <MobileMetricCard label="ทั้งหมด" value={preview.totalStores} />
                        <MobileMetricCard label="พร้อมสร้าง" value={preview.eligibleStores} tone="success" />
                        <MobileMetricCard label="ข้าม" value={preview.skippedStores} tone={preview.skippedStores > 0 ? "warning" : "default"} wide />
                      </MobileMetricGrid>
                      <div className="space-y-2">
                        {preview.stores.map((store) => <MobileListCard key={store.storeId} title={store.storeName} subtitle={store.lineOaName ?? "ไม่มี LINE OA"} trailing={<span className={`text-[10px] font-bold ${store.isEligible ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{store.isEligible ? "พร้อม" : store.skipReason}</span>} />)}
                      </div>
                      <button type="button" onClick={() => void runPreview()} disabled={previewLoading || creating} className="min-h-11 w-full rounded-xl border border-[var(--app-border)] text-xs font-bold">{previewLoading ? "กำลังตรวจสอบ..." : "ตรวจสอบอีกครั้ง"}</button>
                      <button type="button" onClick={() => void createCoupon()} disabled={preview.eligibleStores < 1 || creating || previewLoading || imageUploading} className="min-h-13 w-full rounded-xl bg-[var(--app-accent)] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-40">{creating ? "กำลังสร้างคูปอง..." : `สร้างคูปอง ${preview.eligibleStores} ร้าน`}</button>
                    </>
                  )}
                </MobileSection>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" disabled={step === 0} onClick={() => { setError(null); setStep((Math.max(0, step - 1)) as WizardStep); }} className="min-h-12 rounded-xl border border-[var(--app-border)] text-sm font-bold disabled:opacity-30">ย้อนกลับ</button>
              {step < 3 ? <button type="button" onClick={goNext} className="min-h-12 rounded-xl bg-[var(--app-accent)] text-sm font-bold text-white">ถัดไป</button> : <button type="button" onClick={() => setStep(0)} className="min-h-12 rounded-xl border border-[var(--app-accent)] text-sm font-bold text-[var(--app-accent)]">แก้ไขตั้งแต่ต้น</button>}
            </div>
          </>
        )}
      </div>

      {moreOpen && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
    </MobilePageShell>
  );
}

function WizardProgress({ step, onStep }: { step: WizardStep; onStep: (step: WizardStep) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {steps.map((label, index) => {
        const active = index === step;
        const complete = index < step;
        return <button key={label} type="button" onClick={() => onStep(index as WizardStep)} className="min-w-0"><span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${active ? "bg-[var(--app-accent)] text-white" : complete ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-tertiary)]"}`}>{complete ? "✓" : index + 1}</span><span className={`mt-1 block truncate text-[9px] font-semibold ${active ? "text-[var(--app-accent)]" : "text-[var(--app-text-tertiary)]"}`}>{label}</span></button>;
      })}
    </div>
  );
}

function ChoiceCard({ active, title, detail, disabled = false, onClick }: { active: boolean; title: string; detail: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`min-h-20 rounded-xl border p-3 text-left transition disabled:opacity-40 ${active ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5" : "border-[var(--app-border)] bg-[var(--app-surface)]"}`}><span className={`block text-xs font-bold ${active ? "text-[var(--app-accent)]" : ""}`}>{title}</span><span className="mt-1 block text-[10px] leading-4 text-[var(--app-text-tertiary)]">{detail}</span></button>;
}

function ChoiceRow({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return <div className={`rounded-xl border p-3 ${active ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5" : "border-[var(--app-border)]"}`}><button type="button" onClick={onClick} className="flex w-full items-center gap-2 text-left text-xs font-bold"><span className={`h-4 w-4 rounded-full border-2 ${active ? "border-[var(--app-accent)] bg-[var(--app-accent)] shadow-[inset_0_0_0_3px_var(--app-surface)]" : "border-[var(--app-border)]"}`} />{title}</button><div className="mt-2 flex items-center gap-1.5 pl-6">{children}</div></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-[var(--app-border-subtle)] pb-3 last:border-0 last:pb-0"><span className="shrink-0 text-[var(--app-text-tertiary)]">{label}</span><span className="min-w-0 text-right font-semibold leading-5">{value}</span></div>;
}

function HistoryView({ campaigns, loading, onRefresh, onOpen }: { campaigns: CouponCampaign[]; loading: boolean; onRefresh: () => void; onOpen: (id: string) => void }) {
  return (
    <MobileSection title="ประวัติคูปอง" description="คูปองที่สร้างผ่านระบบนี้" action={<button type="button" onClick={onRefresh} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-[10px] font-bold">รีเฟรช</button>}>
      {loading && campaigns.length === 0 ? <MobileCard><p className="py-8 text-center text-xs text-[var(--app-text-secondary)]">กำลังโหลด...</p></MobileCard> : campaigns.length === 0 ? <MobileEmptyState title="ยังไม่มีคูปอง" description="สร้างคูปองแรกจากแท็บ “สร้างคูปอง”" /> : <div className="space-y-2.5">{campaigns.map((campaign) => <button key={campaign.id} type="button" onClick={() => onOpen(campaign.id)} className="block w-full text-left"><MobileListCard title={campaign.title} subtitle={new Date(campaign.createdAt).toLocaleString("th-TH")} trailing={<StatusPill status={campaign.status} />}><div className="flex items-center justify-between text-[10px] text-[var(--app-text-tertiary)]"><span>{campaign.couponPayload.visibility === "PUBLIC" ? "Public" : "Unlisted"}</span><span>ดูรายละเอียด ›</span></div></MobileListCard></button>)}</div>}
    </MobileSection>
  );
}

function CampaignDetail({ detail, actionLoading, onBack, onRetry, onDiscontinue }: { detail: CouponCampaignDetail; actionLoading: boolean; onBack: () => void; onRetry: () => void; onDiscontinue: () => void }) {
  const failed = detail.summary.FAILED ?? 0;
  const success = detail.summary.SUCCESS ?? 0;
  const skipped = Object.entries(detail.summary).filter(([key]) => !["SUCCESS", "FAILED"].includes(key)).reduce((sum, [, value]) => sum + value, 0);
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-[var(--app-accent)]">‹ กลับประวัติ</button>
      <MobileSection title={detail.campaign.title} description={new Date(detail.campaign.createdAt).toLocaleString("th-TH")} action={<StatusPill status={detail.campaign.status} />}>
        <MobileMetricGrid>
          <MobileMetricCard label="สำเร็จ" value={success} tone="success" />
          <MobileMetricCard label="ล้มเหลว" value={failed} tone={failed > 0 ? "danger" : "default"} />
          <MobileMetricCard label="อื่น ๆ" value={skipped} wide />
        </MobileMetricGrid>
        {detail.campaign.description && <MobileCard><p className="whitespace-pre-line text-xs leading-5 text-[var(--app-text-secondary)]">{detail.campaign.description}</p></MobileCard>}
      </MobileSection>

      <MobileSection title="สถานะรายร้าน" description={`${detail.stores.length} ร้าน`}>
        <div className="space-y-2.5">{detail.stores.map((store) => <MobileListCard key={store.id} title={store.storeName} subtitle={store.lineOaName ?? "ไม่มี LINE OA"} trailing={<StatusPill status={store.status} />}>{store.lineCouponId && <p className="break-all text-[10px] text-[var(--app-text-tertiary)]">Coupon ID: {store.lineCouponId}</p>}{(store.errorMessage || store.skipReason) && <p className="mt-1 text-[10px] leading-4 text-rose-600 dark:text-rose-400">{store.errorMessage ?? store.skipReason}</p>}</MobileListCard>)}</div>
      </MobileSection>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={actionLoading || failed <= 0} onClick={onRetry} className="min-h-12 rounded-xl border border-[var(--app-border)] text-xs font-bold disabled:opacity-35">Retry ร้านที่ล้มเหลว</button>
        <button type="button" disabled={actionLoading || detail.campaign.status === "DISCONTINUED"} onClick={onDiscontinue} className="min-h-12 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white disabled:opacity-35">ยกเลิกคูปอง</button>
      </div>
    </div>
  );
}
