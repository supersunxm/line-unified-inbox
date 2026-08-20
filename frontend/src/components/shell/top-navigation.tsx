"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeControl } from "@/app/theme";
import type { PrimarySection } from "@/app/primary-navigation";

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
  authUser: { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" } | null;
  text: TopNavigationText;
  language: Language;
  changeLanguage: (lang: Language) => void;
  searchText: string;
  setSearchText: (query: string) => void;
  pilotMode?: boolean;
  lastUpdatedAt?: Date | null;
  logout: () => Promise<void> | void;
}

type MenuProps = Pick<TopNavigationProps, "authUser" | "changeLanguage" | "language" | "logout" | "pilotMode" | "text">;

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1";
const navLinkClass = `${focusRing} whitespace-nowrap rounded-[var(--app-radius-md)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-text-secondary)] transition-all duration-120 hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)] aria-[current=page]:bg-[var(--app-accent-soft)] aria-[current=page]:text-[var(--app-accent)] aria-[current=page]:font-semibold aria-[current=page]:border aria-[current=page]:border-[var(--app-accent)]/20`;

function ProfileMenu({ authUser, changeLanguage, language, logout, pilotMode, text }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [isOpen]);

  if (!authUser) return null;

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Open profile menu for ${authUser.displayName}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`${focusRing} flex h-9 items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5 text-xs shadow-xs transition-colors hover:bg-[var(--app-surface-hover)] md:h-8`}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--app-accent)] text-[10px] font-bold text-white shadow-xs md:h-5 md:w-5" aria-hidden="true">
          {authUser.displayName.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-28 truncate font-medium text-[var(--app-text-primary)] 2xl:inline">{authUser.displayName}</span>
        <span aria-hidden="true" className="text-[10px] text-[var(--app-text-tertiary)]">⌄</span>
      </button>

      {isOpen && (
        <div role="dialog" aria-label="Profile settings" className="app-surface fixed inset-x-3 top-[4.2rem] z-[70] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-[var(--app-shadow-elevated)] backdrop-blur-md md:absolute md:inset-x-auto md:right-0 md:top-[calc(100%+0.5rem)] md:w-72">
          <div className="border-b border-[var(--app-border-subtle)] px-2 pb-3">
            <p className="truncate text-sm font-semibold text-[var(--app-text-primary)]">{authUser.displayName}</p>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-[var(--app-radius-sm)] bg-[var(--app-surface-subtle)] border border-[var(--app-border-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--app-text-secondary)]">{authUser.role}</span>
              <span className={pilotMode ? "rounded-full border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-300" : "app-muted text-[10px]"}>
                {pilotMode ? "Pilot environment" : "Standard environment"}
              </span>
            </div>
          </div>

          <div className="space-y-3 px-2 py-3">
            <label className="block text-xs font-medium">
              <span className="mb-1 block app-muted">{text.language || "Language"}</span>
              <select
                value={language}
                onChange={(event) => changeLanguage(event.target.value as Language)}
                aria-label={text.language || "Language"}
                className={`${focusRing} app-input h-10 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] px-2.5 text-xs text-[var(--app-text-primary)] md:h-8`}
              >
                <option value="th">🇹🇭 ไทย</option>
                <option value="en">🇬🇧 English</option>
                <option value="zh">🇨🇳 中文</option>
              </select>
            </label>
            <div>
              <p className="mb-1 text-xs font-medium app-muted">Appearance</p>
              <ThemeControl />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className={`${focusRing} w-full rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/20 px-3 py-2.5 text-left text-xs font-medium text-[var(--app-danger)] transition-colors hover:bg-[var(--app-danger-soft)] md:py-1.5`}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

function ResponsiveSearch({ searchText, setSearchText, text }: Pick<TopNavigationProps, "searchText" | "setSearchText" | "text">) {
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const label = text.searchPlaceholder || "Search customers, stores, or messages";

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [isOpen]);

  return (
    <div ref={searchRef} className="relative shrink-0">
      <label className="relative hidden w-40 lg:block xl:w-48 2xl:w-[clamp(11rem,13vw,16rem)]">
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--app-text-tertiary)]">⌕</span>
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder={label}
          className={`${focusRing} app-header-search app-input h-8 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] py-1 pl-7 pr-3 text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-tertiary)]`}
        />
      </label>

      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`${focusRing} app-button-secondary flex h-9 w-9 items-center justify-center rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] text-sm text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] lg:hidden md:h-8 md:w-8 md:text-xs`}
      >
        <span aria-hidden="true">⌕</span>
      </button>

      {isOpen && (
        <div className="app-surface fixed inset-x-3 top-[4.2rem] z-[70] rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-[var(--app-shadow-elevated)] backdrop-blur-md lg:absolute lg:inset-x-auto lg:right-0 lg:top-[calc(100%+0.5rem)] lg:w-[min(20rem,calc(100vw-2rem))]">
          <label>
            <span className="sr-only">{label}</span>
            <input
              autoFocus
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={label}
              className={`${focusRing} app-input h-11 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] px-3 text-sm text-[var(--app-text-primary)] lg:h-9 lg:text-xs`}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function SecondaryNavigation({ authUser, currentSection, language }: Pick<TopNavigationProps, "authUser" | "currentSection" | "language">) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [isOpen]);

  const secondaryActive = ["stores", "admin-registrations", "purchase-analytics", "classification-insights", "friend-source-links", "mass-messages"].includes(currentSection);
  return (
    <div ref={menuRef} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} className={`${navLinkClass} ${secondaryActive ? "app-nav-active" : ""}`}>
        {language === "th" ? "เพิ่มเติม" : language === "zh" ? "更多" : "More"} <span aria-hidden="true">⌄</span>
      </button>
      {isOpen && (
        <div role="menu" aria-label="More navigation" className="app-surface absolute left-0 top-[calc(100%+0.4rem)] z-50 min-w-56 rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 shadow-[var(--app-shadow-elevated)]">
          <Link role="menuitem" href="/stores" aria-current={currentSection === "stores" ? "page" : undefined} className={`${navLinkClass} block w-full text-left`}>{language === "th" ? "จัดการร้านค้า" : language === "zh" ? "门店管理" : "Store Management"}</Link>
          {authUser?.role === "ADMIN" && <Link role="menuitem" href="/admin/registrations" aria-current={currentSection === "admin-registrations" ? "page" : undefined} className={`${navLinkClass} block w-full text-left`}>{language === "th" ? "อนุมัติ BM" : language === "zh" ? "BM 审批" : "BM Approval"}</Link>}
          <Link role="menuitem" href="/admin/purchase-analytics" aria-current={currentSection === "purchase-analytics" ? "page" : undefined} className={`${navLinkClass} block w-full text-left`}>{language === "th" ? "ข้อมูลการซื้อ" : language === "zh" ? "购买洞察" : "Purchase Intelligence"}</Link>
          <Link role="menuitem" href="/classification-insights" aria-current={currentSection === "classification-insights" ? "page" : undefined} className={`${navLinkClass} block w-full text-left`}>{language === "th" ? "ข้อมูลการจำแนก" : language === "zh" ? "分类洞察" : "Classification Insights"}</Link>
          {authUser?.role === "ADMIN" && <Link role="menuitem" href="/friend-source-links" aria-current={currentSection === "friend-source-links" ? "page" : undefined} className={`${navLinkClass} block w-full text-left`}>{language === "th" ? "ลิงก์เพิ่มเพื่อน" : language === "zh" ? "加好友来源链接" : "Friend Source Links"}</Link>}
          {authUser?.role === "ADMIN" && <Link role="menuitem" href="/mass-messages" aria-current={currentSection === "mass-messages" ? "page" : undefined} className={`${navLinkClass} block w-full text-left`}>{language === "th" ? "ส่งข้อความ" : language === "zh" ? "群发消息" : "Mass Message"}</Link>}
        </div>
      )}
    </div>
  );
}

