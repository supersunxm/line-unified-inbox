"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { ThemeControl } from "@/app/theme";
import type { PrimarySection } from "@/app/primary-navigation";
import { canAccessPrimarySection, canAccessWebTool, defaultRouteForUser } from "@/lib/authorization";
import type { Language, TopNavigationProps } from "./top-navigation";

const SIDEBAR_STORAGE_KEY = "oppo-app-sidebar-collapsed";
const SIDEBAR_STORAGE_EVENT = "oppo-app-sidebar-storage";
const EXPANDED_SIDEBAR_WIDTH = "16rem";
const COMPACT_SIDEBAR_WIDTH = "4.25rem";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1";

type SidebarProps = Pick<TopNavigationProps, "authUser" | "changeLanguage" | "currentSection" | "language" | "logout" | "pilotMode" | "text">;
type AccountPanel = "profile" | "settings" | null;
type SidebarTooltip = { label: string; top: number } | null;
type IconName = "home" | "dashboard" | "chat" | "main-oa" | "followers" | "traffic" | "coupon" | "store" | "purchase" | "friend" | "broadcast" | "approval" | "tiktok" | "rich-menu" | "auto-response" | "profile" | "settings" | "logout";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  section?: PrimarySection;
  tool?: "message-traffic" | "tiktok";
  active?: (pathname: string, section: PrimarySection) => boolean;
};

