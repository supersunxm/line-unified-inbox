import type { PrimarySection } from "@/app/primary-navigation";
import { canAccessPrimarySection, canAccessWebTool, type AuthUser } from "../../lib/authorization.ts";

/**
 * The main app menu (layout "A", owner decision 2026-10-07): the single source for the desktop
 * sidebar, its collapsed (icon-only) mode and the mobile "More" sheet. Each item keeps the href,
 * active-route matcher and permission gate it had before the regrouping; only grouping, order and
 * Thai labels changed.
 */

export type Language = "th" | "en" | "zh";
export type NavIconName = "home" | "dashboard" | "chat" | "main-oa" | "followers" | "traffic" | "coupon" | "store" | "store-360" | "purchase" | "friend" | "broadcast" | "approval" | "health" | "tiktok" | "rich-menu" | "auto-response" | "greeting" | "review" | "download" | "kpi-report" | "profile" | "settings" | "logout";

export function sidebarLabels(language: Language) {
  if (language === "th") return { workspace: "พื้นที่ทำงาน", mainOa: "Main OA", operations: "เครื่องมือ", home: "หน้าหลัก", dashboard: "แดชบอร์ด", replySla: "อัตราตอบกลับ 24 ชม.", chats: "แชทร้านค้า", followers: "เพื่อน", traffic: "Message Traffic", coupons: "คูปอง", storeDirectory: "ค้นหาสาขา", stores: "จัดการร้านค้า", store360: "Store 360", purchase: "ข้อมูลการซื้อ", friendLinks: "ลิงก์เพิ่มเพื่อน", mass: "Mass Message", broadcast: "Broadcast", approval: "อนุมัติ BM", health: "LINE Chat Health", tiktok: "TikTok Analytics", richMenus: "Rich Menu", autoResponses: "ตอบอัตโนมัติ", greetingMessages: "ข้อความต้อนรับ", googleReviewKpi: "Google Review KPI", monthlyOperationsReport: "รายงาน LINE รายเดือน", monthlyKpiReport: "รายงาน KPI รายเดือน", downloadCenter: "Download Center", groupMonitoring: "ติดตามผล", groupReports: "รายงาน", groupMessaging: "ส่งข้อความถึงลูกค้า", groupMainOa: "Main OA", groupSystem: "จัดการระบบ", newChip: "ใหม่", unrepliedBadge: "ยังไม่ตอบเดือนนี้", search: "ค้นหาเมนู", searchHint: "กด / เพื่อค้นหา", noResults: "ไม่พบเมนูที่ค้นหา", profile: "โปรไฟล์", settings: "ตั้งค่า", logout: "ออกจากระบบ", language: "ภาษา", appearance: "รูปแบบการแสดงผล", role: "สิทธิ์การใช้งาน", environment: "สภาพแวดล้อม", standard: "Production", pilot: "Pilot", collapse: "ย่อแถบเมนู", expand: "ขยายแถบเมนู" };
  if (language === "zh") return { workspace: "工作区", mainOa: "Main OA", operations: "工具", home: "主页", dashboard: "仪表盘", replySla: "24小时回复率", chats: "门店聊天", followers: "关注者洞察", traffic: "消息流量", coupons: "优惠券", storeDirectory: "门店目录", stores: "门店管理", store360: "Store 360", purchase: "购买洞察", friendLinks: "加好友来源链接", mass: "群发消息", broadcast: "Broadcast", approval: "BM 审批", health: "LINE Chat Health", tiktok: "TikTok Analytics", richMenus: "Rich Menu 管理", autoResponses: "自动回复", greetingMessages: "欢迎消息", googleReviewKpi: "Google Review KPI", monthlyOperationsReport: "LINE 月度运营报告", monthlyKpiReport: "月度 KPI 报告", downloadCenter: "下载中心", groupMonitoring: "跟踪", groupReports: "报告", groupMessaging: "客户消息", groupMainOa: "Main OA", groupSystem: "系统管理", newChip: "新", unrepliedBadge: "本月未回复", search: "搜索菜单", searchHint: "按 / 搜索", noResults: "未找到菜单", profile: "个人资料", settings: "设置", logout: "退出", language: "语言", appearance: "外观", role: "角色", environment: "环境", standard: "Production", pilot: "Pilot", collapse: "收起侧栏", expand: "展开侧栏" };
  return { workspace: "Workspace", mainOa: "Main OA", operations: "Tools", home: "Main", dashboard: "Dashboard", replySla: "24H Response Rate", chats: "Store Chats", followers: "Friends", traffic: "Message Traffic", coupons: "Coupons", storeDirectory: "Store Directory", stores: "Store Management", store360: "Store 360", purchase: "Purchase Intelligence", friendLinks: "Friend Source Links", mass: "Mass Message", broadcast: "Broadcast", approval: "BM Approval", health: "LINE Chat Health", tiktok: "TikTok Analytics", richMenus: "Rich Menu Manager", autoResponses: "Auto-response", greetingMessages: "Greeting Messages", googleReviewKpi: "Google Review KPI", monthlyOperationsReport: "Monthly Operations Report", monthlyKpiReport: "Monthly KPI Report", downloadCenter: "Download Center", groupMonitoring: "Monitoring", groupReports: "Reports", groupMessaging: "Customer Messaging", groupMainOa: "Main OA", groupSystem: "Administration", newChip: "New", unrepliedBadge: "Unreplied this month", search: "Search menu", searchHint: "Press / to search", noResults: "No matching menu", profile: "Profile", settings: "Settings", logout: "Logout", language: "Language", appearance: "Appearance", role: "Role", environment: "Environment", standard: "Production", pilot: "Pilot", collapse: "Collapse sidebar", expand: "Expand sidebar" };
}