function MobileNavIcon({ type }: { type: "dashboard" | "chat" | "insights" | "more" }) {
  if (type === "dashboard") return <span aria-hidden="true" className="text-[18px] leading-none">▦</span>;
  if (type === "chat") return <span aria-hidden="true" className="text-[18px] leading-none">◫</span>;
  if (type === "insights") return <span aria-hidden="true" className="text-[18px] leading-none">↗</span>;
  return <span aria-hidden="true" className="text-[20px] leading-none">•••</span>;
}

function MobileBottomNavigation({ authUser, currentSection, language }: Pick<TopNavigationProps, "authUser" | "currentSection" | "language">) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const secondaryActive = ["stores", "admin-registrations", "purchase-analytics", "classification-insights", "friend-source-links", "mass-messages", "coupons"].includes(currentSection);

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  const labels = language === "th"
    ? { dashboard: "แดชบอร์ด", chats: "แชทร้านค้า", insights: "ข้อมูลผู้ติดตาม", more: "เพิ่มเติม", traffic: "Message Traffic", coupons: "คูปอง", stores: "จัดการร้านค้า", purchase: "ข้อมูลการซื้อ", classification: "ข้อมูลการจำแนก", friendLinks: "ลิงก์เพิ่มเพื่อน", mass: "ส่งข้อความ", tiktok: "TikTok" }
    : language === "zh"
      ? { dashboard: "仪表盘", chats: "门店聊天", insights: "关注者", more: "更多", traffic: "消息流量", coupons: "优惠券", stores: "门店管理", purchase: "购买洞察", classification: "分类洞察", friendLinks: "加好友链接", mass: "群发消息", tiktok: "TikTok" }
      : { dashboard: "Dashboard", chats: "Chats", insights: "Followers", more: "More", traffic: "Message Traffic", coupons: "Coupons", stores: "Stores", purchase: "Purchase", classification: "Classification", friendLinks: "Friend Links", mass: "Mass Message", tiktok: "TikTok" };

  const itemClass = (active: boolean) => `${focusRing} flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors ${active ? "text-[var(--app-accent)]" : "text-[var(--app-text-secondary)]"}`;
  const sheetLinkClass = `${focusRing} flex min-h-12 items-center justify-between rounded-xl px-3 text-sm font-medium text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]`;

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] md:hidden" onClick={() => setMoreOpen(false)} aria-hidden="true" />
      )}
      {moreOpen && (
        <div ref={moreRef} role="dialog" aria-modal="true" aria-label={labels.more} className="fixed inset-x-0 bottom-0 z-50 max-h-[76dvh] overflow-y-auto rounded-t-[24px] border-t border-[var(--app-border)] bg-[var(--app-surface)] px-3 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-14px_40px_rgba(0,0,0,0.16)] md:hidden">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--app-border-strong)]" />
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]">{labels.more}</div>
          <div className="grid grid-cols-1 gap-1">
            <Link href="/dashboard/message-traffic" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.traffic}</span><span aria-hidden="true">›</span></Link>
            {authUser?.role === "ADMIN" && <Link href="/coupons" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.coupons}</span><span aria-hidden="true">›</span></Link>}
            <Link href="/stores" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.stores}</span><span aria-hidden="true">›</span></Link>
            <Link href="/admin/purchase-analytics" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.purchase}</span><span aria-hidden="true">›</span></Link>
            <Link href="/classification-insights" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.classification}</span><span aria-hidden="true">›</span></Link>
            {authUser?.role === "ADMIN" && <Link href="/friend-source-links" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.friendLinks}</span><span aria-hidden="true">›</span></Link>}
            {authUser?.role === "ADMIN" && <Link href="/mass-messages" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.mass}</span><span aria-hidden="true">›</span></Link>}
            {authUser?.role === "ADMIN" && <Link href="/admin/registrations" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>BM Approval</span><span aria-hidden="true">›</span></Link>}
            <a href="https://lineoppo.click/tiktok" target="_blank" rel="noreferrer noopener" onClick={() => setMoreOpen(false)} className={sheetLinkClass}><span>{labels.tiktok}</span><span aria-hidden="true">↗</span></a>
          </div>
        </div>
      )}

      <nav aria-label="Mobile primary navigation" className="fixed inset-x-0 bottom-0 z-[60] grid grid-cols-4 border-t border-[var(--app-border)] bg-[color:var(--app-surface)]/95 px-2 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl md:hidden">
        <Link href="/dashboard" aria-current={currentSection === "dashboard" ? "page" : undefined} className={itemClass(currentSection === "dashboard")}>
          <MobileNavIcon type="dashboard" /><span>{labels.dashboard}</span>
        </Link>
        <Link href="/chats" aria-current={currentSection === "chats" ? "page" : undefined} className={itemClass(currentSection === "chats")}>
          <MobileNavIcon type="chat" /><span>{labels.chats}</span>
        </Link>
        <Link href="/follower-insights" aria-current={currentSection === "follower-insights" ? "page" : undefined} className={itemClass(currentSection === "follower-insights")}>
          <MobileNavIcon type="insights" /><span>{labels.insights}</span>
        </Link>
        <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)} className={itemClass(moreOpen || secondaryActive)}>
          <MobileNavIcon type="more" /><span>{labels.more}</span>
        </button>
      </nav>
    </>
  );
}

