"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeControl } from "@/app/theme";
import type { PrimarySection } from "@/app/primary-navigation";
import type { Language, TopNavigationProps } from "./top-navigation";

const SIDEBAR_STORAGE_KEY = "oppo-app-sidebar-collapsed";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1";

type SidebarProps = Pick<TopNavigationProps, "authUser" | "changeLanguage" | "currentSection" | "language" | "logout" | "pilotMode" | "text">;
type AccountPanel = "profile" | "settings" | null;

type NavItem = {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  active?: (pathname: string, section: PrimarySection) => boolean;
};

function labels(language: Language) {
  if (language === "th") {
    return {
      workspace: "พื้นที่ทำงาน", operations: "เครื่องมือ", dashboard: "แดชบอร์ด", chats: "แชทร้านค้า",
      followers: "ข้อมูลผู้ติดตาม", traffic: "Message Traffic", coupons: "คูปอง", stores: "จัดการร้านค้า",
      purchase: "ข้อมูลการซื้อ", classification: "ข้อมูลการจำแนก", friendLinks: "ลิงก์เพิ่มเพื่อน",
      mass: "ส่งข้อความ", approval: "อนุมัติ BM", profile: "โปรไฟล์", settings: "ตั้งค่า",
      logout: "ออกจากระบบ", language: "ภาษา", appearance: "รูปแบบการแสดงผล", role: "สิทธิ์การใช้งาน",
      environment: "สภาพแวดล้อม", standard: "Production", pilot: "Pilot", collapse: "ย่อแถบเมนู", expand: "ขยายแถบเมนู",
    };
  }
  if (language === "zh") {
    return {
      workspace: "工作区", operations: "工具", dashboard: "仪表盘", chats: "门店聊天", followers: "关注者洞察",
      traffic: "消息流量", coupons: "优惠券", stores: "门店管理", purchase: "购买洞察", classification: "分类洞察",
      friendLinks: "加好友来源链接", mass: "群发消息", approval: "BM 审批", profile: "个人资料", settings: "设置",
      logout: "退出", language: "语言", appearance: "外观", role: "角色", environment: "环境", standard: "Production",
      pilot: "Pilot", collapse: "收起侧栏", expand: "展开侧栏",
    };
  }
  return {
    workspace: "Workspace", operations: "Tools", dashboard: "Dashboard", chats: "Store Chats", followers: "Follower Insights",
    traffic: "Message Traffic", coupons: "Coupons", stores: "Store Management", purchase: "Purchase Intelligence",
    classification: "Classification Insights", friendLinks: "Friend Source Links", mass: "Mass Message", approval: "BM Approval",
    profile: "Profile", settings: "Settings", logout: "Logout", language: "Language", appearance: "Appearance", role: "Role",
    environment: "Environment", standard: "Production", pilot: "Pilot", collapse: "Collapse sidebar", expand: "Expand sidebar",
  };
}

