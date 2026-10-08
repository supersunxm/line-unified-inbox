import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { INTERNAL_APP_NAME, internalPageTitle } from "../src/lib/page-title.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("IBM Plex Sans Thai is loaded once and is the app-wide sans font", () => {
  const layout = read("../src/app/layout.tsx");
  const css = read("../src/app/globals.css");
  assert.match(layout, /import \{ IBM_Plex_Sans_Thai \} from "next\/font\/google";/);
  assert.match(layout, /weight: \["400", "500", "600", "700"\]/);
  assert.match(layout, /subsets: \["thai", "latin"\]/);
  assert.match(layout, /variable: "--font-ibm-plex-sans-thai"/);
  assert.match(layout, /className=\{`\$\{ibmPlexSansThai\.variable\} h-full antialiased`\}/);
  assert.match(css, /--app-font-sans: var\(--font-ibm-plex-sans-thai\), "IBM Plex Sans Thai", -apple-system, "Segoe UI", sans-serif;/);
  assert.match(css, /--font-sans: var\(--app-font-sans\);/);
  assert.match(css, /body \{[\s\S]*?font-family: var\(--app-font-sans\);/);
  assert.doesNotMatch(css, /"Inter"/);

  // Pages that named the family literally would miss next/font's generated family name.
  assert.match(read("../src/app/follower-insights/follower-insights-modern.module.css"), /font-family: var\(--app-font-sans\);/);
  assert.doesNotMatch(read("../src/app/dashboard/monthly-dashboard.tsx"), /IBM_Plex_Sans_Thai/);
});