export type SidebarLabels = ReturnType<typeof sidebarLabels>;
export type NavLabelKey = keyof SidebarLabels;

export type NavItem = {
  href: string;
  label: NavLabelKey;
  icon: NavIconName;
  section?: PrimarySection;
  tool?: "message-traffic" | "tiktok";
  active?: (pathname: string, section: PrimarySection) => boolean;
  /** Extra search terms: former names of the item. */
  aliases?: string[];
  /** This month's ยังไม่ตอบ count, as /chats shows it. */
  badge?: "chats-unreplied";
  isNew?: boolean;
};

export type NavGroupId = "top" | "monitoring" | "reports" | "messaging" | "main-oa" | "system";
export type NavGroup = { id: NavGroupId; label: NavLabelKey | null; defaultOpen: boolean; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "top",
    label: null,
    defaultOpen: true,
    items: [
      { href: "/home", label: "home", icon: "home", section: "home", active: (path) => path === "/home" },
      { href: "/chats", label: "chats", icon: "chat", section: "chats", active: (path) => path.startsWith("/chats"), badge: "chats-unreplied" },
      { href: "/replymessage", label: "replySla", icon: "traffic", section: "dashboard", active: (path) => path.startsWith("/replymessage"), aliases: ["Reply SLA", "24H"] },
    ],
  },
  {
    id: "monitoring",
    label: "groupMonitoring",
    defaultOpen: true,
    items: [
      { href: "/dashboard", label: "dashboard", icon: "dashboard", section: "dashboard", active: (path) => path === "/dashboard" },
      { href: "/store-360", label: "store360", icon: "store-360", section: "store-360", active: (path) => path.startsWith("/store-360") },
      { href: "/dashboard/message-traffic", label: "traffic", icon: "traffic", tool: "message-traffic", active: (path) => path.startsWith("/dashboard/message-traffic") },
      { href: "/follower-insights", label: "followers", icon: "followers", section: "follower-insights", aliases: ["Follower Insights", "Followers"] },
      { href: "/google-review-kpi", label: "googleReviewKpi", icon: "review", section: "google-review-kpi" },
      { href: "/admin/purchase-analytics", label: "purchase", icon: "purchase", section: "purchase-analytics" },
      { href: "/friend-source-links", label: "friendLinks", icon: "friend", section: "friend-source-links" },
      // Not in the layout "A" list; kept (same gate) so no destination disappears from the menu.
      { href: "/tiktok", label: "tiktok", icon: "tiktok", tool: "tiktok" },
    ],
  },
  {
    id: "reports",
    label: "groupReports",
    defaultOpen: true,
    items: [
      { href: "/monthly-operations-report", label: "monthlyOperationsReport", icon: "download", section: "dashboard", active: (path) => path.startsWith("/monthly-operations-report") },
      // Replaces the former "ลองเวอร์ชันใหม่ (v2)" link. Gated like the report page itself
      // (MonthReport renders inside AuthorizedSection section="dashboard").
      { href: "/v2/report", label: "monthlyKpiReport", icon: "kpi-report", section: "dashboard", active: (path) => path.startsWith("/v2/report"), isNew: true, aliases: ["v2", "KPI", "รายงานเดือน"] },
      { href: "/download-center", label: "downloadCenter", icon: "download", section: "follower-insights", active: (path) => path.startsWith("/download-center") },
    ],
  },
  {
    id: "messaging",
    label: "groupMessaging",
    defaultOpen: false,
    items: [
      { href: "/mass-messages", label: "mass", icon: "broadcast", section: "mass-messages", aliases: ["ส่งข้อความ"] },
      { href: "/broadcast", label: "broadcast", icon: "broadcast", section: "broadcast", active: (path) => path.startsWith("/broadcast") },
      { href: "/rich-menus", label: "richMenus", icon: "rich-menu", section: "rich-menus", aliases: ["จัดการ Rich Menu", "Rich Menu Manager"] },
      { href: "/auto-responses", label: "autoResponses", icon: "auto-response", section: "auto-responses", aliases: ["ข้อความตอบกลับอัตโนมัติ", "Auto-response", "Auto response"] },
      { href: "/greeting-messages", label: "greetingMessages", icon: "greeting", section: "greeting-messages", active: (path) => path.startsWith("/greeting-messages") || path.startsWith("/rich-messages"), aliases: ["Rich Message"] },
      { href: "/coupons", label: "coupons", icon: "coupon", section: "coupons" },
    ],
  },
  {
    id: "main-oa",
    label: "groupMainOa",
    defaultOpen: true,
    items: [
      { href: "/main-oa", label: "mainOa", icon: "main-oa", section: "main-oa", active: (path) => path.startsWith("/main-oa") },
    ],
  },
  {
    id: "system",
    label: "groupSystem",
    defaultOpen: false,
    items: [
      { href: "/stores", label: "storeDirectory", icon: "store", active: (path) => path === "/stores", aliases: ["Store Directory"] },
      { href: "/storemanagement", label: "stores", icon: "store", section: "stores", active: (path) => path.startsWith("/storemanagement") || path.startsWith("/admin/stores") },
      { href: "/admin/registrations", label: "approval", icon: "approval", section: "admin-registrations" },
      { href: "/operations/line-chat-health", label: "health", icon: "health", section: "line-chat-health" },
    ],
  },
];

