"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { useThemeToggle } from "@/app/theme";
import { api } from "@/lib/api";
import { useAuthUserSnapshot } from "@/lib/auth-user-store";
import { withMonth } from "@/lib/v2/month-url";
import { useV2Data } from "./v2-data";
import { MonthSelector } from "./v2-month-controls";
import { useV2Month } from "./v2-month-data";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40";

type IconName = "today" | "response" | "customers" | "growth" | "stores" | "send" | "report" | "admin";

function NavIcon({ name }: { name: IconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
      {name === "today" && <><rect {...common} x="3.5" y="5" width="17" height="15" rx="2" /><path {...common} d="M8 3v4m8-4v4M3.5 10h17" /><path {...common} d="m9 15 2 2 4-4" /></>}
      {name === "response" && <><path {...common} d="M5 5h11a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-5l-4 3v-3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" /><path {...common} d="M10.5 8.5v3l2 1.5" /></>}
      {name === "customers" && <><circle {...common} cx="9" cy="8" r="3.2" /><path {...common} d="M3.5 19c.6-4 2.6-6 5.5-6 2.2 0 4 1.2 4.9 3.4" /><path {...common} d="M16 19v-4m3 4v-7" /></>}
      {name === "growth" && <><path {...common} d="M3 17 9 11l4 4 8-8" /><path {...common} d="M15 7h6v6" /></>}
      {name === "stores" && <><path {...common} d="M4 9h16l-1.5-4h-13L4 9Z" /><path {...common} d="M5 10v9h14v-9" /><path {...common} d="M10 19v-5h4v5" /></>}
      {name === "send" && <><path {...common} d="M21 3 10 14" /><path {...common} d="m21 3-7 18-4-7-7-4 18-7Z" /></>}
      {name === "report" && <><path {...common} d="M6 3h9l4 4v14H6V3Z" /><path {...common} d="M15 3v4h4M9 13h6M9 17h6M9 9h2" /></>}
      {name === "admin" && <><path {...common} d="M12 3c3 2.5 6 2.7 8 3v5.5c0 4.5-2.7 7.7-8 9.5-5.3-1.8-8-5-8-9.5V6c2-.3 5-.5 8-3Z" /><path {...common} d="m8.5 12 2.2 2.2 4.8-5" /></>}
    </svg>
  );
}

type NavItem = { href: string; label: string; icon: IconName; active?: (path: string) => boolean };

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.active ? item.active(pathname) : false;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${focusRing} flex h-10 items-center gap-3 rounded-[var(--app-radius-md)] px-3 text-sm font-medium transition-colors ${active ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]" : "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]"}`}
    >
      <NavIcon name={item.icon} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  );
}

export const V2_PAGE_TITLES: Record<string, string> = { "/v2": "ภาพรวมเดือน", "/v2/response": "ตอนนี้", "/v2/stores": "สาขา", "/v2/admin/partners": "Partner ของสาขา" };

/** Pages that show monthly numbers carry the month selector; "ตอนนี้" is live and has none. */
export function isMonthlyPage(pathname: string): boolean {
  return pathname === "/v2" || pathname.startsWith("/v2/stores");
}

function ThemeToggle() {
  const { shown, toggle } = useThemeToggle();
  const label = shown === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด";
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

/** Sidebar and top bar for /v2. Lives in app/v2/layout.tsx, so it stays mounted across /v2 pages. */
export function V2Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/v2";
  const data = useV2Data();
  const monthData = useV2Month();
  const { user } = useAuthUserSnapshot();
  const monthly = isMonthlyPage(pathname);

  const mainItems: NavItem[] = [
    { href: withMonth("/v2", monthData.month), label: "ภาพรวมเดือน", icon: "today", active: (path) => path === "/v2" || path.startsWith("/v2/response") },
    { href: withMonth("/v2/stores", monthData.month), label: "สาขา", icon: "stores", active: (path) => path.startsWith("/v2/stores") },
    { href: "/admin/purchase-analytics", label: "ลูกค้าและการขาย", icon: "customers" },
    { href: "/follower-insights", label: "การเติบโต", icon: "growth" },
  ];
  const toolItems: NavItem[] = [
    { href: "/mass-messages", label: "ส่งข้อความ", icon: "send" },
    { href: "/monthly-operations-report", label: "รายงาน", icon: "report" },
    { href: "/admin/registrations", label: "ผู้ดูแลระบบ", icon: "admin" },
    { href: "/v2/admin/partners", label: "Partner ของสาขา", icon: "stores", active: (path) => path.startsWith("/v2/admin/partners") },
  ];
  const title = V2_PAGE_TITLES[pathname] ?? "OPPO LINE OA Monitor";

  return (
    <div data-v2-shell className="flex h-dvh w-full min-w-[1024px] overflow-hidden bg-[var(--app-bg)] text-[var(--app-text-primary)]">
      <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-surface)]">
        <div className="flex h-14 items-center gap-2 border-b border-[var(--app-border-subtle)] px-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-accent)] text-[11px] font-bold text-white">O</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">OPPO LINE OA</div>
            <div className="text-[11px] text-[var(--app-text-tertiary)]">เวอร์ชันใหม่ (v2)</div>
          </div>
        </div>
        <nav aria-label="เมนู v2" className="flex-1 space-y-1 overflow-y-auto p-3">
          {mainItems.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
          <div className="px-3 pb-1 pt-5 text-xs font-semibold text-[var(--app-text-tertiary)]">เครื่องมือ</div>
          {toolItems.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
        </nav>
        <div className="border-t border-[var(--app-border-subtle)] p-3">
          <Link href="/home" className={`${focusRing} block rounded-[var(--app-radius-md)] px-3 py-2 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]`}>กลับไปเวอร์ชันเดิม</Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-6">
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</div>
          {monthly && <MonthSelector />}
          <button type="button" onClick={() => { monthData.refresh(); if (data.active) data.refresh(); }} className={`${focusRing} h-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-xs font-medium text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]`}>
            รีเฟรช
          </button>
          <ThemeToggle />
          {user && (
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-accent)] text-xs font-bold text-white" aria-hidden="true">{user.displayName.charAt(0).toUpperCase()}</span>
              <button type="button" onClick={() => void api.logout().catch(() => undefined).then(() => window.location.replace("/"))} className={`${focusRing} rounded-lg px-2 py-1 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]`}>
                ออกจากระบบ
              </button>
            </div>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
