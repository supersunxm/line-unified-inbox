import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canAccessPrimarySection, canAccessWebTool, type AuthUser } from "../src/lib/authorization.ts";
import {
  activeNavGroupId,
  formatNavBadge,
  isNavGroupOpen,
  isTypingTarget,
  NAV_GROUPS,
  parseNavGroupState,
  searchNavItems,
  sidebarLabels,
  visibleNavGroups,
} from "../src/components/shell/navigation-config.ts";
import { parseReportUrl } from "../src/lib/v2/month-url.ts";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const allItems = () => NAV_GROUPS.flatMap((group) => group.items);

// The main menu as it was before layout "A" (app-sidebar.tsx on main, 2026-10-07):
// href → gate. "/v2" was the footer link "ลองเวอร์ชันใหม่ (v2)", shown to every signed-in user.
const BEFORE: Record<string, { section?: string; tool?: string }> = {
  "/home": { section: "home" },
  "/dashboard": { section: "dashboard" },
  "/replymessage": { section: "dashboard" },
  "/chats": { section: "chats" },
  "/follower-insights": { section: "follower-insights" },
  "/store-360": { section: "store-360" },
  "/dashboard/message-traffic": { tool: "message-traffic" },
  "/monthly-operations-report": { section: "dashboard" },
  "/download-center": { section: "follower-insights" },
  "/coupons": { section: "coupons" },
  "/stores": {},
  "/storemanagement": { section: "stores" },
  "/google-review-kpi": { section: "google-review-kpi" },
  "/admin/purchase-analytics": { section: "purchase-analytics" },
  "/friend-source-links": { section: "friend-source-links" },
  "/mass-messages": { section: "mass-messages" },
  "/broadcast": { section: "broadcast" },
  "/rich-menus": { section: "rich-menus" },
  "/auto-responses": { section: "auto-responses" },
  "/greeting-messages": { section: "greeting-messages" },
  "/admin/registrations": { section: "admin-registrations" },
  "/operations/line-chat-health": { section: "line-chat-health" },
  "/tiktok": { tool: "tiktok" },
  "/main-oa": { section: "main-oa" },
  "/v2": {},
};

test("reachable hrefs: identical to before, except +/v2/report and −the v2 link", () => {
  const after = new Set(allItems().map((item) => item.href));
  assert.equal(after.size, allItems().length, "no duplicate destinations");
  const before = new Set(Object.keys(BEFORE));
  assert.deepEqual([...after].filter((href) => !before.has(href)), ["/v2/report"]);
  assert.deepEqual([...before].filter((href) => !after.has(href)), ["/v2"]);
});

test("permission gating is unchanged for every existing item", () => {
  for (const item of allItems()) {
    if (item.href === "/v2/report") continue;
    assert.deepEqual({ section: item.section, tool: item.tool }, { section: BEFORE[item.href].section, tool: BEFORE[item.href].tool }, item.href);
  }
  // The new item is gated like the page it opens (MonthReport → AuthorizedSection section="dashboard").
  assert.equal(allItems().find((item) => item.href === "/v2/report")?.section, "dashboard");
  assert.match(read("components/v2/month-report.tsx"), /<AuthorizedSection section="dashboard">/);
});

// Synthetic users (no real people): one per role/workspace shape.
const base = { platforms: { web: true, mobile: true }, scope: { allStores: false, storeIds: [] as string[] }, capabilities: { manageAccounts: false, reply: false, accessMainOa: false, manageMainOa: false } };
const user = (role: "ADMIN" | "ASSISTANT" | "VIEWER", overrides: Record<string, unknown>): AuthUser => ({
  id: `synthetic-${role}`, email: "synthetic@example.test", displayName: "Synthetic", role,
  authorization: { version: 2, identity: { platformRole: role, membershipRoles: [] }, workspaces: { hq: false, store: false, mainOa: false }, ...base, ...overrides } as AuthUser["authorization"],
});
const ROLES: Record<string, AuthUser> = {
  hqAdmin: user("ADMIN", { workspaces: { hq: true, store: false, mainOa: true }, scope: { allStores: true, storeIds: [] }, capabilities: { manageAccounts: true, reply: true, accessMainOa: true, manageMainOa: true } }),
  hqAssistant: user("ASSISTANT", { workspaces: { hq: true, store: false, mainOa: false }, scope: { allStores: true, storeIds: [] } }),
  hqViewerLimited: user("VIEWER", { workspaces: { hq: true, store: false, mainOa: false } }),
  storeStaff: user("VIEWER", { workspaces: { hq: false, store: true, mainOa: false }, scope: { allStores: false, storeIds: ["store-1"] }, capabilities: { manageAccounts: false, reply: true, accessMainOa: false, manageMainOa: false } }),
  mainOaOnly: user("VIEWER", { workspaces: { hq: false, store: false, mainOa: true }, capabilities: { manageAccounts: false, reply: false, accessMainOa: true, manageMainOa: false } }),
};

