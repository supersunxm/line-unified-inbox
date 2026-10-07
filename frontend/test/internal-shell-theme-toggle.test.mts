import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveTheme, toggledThemePreference } from "../src/app/theme-logic.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const topNavigation = read("../src/components/shell/top-navigation.tsx");
const navConfig = read("../src/components/shell/navigation-config.ts");
const theme = read("../src/app/theme.tsx");
const themeI18n = read("../src/app/theme-i18n.ts");
const internalShell = read("../src/components/shell/internal-page-shell.tsx");

test("one click switches to the opposite of the theme on screen, including from system", () => {
  assert.equal(toggledThemePreference("light"), "dark");
  assert.equal(toggledThemePreference("dark"), "light");
  // "system" on a dark OS shows dark, so one click makes it explicitly light (and vice versa).
  assert.equal(toggledThemePreference(resolveTheme("system", true)), "light");
  assert.equal(toggledThemePreference(resolveTheme("system", false)), "dark");
});

test("the toggle reads the shown theme from <html data-theme> and saves through the existing setTheme", () => {
  assert.match(theme, /observer\.observe\(document\.documentElement, \{ attributes: true, attributeFilter: \["data-theme"\] \}\);/);
  assert.match(theme, /return \{ shown, toggle: \(\) => context\.setTheme\(toggledThemePreference\(shown\)\) \};/);
  // Select options are localized through the active app language.
  assert.match(theme, /const text = themeControlLabels\[language\];/);
  assert.match(theme, /<option value="light">\{text\.light\}<\/option>\s*<option value="dark">\{text\.dark\}<\/option>\s*<option value="system">\{text\.system\}<\/option>/);
  for (const label of ["light: \"สว่าง\"", "light: \"Light\"", "light: \"浅色\"", "system: \"ตามระบบ\"", "system: \"System\"", "system: \"跟随系统\""]) {
    assert.ok(themeI18n.includes(label), `missing localized theme label ${label}`);
  }
  assert.match(topNavigation, /<ThemeControl \/>/);
});

test("the top bar has an accessible theme toggle button", () => {
  const button = topNavigation.match(/function ThemeToggleButton[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(button, /<button type="button" data-theme-toggle onClick=\{toggle\} aria-label=\{label\} title=\{label\} className=\{`\$\{focusRing\} flex h-9 w-9 shrink-0/);
  assert.match(button, /shown === "dark" \? themeToggleLabels\[language\]\.toLight : themeToggleLabels\[language\]\.toDark/);
  // Sun in dark mode (circle + rays), moon in light mode.
  assert.match(button, /shown === "dark"\s*\? <><circle \{\.\.\.common\} cx="12" cy="12" r="4" \/>[\s\S]*?: <path \{\.\.\.common\} d="M20 14\.5A8\.5/);
  assert.match(topNavigation, /th: \{ toDark: "สลับเป็นโหมดมืด", toLight: "สลับเป็นโหมดสว่าง" \}/);
  assert.match(topNavigation, /<ResponsiveSearch searchText=\{searchText\} setSearchText=\{setSearchText\} text=\{text\} \/>\s*<ThemeToggleButton language=\{language\} \/>/);
});

test("InternalPageShell renders AppShell with the shared store user", () => {
  assert.match(internalShell, /const \{ user \} = useAuthUserSnapshot\(\);/);
  assert.match(internalShell, /<AppShell\s+currentSection=\{section\}\s+authUser=\{user\}/);
});

test("internal pages without the shell now render inside InternalPageShell with the right active item", () => {
  const wrapped: Array<[string, RegExp]> = [
    ["../src/app/replymessage/page.tsx", /<InternalPageShell section="dashboard">/],
    ["../src/app/rich-messages/page.tsx", /<InternalPageShell section="greeting-messages">/],
    ["../src/app/monthly-operations-report/page.tsx", /<InternalPageShell section="dashboard">/],
    ["../src/app/admin/registrations/hq/page.tsx", /<InternalPageShell section="admin-registrations">/],
    ["../src/app/rich-menus/overview/page.tsx", /<InternalPageShell section="rich-menus">/],
    ["../src/app/tiktok/page.tsx", /<InternalPageShell section="dashboard">/],
    ["../src/app/tiktok/stores/[storeMasterId]/page.tsx", /<InternalPageShell section="dashboard">/],
    ["../src/app/tiktok/dashboard/tiktok-dashboard-responsive.tsx", /<InternalPageShell section="dashboard">\s*<TikTokDashboardView/],
  ];
  for (const [path, pattern] of wrapped) assert.match(read(path), pattern, path);
  // The monthly report no longer reserves sidebar space itself; AppShell does.
  assert.doesNotMatch(read("../src/app/monthly-operations-report/page.tsx"), /md:ml-\[var\(--app-sidebar-width/);
  // /replymessage keeps its back-to-dashboard link.
  assert.match(read("../src/app/replymessage/page.tsx"), /href="\/dashboard"[\s\S]*?กลับแดชบอร์ด/);
  // Active items: pathname-based, with /rich-messages under Greeting Messages.
  assert.match(navConfig, /section: "greeting-messages", active: \(path\) => path\.startsWith\("\/greeting-messages"\) \|\| path\.startsWith\("\/rich-messages"\)/);
  assert.match(topNavigation, /if \(pathname\.startsWith\("\/replymessage"\)\) return navigationLabels\.replySla;/);
});
