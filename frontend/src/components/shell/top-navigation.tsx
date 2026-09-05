"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeControl } from "@/app/theme";
import type { PrimarySection } from "@/app/primary-navigation";
import { canAccessPrimarySection, canAccessWebTool, defaultRouteForUser, type AuthUser } from "@/lib/authorization";
import { AppSidebar } from "./app-sidebar";

export type Language = "th" | "en" | "zh";

type TopNavigationText = {
  apiError?: string;
  appDescription?: string;
  appName?: string;
  dashboard?: string;
  language?: string;
  lastUpdated?: string;
  loadingData?: string;
  retry?: string;
  searchPlaceholder?: string;
  storeManagement?: string;
};

export interface TopNavigationProps {
  currentSection: PrimarySection;
  authUser: AuthUser | null;
  text: TopNavigationText;
  language: Language;
  changeLanguage: (lang: Language) => void;
  searchText: string;
  setSearchText: (query: string) => void;
  pilotMode?: boolean;
  lastUpdatedAt?: Date | null;
  logout: () => Promise<void> | void;
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1";

function sectionLabel(section: PrimarySection, language: Language) {
  const labels: Record<PrimarySection, [string, string, string]> = {
    home: ["หน้าหลัก", "Main", "主页"],
    dashboard: ["แดชบอร์ด", "Dashboard", "仪表盘"],
    chats: ["แชทร้านค้า", "Store Chats", "门店聊天"],
    "main-oa": ["Main OA", "Main OA", "Main OA"],
    stores: ["จัดการร้านค้า", "Store Management", "门店管理"],
    "admin-registrations": ["อนุมัติ BM", "BM Approval", "BM 审批"],
    "purchase-analytics": ["ข้อมูลการซื้อ", "Purchase Intelligence", "购买洞察"],
    "line-chat-health": ["สถานะ LINE Chat", "LINE Chat Health", "LINE Chat 健康"],
    "follower-insights": ["ข้อมูลผู้ติดตาม", "Follower Insights", "关注者洞察"],
    "friend-source-links": ["ลิงก์เพิ่มเพื่อน", "Friend Source Links", "加好友来源链接"],
    "mass-messages": ["ส่งข้อความ", "Mass Message", "群发消息"],
    coupons: ["คูปอง", "Coupons", "优惠券"],
    "rich-menus": ["จัดการ Rich Menu", "Rich Menu Manager", "Rich Menu 管理"],
    "auto-responses": ["ข้อความตอบกลับอัตโนมัติ", "Auto-response", "自动回复"],
    "greeting-messages": ["ข้อความต้อนรับ", "Greeting Messages", "欢迎消息"],
    "google-review-kpi": ["Google Review KPI", "Google Review KPI", "Google Review KPI"],
  };
  const index = language === "th" ? 0 : language === "zh" ? 2 : 1;
  return labels[section][index];
}

function ResponsiveSearch({ searchText, setSearchText, text }: Pick<TopNavigationProps, "searchText" | "setSearchText" | "text">) {
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const label = text.searchPlaceholder || "Search customers, stores, or messages";

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setIsOpen(false); };
    const closeOnOutsideClick = (event: PointerEvent) => { if (!searchRef.current?.contains(event.target as Node)) setIsOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [isOpen]);

  return (
    <div ref={searchRef} className="relative shrink-0">
      <label className="relative hidden w-52 lg:block xl:w-64">
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--app-text-tertiary)]">⌕</span>
        <input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={label} className={`${focusRing} app-input h-9 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] py-1 pl-8 pr-3 text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-tertiary)]`} />
      </label>
      <button type="button" aria-label={label} title={label} aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} className={`${focusRing} flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-sm text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] lg:hidden`}>
        <span aria-hidden="true">⌕</span>
      </button>
      {isOpen && (
        <div className="fixed inset-x-3 top-[4.2rem] z-[70] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-[var(--app-shadow-elevated)] lg:absolute lg:inset-x-auto lg:right-0 lg:top-[calc(100%+0.5rem)] lg:w-80">
          <input autoFocus type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={label} className={`${focusRing} h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-sm text-[var(--app-text-primary)]`} />
        </div>
      )}
    </div>
  );
}