export function AppSidebar({ authUser, changeLanguage, currentSection, language, logout, pilotMode, text }: SidebarProps) {
  const pathname = usePathname() || "/";
  const t = labels(language);
  const [collapsed, setCollapsed] = useState(false);
  const [accountPanel, setAccountPanel] = useState<AccountPanel>(null);

  useEffect(() => {
    const next = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    setCollapsed(next);
    document.documentElement.style.setProperty("--app-sidebar-width", next ? "4.5rem" : "16rem");
    return () => {
      document.documentElement.style.removeProperty("--app-sidebar-width");
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--app-sidebar-width", collapsed ? "4.5rem" : "16rem");
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const primaryItems: NavItem[] = [
    { href: "/dashboard", label: t.dashboard, icon: "▦", active: (path) => path === "/dashboard" },
    { href: "/chats", label: t.chats, icon: "◫", active: (path) => path.startsWith("/chats") },
    { href: "/follower-insights", label: t.followers, icon: "↗", active: (path) => path.startsWith("/follower-insights") },
    { href: "/dashboard/message-traffic", label: t.traffic, icon: "≋", active: (path) => path.startsWith("/dashboard/message-traffic") },
  ];

  const toolItems: NavItem[] = [
    { href: "/coupons", label: t.coupons, icon: "◇", adminOnly: true },
    { href: "/stores", label: t.stores, icon: "□" },
    { href: "/admin/purchase-analytics", label: t.purchase, icon: "◎" },
    { href: "/classification-insights", label: t.classification, icon: "⌁" },
    { href: "/friend-source-links", label: t.friendLinks, icon: "↗", adminOnly: true },
    { href: "/mass-messages", label: t.mass, icon: "✦", adminOnly: true },
    { href: "/admin/registrations", label: t.approval, icon: "✓", adminOnly: true },
    { href: "/tiktok", label: "TikTok", icon: "♪", adminOnly: true },
  ];

  const itemClass = (active: boolean) => `${focusRing} group flex h-10 w-full items-center rounded-xl text-sm font-medium transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${active ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]" : "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]"}`;
  const isActive = (item: NavItem) => item.active ? item.active(pathname, currentSection) : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const renderItem = (item: NavItem) => {
    if (item.adminOnly && authUser?.role !== "ADMIN") return null;
    const active = isActive(item);
    return (
      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined} className={itemClass(active)}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[17px]" aria-hidden="true">{item.icon}</span>
        {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      </Link>
    );
  };

  if (!authUser) return null;

  return (
    <aside className={`app-desktop-sidebar fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--app-border)] bg-[var(--app-surface)] transition-[width] duration-200 md:flex md:flex-col ${collapsed ? "w-[4.5rem]" : "w-64"}`}>
      <div className={`flex h-14 shrink-0 items-center border-b border-[var(--app-border-subtle)] ${collapsed ? "justify-center px-2" : "justify-between px-3"}`}>
        <Link href="/dashboard" className={`${focusRing} flex min-w-0 items-center gap-2 rounded-lg`} title={collapsed ? (text.appName || "OPPO LINE OA Monitor") : undefined}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--app-accent)] text-xs font-bold text-white">O</span>
          {!collapsed && <div className="min-w-0"><div className="truncate text-sm font-bold text-[var(--app-text-primary)]">{text.appName || "OPPO LINE OA Monitor"}</div><div className="truncate text-[10px] text-[var(--app-text-tertiary)]">Retail Operations</div></div>}
        </Link>
        {!collapsed && <button type="button" onClick={() => setCollapsed(true)} aria-label={t.collapse} title={t.collapse} className={`${focusRing} flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-hover)]`}>‹</button>}
      </div>

      {collapsed && <button type="button" onClick={() => setCollapsed(false)} aria-label={t.expand} title={t.expand} className={`${focusRing} mx-auto mt-2 flex h-9 w-9 items-center justify-center rounded-xl text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-hover)]`}>›</button>}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {!collapsed && <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">{t.workspace}</div>}
        <nav className="space-y-1" aria-label={t.workspace}>{primaryItems.map(renderItem)}</nav>
        <div className="my-3 border-t border-[var(--app-border-subtle)]" />
        {!collapsed && <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">{t.operations}</div>}
        <nav className="space-y-1" aria-label={t.operations}>{toolItems.map(renderItem)}</nav>
      </div>

      <div className="relative shrink-0 border-t border-[var(--app-border-subtle)] p-2">
        {accountPanel && !collapsed && (
          <div className="absolute bottom-[7.2rem] left-2 right-2 z-50 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-[var(--app-shadow-elevated)]">
            {accountPanel === "profile" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-accent)] text-sm font-bold text-white">{authUser.displayName.charAt(0).toUpperCase()}</span><div className="min-w-0"><div className="truncate text-sm font-semibold text-[var(--app-text-primary)]">{authUser.displayName}</div><div className="truncate text-[11px] text-[var(--app-text-tertiary)]">{authUser.email}</div></div></div>
                <div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-[var(--app-surface-subtle)] p-2.5"><div className="text-[10px] text-[var(--app-text-tertiary)]">{t.role}</div><div className="mt-0.5 text-xs font-semibold">{authUser.role}</div></div><div className="rounded-xl bg-[var(--app-surface-subtle)] p-2.5"><div className="text-[10px] text-[var(--app-text-tertiary)]">{t.environment}</div><div className="mt-0.5 text-xs font-semibold">{pilotMode ? t.pilot : t.standard}</div></div></div>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-xs font-medium text-[var(--app-text-secondary)]"><span className="mb-1.5 block">{t.language}</span><select value={language} onChange={(event) => changeLanguage(event.target.value as Language)} className={`${focusRing} h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-sm text-[var(--app-text-primary)]`}><option value="th">🇹🇭 ไทย</option><option value="en">🇬🇧 English</option><option value="zh">🇨🇳 中文</option></select></label>
                <div><div className="mb-1.5 text-xs font-medium text-[var(--app-text-secondary)]">{t.appearance}</div><ThemeControl /></div>
              </div>
            )}
          </div>
        )}

        <button type="button" onClick={() => { if (collapsed) setCollapsed(false); setAccountPanel((current) => current === "profile" ? null : "profile"); }} className={itemClass(accountPanel === "profile")} title={collapsed ? t.profile : undefined}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent)] text-[10px] font-bold text-white">{authUser.displayName.charAt(0).toUpperCase()}</span>{!collapsed && <span className="min-w-0 flex-1 truncate text-left">{t.profile}</span>}{!collapsed && <span className="text-[11px] text-[var(--app-text-tertiary)]">{authUser.role}</span>}</button>
        <button type="button" onClick={() => { if (collapsed) setCollapsed(false); setAccountPanel((current) => current === "settings" ? null : "settings"); }} className={itemClass(accountPanel === "settings")} title={collapsed ? t.settings : undefined}><span className="flex h-7 w-7 shrink-0 items-center justify-center text-[17px]" aria-hidden="true">⚙</span>{!collapsed && <span className="min-w-0 flex-1 truncate text-left">{t.settings}</span>}</button>
        <button type="button" onClick={() => void logout()} className={`${itemClass(false)} text-[var(--app-danger)] hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)]`} title={collapsed ? t.logout : undefined}><span className="flex h-7 w-7 shrink-0 items-center justify-center text-[17px]" aria-hidden="true">↪</span>{!collapsed && <span className="min-w-0 flex-1 truncate text-left">{t.logout}</span>}</button>
      </div>
    </aside>
  );
}
