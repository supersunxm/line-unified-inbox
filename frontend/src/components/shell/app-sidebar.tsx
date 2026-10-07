"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeControl } from "@/app/theme";
import { defaultRouteForUser } from "@/lib/authorization";
import { useChatsUnrepliedBadge } from "./chats-unreplied-badge";
import {
  activeNavGroupId,
  formatNavBadge,
  isNavGroupOpen,
  isNavItemActive,
  isTypingTarget,
  NAV_GROUP_STORAGE_KEY,
  parseNavGroupState,
  searchNavItems,
  sidebarLabels,
  visibleNavGroups,
  type NavGroup,
  type NavIconName,
  type NavItem,
} from "./navigation-config";
import type { Language, TopNavigationProps } from "./top-navigation";

export { sidebarLabels } from "./navigation-config";

export const SIDEBAR_STORAGE_KEY = "oppo-app-sidebar-collapsed";
const SIDEBAR_STORAGE_EVENT = "oppo-app-sidebar-storage";
const EXPANDED_SIDEBAR_WIDTH = "16rem";
const COMPACT_SIDEBAR_WIDTH = "4.25rem";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40 focus-visible:ring-offset-1";

type SidebarProps = Pick<TopNavigationProps, "authUser" | "changeLanguage" | "currentSection" | "language" | "logout" | "pilotMode" | "text">;
type AccountPanel = "profile" | "settings" | null;
type SidebarTooltip = { label: string; top: number } | null;
type IconName = NavIconName | "search";

/** localStorage can be unavailable (private mode, blocked storage): fall back to defaults. */
function readStorage(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* defaults stay in effect */ }
  window.dispatchEvent(new Event(SIDEBAR_STORAGE_EVENT));
}

function subscribeStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_STORAGE_EVENT, onStoreChange);
  };
}

export function SidebarIcon({ name, className = "" }: { name: IconName; className?: string }) {
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
      {name === "store-360" && <><rect {...common} x="3" y="4" width="18" height="16" rx="2"/><path {...common} d="M7 16v-3m4 3V9m4 7v-5m4 5v-8"/></>}
      {name === "purchase" && <><path {...common} d="M7 8h10l1 12H6L7 8Z"/><path {...common} d="M9 8c0-3 1.2-5 3-5s3 2 3 5"/><path {...common} d="M9.5 17v-3m2.5 3v-5m2.5 5v-2"/></>}
      {name === "friend" && <><circle {...common} cx="9" cy="8" r="3.2"/><path {...common} d="M3.5 19c.6-4 2.6-6 5.5-6 2.1 0 3.8 1.1 4.8 3"/><path {...common} d="M18 13v7m-3.5-3.5h7"/></>}
      {name === "broadcast" && <><path {...common} d="M3 10v4l11 4V6L3 10Z"/><path {...common} d="M3 10H1v4h2m3 1 1.5 5h3l-1-4"/><path {...common} d="m17 8 3-2m-2 6h4m-5 4 3 2"/></>}
      {name === "approval" && <><path {...common} d="M12 3c3 2.5 6 2.7 8 3v5.5c0 4.5-2.7 7.7-8 9.5-5.3-1.8-8-5-8-9.5V6c2-.3 5-.5 8-3Z"/><path {...common} d="m8.5 12 2.2 2.2 4.8-5"/></>}
      {name === "health" && <><path {...common} d="M3 12h4l2-5 4 10 2-5h6"/><path {...common} d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></>}
      {name === "tiktok" && <><path {...common} d="M13 4v10a4.5 4.5 0 1 1-4-4.5"/><path {...common} d="M13 4c1.6 2.8 3.7 4 6 4.3"/></>}
      {name === "rich-menu" && <><rect {...common} x="3" y="3" width="18" height="18" rx="2"/><path {...common} d="M3 9h18M3 15h18M9 9v12M15 9v12"/></>}
      {name === "auto-response" && <><path {...common} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2 2z"/><path {...common} d="M13 8l-3 4h4l-2 4"/></>}
      {name === "greeting" && <><path {...common} d="M18 8a3 3 0 0 0-3-3 3 3 0 0 0-3 3v8a2 2 0 0 1-2 2 2 2 0 0 1-2-2V8"/><path {...common} d="M10 10V5a2 2 0 0 1 4 0v5"/><path {...common} d="M14 10V6a2 2 0 0 1 4 0v4"/><path {...common} d="M6 13V9a2 2 0 0 1 4 0v4"/></>}
      {name === "review" && <><path {...common} d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/></>}
      {name === "download" && <><path {...common} d="M12 3v11"/><path {...common} d="m8 10 4 4 4-4"/><path {...common} d="M5 19h14"/></>}
      {name === "kpi-report" && <><path {...common} d="M6 3h9l4 4v14H6z"/><path {...common} d="M14 3v5h5"/><path {...common} d="M9 17v-3m3 3v-6m3 6v-4"/></>}
      {name === "search" && <><circle {...common} cx="11" cy="11" r="6.5"/><path {...common} d="m16 16 4.5 4.5"/></>}
      {name === "profile" && <><circle {...common} cx="12" cy="8" r="3.5"/><path {...common} d="M5 21c.7-4.6 3.2-7 7-7s6.3 2.4 7 7"/></>}
      {name === "settings" && <><path {...common} d="M12 3l1.5.5 1.4-.9 2 2-.9 1.4.5 1.5 1.8.4v2.8l-1.8.4-.5 1.5.9 1.4-2 2-1.4-.9-1.5.5-.4 1.8H8.8l-.4-1.8-1.5-.5-1.4.9-2-2 .9-1.4-.5-1.5-1.8-.4V7.9l1.8-.4.5-1.5-.9-1.4 2-2 1.4.9L8.4 3l.4-1.8h2.8L12 3Z"/><circle {...common} cx="10.2" cy="9.3" r="2.4"/></>}
      {name === "logout" && <><path {...common} d="M10 4H5v16h5"/><path {...common} d="M10 12h11m-4-4 4 4-4 4"/></>}
    </svg>
  );
}


