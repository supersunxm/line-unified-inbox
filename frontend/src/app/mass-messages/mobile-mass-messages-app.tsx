"use client";

import Link from "next/link";
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
import type {
  ApiStore,
  MassMessageAudienceType,
  MassMessageCampaignDetail,
  MassMessagePreviewResult,
  MassMessageStoreMode,
  StoreDeliveryDetail,
} from "@/types/api";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type TopView = "compose" | "history";
type ComposeStep = 0 | 1 | 2;
type AttachedImage = { url: string; previewUrl: string; name: string; size: number };

const MAX_MESSAGE_LENGTH = 5000;
const inputClass = "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-3 text-[16px] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]";
const audienceOptions: Array<{ value: Exclude<MassMessageAudienceType, "SELECTED_USERS">; label: string; detail: string }> = [
  { value: "ALL_KNOWN", label: "ลูกค้าที่รู้จักทั้งหมด", detail: "ทุก LINE user ที่ระบบสามารถระบุผู้รับได้" },
  { value: "NOT_REPLIED", label: "ยังไม่ตอบ", detail: "บทสนทนาที่กำลังรอการตอบจากร้าน" },
  { value: "NOTIFIED_BM", label: "แจ้ง BM แล้ว", detail: "ลูกค้าที่อยู่ในสถานะแจ้ง BM แล้ว" },
  { value: "REPLIED", label: "ตอบแล้ว", detail: "ลูกค้าที่ร้านตอบกลับแล้ว" },
];

function uuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function campaignTone(status: MassMessageCampaignDetail["status"]) {
  if (status === "COMPLETED") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (["FAILED", "CANCELLED"].includes(status)) return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  if (status === "PARTIAL") return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  if (status === "DRAFT") return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
  return "bg-[var(--app-accent)]/10 text-[var(--app-accent)]";
}

