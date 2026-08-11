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

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";
const navLinkClass = `${focusRing} whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors`;

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
        className={`${focusRing} flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white p-1 pr-2 text-sm shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800`}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white dark:bg-blue-500" aria-hidden="true">
          {authUser.displayName.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-24 truncate font-semibold 2xl:inline">{authUser.displayName}</span>
        <span aria-hidden="true" className="text-xs text-slate-500">⌄</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Profile settings"
          className="app-surface absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-xl border p-3 shadow-xl"
        >
          <div className="border-b border-slate-200 px-2 pb-3 dark:border-slate-700">
            <p className="truncate text-sm font-bold">{authUser.displayName}</p>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="app-muted">{authUser.role}</span>
              <span className={pilotMode ? "rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-300" : "app-muted"}>
                {pilotMode ? "Pilot environment" : "Standard environment"}
              </span>
            </div>
          </div>

          <div className="space-y-3 px-2 py-3">
            <label className="block text-xs font-semibold">
              <span className="mb-1 block app-muted">{text.language || "Language"}</span>
              <select
                value={language}
                onChange={(event) => changeLanguage(event.target.value as Language)}
                aria-label={text.language || "Language"}
                className={`${focusRing} app-input h-9 w-full rounded-lg border px-2.5 text-sm`}
              >
                <option value="th">🇹🇭 ไทย</option>
                <option value="en">🇬🇧 English</option>
                <option value="zh">🇨🇳 中文</option>
              </select>
            </label>
            <div>
              <p className="mb-1 text-xs font-semibold app-muted">Appearance</p>
              <ThemeControl />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className={`${focusRing} w-full rounded-lg border border-red-200 px-3 py-2 text-left text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50`}
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
    <div ref={searchRef} className="relative min-w-0 lg:flex lg:flex-1 lg:justify-end">
      <label className="relative hidden w-40 lg:block xl:w-48 2xl:w-[clamp(14rem,18vw,22rem)]">
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder={label}
          className={`${focusRing} app-header-search app-input h-9 w-full rounded-lg border py-1.5 pl-8 pr-3 text-xs`}
        />
      </label>

      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`${focusRing} app-button-secondary flex h-9 w-9 items-center justify-center rounded-lg border lg:hidden`}
      >
        <span aria-hidden="true">⌕</span>
      </button>

      {isOpen && (
        <div className="app-surface absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border p-2 shadow-xl lg:hidden">
          <label>
            <span className="sr-only">{label}</span>
            <input
              autoFocus
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={label}
              className={`${focusRing} app-input h-10 w-full rounded-lg border px-3 text-sm`}
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

  const secondaryActive = ["classification-insights", "follower-insights", "friend-source-links"].includes(currentSection);
  return (
    <div ref={menuRef} className="relative 2xl:hidden">
      <button type="button" aria-haspopup="menu" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} className={`${navLinkClass} ${secondaryActive ? "app-nav-active" : ""}`}>
        {language === "th" ? "เพิ่มเติม" : language === "zh" ? "更多" : "More"} <span aria-hidden="true">⌄</span>
      </button>
      {isOpen && (
        <div role="menu" aria-label="More navigation" className="app-surface absolute left-0 top-[calc(100%+0.4rem)] z-50 min-w-56 rounded-xl border p-2 shadow-xl">
          <Link role="menuitem" href="/stores" aria-current={currentSection === "stores" ? "page" : undefined} className={`${navLinkClass} block lg:hidden`}>{language === "th" ? "จัดการร้านค้า" : language === "zh" ? "门店管理" : "Store Management"}</Link>
          <Link role="menuitem" href="/classification-insights" aria-current={currentSection === "classification-insights" ? "page" : undefined} className={`${navLinkClass} block`}>{language === "th" ? "ข้อมูลการจัดหมวดหมู่" : language === "zh" ? "分类洞察" : "Classification Insights"}</Link>
          <Link role="menuitem" href="/follower-insights" aria-current={currentSection === "follower-insights" ? "page" : undefined} className={`${navLinkClass} block`}>{language === "th" ? "ข้อมูลผู้ติดตาม" : language === "zh" ? "关注者洞察" : "Follower Insights"}</Link>
          {authUser?.role === "ADMIN" && <Link role="menuitem" href="/friend-source-links" aria-current={currentSection === "friend-source-links" ? "page" : undefined} className={`${navLinkClass} block`}>{language === "th" ? "ลิงก์เพิ่มเพื่อน" : language === "zh" ? "加好友来源链接" : "Friend Source Links"}</Link>}
        </div>
      )}
    </div>
  );
}

