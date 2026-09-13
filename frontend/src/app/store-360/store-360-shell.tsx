"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { AuthUser } from "@/lib/authorization";
import type { AppLanguage } from "../language";

type Store360ShellProps = {
  authUser: AuthUser;
  language: AppLanguage;
  changeLanguage: (language: AppLanguage) => void;
  logout: () => Promise<void> | void;
  isLoading?: boolean;
  apiError?: string | null;
  onRetry?: () => void;
  style?: CSSProperties;
  children: ReactNode;
};

const navigation = [
  ["store", "Store 360", "/store-360"],
  ["grid", "Multi-store View", "/dashboard"],
  ["chat", "Conversation Explorer", "/chats"],
  ["sales", "Sales & Products", "/admin/purchase-analytics"],
  ["voice", "Customer Voice", "#customer-voice-title"],
  ["team", "Team Performance", "#team-performance-title"],
  ["download", "Export Center", "/download-center"],
] as const;

function ShellIcon({ name, size = 17 }: { name: string; size?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...common}>
      {name === "store" && <><path d="M4 9h16l-1.5-4h-13L4 9Z" /><path d="M5 10v9h14v-9" /><path d="M3.5 9c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3" /><path d="M9 19v-5h6v5" /></>}
      {name === "grid" && <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>}
      {name === "chat" && <><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 9h8m-8 3h5" /></>}
      {name === "sales" && <><path d="M5 7h14l-1 13H6L5 7Z" /><path d="M9 7c0-2.7 1.2-4 3-4s3 1.3 3 4" /></>}
      {name === "voice" && <><path d="M4 5h16v12H8l-4 3V5Z" /><path d="M8 9h8m-8 4h5" /></>}
      {name === "team" && <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.6-4 2.6-6 5.5-6 2.1 0 3.8 1.1 4.8 3" /><path d="M16 8a2.5 2.5 0 1 1 2 4m-2 2c2.3.3 3.7 2 4.2 4" /></>}
      {name === "download" && <><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></>}
    </svg>
  );
}

export function Store360Shell({ authUser, language, changeLanguage, logout, isLoading, apiError, onRetry, style, children }: Store360ShellProps) {
  return (
    <div style={style} className="store-360-shell flex min-h-dvh w-full min-w-0 bg-[var(--app-bg)] text-[var(--app-text-primary)]">
      <aside className="hidden w-[190px] shrink-0 flex-col bg-[#0d1a27] px-2.5 py-5 text-white lg:flex">
        <div className="flex items-center px-3 pb-7 text-[25px] font-medium tracking-[-0.06em]">oppo</div>
        <nav aria-label="Store 360 navigation" className="flex-1 space-y-1">
          {navigation.map(([icon, label, href]) => (
            <Link key={label} href={href} aria-current={label === "Store 360" ? "page" : undefined} className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 text-[12px] font-medium transition-colors ${label === "Store 360" ? "bg-[#2b3e51] text-white shadow-sm" : "text-slate-300 hover:bg-[#1b2b3b] hover:text-white"}`}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center"><ShellIcon name={icon} /></span>
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="space-y-4 px-3 pb-1 text-[11px] text-slate-300">
          <Link href="mailto:support@oppo.example" className="flex items-center gap-2 hover:text-white"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-500 text-[10px]">?</span>Need Help?</Link>
          <div className="space-y-1 text-[10px] leading-4 text-slate-400"><p>Store 360 v1.0</p><p>OPPO Thailand</p></div>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[64px] items-center justify-end border-b border-[var(--app-border-subtle)] bg-[var(--app-surface)]/90 px-4 backdrop-blur-xl sm:px-6 lg:absolute lg:inset-x-0 lg:top-0 lg:z-40 lg:h-0 lg:min-h-0 lg:border-b-0 lg:bg-transparent lg:px-8">
          <div className="flex items-center gap-3 lg:absolute lg:right-8 lg:top-3">
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[var(--app-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2468b5] text-xs font-bold text-white">{authUser.displayName.charAt(0).toUpperCase()}</span>
                <span className="hidden text-left sm:block"><span className="block text-xs font-semibold text-[var(--app-text-primary)]">{authUser.displayName}</span><span className="block text-[10px] text-[var(--app-text-tertiary)]">OPPO Thailand</span></span>
                <span className="text-xs text-[var(--app-text-secondary)]">⌄</span>
              </summary>
              <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-[var(--app-shadow-elevated)]">
                <p className="truncate text-xs font-semibold text-[var(--app-text-primary)]">{authUser.displayName}</p>
                <p className="mt-0.5 truncate text-[10px] text-[var(--app-text-tertiary)]">{authUser.email}</p>
                <label className="mt-3 block text-[10px] font-semibold text-[var(--app-text-secondary)]">Language<select value={language} onChange={(event) => changeLanguage(event.target.value as AppLanguage)} className="mt-1 h-8 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2 text-xs text-[var(--app-text-primary)]"><option value="th">ไทย</option><option value="en">English</option><option value="zh">中文</option></select></label>
                <button type="button" onClick={() => void logout()} className="mt-3 w-full rounded-lg bg-[var(--app-danger-soft)] px-2 py-2 text-left text-xs font-semibold text-[var(--app-danger)]">Log out</button>
              </div>
            </details>
          </div>
        </header>

        {isLoading && <div className="border-b border-[var(--app-info)]/30 bg-[var(--app-info-soft)] px-4 py-2 text-center text-xs font-medium text-[var(--app-info)]">Loading Store 360 data…</div>}
        {apiError && <div role="alert" className="flex items-center justify-center gap-3 border-b border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] px-4 py-2 text-xs font-medium text-[var(--app-danger)]"><span>Unable to connect to the data service: {apiError}</span>{onRetry && <button type="button" onClick={onRetry} className="rounded-lg border border-[var(--app-danger)]/30 bg-[var(--app-surface)] px-2.5 py-1 font-semibold">Retry</button>}</div>}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