/** ยังไม่ตอบ count on แชทร้านค้า: rendered only when there is a count (never while loading or on error). */
export function NavBadge({ count, label, compact = false }: { count: number | null; label: string; compact?: boolean }) {
  if (count === null || count <= 0) return null;
  return (
    <span data-nav-badge className={`${compact ? "absolute -right-1 -top-1 min-w-[1.1rem] px-1 text-[9px] leading-[1.1rem]" : "ml-auto min-w-[1.5rem] px-1.5 text-[11px] leading-5"} rounded-full bg-[var(--app-danger-soft)] text-center font-semibold tabular-nums text-[var(--app-text-primary)] ring-1 ring-[var(--app-danger)]`} title={`${label} ${count.toLocaleString("th-TH")}`}>
      {formatNavBadge(count)}<span className="sr-only"> {label}</span>
    </span>
  );
}

export function NewChip({ label }: { label: string }) {
  return <span data-nav-new className="rounded-md bg-[var(--app-accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--app-accent)] dark:text-[var(--app-text-primary)]">{label}</span>;
}

export function AppSidebar({ authUser, changeLanguage, currentSection, language, logout, pilotMode, text }: SidebarProps) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const t = sidebarLabels(language);
  const collapsed = useSyncExternalStore(subscribeStorage, () => readStorage(SIDEBAR_STORAGE_KEY) === "1", () => false);
  const groupStateRaw = useSyncExternalStore(subscribeStorage, () => readStorage(NAV_GROUP_STORAGE_KEY), () => null);
  const groupState = useMemo(() => parseNavGroupState(groupStateRaw), [groupStateRaw]);
  const [accountPanel, setAccountPanel] = useState<AccountPanel>(null);
  const [tooltip, setTooltip] = useState<SidebarTooltip>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const focusSearchOnExpand = useRef(false);

  const groups = useMemo(() => visibleNavGroups(authUser), [authUser]);
  const activeGroupId = activeNavGroupId(groups, pathname, currentSection);
  const results = useMemo(() => searchNavItems(query, groups), [groups, query]);
  const badgeCount = useChatsUnrepliedBadge(groups.some((group) => group.items.some((item) => item.badge === "chats-unreplied")));

  useEffect(() => {
    document.documentElement.style.setProperty("--app-sidebar-width", collapsed ? COMPACT_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH);
    return () => { document.documentElement.style.removeProperty("--app-sidebar-width"); };
  }, [collapsed]);

  // After "search" in the icon-only sidebar expands it, focus the search field.
  useEffect(() => {
    if (!collapsed && focusSearchOnExpand.current) {
      focusSearchOnExpand.current = false;
      searchRef.current?.focus();
    }
  }, [collapsed]);

  // "/" focuses menu search, never while typing in a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target as HTMLElement | null) || isTypingTarget(document.activeElement as HTMLElement | null)) return;
      const input = searchRef.current;
      if (!input && !collapsed) return;
      // The sidebar is hidden below md; leave "/" alone there.
      if (window.matchMedia && !window.matchMedia("(min-width: 768px)").matches) return;
      event.preventDefault();
      returnFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      if (collapsed) {
        focusSearchOnExpand.current = true;
        writeStorage(SIDEBAR_STORAGE_KEY, "0");
      } else {
        input?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed]);

  const updateCollapsed = (next: boolean) => {
    writeStorage(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
    setTooltip(null);
  };

  const toggleGroup = (group: NavGroup, open: boolean) => {
    writeStorage(NAV_GROUP_STORAGE_KEY, JSON.stringify({ ...groupState, [group.id]: !open }));
  };

  const clearSearch = () => {
    setQuery("");
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target && target.isConnected) target.focus();
    else searchRef.current?.blur();
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && results[0]) {
      event.preventDefault();
      const href = results[0].item.href;
      setQuery("");
      router.push(href);
    } else if (event.key === "Escape") {
      event.preventDefault();
      clearSearch();
    }
  };

  const itemClass = (active: boolean) => `${focusRing} group relative flex h-9 w-full items-center rounded-xl text-sm font-medium transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${active ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:text-[var(--app-text-primary)]" : "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]"}`;
  const showTooltip = (label: string, element: HTMLElement) => { if (!collapsed) return; const rect = element.getBoundingClientRect(); setTooltip({ label, top: rect.top + rect.height / 2 }); };
  const hideTooltip = () => setTooltip(null);

  const renderItem = (item: NavItem, groupLabel?: string) => {
    const active = isNavItemActive(item, pathname, currentSection);
    const label = t[item.label];
    const count = item.badge === "chats-unreplied" ? badgeCount : null;
    return (
      <Link key={item.href} href={item.href} data-nav-item={item.href} aria-current={active ? "page" : undefined} aria-label={collapsed ? (count ? `${label} · ${t.unrepliedBadge} ${count.toLocaleString("th-TH")}` : label) : undefined} onClick={() => setQuery("")} onMouseEnter={(e) => showTooltip(label, e.currentTarget)} onMouseLeave={hideTooltip} onFocus={(e) => showTooltip(label, e.currentTarget)} onBlur={hideTooltip} className={itemClass(active)}>
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden="true"><SidebarIcon name={item.icon}/>{collapsed && <NavBadge count={count} label={t.unrepliedBadge} compact />}</span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate">{label}{groupLabel && <span className="block truncate text-[11px] font-normal text-[var(--app-text-secondary)]">{groupLabel}</span>}</span>
            {item.isNew && <NewChip label={t.newChip} />}
            <NavBadge count={count} label={t.unrepliedBadge} />
          </>
        )}
      </Link>
    );
  };

  const renderGroup = (group: NavGroup, index: number) => {
    if (!group.label) return <div key={group.id} className="space-y-1">{group.items.map((item) => renderItem(item))}</div>;
    const groupLabel = t[group.label];
    // Icon-only: every item, thin dividers between groups.
    if (collapsed) return <div key={group.id} data-nav-group={group.id} role="group" aria-label={groupLabel} className="space-y-1">{index > 0 && <div className="mx-2 my-2 border-t border-[var(--app-border-subtle)]" />}{group.items.map((item) => renderItem(item))}</div>;
    const open = isNavGroupOpen(group, groupState, activeGroupId);
    const panelId = `nav-group-${group.id}`;
    return (
      <div key={group.id} data-nav-group={group.id} className="pt-2">
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => toggleGroup(group, open)} className={`${focusRing} flex h-8 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]`}>
          <span className="min-w-0 flex-1 truncate">{groupLabel}</span>
          {!open && <span className="rounded-full bg-[var(--app-surface-subtle)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--app-text-secondary)]">{group.items.length}</span>}
          <span aria-hidden="true" className={`text-xs transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        </button>
        {open && <div id={panelId} role="group" aria-label={groupLabel} className="mt-0.5 space-y-1">{group.items.map((item) => renderItem(item))}</div>}
      </div>
    );
  };

  if (!authUser) return null;
  const defaultRoute = defaultRouteForUser(authUser);

  return (
    <aside data-app-sidebar className={`app-desktop-sidebar fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--app-border)] bg-[var(--app-surface)] transition-[width] duration-200 md:flex md:flex-col ${collapsed ? "w-[4.25rem]" : "w-64"}`}>
      {collapsed && tooltip && <div role="tooltip" className="pointer-events-none fixed z-[90] -translate-y-1/2 whitespace-nowrap rounded-lg border border-[var(--app-border)] bg-[var(--app-text-primary)] px-2.5 py-1.5 text-xs font-semibold text-[var(--app-surface)] shadow-[var(--app-shadow-elevated)]" style={{ left: `calc(var(--app-sidebar-width, ${COMPACT_SIDEBAR_WIDTH}) + 0.65rem)`, top: tooltip.top }}>{tooltip.label}</div>}

      <div className={`flex h-14 shrink-0 items-center border-b border-[var(--app-border-subtle)] ${collapsed ? "justify-center px-2" : "gap-2 px-3"}`}>
        <Link href={defaultRoute} className={`${focusRing} flex min-w-0 flex-1 items-center gap-2 rounded-lg`} aria-label={collapsed ? (text.appName || "OPPO LINE OA Monitor") : undefined}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--app-accent)] text-xs font-bold text-white">O</span>
          {!collapsed && <div className="min-w-0"><div className="truncate text-sm font-bold text-[var(--app-text-primary)]">{text.appName || "OPPO LINE OA Monitor"}</div><div className="truncate text-[10px] text-[var(--app-text-secondary)]">Retail Operations</div></div>}
        </Link>
        {!collapsed && <button type="button" onClick={() => { updateCollapsed(true); setAccountPanel(null); }} aria-label={t.collapse} title={t.collapse} className={`${focusRing} flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--app-text-tertiary)] transition-colors hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]`}><span aria-hidden="true" className="text-lg leading-none">‹</span></button>}
      </div>

      <div className={`shrink-0 ${collapsed ? "px-2 pt-3" : "px-3 pt-3"}`}>
        {collapsed ? (
          <button type="button" data-nav-search-button onClick={() => { focusSearchOnExpand.current = true; updateCollapsed(false); }} onMouseEnter={(e) => showTooltip(t.search, e.currentTarget)} onMouseLeave={hideTooltip} onFocus={(e) => showTooltip(t.search, e.currentTarget)} onBlur={hideTooltip} aria-label={t.search} className={itemClass(false)}><span className="flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden="true"><SidebarIcon name="search"/></span></button>
        ) : (
          <div role="search" className="relative">
            <label htmlFor="app-menu-search" className="sr-only">{t.search}</label>
            <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-secondary)]"><SidebarIcon name="search" className="h-4 w-4"/></span>
            <input ref={searchRef} id="app-menu-search" data-nav-search type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onSearchKeyDown} placeholder={t.search} aria-describedby="app-menu-search-hint" autoComplete="off" className={`${focusRing} app-input h-9 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] pl-8 pr-8 text-sm text-[var(--app-text-primary)] placeholder:text-[var(--app-text-secondary)]`} />
            <kbd id="app-menu-search-hint" title={t.searchHint} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[var(--app-border)] px-1.5 text-[10px] font-medium text-[var(--app-text-secondary)]"><span aria-hidden="true">/</span><span className="sr-only">{t.searchHint}</span></kbd>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-2">
        {query.trim() && !collapsed ? (
          <nav className="space-y-1" aria-label={t.search} data-nav-results>
            {results.length === 0 ? <p className="px-3 py-2 text-sm text-[var(--app-text-secondary)]">{t.noResults}</p> : results.map(({ item, group }) => renderItem(item, group.label ? t[group.label] : t.workspace))}
          </nav>
        ) : (
          <nav className="space-y-1" aria-label={t.workspace}>{groups.map(renderGroup)}</nav>
        )}
      </div>

      <div className="relative shrink-0 border-t border-[var(--app-border-subtle)] p-2">
        {accountPanel && !collapsed && (
          <div className="absolute bottom-[7.2rem] left-2 right-2 z-50 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-[var(--app-shadow-elevated)]">
            {accountPanel === "profile" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-accent)] text-sm font-bold text-white">{authUser.displayName.charAt(0).toUpperCase()}</span><div className="min-w-0"><div className="truncate text-sm font-semibold text-[var(--app-text-primary)]">{authUser.displayName}</div><div className="truncate text-[11px] text-[var(--app-text-tertiary)]">{authUser.email}</div></div></div>
                <div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-[var(--app-surface-subtle)] p-2.5"><div className="text-[10px] text-[var(--app-text-secondary)]">{t.role}</div><div className="mt-0.5 text-xs font-semibold">{authUser.role}</div></div><div className="rounded-xl bg-[var(--app-surface-subtle)] p-2.5"><div className="text-[10px] text-[var(--app-text-secondary)]">{t.environment}</div><div className="mt-0.5 text-xs font-semibold">{pilotMode ? t.pilot : t.standard}</div></div></div>
              </div>
            ) : (
              <div className="space-y-4"><label className="block text-xs font-medium text-[var(--app-text-secondary)]"><span className="mb-1.5 block">{t.language}</span><select value={language} onChange={(event) => changeLanguage(event.target.value as Language)} className={`${focusRing} h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-sm text-[var(--app-text-primary)]`}><option value="th">🇹🇭 ไทย</option><option value="en">🇬🇧 English</option><option value="zh">🇨🇳 中文</option></select></label><div><div className="mb-1.5 text-xs font-medium text-[var(--app-text-secondary)]">{t.appearance}</div><ThemeControl /></div></div>
            )}
          </div>
        )}

        {collapsed && <button type="button" onClick={() => updateCollapsed(false)} onMouseEnter={(e) => showTooltip(t.expand, e.currentTarget)} onMouseLeave={hideTooltip} onFocus={(e) => showTooltip(t.expand, e.currentTarget)} onBlur={hideTooltip} aria-label={t.expand} className={`${itemClass(false)} mb-1`}><span className="flex h-7 w-7 shrink-0 items-center justify-center text-[19px]" aria-hidden="true">›</span></button>}
        <button type="button" onClick={() => { if (collapsed) updateCollapsed(false); setAccountPanel((current) => current === "profile" ? null : "profile"); }} className={itemClass(accountPanel === "profile")} title={collapsed ? t.profile : undefined}><span className="flex h-7 w-7 shrink-0 items-center justify-center"><SidebarIcon name="profile"/></span>{!collapsed && <span className="min-w-0 flex-1 truncate text-left">{t.profile}</span>}{!collapsed && <span className="text-[11px] text-[var(--app-text-secondary)]">{authUser.role}</span>}</button>
        <button type="button" onClick={() => { if (collapsed) updateCollapsed(false); setAccountPanel((current) => current === "settings" ? null : "settings"); }} className={itemClass(accountPanel === "settings")} title={collapsed ? t.settings : undefined}><span className="flex h-7 w-7 shrink-0 items-center justify-center"><SidebarIcon name="settings"/></span>{!collapsed && <span className="min-w-0 flex-1 truncate text-left">{t.settings}</span>}</button>
        <button type="button" onClick={() => void logout()} className={`${itemClass(false)} text-[var(--app-danger)] hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)]`} title={collapsed ? t.logout : undefined}><span className="flex h-7 w-7 shrink-0 items-center justify-center"><SidebarIcon name="logout"/></span>{!collapsed && <span className="min-w-0 flex-1 truncate text-left">{t.logout}</span>}</button>
      </div>
    </aside>
  );
}