test("primary buttons and focus rings use the brand accent in both themes", () => {
  const css = read("../src/app/globals.css");
  const darkStart = css.indexOf('html[data-theme="dark"] {');
  const lightBlock = css.slice(css.indexOf(":root {"), darkStart);
  const darkBlock = css.slice(darkStart, css.indexOf("@theme", darkStart));
  const value = (block: string, name: string) => block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1];

  for (const block of [lightBlock, darkBlock]) {
    assert.equal(value(block, "--button-primary-bg"), value(block, "--app-accent"));
    assert.equal(value(block, "--button-primary-hover-bg"), value(block, "--app-accent-hover"));
    assert.equal(value(block, "--button-primary-text"), value(block, "--app-accent-contrast"));
    assert.equal(value(block, "--focus"), "var(--app-accent)");
  }

  // The default button colour reset belongs in Tailwind's base layer so component
  // text utilities can win. Explicit accent contrast remains a defensive legacy backstop.
  assert.match(css, /@layer base\s*\{[\s\S]*?button\s*\{\s*color:\s*inherit;\s*\}/);
  assert.doesNotMatch(css, /button\s*,\s*input\s*,\s*select\s*,\s*textarea\s*\{\s*color:\s*inherit;/);
  const backgrounds = ["bg-[var(--app-accent)]", "bg-[var(--app-accent-hover)]", "bg-[var(--app-accent,#1f6b4a)]", "bg-[var(--app-accent,#111827)]"];
  const enabledSelectors = backgrounds.map((background) => `button.text-white[class~="${background}"]:not(:disabled, [aria-disabled="true"])`);
  const disabledSelectors = backgrounds.map((background) => `button.text-white[class~="${background}"]:is(:disabled, [aria-disabled="true"])`);
  assert.ok(css.includes(`${enabledSelectors.join(",\n")} {\n  color: var(--app-accent-contrast);\n}`), "enabled accent buttons use the accent contrast color");

  // Disabled accent buttons must look disabled: no contrast-white text, and the
  // existing primary-button disabled styling (already contrast-checked above).
  assert.ok(css.includes(`${disabledSelectors.join(",\n")} {\n  background: var(--button-primary-disabled-bg);\n  color: var(--button-primary-disabled-text);\n  opacity: 1;\n}`), "disabled accent buttons use the primary disabled styling");
  const accentContrastRules = [...css.matchAll(/([^{}]+)\{\s*color: var\(--app-accent-contrast\);\s*\}/g)].map(([, selectors]) => selectors);
  for (const selectors of accentContrastRules.filter((value) => value.includes("button.text-white[class~="))) {
    for (const selector of selectors.split(",\n").map((value) => value.trim())) {
      assert.ok(selector.endsWith(':not(:disabled, [aria-disabled="true"])'), `${selector} must exclude disabled buttons`);
    }
  }
});

test("internal page titles use the '<Page name> · OPPO LINE OA Monitor' format", () => {
  assert.equal(INTERNAL_APP_NAME, "OPPO LINE OA Monitor");
  assert.deepEqual(internalPageTitle("แชทร้านค้า"), { absolute: "แชทร้านค้า · OPPO LINE OA Monitor" });
});

test("every internal route sets its document title through internalPageTitle", () => {
  const titledFiles: Array<[string, string]> = [
    ["../src/app/home/layout.tsx", "หน้าหลัก"],
    ["../src/app/dashboard/layout.tsx", "แดชบอร์ด"],
    ["../src/app/dashboard/message-traffic/layout.tsx", "Message Traffic"],
    ["../src/app/replymessage/layout.tsx", "อัตราตอบกลับ 24 ชม."],
    ["../src/app/chats/layout.tsx", "แชทร้านค้า"],
    ["../src/app/main-oa/layout.tsx", "Main OA"],
    ["../src/app/follower-insights/layout.tsx", "เพื่อน"],
    ["../src/app/store-360/layout.tsx", "Store 360"],
    ["../src/app/monthly-operations-report/layout.tsx", "รายงาน LINE รายเดือน"],
    ["../src/app/download-center/layout.tsx", "Download Center"],
    ["../src/app/coupons/layout.tsx", "คูปอง"],
    ["../src/app/storemanagement/layout.tsx", "จัดการร้านค้า"],
    ["../src/app/admin/stores/layout.tsx", "จัดการร้านค้า"],
    ["../src/app/google-review-kpi/layout.tsx", "Google Review KPI"],
    ["../src/app/admin/purchase-analytics/layout.tsx", "ข้อมูลการซื้อ"],
    ["../src/app/admin/registrations/layout.tsx", "อนุมัติ BM"],
    ["../src/app/friend-source-links/layout.tsx", "ลิงก์เพิ่มเพื่อน"],
    ["../src/app/mass-messages/layout.tsx", "ส่งข้อความ"],
    ["../src/app/broadcast/layout.tsx", "Broadcast"],
    ["../src/app/rich-menus/layout.tsx", "จัดการ Rich Menu"],
    ["../src/app/rich-messages/layout.tsx", "Rich Message"],
    ["../src/app/auto-responses/layout.tsx", "ข้อความตอบกลับอัตโนมัติ"],
    ["../src/app/greeting-messages/layout.tsx", "ข้อความต้อนรับ"],
    ["../src/app/operations/line-chat-health/layout.tsx", "LINE Chat Health"],
    ["../src/app/tiktok/page.tsx", "TikTok Analytics"],
    ["../src/app/tiktok/dashboard/page.tsx", "TikTok Performance Dashboard"],
    ["../src/app/tiktok/dashboard/[accountId]/page.tsx", "TikTok Store Performance Dashboard"],
    ["../src/app/tiktok/stores/[storeMasterId]/page.tsx", "TikTok Store Analytics"],
  ];
  for (const [path, pageName] of titledFiles) {
    const source = read(path);
    assert.doesNotMatch(source, /^"use client";/, `${path} must be a server module to export metadata`);
    assert.ok(source.includes(`title: internalPageTitle("${pageName}")`), `${path} should title the page "${pageName}"`);
  }
});

test("public pages keep their own titles", () => {
  const rootLayout = read("../src/app/layout.tsx");
  assert.match(rootLayout, /default: "OPPO Brand Shop · ค้นหาสาขา & ช่องทางติดต่อ"/);
  assert.match(rootLayout, /template: "%s \| OPPO Brand Shop"/);
  assert.match(read("../src/app/stores/page.tsx"), /absolute: "ค้นหา OPPO Brand Shop \| Store Directory"/);
  assert.doesNotMatch(read("../src/app/stores/page.tsx"), /internalPageTitle/);
});

test("top-bar title follows the route when a page borrows another section", () => {
  const topNavigation = read("../src/components/shell/top-navigation.tsx");
  const navConfig = read("../src/components/shell/navigation-config.ts");
  assert.match(navConfig, /export function sidebarLabels\(language: Language\)/);
  assert.match(topNavigation, /if \(pathname\.startsWith\("\/download-center"\)\) return navigationLabels\.downloadCenter;/);
  assert.match(topNavigation, /if \(pathname\.startsWith\("\/dashboard\/message-traffic"\)\) return navigationLabels\.traffic;/);
  assert.match(topNavigation, /\{pageLabel\(pathname, currentSection, language\)\}/);
  assert.doesNotMatch(topNavigation, /\{sectionLabel\(currentSection, language\)\}/);
});

test("html lang starts Thai and follows the active language", () => {
  assert.match(read("../src/app/layout.tsx"), /lang="th"/);
  assert.match(read("../src/app/language.tsx"), /document\.documentElement\.lang = language === "zh" \? "zh-CN" : language;/);
});