export const ALL_LANGUAGES: Language[] = ["th", "en", "zh"];

/** The same gates as before the regrouping: section and/or web tool, nothing else. */
export function canSeeNavItem(user: AuthUser, item: NavItem): boolean {
  if (item.section && !canAccessPrimarySection(user, item.section)) return false;
  if (item.tool && !canAccessWebTool(user, item.tool)) return false;
  return true;
}

/** Groups with only the items the user may open; empty groups are dropped. */
export function visibleNavGroups(user: AuthUser | null, groups: NavGroup[] = NAV_GROUPS): NavGroup[] {
  if (!user) return [];
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => canSeeNavItem(user, item)) })).filter((group) => group.items.length > 0);
}

export function isNavItemActive(item: NavItem, pathname: string, section: PrimarySection): boolean {
  return item.active ? item.active(pathname, section) : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The group holding the active route (always shown expanded). */
export function activeNavGroupId(groups: NavGroup[], pathname: string, section: PrimarySection): NavGroupId | null {
  return groups.find((group) => group.items.some((item) => isNavItemActive(item, pathname, section)))?.id ?? null;
}

// ---- Group open/closed state (persisted per group) ----

export const NAV_GROUP_STORAGE_KEY = "oppo-app-sidebar-groups";
export type NavGroupState = Partial<Record<NavGroupId, boolean>>;

/** Stored state, or {} when missing or unreadable (each group then uses its default). */
export function parseNavGroupState(raw: string | null | undefined): NavGroupState {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const state: NavGroupState = {};
    for (const group of NAV_GROUPS) {
      const open = (value as Record<string, unknown>)[group.id];
      if (typeof open === "boolean") state[group.id] = open;
    }
    return state;
  } catch {
    return {};
  }
}

export function isNavGroupOpen(group: NavGroup, state: NavGroupState, activeGroupId: NavGroupId | null): boolean {
  if (!group.label) return true;
  if (group.id === activeGroupId) return true;
  return state[group.id] ?? group.defaultOpen;
}

// ---- Menu search ----

export type NavSearchResult = { item: NavItem; group: NavGroup };

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("th").replace(/\s+/gu, " ").trim();
}

/** Every term an item is found by: its TH, EN and ZH labels and its aliases. */
export function navItemSearchTerms(item: NavItem): string[] {
  return [...ALL_LANGUAGES.map((language) => sidebarLabels(language)[item.label]), ...(item.aliases ?? [])];
}

/** Flat results in menu order; each result carries its group. */
export function searchNavItems(query: string, groups: NavGroup[]): NavSearchResult[] {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  const results: NavSearchResult[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (navItemSearchTerms(item).some((term) => normalizeSearch(term).includes(needle))) results.push({ item, group });
    }
  }
  return results;
}

/** "/" focuses menu search, except while typing in a field. */
export function isTypingTarget(target: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function formatNavBadge(count: number): string {
  return count > 999 ? "999+" : String(count);
}