function MobileNavIcon({ type }: { type: "home" | "chat" | "insights" | "main-oa" | "more" }) {
  if (type === "home") return <span aria-hidden="true" className="text-[19px] leading-none">⌂</span>;
  if (type === "chat") return <span aria-hidden="true" className="text-[18px] leading-none">◫</span>;
  if (type === "insights") return <span aria-hidden="true" className="text-[18px] leading-none">↗</span>;
  if (type === "main-oa") return <span aria-hidden="true" className="text-[18px] leading-none">▦</span>;
  return <span aria-hidden="true" className="text-[20px] leading-none">•••</span>;
}

function MobileBottomNavigation({ authUser, currentSection, language, changeLanguage, logout }: Pick<TopNavigationProps, "authUser" | "currentSection" | "language" | "changeLanguage" | "logout">) {
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryActive = ["dashboard", "stores", "admin-registrations", "purchase-analytics", "line-chat-health", "friend-source-links", "mass-messages", "coupons"].includes(currentSection);
  const labels = language === "th"
    ? { home: "หน้าหลัก", dashboard: "แดชบอร์ด", chats: "แชทร้านค้า", insights: "ผู้ติดตาม", mainOa: "Main OA", more: "เพิ่มเติม", account: "บัญชี", profile: "โปรไฟล์", settings: "ตั้งค่า", traffic: "Message Traffic", coupons: "คูปอง", stores: "จัดการร้านค้า", purchase: "ข้อมูลการซื้อ", friendLinks: "ลิงก์เพิ่มเพื่อน", mass: "ส่งข้อความ", approval: "อนุมัติ BM", richMenus: "จัดการ Rich Menu", autoResponses: "ข้อความตอบกลับอัตโนมัติ", greetingMessages: "ข้อความต้อนรับ", logout: "ออกจากระบบ", appearance: "รูปแบบการแสดงผล", language: "ภาษา" }
    : language === "zh"
      ? { home: "主页", dashboard: "仪表盘", chats: "门店聊天", insights: "关注者", mainOa: "Main OA", more: "更多", account: "账户", profile: "个人资料", settings: "设置", traffic: "消息流量", coupons: "优惠券", stores: "门店管理", purchase: "购买洞察", friendLinks: "加好友链接", mass: "群发消息", approval: "BM 审批", richMenus: "Rich Menu 管理", autoResponses: "自动回复", greetingMessages: "欢迎消息", logout: "退出", appearance: "外观", language: "语言" }
      : { home: "Main", dashboard: "Dashboard", chats: "Chats", insights: "Followers", mainOa: "Main OA", more: "More", account: "Account", profile: "Profile", settings: "Settings", traffic: "Message Traffic", coupons: "Coupons", stores: "Stores", purchase: "Purchase", friendLinks: "Friend Links", mass: "Mass Message", approval: "BM Approval", richMenus: "Rich Menu Manager", autoResponses: "Auto-response", greetingMessages: "Greeting Messages", logout: "Logout", appearance: "Appearance", language: "Language" };

  const itemClass = (active: boolean) => `${focusRing} flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors ${active ? "text-[var(--app-accent)]" : "text-[var(--app-text-secondary)]"}`;
  const sheetLinkClass = `${focusRing} flex min-h-12 items-center justify-between rounded-xl px-3 text-sm font-medium text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]`;
  const can = (section: PrimarySection) => Boolean(authUser && canAccessPrimarySection(authUser, section));
  const canTool = (tool: "message-traffic" | "tiktok") => Boolean(authUser && canAccessWebTool(authUser, tool));
  const defaultRoute = authUser ? defaultRouteForUser(authUser) : "/login";

  return (
    <>
      {moreOpen && <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] md:hidden" onClick={() => setMoreOpen(false)} aria-hidden="true" />}
      {moreOpen && (
        <div role="dialog" aria-modal="true" aria-label={labels.more} className="fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] overflow-y-auto rounded-t-[24px] border-t border-[var(--app-border)] bg-[var(--app-surface)] px-3 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-14px_40px_rgba(0,0,0,0.16)] md:hidden">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--app-border-strong)]" />
          {authUser && (
            <div className="mb-3 rounded-2xl bg-[var(--app-surface-subtle)] p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-accent)] text-sm font-bold text-white">{authUser.displayName.charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--app-text-primary)]">{authUser.displayName}</div>
                  <div className="truncate text-[11px] text-[var(--app-text-tertiary)]">{authUser.email}</div>
                </div>
                <span className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--app-text-secondary)]">{authUser.role}</span>
              </div>
            </div>
          )}

          <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">{labels.more}</div>
          <div className="grid grid-cols-1 gap-1">
            {can("dashboard") && <Link href="/dashboard" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.dashboard}</span><span>›</span></Link>}
            {canTool("message-traffic") && <Link href="/dashboard/message-traffic" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.traffic}</span><span>›</span></Link>}
            {can("coupons") && <Link href="/coupons" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.coupons}</span><span>›</span></Link>}
            {can("stores") && <Link href="/stores" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.stores}</span><span>›</span></Link>}
            {can("google-review-kpi") && <Link href="/google-review-kpi" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>Google Review KPI</span><span>›</span></Link>}
            {can("purchase-analytics") && <Link href="/admin/purchase-analytics" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.purchase}</span><span>›</span></Link>}
            {can("friend-source-links") && <Link href="/friend-source-links" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.friendLinks}</span><span>›</span></Link>}
            {can("mass-messages") && <Link href="/mass-messages" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.mass}</span><span>›</span></Link>}
            {can("rich-menus") && <Link href="/rich-menus" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.richMenus}</span><span>›</span></Link>}
            {can("auto-responses") && <Link href="/auto-responses" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.autoResponses}</span><span>›</span></Link>}
            {can("greeting-messages") && <Link href="/greeting-messages" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.greetingMessages}</span><span>›</span></Link>}
            {can("admin-registrations") && <Link href="/admin/registrations" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.approval}</span><span>›</span></Link>}
            {can("line-chat-health") && <Link href="/operations/line-chat-health" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>LINE Chat Health</span><span>›</span></Link>}
            {can("main-oa") && <Link href="/main-oa" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.mainOa}</span><span>›</span></Link>}
            {canTool("tiktok") && <Link href="/tiktok" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>TikTok</span><span>›</span></Link>}
          </div>

          <div className="my-3 border-t border-[var(--app-border-subtle)]" />
          <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">{labels.account}</div>
          <div className="space-y-3 rounded-2xl border border-[var(--app-border)] p-3">
            <label className="block text-xs font-medium text-[var(--app-text-secondary)]">
              <span className="mb-1.5 block">{labels.language}</span>
              <select value={language} onChange={(event) => changeLanguage(event.target.value as Language)} className="h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-[16px] text-[var(--app-text-primary)]">
                <option value="th">🇹🇭 ไทย</option><option value="en">🇬🇧 English</option><option value="zh">🇨🇳 中文</option>
              </select>
            </label>
            <div><div className="mb-1.5 text-xs font-medium text-[var(--app-text-secondary)]">{labels.appearance}</div><ThemeControl /></div>
            <button type="button" onClick={() => void logout()} className={`${focusRing} min-h-11 w-full rounded-xl bg-[var(--app-danger-soft)] px-3 text-left text-sm font-semibold text-[var(--app-danger)]`}>{labels.logout}</button>
          </div>
        </div>
      )}

      <nav aria-label="Mobile primary navigation" className="fixed inset-x-0 bottom-0 z-[60] flex border-t border-[var(--app-border)] bg-[color:var(--app-surface)]/95 px-2 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl md:hidden">
        {can("home") && <Link href="/home" aria-current={currentSection === "home" ? "page" : undefined} className={itemClass(currentSection === "home")}><MobileNavIcon type="home" /><span>{labels.home}</span></Link>}
        {can("chats") && <Link href="/chats" aria-current={currentSection === "chats" ? "page" : undefined} className={itemClass(currentSection === "chats")}><MobileNavIcon type="chat" /><span>{labels.chats}</span></Link>}
        {can("follower-insights") && <Link href="/follower-insights" aria-current={currentSection === "follower-insights" ? "page" : undefined} className={itemClass(currentSection === "follower-insights")}><MobileNavIcon type="insights" /><span>{labels.insights}</span></Link>}
        {can("main-oa") && !can("home") && !can("chats") && <Link href="/main-oa" aria-current={currentSection === "main-oa" ? "page" : undefined} className={itemClass(currentSection === "main-oa")}><MobileNavIcon type="main-oa" /><span>{labels.mainOa}</span></Link>}
        <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)} className={itemClass(moreOpen || secondaryActive || currentSection === "main-oa")}><MobileNavIcon type="more" /><span>{labels.more}</span></button>
      </nav>

      {authUser && defaultRoute === "/login" && <span className="sr-only">No authorized workspace</span>}
    </>
  );
}

