"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LanguageControl, pickLanguageText, useAppLanguage } from "../../../language";

interface StoreSummary {
  id: string;
  externalStoreId?: string | null;
  storeName: string;
  accountName: string;
  province?: string | null;
  region?: string | null;
  tiktokUsername?: string | null;
}

interface PendingRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requestedAt: string;
  store: StoreSummary | null;
}

interface BindingContext {
  accountId: string;
  username?: string | null;
  currentStore: StoreSummary | null;
  suggestedStore: StoreSummary | null;
  pendingRequest: PendingRequest | null;
  options: StoreSummary[];
}

export interface StoreBindingSuccessProps {
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  followerCount?: number;
  followingCount?: number;
  likesCount?: number;
  videoCount?: number;
}

const copy = {
  th: {
    title: "TikTok เชื่อมต่อสำเร็จ",
    subtitle: "บัญชีของคุณเชื่อมต่อกับ OPPO Brand Shop แล้ว",
    followers: "ผู้ติดตาม",
    following: "กำลังติดตาม",
    likes: "ยอดถูกใจทั้งหมด",
    videos: "วิดีโอ",
    storeTitle: "เชื่อมบัญชีนี้กับสาขาของคุณ",
    found: "เราพบร้านที่น่าจะตรงกับบัญชี TikTok นี้",
    confirm: "ยืนยันและเชื่อมต่อร้านนี้",
    chooseOther: "เลือกร้านอื่น",
    choose: "เลือกสาขาของคุณ",
    searchPlaceholder: "ค้นหาชื่อร้าน จังหวัด หรือ Store ID",
    request: "ส่งคำขอเชื่อมต่อ",
    pendingTitle: "ส่งคำขอให้ HQ ตรวจสอบแล้ว",
    pendingDesc: "สาขาที่เลือกจะยังไม่ถูกเปลี่ยนจนกว่า HQ จะอนุมัติ",
    connected: "เชื่อมต่อร้านสำเร็จ",
    viewAnalytics: "ดูข้อมูล TikTok ของร้าน",
    changeStore: "เปลี่ยนร้าน / เลือกร้านอื่น",
    loading: "กำลังตรวจสอบข้อมูลสาขา...",
    retry: "เริ่มการเชื่อมต่อใหม่",
    sessionExpired: "เซสชันสำหรับผูกร้านหมดอายุ แต่การเชื่อมต่อ TikTok สำเร็จแล้ว",
    noResults: "ไม่พบสาขาที่ตรงกับคำค้นหา",
    saving: "กำลังบันทึก...",
    safe: "การเชื่อมต่อนี้เป็นแบบอ่านอย่างเดียว ระบบจะไม่โพสต์ แก้ไข หรือลบคอนเทนต์บน TikTok",
    hqReview: "หาก TikTok username ไม่ตรงกับข้อมูล Store Master การเปลี่ยนสาขาจะต้องผ่าน HQ ก่อน",
  },
  en: {
    title: "TikTok Connected Successfully",
    subtitle: "Your account is now connected to OPPO Brand Shop",
    followers: "Followers",
    following: "Following",
    likes: "Total Likes",
    videos: "Videos",
    storeTitle: "Associate this account with your store",
    found: "We found a store that matches this TikTok account",
    confirm: "Confirm and connect this store",
    chooseOther: "Choose another store",
    choose: "Choose your store",
    searchPlaceholder: "Search store name, province, or Store ID",
    request: "Request store connection",
    pendingTitle: "Submitted for HQ review",
    pendingDesc: "The store association will not change until HQ approves the request.",
    connected: "Store connected",
    viewAnalytics: "View store TikTok analytics",
    changeStore: "Change / choose another store",
    loading: "Checking store association...",
    retry: "Start connection again",
    sessionExpired: "The store-association session expired, but TikTok authorization succeeded.",
    noResults: "No matching stores found",
    saving: "Saving...",
    safe: "This connection is read-only. The system will not post, edit, or delete TikTok content.",
    hqReview: "If the TikTok username does not match Store Master, a different-store request requires HQ approval.",
  },
  zh: {
    title: "TikTok 连接成功",
    subtitle: "您的账户已连接到 OPPO Brand Shop",
    followers: "关注者",
    following: "正在关注",
    likes: "总点赞",
    videos: "视频",
    storeTitle: "将此账户关联到您的门店",
    found: "我们找到了一家与此 TikTok 账户匹配的门店",
    confirm: "确认并关联此门店",
    chooseOther: "选择其他门店",
    choose: "选择您的门店",
    searchPlaceholder: "搜索门店名称、省份或 Store ID",
    request: "提交门店关联申请",
    pendingTitle: "已提交 HQ 审核",
    pendingDesc: "在 HQ 批准前，门店关联不会更改。",
    connected: "门店已关联",
    viewAnalytics: "查看门店 TikTok 数据",
    changeStore: "更换 / 选择其他门店",
    loading: "正在检查门店关联...",
    retry: "重新开始连接",
    sessionExpired: "门店关联会话已过期，但 TikTok 授权已成功。",
    noResults: "未找到匹配的门店",
    saving: "正在保存...",
    safe: "此连接为只读模式，系统不会在 TikTok 上发布、编辑或删除内容。",
    hqReview: "如果 TikTok 用户名与 Store Master 不一致，更换门店需要 HQ 审批。",
  },
};