export function TopNavigation(props: TopNavigationProps) {
  const { authUser, changeLanguage, currentSection, language, lastUpdatedAt, logout, pilotMode, searchText, setSearchText, text } = props;
  const updatedLabel = lastUpdatedAt
    ? `${text.lastUpdated || "Last updated"} ${new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(lastUpdatedAt)}`
    : (text.lastUpdated || "Last updated");

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .app-shell { padding-bottom: calc(4.35rem + env(safe-area-inset-bottom)); }
          .app-header { min-height: 3.75rem !important; height: 3.75rem !important; flex-wrap: nowrap !important; padding: 0.55rem 0.75rem !important; gap: 0.5rem !important; }
          .app-header .app-primary-nav { display: none !important; }
          .app-header > div:first-child { width: auto !important; flex: 1 1 auto !important; }
          .app-header-controls { flex: 0 0 auto !important; }
        }
      `}</style>

      <header className="app-header app-surface sticky top-0 z-30 flex min-h-14 h-14 min-w-0 items-center gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3 xl:gap-4 2xl:gap-5">
          <Link href="/dashboard" className={`${focusRing} flex min-w-0 shrink items-center gap-2 rounded-[var(--app-radius-md)] p-0.5 group md:min-w-max md:shrink-0`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--app-radius-sm)] bg-[var(--app-accent)] font-bold text-[11px] text-white shadow-2xs md:h-6 md:w-6">O</span>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-bold tracking-tight md:text-base xl:text-lg">{text.appName || "OPPO LINE OA Monitor"}</h1>
              <p className="app-muted hidden text-xs 2xl:block">{text.appDescription || "LINE OA monitoring"}</p>
            </div>
          </Link>

          <nav aria-label="Primary navigation" className="app-primary-nav hidden min-w-0 items-center gap-0.5 md:flex">
            <Link href="/dashboard" aria-current={currentSection === "dashboard" ? "page" : undefined} className={navLinkClass}>{text.dashboard || "Dashboard"}</Link>
            <Link href="/chats" aria-current={currentSection === "chats" ? "page" : undefined} className={navLinkClass}>{language === "th" ? "แชทร้านค้า" : language === "zh" ? "门店聊天" : "Store Chats"}</Link>
            <Link href="/follower-insights" aria-current={currentSection === "follower-insights" ? "page" : undefined} className={navLinkClass}>{language === "th" ? "ข้อมูลผู้ติดตาม" : language === "zh" ? "关注者洞察" : "Follower Insights"}</Link>
            {authUser?.role === "ADMIN" && <Link href="/coupons" aria-current={currentSection === "coupons" ? "page" : undefined} className={navLinkClass}>{language === "th" ? "คูปอง" : language === "zh" ? "优惠券" : "Coupons"}</Link>}
            <a href="https://lineoppo.click/tiktok" target="_blank" rel="noreferrer noopener" className={navLinkClass} aria-label="Open TikTok in a new tab">TikTok <span aria-hidden="true">↗</span></a>
            <SecondaryNavigation authUser={authUser} currentSection={currentSection} language={language} />
          </nav>
        </div>

        <div className="app-header-controls flex shrink-0 items-center justify-end gap-1.5 ml-auto md:gap-2">
          <ResponsiveSearch searchText={searchText} setSearchText={setSearchText} text={text} />
          {lastUpdatedAt && (
            <button type="button" aria-label={updatedLabel} title={updatedLabel} className={`${focusRing} app-button-secondary flex h-9 w-9 items-center justify-center rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] text-[11px] font-medium text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] md:h-8 md:w-auto md:gap-1.5 md:px-2`}>
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--app-success)] animate-pulse md:h-1.5 md:w-1.5" />
              <span className="hidden xl:inline">Live</span>
              <span className="sr-only">{updatedLabel}</span>
            </button>
          )}
          <ProfileMenu authUser={authUser} changeLanguage={changeLanguage} language={language} logout={logout} pilotMode={pilotMode} text={text} />
        </div>
      </header>

      <MobileBottomNavigation authUser={authUser} currentSection={currentSection} language={language} />
    </>
  );
}