export function TopNavigation(props: TopNavigationProps) {
  const { authUser, changeLanguage, currentSection, language, lastUpdatedAt, logout, pilotMode, searchText, setSearchText, text } = props;
  const updatedLabel = lastUpdatedAt
    ? `${text.lastUpdated || "Last updated"} ${new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(lastUpdatedAt)}`
    : (text.lastUpdated || "Last updated");
  const defaultRoute = authUser ? defaultRouteForUser(authUser) : "/login";

  return (
    <>
      <style>{`
        :root { --app-sidebar-width: 16rem; }
        @media (min-width: 768px) {
          .app-header {
            margin-left: var(--app-sidebar-width);
            width: calc(100% - var(--app-sidebar-width));
            transition: margin-left 200ms ease, width 200ms ease;
          }
        }
        @media (max-width: 767px) {
          .app-shell { padding-bottom: calc(4.35rem + env(safe-area-inset-bottom)); }
          .app-header { min-height: 3.75rem !important; height: 3.75rem !important; padding: 0.55rem 0.75rem !important; }
        }
      `}</style>

      <AppSidebar authUser={authUser} changeLanguage={changeLanguage} currentSection={currentSection} language={language} logout={logout} pilotMode={pilotMode} text={text} />

      <header className="app-header sticky top-0 z-30 flex h-14 min-h-14 min-w-0 items-center gap-3 border-b border-[var(--app-border)] bg-[color:var(--app-surface)]/95 px-4 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href={defaultRoute} className={`${focusRing} flex min-w-0 items-center gap-2 rounded-lg md:hidden`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--app-accent)] text-[11px] font-bold text-white">O</span>
            <span className="truncate text-[15px] font-bold">{text.appName || "OPPO LINE OA Monitor"}</span>
          </Link>
          <div className="hidden min-w-0 md:block">
            <div className="truncate text-sm font-semibold text-[var(--app-text-primary)]">{sectionLabel(currentSection, language)}</div>
            <div className="text-[10px] text-[var(--app-text-tertiary)]">OPPO LINE OA Monitor</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <ResponsiveSearch searchText={searchText} setSearchText={setSearchText} text={text} />
          {lastUpdatedAt && (
            <button type="button" aria-label={updatedLabel} title={updatedLabel} className={`${focusRing} hidden h-9 items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-[11px] font-medium text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] md:flex`}>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--app-success)]" /><span>Live</span>
            </button>
          )}
          {authUser && <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-accent)] text-[10px] font-bold text-white md:hidden">{authUser.displayName.charAt(0).toUpperCase()}</span>}
        </div>
      </header>

      <MobileBottomNavigation authUser={authUser} currentSection={currentSection} language={language} changeLanguage={changeLanguage} logout={logout} />
    </>
  );
}