test("per role, the visible menu is exactly what it was, plus the KPI report where dashboard is allowed", () => {
  for (const [name, role] of Object.entries(ROLES)) {
    const before = Object.entries(BEFORE)
      .filter(([href]) => href !== "/v2")
      .filter(([, gate]) => (!gate.section || canAccessPrimarySection(role, gate.section as never)) && (!gate.tool || canAccessWebTool(role, gate.tool as never)))
      .map(([href]) => href)
      .sort();
    const after = visibleNavGroups(role).flatMap((group) => group.items.map((item) => item.href)).filter((href) => href !== "/v2/report").sort();
    assert.deepEqual(after, before, name);
    const hasReport = visibleNavGroups(role).some((group) => group.items.some((item) => item.href === "/v2/report"));
    assert.equal(hasReport, canAccessPrimarySection(role, "dashboard"), name);
  }
  assert.deepEqual(visibleNavGroups(null), []);
  // Empty groups disappear (a Main-OA-only user sees ค้นหาสาขา and Main OA only).
  assert.deepEqual(visibleNavGroups(ROLES.mainOaOnly).map((group) => group.id), ["main-oa", "system"]);
});

test("layout A: group order, Thai labels, item order and default open state", () => {
  const th = sidebarLabels("th");
  assert.deepEqual(NAV_GROUPS.map((group) => [group.label ? th[group.label] : null, group.defaultOpen]), [
    [null, true],
    ["ติดตามผล", true],
    ["รายงาน", true],
    ["ส่งข้อความถึงลูกค้า", false],
    ["Main OA", true],
    ["จัดการระบบ", false],
  ]);
  assert.deepEqual(NAV_GROUPS.map((group) => group.items.map((item) => th[item.label])), [
    ["หน้าหลัก", "แชทร้านค้า", "อัตราตอบกลับ 24 ชม."],
    ["แดชบอร์ด", "Store 360", "Message Traffic", "เพื่อน", "Google Review KPI", "ข้อมูลการซื้อ", "ลิงก์เพิ่มเพื่อน", "TikTok Analytics"],
    ["รายงาน LINE รายเดือน", "รายงาน KPI รายเดือน", "Download Center"],
    ["Mass Message", "Broadcast", "Rich Menu", "ตอบอัตโนมัติ", "ข้อความต้อนรับ", "คูปอง"],
    ["Main OA"],
    ["ค้นหาสาขา", "จัดการร้านค้า", "อนุมัติ BM", "LINE Chat Health"],
  ]);
  assert.deepEqual(allItems().filter((item) => item.isNew).map((item) => item.href), ["/v2/report"]);
  assert.deepEqual(allItems().filter((item) => item.badge).map((item) => [item.href, item.badge]), [["/chats", "chats-unreplied"]]);
  // EN and ZH labels of existing items are kept; every item has all three.
  const en = sidebarLabels("en");
  assert.deepEqual([en.purchase, en.autoResponses, en.storeDirectory, en.richMenus, en.mass], ["Purchase Intelligence", "Auto-response", "Store Directory", "Rich Menu Manager", "Mass Message"]);
  assert.deepEqual([sidebarLabels("zh").autoResponses, sidebarLabels("zh").purchase], ["自动回复", "购买洞察"]);
  for (const language of ["th", "en", "zh"] as const) {
    for (const item of allItems()) assert.ok(sidebarLabels(language)[item.label], `${language} ${item.href}`);
  }
});

