"use client";

import Image from "next/image";
import Link from "next/link";
import { LanguageControl, pickLanguageText, useAppLanguage } from "../../../language";

const translations = {
  th: {
    title: "TikTok เชื่อมต่อสำเร็จ",
    status: "เชื่อมต่อ TikTok สำเร็จ",
    authorizedNotice: "ข้อมูลนี้ได้รับอนุญาตจากบัญชี TikTok ที่เชื่อมต่อ",
    readOnlyNotice: "การเชื่อมต่อนี้เป็นแบบอ่านอย่างเดียว (Read-only) ระบบจะไม่โพสต์ แก้ไข หรือลบคอนเทนต์ใดๆ บน TikTok",
    displayName: "ชื่อบัญชี TikTok",
    linkedStore: "สาขาร้านค้าที่เชื่อมโยง",
    storeNotBound: "ยังไม่ได้เชื่อมโยงกับสาขา (Unassigned / Pending Store Association)",
    storeNotBoundDesc: "บัญชีได้รับการอนุญาตเรียบร้อยแล้ว โดยผู้ดูแลระบบหรือเจ้าหน้าที่สาขาสามารถทำการผูกบัญชีเข้ากับสาขาได้ในระบบจัดการ",
    followers: "ผู้ติดตาม",
    following: "กำลังติดตาม",
    likes: "ยอดถูกใจทั้งหมด",
    videos: "วิดีโอ",
    viewStores: "ดูข้อมูลร้าน",
    manageConnection: "จัดการการเชื่อมต่อ",
    disconnectNoticeTitle: "การยกเลิกการเชื่อมต่อ",
    disconnectNoticeDesc: "คุณสามารถยกเลิกการเชื่อมต่อหรือเพิกถอนสิทธิ์ได้ทุกเมื่อผ่านแอปพลิเคชัน TikTok ในเมนู การตั้งค่าและความเป็นส่วนตัว > ความปลอดภัยและสิทธิ์ > แอปและบริการของบุคคลที่สาม หรือติดต่อ obsthailand@gmail.com",
    close: "คุณสามารถปิดหน้านี้หรือไปต่อยังหน้าอื่นได้",
  },
  en: {
    title: "TikTok Connected Successfully",
    status: "TikTok Account Connected",
    authorizedNotice: "This data is authorized directly from your connected TikTok account",
    readOnlyNotice: "This connection is strictly read-only. The system will never post, edit, or delete any content on TikTok.",
    displayName: "TikTok Display Name",
    linkedStore: "Linked Store",
    storeNotBound: "Unassigned / Pending Store Association",
    storeNotBoundDesc: "The TikTok account is successfully verified. Authorized staff can associate it with a store in the administration workspace.",
    followers: "Followers",
    following: "Following",
    likes: "Total Likes",
    videos: "Videos",
    viewStores: "View Stores",
    manageConnection: "Manage Connection",
    disconnectNoticeTitle: "How to Disconnect",
    disconnectNoticeDesc: "You can revoke access at any time in the TikTok mobile app under Settings and Privacy > Security & Permissions > Apps and Services, or contact obsthailand@gmail.com",
    close: "You may now close this page or navigate elsewhere.",
  },
  zh: {
    title: "TikTok 连接成功",
    status: "TikTok 账户已连接",
    authorizedNotice: "此数据直接自您已连接的 TikTok 账户授权获取",
    readOnlyNotice: "此连接为严格只读模式。系统绝不会在 TikTok 上发布、修改或删除任何内容。",
    displayName: "TikTok 显示名称",
    linkedStore: "已关联门店",
    storeNotBound: "待关联门店 (Unassigned / Pending Store Association)",
    storeNotBoundDesc: "该 TikTok 账户已成功验证。经授权的管理人员可以在后台将其与指定门店进行关联。",
    followers: "关注者",
    following: "正在关注",
    likes: "总点赞数",
    videos: "视频数",
    viewStores: "查看门店",
    manageConnection: "管理连接",
    disconnectNoticeTitle: "如何取消连接",
    disconnectNoticeDesc: "您可以随时在 TikTok 应用程序中的“设置与隐私 > 安全与权限 > 第三方应用与服务”中撤销授权，或联系 obsthailand@gmail.com",
    close: "您现在可以关闭此页面或前往其他页面。",
  },
};

export interface TikTokConnectSuccessProps {
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  followerCount?: number;
  followingCount?: number;
  likesCount?: number;
  videoCount?: number;
  storeName?: string;
  isStoreBound?: boolean;
}