function SidebarIcon({ name, className = "" }: { name: IconName; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 ${className}`}>
      {name === "home" && <><path {...common} d="m3 11 9-7 9 7"/><path {...common} d="M5.5 9.5V20h13V9.5M9.5 20v-6h5v6"/></>}
      {name === "dashboard" && <><rect {...common} x="3" y="3" width="7" height="7" rx="1.5"/><rect {...common} x="14" y="3" width="7" height="7" rx="1.5"/><rect {...common} x="3" y="14" width="7" height="7" rx="1.5"/><rect {...common} x="14" y="14" width="7" height="7" rx="1.5"/></>}
      {name === "chat" && <><path {...common} d="M5 5h11a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-5l-4 3v-3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"/><circle cx="7" cy="10.5" r=".8" fill="currentColor"/><circle cx="10.5" cy="10.5" r=".8" fill="currentColor"/><circle cx="14" cy="10.5" r=".8" fill="currentColor"/><path {...common} d="M17 16h1.5A2.5 2.5 0 0 1 21 18.5V20l-2-1.5"/></>}
      {name === "main-oa" && <><path {...common} d="M4 20h16"/><path {...common} d="M6 20V6h12v14"/><path {...common} d="M9 9h2m2 0h2M9 13h2m2 0h2"/><path {...common} d="M10 20v-3h4v3"/></>}
      {name === "followers" && <><circle {...common} cx="9" cy="8" r="3.2"/><path {...common} d="M3.5 19c.6-4 2.6-6 5.5-6 2.2 0 4 1.2 4.9 3.4"/><path {...common} d="M16 19v-4m3 4v-7m3 7V9"/></>}
      {name === "traffic" && <><path {...common} d="M2 12c2.2-3.5 4.2-3.5 6.3 0s4.2 3.5 6.4 0 4.2-3.5 7 0"/><path {...common} d="M2 17c2.2-3.5 4.2-3.5 6.3 0s4.2 3.5 6.4 0"/></>}
      {name === "coupon" && <><path {...common} d="M4 6h16v3a2.5 2.5 0 0 0 0 5v4H4v-4a2.5 2.5 0 0 0 0-5V6Z"/><circle {...common} cx="9" cy="10" r="1.2"/><circle {...common} cx="15" cy="14" r="1.2"/><path {...common} d="m16 9-8 7"/></>}
      {name === "store" && <><path {...common} d="M4 9h16l-1.5-4h-13L4 9Z"/><path {...common} d="M5 10v9h14v-9"/><path {...common} d="M3.5 9c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3"/><path {...common} d="M9 19v-5h6v5"/></>}
      {name === "purchase" && <><path {...common} d="M7 8h10l1 12H6L7 8Z"/><path {...common} d="M9 8c0-3 1.2-5 3-5s3 2 3 5"/><path {...common} d="M9.5 17v-3m2.5 3v-5m2.5 5v-2"/></>}
      {name === "friend" && <><circle {...common} cx="9" cy="8" r="3.2"/><path {...common} d="M3.5 19c.6-4 2.6-6 5.5-6 2.1 0 3.8 1.1 4.8 3"/><path {...common} d="M18 13v7m-3.5-3.5h7"/></>}
      {name === "broadcast" && <><path {...common} d="M3 10v4l11 4V6L3 10Z"/><path {...common} d="M3 10H1v4h2m3 1 1.5 5h3l-1-4"/><path {...common} d="m17 8 3-2m-2 6h4m-5 4 3 2"/></>}
      {name === "approval" && <><path {...common} d="M12 3c3 2.5 6 2.7 8 3v5.5c0 4.5-2.7 7.7-8 9.5-5.3-1.8-8-5-8-9.5V6c2-.3 5-.5 8-3Z"/><path {...common} d="m8.5 12 2.2 2.2 4.8-5"/></>}
      {name === "tiktok" && <><path {...common} d="M13 4v10a4.5 4.5 0 1 1-4-4.5"/><path {...common} d="M13 4c1.6 2.8 3.7 4 6 4.3"/></>}
      {name === "rich-menu" && <><rect {...common} x="3" y="3" width="18" height="18" rx="2"/><path {...common} d="M3 9h18M3 15h18M9 9v12M15 9v12"/></>}
      {name === "auto-response" && <><path {...common} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path {...common} d="M13 8l-3 4h4l-2 4"/></>}
      {name === "profile" && <><circle {...common} cx="12" cy="8" r="3.5"/><path {...common} d="M5 21c.7-4.6 3.2-7 7-7s6.3 2.4 7 7"/></>}
      {name === "settings" && <><path {...common} d="M12 3l1.5.5 1.4-.9 2 2-.9 1.4.5 1.5 1.8.4v2.8l-1.8.4-.5 1.5.9 1.4-2 2-1.4-.9-1.5.5-.4 1.8H8.8l-.4-1.8-1.5-.5-1.4.9-2-2 .9-1.4-.5-1.5-1.8-.4V7.9l1.8-.4.5-1.5-.9-1.4 2-2 1.4.9L8.4 3l.4-1.8h2.8L12 3Z"/><circle {...common} cx="10.2" cy="9.3" r="2.4"/></>}
      {name === "logout" && <><path {...common} d="M10 4H5v16h5"/><path {...common} d="M10 12h11m-4-4 4 4-4 4"/></>}
    </svg>
  );
}

function labels(language: Language) {
  if (language === "th") return { workspace: "พื้นที่ทำงาน", mainOa: "Main OA", operations: "เครื่องมือ", home: "หน้าหลัก", dashboard: "แดชบอร์ด", chats: "แชทร้านค้า", followers: "ข้อมูลผู้ติดตาม", traffic: "Message Traffic", coupons: "คูปอง", stores: "จัดการร้านค้า", purchase: "ข้อมูลการซื้อ", friendLinks: "ลิงก์เพิ่มเพื่อน", mass: "ส่งข้อความ", approval: "อนุมัติ BM", richMenus: "จัดการ Rich Menu", autoResponses: "ข้อความตอบกลับอัตโนมัติ", profile: "โปรไฟล์", settings: "ตั้งค่า", logout: "ออกจากระบบ", language: "ภาษา", appearance: "รูปแบบการแสดงผล", role: "สิทธิ์การใช้งาน", environment: "สภาพแวดล้อม", standard: "Production", pilot: "Pilot", collapse: "ย่อแถบเมนู", expand: "ขยายแถบเมนู" };
  if (language === "zh") return { workspace: "工作区", mainOa: "Main OA", operations: "工具", home: "主页", dashboard: "仪表盘", chats: "门店聊天", followers: "关注者洞察", traffic: "消息流量", coupons: "优惠券", stores: "门店管理", purchase: "购买洞察", friendLinks: "加好友来源链接", mass: "群发消息", approval: "BM 审批", richMenus: "Rich Menu 管理", autoResponses: "自动回复", profile: "个人资料", settings: "设置", logout: "退出", language: "语言", appearance: "外观", role: "角色", environment: "环境", standard: "Production", pilot: "Pilot", collapse: "收起侧栏", expand: "展开侧栏" };
  return { workspace: "Workspace", mainOa: "Main OA", operations: "Tools", home: "Main", dashboard: "Dashboard", chats: "Store Chats", followers: "Follower Insights", traffic: "Message Traffic", coupons: "Coupons", stores: "Store Management", purchase: "Purchase Intelligence", friendLinks: "Friend Source Links", mass: "Mass Message", approval: "BM Approval", richMenus: "Rich Menu Manager", autoResponses: "Auto-response", profile: "Profile", settings: "Settings", logout: "Logout", language: "Language", appearance: "Appearance", role: "Role", environment: "Environment", standard: "Production", pilot: "Pilot", collapse: "Collapse sidebar", expand: "Expand sidebar" };
}

export function AppSidebar({ authUser, changeLanguage, currentSection, language, logout, pilotMode, text }: SidebarProps) {
  const pathname = usePathname() || "/";
  const t = labels(language);
  const collapsed = useSyncExternalStore(
    (onStoreChange) => {
      const handleChange = () => onStoreChange();
      window.addEventListener("storage", handleChange);
      window.addEventListener(SIDEBAR_STORAGE_EVENT, handleChange);
      return () => {
        window.removeEventListener("storage", handleChange);
        window.removeEventListener(SIDEBAR_STORAGE_EVENT, handleChange);
      };
    },
    () => window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1",
    () => false,
  );
  const [accountPanel, setAccountPanel] = useState<AccountPanel>(null);
  const [tooltip, setTooltip] = useState<SidebarTooltip>(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--app-sidebar-width", collapsed ? COMPACT_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH);
    return () => { document.documentElement.style.removeProperty("--app-sidebar-width"); };
  }, [collapsed]);

  const updateCollapsed = (next: boolean) => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
    window.dispatchEvent(new Event(SIDEBAR_STORAGE_EVENT));
    setTooltip(null);
  };

  const primaryItems: NavItem[] = [
    { href: "/home", label: t.home, icon: "home", section: "home", active: (path) => path === "/home" },
    { href: "/dashboard", label: t.dashboard, icon: "dashboard", section: "dashboard", active: (path) => path === "/dashboard" },
    { href: "/chats", label: t.chats, icon: "chat", section: "chats", active: (path) => path.startsWith("/chats") },
    { href: "/follower-insights", label: t.followers, icon: "followers", section: "follower-insights", active: (path) => path.startsWith("/follower-insights") },
    { href: "/dashboard/message-traffic", label: t.traffic, icon: "traffic", tool: "message-traffic", active: (path) => path.startsWith("/dashboard/message-traffic") },
  ];
  const toolItems: NavItem[] = [
    { href: "/coupons", label: t.coupons, icon: "coupon", section: "coupons" },
    { href: "/stores", label: t.stores, icon: "store", section: "stores" },
    { href: "/admin/purchase-analytics", label: t.purchase, icon: "purchase", section: "purchase-analytics" },
    { href: "/friend-source-links", label: t.friendLinks, icon: "friend", section: "friend-source-links" },
    { href: "/mass-messages", label: t.mass, icon: "broadcast", section: "mass-messages" },
    { href: "/rich-menus", label: t.richMenus, icon: "rich-menu", section: "rich-menus" },
    { href: "/auto-responses", label: t.autoResponses, icon: "auto-response", section: "auto-responses" },
    { href: "/admin/registrations", label: t.approval, icon: "approval", section: "admin-registrations" },
    { href: "/tiktok", label: "TikTok", icon: "tiktok", tool: "tiktok" },
  ];
  const mainOaItems: NavItem[] = [
    { href: "/main-oa", label: t.mainOa, icon: "main-oa", section: "main-oa", active: (path) => path.startsWith("/main-oa") },
  ];

  const itemClass = (active: boolean) => `${focusRing} group flex h-10 w-full items-center rounded-xl text-sm font-medium transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${active ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]" : "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]"}`;
  const isActive = (item: NavItem) => item.active ? item.active(pathname, currentSection) : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const showTooltip = (label: string, element: HTMLElement) => { if (!collapsed) return; const rect = element.getBoundingClientRect(); setTooltip({ label, top: rect.top + rect.height / 2 }); };
  const hideTooltip = () => setTooltip(null);
  const renderItem = (item: NavItem) => {
    if (!authUser) return null;
    if (item.section && !canAccessPrimarySection(authUser, item.section)) return null;
    if (item.tool && !canAccessWebTool(authUser, item.tool)) return null;
    const active = isActive(item);
    return (
      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} aria-label={collapsed ? item.label : undefined} onMouseEnter={(e) => showTooltip(item.label, e.currentTarget)} onMouseLeave={hideTooltip} onFocus={(e) => showTooltip(item.label, e.currentTarget)} onBlur={hideTooltip} className={itemClass(active)}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden="true"><SidebarIcon name={item.icon}/></span>
        {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      </Link>
    );
  };

  if (!authUser) return null;
  const defaultRoute = defaultRouteForUser(authUser);
  const canUseMainOa = canAccessPrimarySection(authUser, "main-oa");

  return (
    <aside className={`app-desktop-sidebar fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--app-border)] bg-[var(--app-surface)] transition-[width] duration-200 md:flex md:flex-col ${collapsed ? "w-[4.25rem]" : "w-64"}`}>
      {collapsed && tooltip && <div role="tooltip" className="pointer-events-none fixed z-[90] -translate-y-1/2 whitespace-nowrap rounded-lg border border-[var(--app-border)] bg-[var(--app-text-primary)] px-2.5 py-1.5 text-xs font-semibold text-[var(--app-surface)] shadow-[var(--app-shadow-elevated)]" style={{ left: `calc(var(--app-sidebar-width, ${COMPACT_SIDEBAR_WIDTH}) + 0.65rem)`, top: tooltip.top }}>{tooltip.label}</div>}

      <div className={`flex h-14 shrink-0 items-center border-b border-[var(--app-border-subtle)] ${collapsed ? "justify-center px-2" : "gap-2 px-3"}`}>
        <Link href={defaultRoute} className={`${focusRing} flex min-w-0 flex-1 items-center gap-2 rounded-lg`} aria-label={collapsed ? (text.appName || "OPPO LINE OA Monitor") : undefined}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--app-accent)] text-xs font-bold text-white">O</span>
          {!collapsed && <div className="min-w-0"><div className="truncate text-sm font-bold text-[var(--app-text-primary)]">{text.appName || "OPPO LINE OA Monitor"}</div><div className="truncate text-[10px] text-[var(--app-text-tertiary)]">Retail Operations</div></div>}
        </Link>
        {!collapsed && <button type="button" onClick={() => { updateCollapsed(true); setAccountPanel(null); }} aria-label={t.collapse} title={t.collapse} className={`${focusRing} flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--app-text-tertiary)] transition-colors hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]`}><span aria-hidden="true" className="text-lg leading-none">‹</span></button>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {!collapsed && <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">{t.workspace}</div>}
        <nav className="space-y-1" aria-label={t.workspace}>{primaryItems.map(renderItem)}</nav>
        {canUseMainOa && <>
          <div className="my-3 border-t border-[var(--app-border-subtle)]" />
          {!collapsed && <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">{t.mainOa}</div>}
          <nav className="space-y-1" aria-label={t.mainOa}>{mainOaItems.map(renderItem)}</nav>
        </>}
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
              <div className="space-y-4"><label className="block text-xs font-medium text-[var(--app-text-secondary)]"><span className="mb-1.5 block">{t.language}</span><select value={language} onChange={(event) => changeLanguage(event.target.value as Language)} className={`${focusRing} h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-sm text-[var(--app-text-primary)]`}><option value="th">🇹🇭 ไทย</option><option value="en">🇬🇧 English</option><option value="zh">🇨🇳 中文</option></select></label><div><div className="mb-1.5 text-xs font-medium text-[var(--app-text-secondary)]">{t.appearance}</div><ThemeControl /></div></div>
            )}
          </div>
        )}

        {collapsed && <button type="button" onClick={() => updateCollapsed(false)} onMouseEnter={(e) => showTooltip(t.expand, e.currentTarget)} onMouseLeave={hideTooltip} onFocus={(e) => showTooltip(t.expand, e.currentTarget)} onBlur={hideTooltip} aria-label={t.expand} className={`${itemClass(false)} mb-1`}><span className="flex h-7 w-7 shrink-0 items-center justify-center text-[19px]" aria-hidden="true">›</span></button>}
        <button type="button" onClick={() => { if (collapsed) updateCollapsed(false); setAccountPanel((current) => current === "profile" ? null : "profile"); }} className={itemClass(accountPanel === "profile")} title={collapsed ? t.profile : undefined}><span className="flex h-7 w-7 shrink-0 items-center justify-center"><SidebarIcon name="profile"/></span>{!collapsed && <span className="min-w-0 flex-1 truncate text-left">{t.profile}</span>}{!collapsed && <span className="text-[11px] text-[var(--app-text-tertiary)]">{authUser.role}</span>}</button>
        <button type="button" onClick={() => { if (collapsed) updateCollapsed(false); setAccountPanel((current) => current === "settings" ? null : "settings"); }} className={itemClass(accountPanel === "settings")} title={collapsed ? t.settings : undefined}><span className="flex h-7 w-7 shrink-0 items-center justify-center"><SidebarIcon name="settings"/></span>{!collapsed && <span className="min-w-0 flex-1 truncate text-left">{t.settings}</span>}</button>
        <button type="button" onClick={() => void logout()} className={`${itemClass(false)} text-[var(--app-danger)] hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)]`} title={collapsed ? t.logout : undefined}><span className="flex h-7 w-7 shrink-0 items-center justify-center"><SidebarIcon name="logout"/></span>{!collapsed && <span className="min-w-0 flex-1 truncate text-left">{t.logout}</span>}</button>
      </div>
    </aside>
  );
}