function StoreCard({ store }: { store: StoreSummary }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{store.storeName}</p>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        {store.externalStoreId && <span>Store ID: {store.externalStoreId}</span>}
        {store.province && <span>{store.province}</span>}
        {store.tiktokUsername && <span>@{store.tiktokUsername.replace(/^@+/, "")}</span>}
      </div>
    </div>
  );
}

export function StoreBindingSuccess({
  displayName = "",
  username = "",
  avatarUrl = "",
  followerCount = 0,
  followingCount = 0,
  likesCount = 0,
  videoCount = 0,
}: StoreBindingSuccessProps) {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, copy);
  const [context, setContext] = useState<BindingContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadContext = useCallback(async (searchQuery = "") => {
    try {
      const url = new URL("/api/tiktok/store-binding/context", window.location.origin);
      if (searchQuery.trim()) url.searchParams.set("query", searchQuery.trim());
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (response.status === 401) {
        setSessionExpired(true);
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error("binding_context_failed");
      const nextContext = (await response.json()) as BindingContext;
      setContext(nextContext);
      setSessionExpired(false);
      setError("");
    } catch {
      setError("store_binding_unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadContext(), 0);
    return () => window.clearTimeout(timer);
  }, [loadContext]);

  useEffect(() => {
    if (!chooserOpen) return;
    const timer = window.setTimeout(() => void loadContext(query), 250);
    return () => window.clearTimeout(timer);
  }, [chooserOpen, query, loadContext]);

  async function confirmStore(store: StoreSummary) {
    setSavingStoreId(store.id);
    setError("");
    try {
      const response = await fetch("/api/tiktok/store-binding/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeMasterId: store.id }),
      });
      if (response.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (!response.ok) throw new Error("confirm_failed");
      await loadContext();
      setChooserOpen(false);
    } catch {
      setError("confirm_failed");
    } finally {
      setSavingStoreId(null);
    }
  }

  async function requestStore(store: StoreSummary) {
    setSavingStoreId(store.id);
    setError("");
    try {
      const response = await fetch("/api/tiktok/store-binding/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeMasterId: store.id }),
      });
      if (response.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (!response.ok) throw new Error("request_failed");
      await loadContext();
      setChooserOpen(false);
      setQuery("");
    } catch {
      setError("request_failed");
    } finally {
      setSavingStoreId(null);
    }
  }

  const cleanUsername = username.replace(/^@+/, "");
  const metricCards = [
    [t.followers, followerCount],
    [t.following, followingCount],
    [t.likes, likesCount],
    [t.videos, videoCount],
  ] as const;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 dark:bg-[#0b0d11] dark:text-slate-100">
      <div className="fixed right-4 top-4 z-10"><LanguageControl /></div>
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-5 flex items-center justify-center gap-2">
          <Image src="/images/LOGO_OBS.png" alt="OPPO Brand Shop" width={34} height={34} className="rounded-lg" priority />
          <span className="text-sm font-semibold">OPPO Brand Shop · TikTok Integration</span>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-8 dark:border-slate-800 dark:bg-[#12151c] dark:shadow-none">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-950/20">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M5 13l4 4L19 7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div className="mt-5 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-emerald-500/30">
                  <Image src={avatarUrl} alt={displayName || cleanUsername || "TikTok account"} fill sizes="56px" unoptimized className="object-cover" />
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black font-bold text-white">T</div>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-bold">{displayName || cleanUsername || "TikTok Account"}</p>
                {cleanUsername && <p className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">@{cleanUsername}</p>}
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">● TikTok Login Kit v2</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 sm:grid-cols-4 dark:border-slate-800">
              {metricCards.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-2.5 text-center dark:border-slate-700 dark:bg-slate-800/60">
                  <span className="block text-[10px] text-slate-400">{label}</span>
                  <strong className="mt-0.5 block text-sm">{value.toLocaleString()}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-bold">{t.storeTitle}</h2>

            {loading ? (
              <p className="mt-3 text-sm text-slate-500">{t.loading}</p>
            ) : sessionExpired ? (
              <div className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                <p>{t.sessionExpired}</p>
                <Link href="/connect/tiktok" className="mt-3 inline-flex font-semibold underline">{t.retry}</Link>
              </div>
            ) : context?.pendingRequest ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{t.pendingTitle}</p>
                {context.pendingRequest.store && <div className="mt-2"><StoreCard store={context.pendingRequest.store} /></div>}
                <p className="mt-2 text-xs text-amber-700/80 dark:text-amber-300/80">{t.pendingDesc}</p>
              </div>
            ) : context?.currentStore && !chooserOpen ? (
              <div className="mt-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <p className="mb-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">✓ {t.connected}</p>
                  <StoreCard store={context.currentStore} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Link href="/connect/tiktok/analytics" className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500">{t.viewAnalytics}</Link>
                  <button type="button" onClick={() => setChooserOpen(true)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">{t.changeStore}</button>
                </div>
              </div>
            ) : context?.suggestedStore && !chooserOpen ? (
              <div className="mt-3">
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{t.found}</p>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20"><StoreCard store={context.suggestedStore} /></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={Boolean(savingStoreId)} onClick={() => void confirmStore(context.suggestedStore!)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">{savingStoreId ? t.saving : t.confirm}</button>
                  <button type="button" onClick={() => setChooserOpen(true)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">{t.chooseOther}</button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{t.choose}</p>
                <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setChooserOpen(true)} placeholder={t.searchPlaceholder} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900" />
                <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                  {(context?.options || []).map((store) => (
                    <div key={store.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <StoreCard store={store} />
                      <button type="button" disabled={Boolean(savingStoreId)} onClick={() => void requestStore(store)} className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50 dark:bg-emerald-600">{savingStoreId === store.id ? t.saving : t.request}</button>
                    </div>
                  ))}
                  {context && context.options.length === 0 && <p className="py-4 text-center text-xs text-slate-500">{t.noResults}</p>}
                </div>
                {context?.currentStore && <button type="button" onClick={() => { setChooserOpen(false); setQuery(""); void loadContext(); }} className="mt-3 text-xs font-semibold text-slate-500 underline">{t.connected}: {context.currentStore.storeName}</button>}
              </div>
            )}

            {error && <p className="mt-3 text-xs font-medium text-red-600">Unable to update store association. Please try again.</p>}
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{t.hqReview}</p>
          </div>

          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-center text-[11px] leading-relaxed text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">{t.safe}</div>
        </section>
      </div>
    </main>
  );
}
