"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeControl, useThemeToggle } from "@/app/theme";
import type { PrimarySection } from "@/app/primary-navigation";
import { canAccessPrimarySection, defaultRouteForUser, type AuthUser } from "@/lib/authorization";
import { AppSidebar, NavBadge, NewChip, sidebarLabels } from "./app-sidebar";
import { useChatsUnrepliedBadge } from "./chats-unreplied-badge";
import { visibleNavGroups } from "./navigation-config";

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
  showGlobalHeader?: boolean;
  pilotMode?: boolean;
  lastUpdatedAt?: Date | null;
  logout: () => Promise<void> | void;
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40 focus-visible:ring-offset-1";

function sectionLabel(section: PrimarySection, language: Language) {
  const labels: Record<PrimarySection, [string, string, string]> = {
    home: ["หน้าหลัก", "Main", "主页"],
    dashboard: ["แดชบอร์ด", "Dashboard", "仪表盘"],
    chats: ["แชทร้านค้า", "Store Chats", "门店聊天"],
    "store-360": ["Store 360", "Store 360", "Store 360"],
    "main-oa": ["Main OA", "Main OA", "Main OA"],
    stores: ["จัดการร้านค้า", "Store Management", "门店管理"],
    "admin-registrations": ["อนุมัติ BM", "BM Approval", "BM 审批"],
    "purchase-analytics": ["ข้อมูลการซื้อ", "Purchase Intelligence", "购买洞察"],
    "line-chat-health": ["สถานะ LINE Chat", "LINE Chat Health", "LINE Chat 健康"],
    "follower-insights": ["เพื่อน", "Friends", "关注者洞察"],
    "friend-source-links": ["ลิงก์เพิ่มเพื่อน", "Friend Source Links", "加好友来源链接"],
    "mass-messages": ["ส่งข้อความ", "Mass Message", "群发消息"],
    broadcast: ["Broadcast", "Broadcast", "Broadcast"],
    coupons: ["คูปอง", "Coupons", "优惠券"],
    "rich-menus": ["จัดการ Rich Menu", "Rich Menu Manager", "Rich Menu 管理"],
    "auto-responses": ["ข้อความตอบกลับอัตโนมัติ", "Auto-response", "自动回复"],
    "greeting-messages": ["ข้อความต้อนรับ", "Greeting Messages", "欢迎消息"],
    "google-review-kpi": ["Google Review KPI", "Google Review KPI", "Google Review KPI"],
  };
  const index = language === "th" ? 0 : language === "zh" ? 2 : 1;
  return labels[section][index];
}

// Some routes reuse another section for access control and navigation state,
// so their title comes from the route instead of the section.
function pageLabel(pathname: string, section: PrimarySection, language: Language) {
  const navigationLabels = sidebarLabels(language);
  if (pathname.startsWith("/download-center")) return navigationLabels.downloadCenter;
  if (pathname.startsWith("/dashboard/message-traffic")) return navigationLabels.traffic;
  if (pathname.startsWith("/replymessage")) return navigationLabels.replySla;
  if (pathname.startsWith("/monthly-operations-report")) return navigationLabels.monthlyOperationsReport;
  if (pathname.startsWith("/rich-messages")) return "Rich Message";
  if (pathname === "/tiktok" || pathname.startsWith("/tiktok/")) return "TikTok Analytics";
  return sectionLabel(section, language);
}

const themeToggleLabels: Record<Language, { toDark: string; toLight: string }> = {
  th: { toDark: "สลับเป็นโหมดมืด", toLight: "สลับเป็นโหมดสว่าง" },
  en: { toDark: "Switch to dark mode", toLight: "Switch to light mode" },
  zh: { toDark: "切换到深色模式", toLight: "切换到浅色模式" },
};

