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

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type DraftTab = "content" | "audience" | "preview";
type DraftMessage =
  | { type: "text"; text: string }
  | { type: "image"; originalContentUrl: string; previewImageUrl: string };
type ComposerResponse = {
  id: string;
  campaignRequestId: string;
  title: string | null;
  status: "DRAFT";
  audienceType: "SELECTED_USERS";
  messages: DraftMessage[];
  audience: {
    recipientCount: number;
    storeCount: number;
    lineOaCount: number;
    filters: { from: string | null; to: string | null; storeId: string | null };
    statuses: string[];
    messageabilityDefinition: string;
    stores: Array<{
      storeId: string;
      externalStoreId: string | null;
      storeName: string;
      storeCode: string | null;
      lineOfficialAccountId: string;
      lineOaName: string;
      recipientCount: number;
    }>;
  };
  createdAt: string;
  updatedAt: string;
};
type AttachedImage = { originalContentUrl: string; previewImageUrl: string; label: string };

const inputClass = "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-3 text-[16px] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]";

async function readError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string") return body.message;
  } catch {}
  return fallback;
}

function composerUrl(campaignId: string) {
  return `/api-backend/admin/purchase-analytics/audience/broadcast-draft/${encodeURIComponent(campaignId)}/composer`;
}

export function MobilePurchaseBroadcastComposer({ campaignId }: { campaignId: string }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [draft, setDraft] = useState<ComposerResponse | null>(null);
  const [tab, setTab] = useState<DraftTab>("content");
  const [title, setTitle] = useState("");
  const [messageText, setMessageText] = useState("");
  const [image, setImage] = useState<AttachedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const hydrate = useCallback((data: ComposerResponse) => {
    setDraft(data);
    setTitle(data.title ?? "");
    const text = data.messages.find((item): item is Extract<DraftMessage, { type: "text" }> => item.type === "text");
    const savedImage = data.messages.find((item): item is Extract<DraftMessage, { type: "image" }> => item.type === "image");
    setMessageText(text?.text ?? "");
    setImage(savedImage ? { originalContentUrl: savedImage.originalContentUrl, previewImageUrl: savedImage.previewImageUrl, label: "Saved image" } : null);
  }, []);

  const loadDraft = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(composerUrl(campaignId), { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response, `Unable to load draft (${response.status}).`));
      hydrate(await response.json() as ComposerResponse);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "โหลด Draft ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [campaignId, hydrate]);

  useEffect(() => {
    let active = true;
    void api.me()
      .then((value) => { if (active) setUser(value); })
      .catch(() => window.location.replace("/login"))
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (user?.role === "ADMIN") void loadDraft();
    else if (user) setLoading(false);
  }, [loadDraft, user]);

  const messages = useMemo<DraftMessage[]>(() => {
    const items: DraftMessage[] = [];
    if (messageText.trim()) items.push({ type: "text", text: messageText.trim() });
    if (image) items.push({ type: "image", originalContentUrl: image.originalContentUrl, previewImageUrl: image.previewImageUrl });
    return items;
  }, [image, messageText]);

  const markDirty = () => setSavedAt(null);

  const saveDraft = async () => {
    if (!draft || user?.role !== "ADMIN" || saving) return;
    setSaving(true); setError(null); setSavedAt(null);
    try {
      const response = await fetch(composerUrl(campaignId), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || undefined, messages }),
      });
      if (!response.ok) throw new Error(await readError(response, `Unable to save draft (${response.status}).`));
      const updated = await response.json() as ComposerResponse;
      hydrate(updated);
      setSavedAt(updated.updatedAt);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึก Draft ไม่สำเร็จ"); }
    finally { setSaving(false); }
  };

  const uploadImage = async (file: File) => {
    if (!(["image/jpeg", "image/png"] as string[]).includes(file.type)) { setError("รองรับเฉพาะ JPEG และ PNG"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("รูปต้องมีขนาดไม่เกิน 10 MB"); return; }
    setUploading(true); setError(null);
    try {
      const uploaded = await api.uploadMassMessageImage(file);
      setImage({ originalContentUrl: uploaded.url, previewImageUrl: uploaded.previewUrl || uploaded.url, label: file.name });
      markDirty();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "อัปโหลดรูปไม่สำเร็จ"); }
    finally { setUploading(false); }
  };

  if (!authChecked || !user) return <main className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิด Campaign Draft...</main>;

  return (
    <MobilePageShell bottomNav={<MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />}>
      <MobilePageHeader
        eyebrow="Mass Message · Purchase Intelligence"
        title={draft?.title || "Campaign Draft"}
        description="Audience ถูกล็อกจาก Purchase Intelligence · การบันทึก Draft จะไม่ส่งข้อความ"
        action={<span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[9px] font-bold text-amber-600 dark:text-amber-400">DRAFT ONLY</span>}
      />
      {user.role === "ADMIN" && draft && (
        <MobileSectionTabs<DraftTab>
          value={tab}
          items={[{ value: "content", label: "เนื้อหา", badge: messages.length }, { value: "audience", label: "Audience", badge: draft.audience.recipientCount }, { value: "preview", label: "Preview" }]}
          onChange={setTab}
        />
      )}

      <div className="space-y-4 px-4 py-4 pb-8">
        {user.role !== "ADMIN" ? <MobileEmptyState title="ไม่มีสิทธิ์ใช้งาน" description="Purchase Intelligence Draft ใช้งานได้เฉพาะ Administrator" /> : loading ? <MobileCard><p className="py-10 text-center text-xs text-[var(--app-text-secondary)]">กำลังโหลด Draft...</p></MobileCard> : error && !draft ? <MobileCard><p className="text-xs text-rose-600">{error}</p><button type="button" onClick={() => void loadDraft()} className="mt-3 min-h-11 w-full rounded-xl border border-[var(--app-border)] text-xs font-bold">ลองใหม่</button></MobileCard> : draft ? (
          <>
            {error && <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-400">{error}</div>}
            {savedAt && <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-600 dark:text-emerald-400">บันทึก Draft แล้ว · {new Date(savedAt).toLocaleString("th-TH")}</div>}

            {tab === "content" && (
              <MobileSection title="Campaign content" description="สูงสุด 1 ข้อความ + 1 รูปภาพ">
                <MobileCard className="space-y-4">
                  <label><span className="mb-1 block text-[11px] font-semibold text-[var(--app-text-secondary)]">ชื่อ Campaign</span><input value={title} maxLength={120} onChange={(event) => { setTitle(event.target.value); markDirty(); }} placeholder="เช่น Reno upgrade campaign" className={inputClass} /></label>
                  <label><span className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[var(--app-text-secondary)]"><span>ข้อความ</span><span>{messageText.length}/5000</span></span><textarea value={messageText} maxLength={5000} rows={8} onChange={(event) => { setMessageText(event.target.value); markDirty(); }} placeholder="พิมพ์ข้อความที่ต้องการเตรียมไว้..." className={`${inputClass} resize-none`} /></label>
                  <div><p className="mb-1 text-[11px] font-semibold text-[var(--app-text-secondary)]">รูปภาพ</p>{image ? <div className="overflow-hidden rounded-2xl border border-[var(--app-border)]"><img src={image.previewImageUrl} alt="Draft attachment preview" className="aspect-[16/9] w-full object-cover" /><div className="flex items-center justify-between gap-2 p-3"><span className="min-w-0 truncate text-[10px]">{image.label}</span><button type="button" onClick={() => { setImage(null); markDirty(); }} className="text-[10px] font-bold text-rose-600">ลบ</button></div></div> : <label className="flex min-h-24 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-xs font-bold text-[var(--app-accent)]">{uploading ? "กำลังอัปโหลด..." : "+ เพิ่มรูป JPG / PNG"}<input type="file" accept="image/jpeg,image/png" disabled={uploading} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.currentTarget.value = ""; }} /></label>}</div>
                </MobileCard>
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[10px] leading-5 text-amber-700 dark:text-amber-300">Save Draft แก้เฉพาะเนื้อหา ไม่สร้าง delivery, ไม่เริ่ม processor และไม่ใช้ LINE quota</div>
              </MobileSection>
            )}

            {tab === "audience" && (
              <div className="space-y-4">
                <MobileMetricGrid><MobileMetricCard label="Customers" value={draft.audience.recipientCount.toLocaleString()} tone="accent" wide /><MobileMetricCard label="Stores" value={draft.audience.storeCount.toLocaleString()} /><MobileMetricCard label="LINE OAs" value={draft.audience.lineOaCount.toLocaleString()} /></MobileMetricGrid>
                <MobileSection title="Audience snapshot" description="Locked · ไม่สามารถเพิ่มผู้รับจากหน้านี้"><MobileCard className="space-y-2"><div className="flex flex-wrap gap-2">{draft.audience.statuses.map((status) => <span key={status} className="rounded-full bg-[var(--app-surface-subtle)] px-2.5 py-1 text-[9px] font-bold">{status}</span>)}</div>{(draft.audience.filters.from || draft.audience.filters.to) && <p className="text-[10px] text-[var(--app-text-secondary)]">ช่วงวันที่: {draft.audience.filters.from || "…"} → {draft.audience.filters.to || "…"}</p>}<p className="text-[10px] leading-4 text-[var(--app-text-tertiary)]">{draft.audience.messageabilityDefinition}</p></MobileCard></MobileSection>
                <MobileSection title="Store / LINE OA" description={`${draft.audience.stores.length} รายการ`}><div className="space-y-2.5">{draft.audience.stores.map((store) => <MobileListCard key={`${store.storeId}:${store.lineOfficialAccountId}`} title={`${store.externalStoreId ? `[${store.externalStoreId}] ` : ""}${store.storeName}`} subtitle={store.lineOaName} trailing={<strong className="text-sm tabular-nums">{store.recipientCount.toLocaleString()}</strong>}>{store.storeCode && <p className="text-[9px] text-[var(--app-text-tertiary)]">{store.storeCode}</p>}</MobileListCard>)}</div></MobileSection>
              </div>
            )}

            {tab === "preview" && (
              <div className="space-y-4">
                <MobileSection title="Message preview" description="Preview เท่านั้น ไม่มี request ไปยังลูกค้าจากหน้าจอนี้"><MobileCard><div className="rounded-2xl bg-[var(--app-surface-subtle)] p-3"><div className="max-w-[92%] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-xs leading-5">{messageText.trim() ? <p className="whitespace-pre-wrap break-words">{messageText}</p> : <p className="italic text-[var(--app-text-tertiary)]">ข้อความ Preview จะแสดงที่นี่</p>}{image && <img src={image.previewImageUrl} alt="Draft preview" className="mt-3 w-full rounded-xl object-cover" />}</div></div></MobileCard></MobileSection>
                <MobileCard className="border-amber-500/30"><p className="text-xs font-bold text-amber-600 dark:text-amber-400">Review & Send ยังถูกล็อก</p><p className="mt-1 text-[10px] leading-5 text-[var(--app-text-secondary)]">หน้านี้อนุญาตให้เตรียมและบันทึก Draft เท่านั้น ก่อนส่งจริงระบบยังต้องทำ recipient re-validation, quota check และ final confirmation</p><button type="button" disabled className="mt-3 min-h-12 w-full cursor-not-allowed rounded-xl bg-[var(--app-surface-subtle)] text-xs font-bold text-[var(--app-text-tertiary)]">Review & Send — Locked</button></MobileCard>
              </div>
            )}

            <button type="button" onClick={() => void saveDraft()} disabled={saving} className="sticky bottom-2 z-10 min-h-14 w-full rounded-xl bg-[var(--app-accent)] px-4 text-sm font-bold text-white shadow-lg disabled:opacity-40">{saving ? "กำลังบันทึก..." : "Save Draft"}</button>
          </>
        ) : null}
      </div>
      {moreOpen && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
    </MobilePageShell>
  );
}