test("active-route matchers are kept, and the group of the active route is the one auto-expanded", () => {
  const groups = NAV_GROUPS;
  assert.equal(activeNavGroupId(groups, "/rich-messages/abc", "greeting-messages"), "messaging", "/rich-messages → ข้อความต้อนรับ");
  assert.equal(activeNavGroupId(groups, "/admin/stores/123", "stores"), "system", "/admin/stores → จัดการร้านค้า");
  assert.equal(activeNavGroupId(groups, "/stores", "stores"), "system");
  assert.equal(activeNavGroupId(groups, "/dashboard/message-traffic", "dashboard"), "monitoring");
  assert.equal(activeNavGroupId(groups, "/replymessage", "dashboard"), "top");
  assert.equal(activeNavGroupId(groups, "/v2/report", "dashboard"), "reports");
  assert.equal(activeNavGroupId(groups, "/nowhere", "home"), null);
  const messaging = groups.find((group) => group.id === "messaging")!;
  assert.equal(isNavGroupOpen(messaging, {}, null), false, "collapsed by default");
  assert.equal(isNavGroupOpen(messaging, { messaging: true }, null), true, "stored state wins over the default");
  assert.equal(isNavGroupOpen(messaging, { messaging: false }, "messaging"), true, "the active route's group is always open");
  assert.equal(isNavGroupOpen(groups[0], { top: false }, null), true, "the ungrouped top section has no toggle");
});