function CampaignPill({ status }: { status: MassMessageCampaignDetail["status"] }) {
  return <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${campaignTone(status)}`}>{status}</span>;
}

function deliveryTone(status: StoreDeliveryDetail["status"]) {
  if (status === "SUCCESS") return "text-emerald-600 dark:text-emerald-400";
  if (["FAILED", "SKIPPED"].includes(status)) return "text-rose-600 dark:text-rose-400";
  if (status === "PARTIAL") return "text-amber-600 dark:text-amber-400";
  return "text-[var(--app-accent)]";
}

export function MobileMassMessagesApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [topView, setTopView] = useState<TopView>("compose");
  const [step, setStep] = useState<ComposeStep>(0);
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [storeMode, setStoreMode] = useState<MassMessageStoreMode>("ALL");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [audienceType, setAudienceType] = useState<MassMessageAudienceType>("ALL_KNOWN");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [messageText, setMessageText] = useState("");
  const [image, setImage] = useState<AttachedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<MassMessagePreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<MassMessageCampaignDetail[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<MassMessageCampaignDetail | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void api.me().then((value) => { if (active) setUser(value); }).catch(() => window.location.replace("/login")).finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    let active = true;
    setStoresLoading(true);
    void api.stores(false).then((rows) => { if (active) setStores(rows ?? []); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "โหลดร้านไม่สำเร็จ"); }).finally(() => { if (active) setStoresLoading(false); });
    return () => { active = false; };
  }, [user]);

  const filteredStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    return stores.filter((store) => !q || store.name.toLowerCase().includes(q) || store.code?.toLowerCase().includes(q) || store.storeId?.toLowerCase().includes(q));
  }, [storeSearch, stores]);

  const effectiveStoreMode: MassMessageStoreMode = storeMode === "ALL" ? "ALL" : selectedStoreIds.length === 1 ? "SINGLE" : "MULTIPLE";

  const calculatePreview = useCallback(async () => {
    if (user?.role !== "ADMIN") return null;
    if (storeMode !== "ALL" && selectedStoreIds.length === 0) { setError("กรุณาเลือกร้านอย่างน้อย 1 ร้าน"); return null; }
    setPreviewLoading(true); setError(null);
    try {
      const result = await api.previewMassMessage({ storeSelection: { mode: effectiveStoreMode, storeIds: storeMode === "ALL" ? undefined : selectedStoreIds }, audienceType });
      setPreview(result);
      return result;
    } catch (reason) {
      setPreview(null); setError(reason instanceof Error ? reason.message : "คำนวณผู้รับไม่สำเร็จ"); return null;
    } finally { setPreviewLoading(false); }
  }, [audienceType, effectiveStoreMode, selectedStoreIds, storeMode, user?.role]);

  const loadHistory = useCallback(async () => {
    if (user?.role !== "ADMIN") return;
    setHistoryLoading(true); setError(null);
    try { const result = await api.listMassMessageCampaigns(50, 0); setHistory(result.items ?? []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "โหลดประวัติไม่สำเร็จ"); }
    finally { setHistoryLoading(false); }
  }, [user?.role]);

  const switchView = (next: TopView) => {
    setTopView(next); setActiveCampaign(null); setError(null);
    if (next === "history") void loadHistory();
  };

  const openCampaign = async (id: string) => {
    setCampaignLoading(true); setError(null);
    try { setActiveCampaign(await api.getMassMessageCampaign(id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "โหลด campaign ไม่สำเร็จ"); }
    finally { setCampaignLoading(false); }
  };

  useEffect(() => {
    if (!activeCampaign || ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED", "DRAFT"].includes(activeCampaign.status)) return;
    const timer = window.setTimeout(async () => {
      try { setActiveCampaign(await api.getMassMessageCampaign(activeCampaign.id)); } catch {}
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [activeCampaign]);

  const toggleStore = (id: string) => {
    setSelectedStoreIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setPreview(null);
  };

  const uploadImage = async (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png)$/)) { setError("รองรับเฉพาะ JPG / PNG"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("รูปต้องไม่เกิน 10 MB"); return; }
    setUploading(true); setError(null);
    try {
      const result = await api.uploadMassMessageImage(file);
      setImage({ url: result.url, previewUrl: result.previewUrl || result.url, name: file.name, size: file.size });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "อัปโหลดรูปไม่สำเร็จ"); }
    finally { setUploading(false); }
  };

  const canContinueAudience = storeMode === "ALL" || selectedStoreIds.length > 0;
  const hasMessage = Boolean(messageText.trim() || image);

  const nextStep = async () => {
    setError(null);
    if (step === 0) {
      if (!canContinueAudience) { setError("กรุณาเลือกร้านอย่างน้อย 1 ร้าน"); return; }
      setStep(1); return;
    }
    if (step === 1) {
      if (!hasMessage) { setError("กรุณาใส่ข้อความหรือรูปภาพอย่างน้อย 1 อย่าง"); return; }
      if (messageText.length > MAX_MESSAGE_LENGTH) { setError(`ข้อความต้องไม่เกิน ${MAX_MESSAGE_LENGTH.toLocaleString()} ตัวอักษร`); return; }
      setStep(2);
      await calculatePreview();
    }
  };

  const send = async () => {
    const currentPreview = preview ?? await calculatePreview();
    if (!currentPreview || currentPreview.eligibleStoreCount < 1 || currentPreview.estimatedRecipientCount < 1) return;
    if (!hasMessage) { setError("ไม่มีเนื้อหาสำหรับส่ง"); return; }
    if (!window.confirm(`ยืนยันส่ง Broadcast ไปยังประมาณ ${currentPreview.estimatedRecipientCount.toLocaleString()} คน ใน ${currentPreview.eligibleStoreCount} ร้าน?`)) return;
    setSending(true); setError(null);
    const messages: Array<{ type: "text"; text: string } | { type: "image"; originalContentUrl: string; previewImageUrl: string }> = [];
    if (messageText.trim()) messages.push({ type: "text", text: messageText.trim() });
    if (image) messages.push({ type: "image", originalContentUrl: image.url, previewImageUrl: image.previewUrl });
    try {
      const campaign = await api.createMassMessage({ campaignRequestId: uuid(), title: campaignTitle.trim() || undefined, storeSelection: { mode: effectiveStoreMode, storeIds: storeMode === "ALL" ? undefined : selectedStoreIds }, audienceType, messages });
      setActiveCampaign(campaign); setTopView("history");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "สร้าง Broadcast ไม่สำเร็จ"); }
    finally { setSending(false); }
  };

  const resetComposer = () => {
    setStep(0); setStoreMode("ALL"); setSelectedStoreIds([]); setAudienceType("ALL_KNOWN"); setCampaignTitle(""); setMessageText(""); setImage(null); setPreview(null); setActiveCampaign(null); setTopView("compose"); setError(null);
  };

  if (!authChecked || !user) return <main className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิด Mass Message...</main>;

  return <MobilePageShell bottomNav={<MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />}>
    <MobilePageHeader eyebrow="Marketing · Broadcast" title="Mass Message" description="สร้าง Broadcast ข้ามหลาย LINE OA พร้อมตรวจจำนวนผู้รับก่อนส่ง" action={topView === "compose" && step > 0 ? <button type="button" onClick={resetComposer} className="min-h-10 rounded-xl border border-[var(--app-border)] px-3 text-[10px] font-bold">เริ่มใหม่</button> : undefined} />
    {user.role === "ADMIN" && !activeCampaign && <MobileSectionTabs<TopView> value={topView} items={[{ value: "compose", label: "สร้างข้อความ" }, { value: "history", label: "ประวัติ", badge: history.length || undefined }]} onChange={switchView} />}
    <div className="space-y-4 px-4 py-4 pb-8">
      {error && <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs leading-5 text-rose-600 dark:text-rose-400">{error}</div>}
      {user.role !== "ADMIN" ? <MobileEmptyState title="ไม่มีสิทธิ์ใช้งาน" description="Mass Message ใช้งานได้เฉพาะผู้ดูแลระบบ" /> : activeCampaign ? <CampaignDetail campaign={activeCampaign} loading={campaignLoading} onBack={() => { setActiveCampaign(null); setTopView("history"); void loadHistory(); }} onNew={resetComposer} /> : topView === "history" ? <History campaigns={history} loading={historyLoading} onReload={loadHistory} onOpen={openCampaign} /> : <Composer step={step} stores={stores} storesLoading={storesLoading} filteredStores={filteredStores} storeSearch={storeSearch} storeMode={storeMode} selectedStoreIds={selectedStoreIds} audienceType={audienceType} campaignTitle={campaignTitle} messageText={messageText} image={image} uploading={uploading} preview={preview} previewLoading={previewLoading} sending={sending} onStoreSearch={setStoreSearch} onStoreMode={(value) => { setStoreMode(value); setPreview(null); }} onToggleStore={toggleStore} onAudience={(value) => { setAudienceType(value); setPreview(null); }} onTitle={setCampaignTitle} onMessage={setMessageText} onImage={uploadImage} onRemoveImage={() => setImage(null)} onBack={() => { setError(null); setStep((Math.max(0, step - 1)) as ComposeStep); }} onNext={nextStep} onPreview={calculatePreview} onSend={send} />}
    </div>
    {moreOpen && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
  </MobilePageShell>;
}

function Composer(props: {
  step: ComposeStep; stores: ApiStore[]; storesLoading: boolean; filteredStores: ApiStore[]; storeSearch: string; storeMode: MassMessageStoreMode; selectedStoreIds: string[]; audienceType: MassMessageAudienceType; campaignTitle: string; messageText: string; image: AttachedImage | null; uploading: boolean; preview: MassMessagePreviewResult | null; previewLoading: boolean; sending: boolean;
  onStoreSearch: (value: string) => void; onStoreMode: (value: MassMessageStoreMode) => void; onToggleStore: (id: string) => void; onAudience: (value: MassMessageAudienceType) => void; onTitle: (value: string) => void; onMessage: (value: string) => void; onImage: (file: File) => void; onRemoveImage: () => void; onBack: () => void; onNext: () => void; onPreview: () => void; onSend: () => void;
}) {
  const { step } = props;
  return <>
    <div className="grid grid-cols-3 gap-2">{["ผู้รับ", "ข้อความ", "ตรวจสอบ"].map((label, index) => <div key={label} className="text-center"><span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${index === step ? "bg-[var(--app-accent)] text-white" : index < step ? "bg-emerald-500/15 text-emerald-600" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-tertiary)]"}`}>{index < step ? "✓" : index + 1}</span><p className={`mt-1 text-[9px] font-bold ${index === step ? "text-[var(--app-accent)]" : "text-[var(--app-text-tertiary)]"}`}>{label}</p></div>)}</div>

    {step === 0 && <div className="space-y-4">
      <MobileSection title="เลือกร้านค้า" description="เลือกร้านที่ต้องการ Broadcast ผ่าน LINE OA">
        <MobileCard className="space-y-3">
          <div className="grid grid-cols-2 gap-2"><Choice active={props.storeMode === "ALL"} title="ทุกร้าน" detail={`${props.stores.length} ร้าน`} onClick={() => props.onStoreMode("ALL")} /><Choice active={props.storeMode !== "ALL"} title="เลือกร้าน" detail={`${props.selectedStoreIds.length} ร้าน`} onClick={() => props.onStoreMode("MULTIPLE")} /></div>
          {props.storeMode !== "ALL" && <><input value={props.storeSearch} onChange={(event) => props.onStoreSearch(event.target.value)} placeholder="ค้นหาร้าน / Store ID" className={inputClass} /><div className="space-y-2">{props.storesLoading ? <p className="py-5 text-center text-xs text-[var(--app-text-secondary)]">กำลังโหลดร้าน...</p> : props.filteredStores.map((store) => { const active = props.selectedStoreIds.includes(store.id); return <button key={store.id} type="button" onClick={() => props.onToggleStore(store.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${active ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5" : "border-[var(--app-border)]"}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${active ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white" : "border-[var(--app-border)]"}`}>{active ? "✓" : ""}</span><span className="min-w-0"><span className="block truncate text-sm font-bold">{store.name}</span><span className="block truncate text-[10px] text-[var(--app-text-tertiary)]">{store.code ?? store.storeId ?? "—"}</span></span></button>; })}</div></>}
        </MobileCard>
      </MobileSection>
      <MobileSection title="กลุ่มผู้รับ" description="กรองลูกค้าตามสถานะบทสนทนา"><div className="space-y-2">{audienceOptions.map((option) => <button key={option.value} type="button" onClick={() => props.onAudience(option.value)} className={`w-full rounded-xl border p-3 text-left ${props.audienceType === option.value ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5" : "border-[var(--app-border)] bg-[var(--app-surface)]"}`}><p className={`text-xs font-bold ${props.audienceType === option.value ? "text-[var(--app-accent)]" : ""}`}>{option.label}</p><p className="mt-1 text-[10px] leading-4 text-[var(--app-text-tertiary)]">{option.detail}</p></button>)}</div></MobileSection>
    </div>}

    {step === 1 && <div className="space-y-4">
      <MobileSection title="ข้อความ Broadcast" description="ส่งข้อความ, รูปภาพ หรือทั้งสองอย่าง"><MobileCard className="space-y-4"><label><span className="mb-1 block text-[11px] font-semibold text-[var(--app-text-secondary)]">ชื่อ Campaign (ไม่บังคับ)</span><input value={props.campaignTitle} maxLength={120} onChange={(event) => props.onTitle(event.target.value)} placeholder="เช่น Reno16 Follow-up" className={inputClass} /></label><label><span className="mb-1 block text-[11px] font-semibold text-[var(--app-text-secondary)]">ข้อความ</span><textarea value={props.messageText} maxLength={MAX_MESSAGE_LENGTH} rows={7} onChange={(event) => props.onMessage(event.target.value)} placeholder="พิมพ์ข้อความที่ต้องการส่ง..." className={`${inputClass} resize-none`} /><p className="mt-1 text-right text-[9px] text-[var(--app-text-tertiary)]">{props.messageText.length.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}</p></label><div><span className="mb-1 block text-[11px] font-semibold text-[var(--app-text-secondary)]">รูปภาพ</span>{props.image ? <div className="overflow-hidden rounded-2xl border border-[var(--app-border)]"><div className="aspect-[16/9] bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(props.image.previewUrl)})` }} /><div className="flex items-center justify-between gap-2 p-3"><span className="min-w-0 truncate text-[10px] text-[var(--app-text-secondary)]">{props.image.name}</span><button type="button" onClick={props.onRemoveImage} className="shrink-0 text-[10px] font-bold text-rose-600">ลบ</button></div></div> : <label className="flex min-h-24 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-xs font-bold text-[var(--app-accent)]">{props.uploading ? "กำลังอัปโหลด..." : "+ เพิ่มรูป JPG / PNG"}<input type="file" accept="image/jpeg,image/png" disabled={props.uploading} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onImage(file); event.currentTarget.value = ""; }} /></label>}</div></MobileCard></MobileSection>
    </div>}

    {step === 2 && <div className="space-y-4">
      <MobileSection title="จำนวนผู้รับโดยประมาณ" description="ระบบคำนวณจากร้านและ Audience ปัจจุบัน">{props.previewLoading && !props.preview ? <MobileCard><p className="py-8 text-center text-xs text-[var(--app-text-secondary)]">กำลังคำนวณ...</p></MobileCard> : props.preview ? <><MobileMetricGrid><MobileMetricCard label="ผู้รับประมาณ" value={props.preview.estimatedRecipientCount.toLocaleString()} tone="accent" wide /><MobileMetricCard label="ร้านพร้อมส่ง" value={props.preview.eligibleStoreCount} tone="success" /><MobileMetricCard label="ร้านถูกข้าม" value={props.preview.skippedStoreCount} tone={props.preview.skippedStoreCount ? "warning" : "default"} /></MobileMetricGrid><div className="space-y-2.5">{props.preview.stores.map((store) => <MobileListCard key={store.storeId} title={store.storeName} subtitle={store.lineOaName ?? "ไม่มี LINE OA"} trailing={<span className={`text-[9px] font-bold ${store.status === "READY" ? "text-emerald-600" : "text-amber-600"}`}>{store.status}</span>}><div className="flex items-center justify-between text-[10px]"><span className="text-[var(--app-text-tertiary)]">Recipients</span><strong>{store.recipientCount.toLocaleString()}</strong></div>{store.skipReason && <p className="mt-1 text-[9px] text-amber-600">{store.skipReason}</p>}</MobileListCard>)}</div></> : <MobileCard><button type="button" onClick={props.onPreview} className="min-h-12 w-full rounded-xl bg-[var(--app-accent)] text-sm font-bold text-white">คำนวณผู้รับ</button></MobileCard>}</MobileSection>
      <MobileSection title="เนื้อหาที่จะส่ง"><MobileCard className="space-y-3">{props.campaignTitle && <p className="text-xs font-bold">{props.campaignTitle}</p>}{props.messageText.trim() && <p className="whitespace-pre-wrap break-words text-xs leading-5">{props.messageText}</p>}{props.image && <div className="aspect-[16/9] rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(props.image.previewUrl)})` }} />}</MobileCard></MobileSection>
      <button type="button" disabled={!props.preview || props.preview.estimatedRecipientCount < 1 || props.sending} onClick={props.onSend} className="min-h-14 w-full rounded-xl bg-[var(--app-accent)] px-4 text-sm font-bold text-white disabled:opacity-35">{props.sending ? "กำลังสร้าง Campaign..." : props.preview ? `ยืนยันส่งประมาณ ${props.preview.estimatedRecipientCount.toLocaleString()} คน` : "กรุณาคำนวณผู้รับก่อน"}</button>
    </div>}

    <div className="grid grid-cols-2 gap-2 pt-2"><button type="button" disabled={step === 0} onClick={props.onBack} className="min-h-12 rounded-xl border border-[var(--app-border)] text-sm font-bold disabled:opacity-30">ย้อนกลับ</button>{step < 2 ? <button type="button" onClick={props.onNext} className="min-h-12 rounded-xl bg-[var(--app-accent)] text-sm font-bold text-white">ถัดไป</button> : <button type="button" onClick={props.onPreview} disabled={props.previewLoading} className="min-h-12 rounded-xl border border-[var(--app-border)] text-xs font-bold">{props.previewLoading ? "กำลังคำนวณ..." : "คำนวณใหม่"}</button>}</div>
  </>;
}

function Choice({ active, title, detail, onClick }: { active: boolean; title: string; detail: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`min-h-20 rounded-xl border p-3 text-left ${active ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5" : "border-[var(--app-border)]"}`}><p className={`text-xs font-bold ${active ? "text-[var(--app-accent)]" : ""}`}>{title}</p><p className="mt-1 text-[10px] text-[var(--app-text-tertiary)]">{detail}</p></button>; }

function History({ campaigns, loading, onReload, onOpen }: { campaigns: MassMessageCampaignDetail[]; loading: boolean; onReload: () => void; onOpen: (id: string) => void }) {
  return <MobileSection title="ประวัติ Campaign" description="Broadcast และ Draft ล่าสุด" action={<button type="button" onClick={onReload} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-[10px] font-bold">รีเฟรช</button>}>{loading && campaigns.length === 0 ? <MobileCard><p className="py-10 text-center text-xs text-[var(--app-text-secondary)]">กำลังโหลด...</p></MobileCard> : campaigns.length === 0 ? <MobileEmptyState title="ยังไม่มี Campaign" /> : <div className="space-y-2.5">{campaigns.map((campaign) => campaign.status === "DRAFT" ? <Link key={campaign.id} href={`/mass-messages/drafts/${encodeURIComponent(campaign.id)}`} className="block"><MobileListCard title={campaign.title ?? "Untitled Draft"} subtitle={`${new Date(campaign.createdAt).toLocaleString("th-TH")} · ${campaign.estimatedRecipientCount.toLocaleString()} recipients`} trailing={<CampaignPill status={campaign.status} />}><p className="text-[10px] text-sky-600 dark:text-sky-400">เปิดเพื่อแก้ไข Draft ›</p></MobileListCard></Link> : <button key={campaign.id} type="button" onClick={() => onOpen(campaign.id)} className="block w-full text-left"><MobileListCard title={campaign.title ?? `Campaign ${campaign.id.slice(0, 8)}`} subtitle={`${new Date(campaign.createdAt).toLocaleString("th-TH")} · ${campaign.estimatedRecipientCount.toLocaleString()} recipients`} trailing={<CampaignPill status={campaign.status} />}><div className="grid grid-cols-3 gap-2"><MiniStat label="Stores" value={campaign.eligibleStoreCount} /><MiniStat label="Success" value={campaign.successRecipientCount} /><MiniStat label="Failed" value={campaign.failedRecipientCount} /></div></MobileListCard></button>)}</div>}</MobileSection>;
}

function CampaignDetail({ campaign, loading, onBack, onNew }: { campaign: MassMessageCampaignDetail; loading: boolean; onBack: () => void; onNew: () => void }) {
  const deliveries = campaign.storeDeliveries ?? [];
  return <div className="space-y-4"><div className="flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="min-h-10 text-sm font-bold text-[var(--app-accent)]">‹ ประวัติ</button><CampaignPill status={campaign.status} /></div><MobileSection title={campaign.title ?? `Campaign ${campaign.id.slice(0, 8)}`} description={`สร้างเมื่อ ${new Date(campaign.createdAt).toLocaleString("th-TH")}`}><MobileMetricGrid><MobileMetricCard label="Recipients" value={campaign.estimatedRecipientCount.toLocaleString()} wide /><MobileMetricCard label="Accepted" value={campaign.acceptedRecipientCount.toLocaleString()} tone="success" /><MobileMetricCard label="Failed" value={campaign.failedRecipientCount.toLocaleString()} tone={campaign.failedRecipientCount ? "danger" : "default"} /></MobileMetricGrid>{loading && <p className="text-center text-[10px] text-[var(--app-text-secondary)]">กำลังอัปเดตสถานะ...</p>}{campaign.errorMessage && <div className="rounded-xl bg-rose-500/10 p-3 text-[10px] text-rose-600">{campaign.errorMessage}</div>}</MobileSection><MobileSection title="สถานะรายร้าน" description={`${deliveries.length || campaign.storeCount} ร้าน`}>{deliveries.length === 0 ? <MobileEmptyState title="ยังไม่มีรายละเอียด Delivery" description={campaign.status === "PENDING" || campaign.status === "RUNNING" ? "ระบบกำลังเตรียมการส่ง" : undefined} /> : <div className="space-y-2.5">{deliveries.map((delivery) => <MobileListCard key={delivery.id} title={delivery.storeName} subtitle={delivery.lineOaName ?? "ไม่มี LINE OA"} trailing={<span className={`text-[9px] font-bold ${deliveryTone(delivery.status)}`}>{delivery.status}</span>}><div className="grid grid-cols-3 gap-2"><MiniStat label="Recipients" value={delivery.recipientCount} /><MiniStat label="Accepted" value={delivery.acceptedCount} /><MiniStat label="Failed" value={delivery.failedCount} /></div>{(delivery.errorMessage || delivery.skipReason) && <p className="mt-2 text-[9px] leading-4 text-rose-600">{delivery.errorMessage ?? delivery.skipReason}</p>}</MobileListCard>)}</div>}</MobileSection>{["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(campaign.status) && <button type="button" onClick={onNew} className="min-h-12 w-full rounded-xl bg-[var(--app-accent)] text-sm font-bold text-white">สร้าง Broadcast ใหม่</button>}</div>;
}

function MiniStat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-[var(--app-surface-subtle)] px-2 py-2"><p className="text-[9px] text-[var(--app-text-tertiary)]">{label}</p><p className="mt-0.5 text-sm font-bold tabular-nums">{value.toLocaleString()}</p></div>; }