/** One click switches light <-> dark; shows a moon in light mode and a sun in dark mode. */
function ThemeToggleButton({ language }: { language: Language }) {
  const { shown, toggle } = useThemeToggle();
  const label = shown === "dark" ? themeToggleLabels[language].toLight : themeToggleLabels[language].toDark;
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <button type="button" data-theme-toggle onClick={toggle} aria-label={label} title={label} className={`${focusRing} flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        {shown === "dark"
          ? <><circle {...common} cx="12" cy="12" r="4" /><path {...common} d="M12 2.5v2m0 15v2M4.6 4.6 6 6m12 12 1.4 1.4M2.5 12h2m15 0h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>
          : <path {...common} d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />}
      </svg>
    </button>
  );
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
  const secondaryActive = ["dashboard", "store-360", "stores", "admin-registrations", "purchase-analytics", "line-chat-health", "friend-source-links", "mass-messages", "broadcast", "coupons"].includes(currentSection);
  const labels = language === "th"
    ? { home: "หน้าหลัก", dashboard: "แดชบอร์ด", chats: "แชทร้านค้า", insights: "เพื่อน", mainOa: "Main OA", more: "เพิ่มเติม", account: "บัญชี", profile: "โปรไฟล์", settings: "ตั้งค่า", traffic: "Message Traffic", store360: "Store 360", coupons: "คูปอง", stores: "จัดการร้านค้า", purchase: "ข้อมูลการซื้อ", friendLinks: "ลิงก์เพิ่มเพื่อน", mass: "ส่งข้อความ", broadcast: "Broadcast", approval: "อนุมัติ BM", richMenus: "จัดการ Rich Menu", autoResponses: "ข้อความตอบกลับอัตโนมัติ", greetingMessages: "ข้อความต้อนรับ", logout: "ออกจากระบบ", appearance: "รูปแบบการแสดงผล", language: "ภาษา", mobilePrimaryNavigation: "เมนูหลักบนมือถือ", noAuthorizedWorkspace: "ไม่มีพื้นที่ทำงานที่ได้รับอนุญาต", live: "ออนไลน์" }
    : language === "zh"
      ? { home: "主页", dashboard: "仪表盘", chats: "门店聊天", insights: "关注者", mainOa: "Main OA", more: "更多", account: "账户", profile: "个人资料", settings: "设置", traffic: "消息流量", store360: "Store 360", coupons: "优惠券", stores: "门店管理", purchase: "购买洞察", friendLinks: "加好友链接", mass: "群发消息", broadcast: "Broadcast", approval: "BM 审批", richMenus: "Rich Menu 管理", autoResponses: "自动回复", greetingMessages: "欢迎消息", logout: "退出", appearance: "外观", language: "语言", mobilePrimaryNavigation: "移动端主导航", noAuthorizedWorkspace: "没有可访问的工作区", live: "实时" }
      : { home: "Main", dashboard: "Dashboard", chats: "Chats", insights: "Friends", mainOa: "Main OA", more: "More", account: "Account", profile: "Profile", settings: "Settings", traffic: "Message Traffic", store360: "Store 360", coupons: "Coupons", stores: "Stores", purchase: "Purchase", friendLinks: "Friend Links", mass: "Mass Message", broadcast: "Broadcast", approval: "BM Approval", richMenus: "Rich Menu Manager", autoResponses: "Auto-response", greetingMessages: "Greeting Messages", logout: "Logout", appearance: "Appearance", language: "Language", mobilePrimaryNavigation: "Mobile primary navigation", noAuthorizedWorkspace: "No authorized workspace", live: "Live" };

  const itemClass = (active: boolean) => `${focusRing} flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors ${active ? "text-[var(--app-accent)]" : "text-[var(--app-text-secondary)]"}`;
  const sheetLinkClass = `${focusRing} flex min-h-12 items-center justify-between rounded-xl px-3 text-sm font-medium text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]`;
  const can = (section: PrimarySection) => Boolean(authUser && canAccessPrimarySection(authUser, section));
  const defaultRoute = authUser ? defaultRouteForUser(authUser) : "/login";
  const navLabels = sidebarLabels(language);
  const navGroups = visibleNavGroups(authUser);
  const badgeCount = useChatsUnrepliedBadge(moreOpen && can("chats"));

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

          {/* Same groups, order, labels and gates as the desktop sidebar (navigation-config). */}
          <nav aria-label={labels.more} data-mobile-more-menu>
            {navGroups.map((group) => (
              <div key={group.id} data-nav-group={group.id} className="mb-2">
                {group.label && <div className="mb-1 mt-2 px-2 text-xs font-semibold text-[var(--app-text-secondary)]">{navLabels[group.label]}</div>}
                <div className="grid grid-cols-1 gap-1">
                  {group.items.map((item) => (
                    <Link key={item.href} href={item.href} data-nav-item={item.href} onClick={() => setMoreOpen(false)} className={sheetLinkClass}>
                      <span className="flex min-w-0 items-center gap-2"><span className="truncate">{navLabels[item.label]}</span>{item.isNew && <NewChip label={navLabels.newChip} />}</span>
                      <span className="flex shrink-0 items-center gap-2">{item.badge === "chats-unreplied" && <NavBadge count={badgeCount} label={navLabels.unrepliedBadge} />}<span aria-hidden="true">›</span></span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

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

      <nav aria-label={labels.mobilePrimaryNavigation} className="fixed inset-x-0 bottom-0 z-[60] flex border-t border-[var(--app-border)] bg-[color:var(--app-surface)]/95 px-2 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl md:hidden">
        {can("home") && <Link href="/home" aria-current={currentSection === "home" ? "page" : undefined} className={itemClass(currentSection === "home")}><MobileNavIcon type="home" /><span>{labels.home}</span></Link>}
        {can("chats") && <Link href="/chats" aria-current={currentSection === "chats" ? "page" : undefined} className={itemClass(currentSection === "chats")}><MobileNavIcon type="chat" /><span>{labels.chats}</span></Link>}
        {can("follower-insights") && <Link href="/follower-insights" aria-current={currentSection === "follower-insights" ? "page" : undefined} className={itemClass(currentSection === "follower-insights")}><MobileNavIcon type="insights" /><span>{labels.insights}</span></Link>}
        {can("main-oa") && !can("home") && !can("chats") && <Link href="/main-oa" aria-current={currentSection === "main-oa" ? "page" : undefined} className={itemClass(currentSection === "main-oa")}><MobileNavIcon type="main-oa" /><span>{labels.mainOa}</span></Link>}
        <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)} className={itemClass(moreOpen || secondaryActive || currentSection === "main-oa")}><MobileNavIcon type="more" /><span>{labels.more}</span></button>
      </nav>

      {authUser && defaultRoute === "/login" && <span className="sr-only">{labels.noAuthorizedWorkspace}</span>}
    </>
  );
}

export function TopNavigation(props: TopNavigationProps) {
  const { authUser, changeLanguage, currentSection, language, lastUpdatedAt, logout, pilotMode, searchText, setSearchText, showGlobalHeader = true, text } = props;
  const updatedLabel = lastUpdatedAt
    ? `${text.lastUpdated || "Last updated"} ${new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(lastUpdatedAt)}`
    : (text.lastUpdated || "Last updated");
  const defaultRoute = authUser ? defaultRouteForUser(authUser) : "/login";
  const pathname = usePathname() || "/";

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

      {showGlobalHeader && <header className="app-header sticky top-0 z-30 flex h-14 min-h-14 min-w-0 items-center gap-3 border-b border-[var(--app-border)] bg-[color:var(--app-surface)]/95 px-4 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href={defaultRoute} className={`${focusRing} flex min-w-0 items-center gap-2 rounded-lg md:hidden`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--app-accent)] text-[11px] font-bold text-white">O</span>
            <span className="truncate text-[15px] font-bold">{text.appName || "OPPO LINE OA Monitor"}</span>
          </Link>
          <div className="hidden min-w-0 md:block">
            <div className="truncate text-sm font-semibold text-[var(--app-text-primary)]">{pageLabel(pathname, currentSection, language)}</div>
            <div className="text-[10px] text-[var(--app-text-tertiary)]">OPPO LINE OA Monitor</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <ResponsiveSearch searchText={searchText} setSearchText={setSearchText} text={text} />
          <ThemeToggleButton language={language} />
          {lastUpdatedAt && (
            <button type="button" aria-label={updatedLabel} title={updatedLabel} className={`${focusRing} hidden h-9 items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-[11px] font-medium text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] md:flex`}>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--app-success)]" /><span>{sidebarLabels(language).live}</span>
            </button>
          )}
          {authUser && <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-accent)] text-[10px] font-bold text-white md:hidden">{authUser.displayName.charAt(0).toUpperCase()}</span>}
        </div>
      </header>}

      <MobileBottomNavigation authUser={authUser} currentSection={currentSection} language={language} changeLanguage={changeLanguage} logout={logout} />
    </>
  );
}