export function TopNavigation(props: TopNavigationProps) {
  const { authUser, changeLanguage, currentSection, language, lastUpdatedAt, logout, pilotMode, searchText, setSearchText, text } = props;
  const updatedLabel = lastUpdatedAt
    ? `${text.lastUpdated || "Last updated"} ${new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(lastUpdatedAt)}`
    : (text.lastUpdated || "Last updated");

  return (
    <header className="app-header app-surface sticky top-0 z-30 flex min-h-16 min-w-0 items-center gap-3 border-b px-4 py-2.5 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3 xl:gap-5">
        <Link href="/dashboard" className={`${focusRing} min-w-max shrink-0 rounded-lg p-0.5`}>
          <h1 className="text-base font-bold tracking-tight xl:text-lg">{text.appName || "OPPO LINE OA Monitor"}</h1>
          <p className="app-muted hidden text-xs 2xl:block">{text.appDescription || "LINE OA monitoring"}</p>
        </Link>

        <nav aria-label="Primary navigation" className="app-primary-nav flex min-w-0 items-center gap-0.5">
          <Link href="/dashboard" aria-current={currentSection === "dashboard" ? "page" : undefined} className={navLinkClass}>{text.dashboard || "Dashboard"}</Link>
          <Link href="/chats" aria-current={currentSection === "chats" ? "page" : undefined} className={navLinkClass}>{language === "th" ? "แชทร้านค้า" : language === "zh" ? "门店聊天" : "Store Chats"}</Link>
          <Link href="/stores" aria-current={currentSection === "stores" ? "page" : undefined} className={`${navLinkClass} hidden lg:block`}>{text.storeManagement || "Stores"}</Link>
          {authUser?.role === "ADMIN" && <Link href="/admin/registrations" aria-current={currentSection === "admin-registrations" ? "page" : undefined} className={navLinkClass}>{language === "th" ? "อนุมัติ BM" : language === "zh" ? "BM 审批" : "BM Approval"}</Link>}
          <div className="hidden items-center gap-0.5 2xl:flex">
            <Link href="/classification-insights" aria-current={currentSection === "classification-insights" ? "page" : undefined} className={navLinkClass}>{language === "th" ? "ข้อมูลการจัดหมวดหมู่" : language === "zh" ? "分类洞察" : "Classification Insights"}</Link>
            <Link href="/follower-insights" aria-current={currentSection === "follower-insights" ? "page" : undefined} className={navLinkClass}>{language === "th" ? "ข้อมูลผู้ติดตาม" : language === "zh" ? "关注者洞察" : "Follower Insights"}</Link>
            {authUser?.role === "ADMIN" && <Link href="/friend-source-links" aria-current={currentSection === "friend-source-links" ? "page" : undefined} className={navLinkClass}>{language === "th" ? "ลิงก์เพิ่มเพื่อน" : language === "zh" ? "加好友来源链接" : "Friend Source Links"}</Link>}
          </div>
          <SecondaryNavigation authUser={authUser} currentSection={currentSection} language={language} />
        </nav>
      </div>

      <div className="app-header-controls flex min-w-0 shrink items-center justify-end gap-2 lg:flex-1">
        <ResponsiveSearch searchText={searchText} setSearchText={setSearchText} text={text} />
        {lastUpdatedAt && (
          <button type="button" aria-label={updatedLabel} title={updatedLabel} className={`${focusRing} app-button-secondary flex h-9 items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold`}>
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="hidden xl:inline">Live</span>
            <span className="sr-only">{updatedLabel}</span>
          </button>
        )}
        <ProfileMenu authUser={authUser} changeLanguage={changeLanguage} language={language} logout={logout} pilotMode={pilotMode} text={text} />
      </div>
    </header>
  );
}