test("group state persistence: per group, and defaults when storage is missing or broken", () => {
  assert.deepEqual(parseNavGroupState(null), {});
  assert.deepEqual(parseNavGroupState("not json"), {});
  assert.deepEqual(parseNavGroupState("[1,2]"), {});
  assert.deepEqual(parseNavGroupState(JSON.stringify({ messaging: true, system: false, reports: "yes", unknown: true })), { messaging: true, system: false });
  const sidebar = read("components/shell/app-sidebar.tsx");
  assert.match(sidebar, /function readStorage\(key: string\): string \| null \{\n  try \{ return window\.localStorage\.getItem\(key\); \} catch \{ return null; \}/);
  assert.match(sidebar, /try \{ window\.localStorage\.setItem\(key, value\); \} catch/);
  assert.match(sidebar, /writeStorage\(NAV_GROUP_STORAGE_KEY, JSON\.stringify\(\{ \.\.\.groupState, \[group\.id\]: !open \}\)\)/);
  // Real buttons with aria-expanded, a chevron, and the item count while closed.
  assert.match(sidebar, /<button type="button" aria-expanded=\{open\} aria-controls=\{panelId\}/);
  assert.match(sidebar, /\{!open && <span[^>]*>\{group\.items\.length\}<\/span>\}/);
  assert.match(sidebar, /rotate-90/);
});

test("menu search: TH, EN and ZH labels plus former names; flat results with their group", () => {
  const hrefs = (query: string) => searchNavItems(query, NAV_GROUPS).map((result) => result.item.href);
  assert.deepEqual(hrefs("Purchase Intelligence"), ["/admin/purchase-analytics"]);
  assert.deepEqual(hrefs("auto-response"), ["/auto-responses"]);
  assert.deepEqual(hrefs("ข้อความตอบกลับอัตโนมัติ"), ["/auto-responses"], "the former Thai name");
  assert.deepEqual(hrefs("Store Directory"), ["/stores"]);
  assert.deepEqual(hrefs("购买"), ["/admin/purchase-analytics"]);
  assert.deepEqual(hrefs("รายงาน"), ["/monthly-operations-report", "/v2/report"]);
  assert.deepEqual(hrefs("  "), []);
  assert.deepEqual(hrefs("zzz-nothing"), []);
  const [first] = searchNavItems("rich", NAV_GROUPS);
  assert.equal(first.group.id, "messaging");
  assert.deepEqual(searchNavItems("rich", NAV_GROUPS).map((result) => result.item.href), ["/rich-menus", "/greeting-messages"]);
  // Results respect permissions: they come from the visible groups.
  assert.deepEqual(searchNavItems("อนุมัติ", visibleNavGroups(ROLES.storeStaff)), []);
});

test('"/" focuses search except while typing; Enter opens the first result; Esc clears and returns focus', () => {
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input"]) assert.equal(isTypingTarget({ tagName }), true, tagName);
  assert.equal(isTypingTarget({ tagName: "DIV", isContentEditable: true }), true);
  for (const tagName of ["BUTTON", "A", "BODY", "DIV"]) assert.equal(isTypingTarget({ tagName }), false, tagName);
  assert.equal(isTypingTarget(null), false);
  const sidebar = read("components/shell/app-sidebar.tsx");
  assert.match(sidebar, /if \(event\.key !== "\/" \|\| event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey\) return;\n\s*if \(isTypingTarget\(event\.target as HTMLElement \| null\) \|\| isTypingTarget\(document\.activeElement as HTMLElement \| null\)\) return;/);
  assert.match(sidebar, /if \(event\.key === "Enter" && results\[0\]\) \{[\s\S]*?router\.push\(href\);/);
  assert.match(sidebar, /else if \(event\.key === "Escape"\) \{\n\s*event\.preventDefault\(\);\n\s*clearSearch\(\);/);
  assert.match(sidebar, /if \(target && target\.isConnected\) target\.focus\(\);/);
});

test("แชทร้านค้า badge counts ยังไม่ตอบ with the same request and helper as /chats", () => {
  const badge = read("components/shell/chats-unreplied-badge.ts");
  const chatsPage = read("app/page.tsx");
  // Same request: this Bangkok month's bm-reply-status-summary.
  assert.match(badge, /api\.bmReplyStatusSummary\(getCurrentBangkokMonth\(\)\)/);
  assert.match(chatsPage, /const \[chatMonth, setChatMonth\] = useState\(\(\) => getCurrentBangkokMonth\(\)\);/);
  assert.match(chatsPage, /api\.bmReplyStatusSummary\(chatMonth, \{ signal: controller\.signal \}\)/);
  // Same helper for the count.
  assert.match(badge, /return effectiveSummaryCounts\(summary\.overview\)\.notReplied;/);
  assert.match(chatsPage, /notReplied: effectiveSummaryCounts\(bmSummaryData\.overview\)\.notReplied/);
  assert.match(badge, /import \{ effectiveSummaryCounts \} from "@\/app\/reply-state";/);
  assert.match(chatsPage, /import \{ chatsStoreCounts, effectiveSummaryCounts, getEffectiveReplyState \} from "\.\/reply-state";/);
  // Shared cache, at most every 5 minutes; no badge while loading or after an error (never a placeholder 0).
  assert.match(badge, /export const CHATS_BADGE_REFRESH_MS = 5 \* 60 \* 1000;/);
  assert.match(badge, /if \(state\.inFlight \|\| now - state\.fetchedAt < CHATS_BADGE_REFRESH_MS\) return;/);
  assert.match(badge, /\(\) => publish\(\{ count: null, fetchedAt: Date\.now\(\), inFlight: false \}\)/);
  assert.match(read("components/shell/app-sidebar.tsx"), /if \(count === null \|\| count <= 0\) return null;/);
  assert.equal(formatNavBadge(7), "7");
  assert.equal(formatNavBadge(12_345), "999+");
});

test("desktop, collapsed and mobile are all built from the one menu config", () => {
  const sidebar = read("components/shell/app-sidebar.tsx");
  const topNavigation = read("components/shell/top-navigation.tsx");
  for (const source of [sidebar, topNavigation]) {
    assert.match(source, /from "\.\/navigation-config"/);
    assert.match(source, /visibleNavGroups\(authUser\)/);
    assert.doesNotMatch(source, /\{ href: "\//, "no menu item literals outside the config");
  }
  // The More sheet has no hand-written menu links any more (the bottom bar is unchanged).
  const sheet = topNavigation.slice(topNavigation.indexOf("data-mobile-more-menu"), topNavigation.indexOf("labels.account"));
  assert.doesNotMatch(sheet, /href="\//);
  assert.match(sheet, /group\.items\.map/);
  // Collapsed (icon-only) mode renders the same groups: every item, dividers, label tooltips and aria-labels.
  assert.match(sidebar, /if \(collapsed\) return <div key=\{group\.id\} data-nav-group=\{group\.id\} role="group" aria-label=\{groupLabel\}/);
  assert.match(sidebar, /aria-label=\{collapsed \? \(count \?/);
  assert.match(sidebar, /data-nav-search-button onClick=\{\(\) => \{ focusSearchOnExpand\.current = true; updateCollapsed\(false\); \}\}/);
  // The v2 link is gone; the account footer stays.
  assert.doesNotMatch(sidebar, /ลองเวอร์ชันใหม่|href="\/v2"/);
  for (const label of ["t.profile", "t.settings", "t.logout"]) assert.ok(sidebar.includes(label), label);
});

test('/v2/report: no params = this month\'s network report; "← กลับ" goes back, or to /home without history', () => {
  // 7 Oct 2026, 10:00 Bangkok: the current month, no partner, no store = the network report.
  assert.deepEqual(parseReportUrl(new URLSearchParams(""), Date.parse("2026-10-07T03:00:00Z")), { month: "2026-10", partner: null, store: null });
  const report = read("components/v2/month-report.tsx");
  assert.match(report, /if \(typeof window !== "undefined" && window\.history\.length > 1\) router\.back\(\);\n\s*else router\.push\("\/home"\);/);
  assert.match(report, /<button type="button" data-report-back onClick=\{\(\) => goBack\(router\)\}[^>]*>← กลับ<\/button>/);
});
