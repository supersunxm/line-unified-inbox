import React from "react";
import Link from "next/link";
import { ThemeControl } from "@/app/theme";
import type { PrimarySection } from "@/app/primary-navigation";

export type Language = "th" | "en" | "zh";

export interface TopNavigationProps {
  currentSection: PrimarySection;
  authUser: { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  text: Record<string, any>;
  language: Language;
  changeLanguage: (lang: Language) => void;
  searchText: string;
  setSearchText: (query: string) => void;
  pilotMode?: boolean;
  lastUpdatedAt?: Date | null;
  logout: () => Promise<void> | void;
  resetPaneSizes?: (() => void) | null;
}

export function TopNavigation({
  currentSection,
  authUser,
  text,
  language,
  changeLanguage,
  searchText,
  setSearchText,
  pilotMode,
  lastUpdatedAt,
  logout,
  resetPaneSizes,
}: TopNavigationProps) {
  return (
    <header className="app-header app-surface sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b px-4 py-2.5 sm:px-6">
      {/* Left section: App Branding & Primary Navigation */}
      <div className="flex min-w-0 items-center gap-4 lg:gap-6">
        <div className="min-w-max shrink-0">
          <Link href="/dashboard" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-0.5">
            <h1 className="text-lg font-bold tracking-tight sm:text-xl text-slate-900 dark:text-slate-50">
              {text.appName || "OPPO LINE OA Monitor"}
            </h1>
            <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              {text.appDescription || "ระบบติดตามข้อความจาก LINE OA ของร้านค้า"}
            </p>
          </Link>
        </div>

        {/* Primary Navigation Links */}
        <nav aria-label="Primary navigation" className="app-primary-nav flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
          <Link
            href="/dashboard"
            aria-current={currentSection === "dashboard" ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              currentSection === "dashboard"
                ? "bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
          >
            {text.dashboard || "แดชบอร์ด"}
          </Link>

          <Link
            href="/chats"
            aria-current={currentSection === "chats" ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              currentSection === "chats"
                ? "bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
          >
            {language === "th" ? "แชทร้านค้า" : language === "zh" ? "门店聊天" : "Store Chats"}
          </Link>

          <Link
            href="/stores"
            aria-current={currentSection === "stores" ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              currentSection === "stores"
                ? "bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
          >
            {text.storeManagement || "จัดการร้านค้า"}
          </Link>

          <Link
            href="/follower-insights"
            aria-current={currentSection === "follower-insights" ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              currentSection === "follower-insights"
                ? "bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
          >
            {language === "th" ? "ข้อมูลผู้ติดตาม" : language === "zh" ? "关注者洞察" : "Follower Insights"}
          </Link>

          {authUser?.role === "ADMIN" && (
            <Link
              href="/friend-source-links"
              aria-current={currentSection === "friend-source-links" ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                currentSection === "friend-source-links"
                  ? "bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
            >
              {language === "th" ? "ลิงก์เพิ่มเพื่อน" : language === "zh" ? "加好友来源链接" : "Friend Source Links"}
            </Link>
          )}
        </nav>
      </div>

      {/* Right section: Header Controls & User Info */}
      <div className="app-header-controls flex items-center gap-2 sm:gap-3 shrink-0">
        <ThemeControl compact />

        {currentSection === "chats" && resetPaneSizes && (
          <button
            type="button"
            onClick={resetPaneSizes}
            aria-label={language === "th" ? "รีเซ็ตขนาดหน้าต่าง" : language === "zh" ? "重置面板大小" : "Reset pane sizes"}
            className="app-button-secondary rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {language === "th" ? "รีเซ็ตขนาดหน้าต่าง" : language === "zh" ? "重置面板大小" : "Reset pane sizes"}
          </button>
        )}

        {pilotMode && (
          <span className="rounded-full bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
            Pilot
          </span>
        )}

        {authUser && (
          <span className="hidden xl:inline text-xs font-medium text-slate-600 dark:text-slate-400">
            {authUser.displayName} · {authUser.role}
          </span>
        )}

        {authUser && (
          <button
            type="button"
            onClick={() => void logout()}
            className="app-button-secondary rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/50 dark:hover:text-red-300 transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Logout
          </button>
        )}

        {lastUpdatedAt && (
          <span className="app-header-metadata hidden 2xl:inline text-xs text-slate-400">
            {text.lastUpdated || "อัปเดตล่าสุด"}{" "}
            {new Intl.DateTimeFormat(language, { timeStyle: "short" }).format(lastUpdatedAt)}
          </span>
        )}

        {/* Global Search Input */}
        <div className="relative hidden md:block">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={text.searchPlaceholder || "ค้นหาลูกค้า ร้านค้า หรือข้อความ"}
            aria-label={text.searchPlaceholder || "Search"}
            className="app-header-search app-input w-48 lg:w-64 h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        {/* Language Selector */}
        <select
          value={language}
          onChange={(e) => changeLanguage(e.target.value as Language)}
          aria-label={text.language || "Language"}
          className="app-input h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
        >
          <option value="th">🇹🇭 ไทย</option>
          <option value="en">🇬🇧 English</option>
          <option value="zh">🇨🇳 中文</option>
        </select>

        {/* Notifications Button */}
        <button
          type="button"
          aria-label="Notifications (12 unread)"
          className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span>🔔</span>
          <span>12</span>
        </button>

        {/* User Avatar */}
        <div
          aria-label={authUser?.displayName ? `User avatar for ${authUser.displayName}` : "User avatar"}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-500 text-xs font-bold text-white shadow-sm ring-2 ring-blue-500/20"
        >
          {authUser?.displayName ? authUser.displayName.charAt(0).toUpperCase() : "S"}
        </div>
      </div>
    </header>
  );
}