export function TikTokConnectSuccessContent({
  displayName = "",
  username = "",
  avatarUrl = "",
  followerCount = 0,
  followingCount = 0,
  likesCount = 0,
  videoCount = 0,
  storeName = "",
  isStoreBound = false,
}: TikTokConnectSuccessProps) {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, translations);

  const cleanUsername = username.replace(/^@+/, "");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 text-slate-900 transition-colors duration-150 sm:px-6 dark:bg-[#0b0d11] dark:text-slate-100">
      <div className="absolute right-4 top-4">
        <LanguageControl />
      </div>

      <div className="w-full max-w-lg space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-xs font-bold text-white shadow-xs dark:bg-emerald-500">
            O
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            OPPO Brand Shop · TikTok Integration
          </span>
        </div>

        {/* Main Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8 dark:border-slate-800/80 dark:bg-[#12151c] dark:shadow-none">
          {/* Success Check Icon */}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-950/20">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="mt-5 text-center">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              {t.title}
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              {t.status}
            </p>
          </div>

          {/* User Profile Card */}
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/80 p-5 dark:border-slate-800/60 dark:bg-slate-900/50">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-emerald-500/30">
                  <Image
                    src={avatarUrl}
                    alt={displayName || cleanUsername || "TikTok Avatar"}
                    fill
                    sizes="56px"
                    unoptimized
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black text-white text-lg font-bold border border-slate-700">
                  {cleanUsername ? cleanUsername[0].toUpperCase() : "T"}
                </div>
              )}

              <div className="min-w-0 flex-1">
                {displayName && (
                  <h2 className="text-base font-bold text-slate-900 truncate dark:text-slate-100">
                    {displayName}
                  </h2>
                )}
                {cleanUsername && (
                  <p className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    @{cleanUsername}
                  </p>
                )}
                <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  TikTok Login Kit v2
                </span>
              </div>
            </div>

            {/* Official Stats Grid */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
              <div className="rounded-lg bg-white/70 dark:bg-slate-800/50 p-2.5 text-center border border-slate-200/50 dark:border-slate-700/50">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  {t.followers}
                </span>
                <span className="mt-0.5 block text-sm font-bold text-slate-900 dark:text-slate-100">
                  {followerCount.toLocaleString()}
                </span>
              </div>

              <div className="rounded-lg bg-white/70 dark:bg-slate-800/50 p-2.5 text-center border border-slate-200/50 dark:border-slate-700/50">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  {t.following}
                </span>
                <span className="mt-0.5 block text-sm font-bold text-slate-900 dark:text-slate-100">
                  {followingCount.toLocaleString()}
                </span>
              </div>

              <div className="rounded-lg bg-white/70 dark:bg-slate-800/50 p-2.5 text-center border border-slate-200/50 dark:border-slate-700/50">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  {t.likes}
                </span>
                <span className="mt-0.5 block text-sm font-bold text-slate-900 dark:text-slate-100">
                  {likesCount.toLocaleString()}
                </span>
              </div>

              <div className="rounded-lg bg-white/70 dark:bg-slate-800/50 p-2.5 text-center border border-slate-200/50 dark:border-slate-700/50">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  {t.videos}
                </span>
                <span className="mt-0.5 block text-sm font-bold text-slate-900 dark:text-slate-100">
                  {videoCount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Store Association Status */}
            <div className="mt-4 border-t border-slate-200/60 pt-3 dark:border-slate-800/60">
              <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-400">
                {t.linkedStore}
              </span>
              {isStoreBound && storeName ? (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {storeName}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    ✓ เชื่อมโยงแล้ว
                  </span>
                </div>
              ) : (
                <div className="mt-1">
                  <span className="inline-block text-xs font-medium text-amber-600 dark:text-amber-400">
                    {t.storeNotBound}
                  </span>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    {t.storeNotBoundDesc}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reassurance Notice */}
          <div className="mt-5 space-y-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-center text-xs text-emerald-800 dark:text-emerald-300">
            <p className="font-semibold">{t.authorizedNotice}</p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed">
              {t.readOnlyNotice}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/stores"
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition"
            >
              <span>{t.viewStores}</span>
            </Link>
            <Link
              href="/tiktok-integration"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition"
            >
              <span>{t.manageConnection}</span>
            </Link>
          </div>

          {/* Disconnect Info */}
          <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800/60 dark:text-slate-400">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              {t.disconnectNoticeTitle}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed">
              {t.disconnectNoticeDesc}
            </p>
          </div>

          {/* Close hint */}
          <div className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
            {t.close}
          </div>
        </div>
      </div>
    </main>
  );
}
