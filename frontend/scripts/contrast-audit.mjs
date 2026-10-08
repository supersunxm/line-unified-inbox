#!/usr/bin/env node
// Dark-mode contrast audit of the real rendered v2 pages, the metrics pages (Home, Dashboard,
// Store 360) and the main app's left sidebar.
//
//   npm run build && npx next start -p 3000      # in one terminal
//   npm run audit:contrast                       # in another (BASE_URL to override)
//
// Manual, not in CI. Opens every v2 page (and the scorecard drawer), and three main-app pages
// measured inside the sidebar only (`scope`), in headless Chromium with
// the app theme set to dark, answers every API call from scripts/v2-seed-api.mjs (synthetic,
// deterministic data — no backend, no customer data), and checks each visible text node: its
// computed colour against the nearest opaque background behind it (backgrounds and opacity
// composited up the ancestor chain). Fails (exit 1) when any text is below MIN_RATIO.
// /v2/report is excluded: it is light-only by design.
//
// Playwright is not a frontend dependency: the script uses the copy the backend already
// depends on, or a global install.

import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { routeSeededApi } from "./v2-seed-api.mjs";

const MIN_RATIO = Number(process.env.MIN_RATIO ?? 3);
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "dark";
const here = dirname(fileURLToPath(import.meta.url));

async function loadPlaywright() {
  const candidates = [join(here, ".."), join(here, "../../backend")];
  try { candidates.push(execSync("npm root -g", { encoding: "utf8" }).trim()); } catch { /* no global npm */ }
  for (const base of candidates) {
    try {
      const resolved = createRequire(join(base, "noop.js")).resolve("playwright");
      const loaded = await import(pathToFileURL(resolved).href);
      return loaded.chromium ? loaded : loaded.default;
    } catch { /* try the next location */ }
  }
  console.error("Playwright not found. Install backend dependencies (cd backend && npm ci) or install playwright globally.");
  process.exit(2);
}

const PAGES = [
  { name: "ภาพรวมเดือน", path: "/v2" },
  { name: "ภาพรวมเดือน (เดือนก่อน)", path: "/v2?month=2026-09" },
  { name: "สาขา", path: "/v2/stores" },
  { name: "สาขา + drawer", path: "/v2/stores?store=store-1", waitFor: "[data-v2-scorecard-drawer]" },
  { name: "สาขา + drawer (ตัวอย่างน้อย)", path: "/v2/stores?store=store-9", waitFor: "[data-v2-scorecard-drawer]" },
  { name: "สาขา + drawer (ยังไม่ได้อ่านชื่อ)", path: "/v2/stores?store=store-4", waitFor: "[data-v2-tag-unread]" },
  { name: "Partner ของสาขา", path: "/v2/admin/partners", waitFor: "[data-v2-partner-admin]" },
  { name: "ตอนนี้", path: "/v2/response" },
  { name: "ตอนนี้ · ทั้งหมด", path: "/v2/response?tab=all" },
  { name: "ตอนนี้ · หน้าแชท", path: "/v2/response?view=chat" },
  // The metrics pages (Home / Dashboard / Store 360 rework, 8 Oct 2026): the whole page is measured.
  { name: "หน้าหลัก", path: "/home", waitFor: "[data-home-stores-to-watch] table" },
  { name: "แดชบอร์ด", path: "/dashboard", waitFor: "[data-dashboard-store-table]" },
  { name: "แดชบอร์ด (เดือนก่อน)", path: "/dashboard?month=2026-09", waitFor: "[data-dashboard-store-table]" },
  // Main app pages: only the left sidebar is measured (scope), with every menu group opened.
  { name: "อัตราตอบกลับ 24 ชม. · sidebar", path: "/replymessage", waitFor: "[data-app-sidebar] [data-nav-item]", scope: "[data-app-sidebar]" },
  { name: "Google Review KPI · sidebar", path: "/google-review-kpi", waitFor: "[data-app-sidebar] [data-nav-item]", scope: "[data-app-sidebar]" },
  { name: "Download Center · sidebar", path: "/download-center", waitFor: "[data-app-sidebar] [data-nav-item]", scope: "[data-app-sidebar]" },
];

/** Runs in the page: every visible text node below MIN_RATIO, with what it was measured against. */
function auditInPage([minRatio, scope]) {
  const root = (scope && document.querySelector(scope)) || document.body;
  const parse = (value) => {
    const match = /rgba?\(([^)]+)\)/.exec(value ?? "");
    if (!match) return null;
    const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (key) => (top[key] * top.a + bottom[key] * bottom.a * (1 - top.a)) / a;
    return { r: mix("r"), g: mix("g"), b: mix("b"), a };
  };
  const luminance = ({ r, g, b }) => {
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const hex = ({ r, g, b }) => `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
  const canvas = parse(getComputedStyle(document.documentElement).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
  const base = canvas.a === 1 ? canvas : over(canvas, { r: 255, g: 255, b: 255, a: 1 });

  const backgroundOf = (element) => {
    const layers = [];
    let opacity = 1;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node);
      opacity *= Number(style.opacity);
      const color = parse(style.backgroundColor);
      if (color && color.a > 0) {
        layers.push(color);
        if (color.a === 1) break;
      }
    }
    let result = layers.length && layers[layers.length - 1].a === 1 ? layers.pop() : base;
    while (layers.length) result = over(layers.pop(), result);
    return { background: result, opacity };
  };

  const describe = (element) => {
    const parts = [];
    for (let node = element; node && node !== document.body && parts.length < 4; node = node.parentElement) {
      const data = [...node.attributes].find((attribute) => attribute.name.startsWith("data-v2"));
      parts.unshift(`${node.tagName.toLowerCase()}${data ? `[${data.name}${data.value ? `=${data.value}` : ""}]` : ""}`);
      if (data) break;
    }
    return parts.join(" > ");
  };

  const failures = [];
  let checked = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (node) => (node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement;
    if (!element || ["SCRIPT", "STYLE", "NOSCRIPT", "OPTION", "TEXTAREA"].includes(element.tagName)) continue;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") continue;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) continue; // sr-only and collapsed text
    if (element.closest("[aria-hidden='true'], .sr-only")) continue;
    const color = parse(style.color);
    if (!color) continue;
    // Fully transparent text is not shown (e.g. the sidebar's "O" mark, replaced by the logo image).
    if (color.a === 0) continue;
    const { background, opacity } = backgroundOf(element);
    const text = { ...color, a: color.a * opacity };
    const effective = over(text, background);
    const value = ratio(effective, background);
    checked += 1;
    if (value < minRatio) {
      failures.push({ where: describe(element), text: node.nodeValue.trim().slice(0, 40), fg: hex(effective), bg: hex(background), ratio: Math.round(value * 100) / 100 });
    }
  }
  // Form controls: a select shows its chosen option's text; an empty input shows its placeholder.
  for (const element of root.querySelectorAll("select, input[placeholder], textarea[placeholder]")) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1 || element.closest("[aria-hidden='true']")) continue;
    const isSelect = element.tagName === "SELECT";
    if (!isSelect && element.value) continue;
    const color = parse(getComputedStyle(element, isSelect ? null : "::placeholder").color);
    if (!color) continue;
    const { background, opacity } = backgroundOf(element);
    const effective = over({ ...color, a: color.a * opacity }, background);
    const value = ratio(effective, background);
    checked += 1;
    if (value < minRatio) {
      failures.push({ where: describe(element), text: isSelect ? element.selectedOptions[0]?.textContent?.trim().slice(0, 40) ?? "" : `placeholder: ${element.placeholder.slice(0, 30)}`, fg: hex(effective), bg: hex(background), ratio: Math.round(value * 100) / 100 });
    }
  }
  return { checked, failures };
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: THEME === "dark" ? "dark" : "light" });
await context.addInitScript((theme) => {
  try {
    localStorage.setItem("oppo-line-oa-theme", theme);
    // Open every main-menu group so each sidebar item is measured.
    localStorage.setItem("oppo-app-sidebar-groups", JSON.stringify({ monitoring: true, reports: true, messaging: true, "main-oa": true, system: true }));
  } catch { /* storage blocked */ }
}, THEME);
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => consoleErrors.push(String(error)));
await routeSeededApi(page);

let total = 0;
const report = [];
for (const entry of PAGES) {
  await page.goto(`${BASE_URL}${entry.path}`, { waitUntil: "networkidle" });
  if (entry.waitFor) await page.waitForSelector(entry.waitFor, { timeout: 10_000 });
  await page.waitForTimeout(800);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  const { checked, failures } = await page.evaluate(auditInPage, [MIN_RATIO, entry.scope ?? null]);
  total += failures.length;
  report.push({ ...entry, theme, checked, failures });
}
await browser.close();

for (const entry of report) {
  console.log(`\n${entry.name}  ${entry.path}  (theme=${entry.theme}, ${entry.checked} text nodes, ${entry.failures.length} below ${MIN_RATIO}:1)`);
  const grouped = new Map();
  for (const failure of entry.failures) {
    const key = `${failure.fg} on ${failure.bg} (${failure.ratio}:1)  ${failure.where}`;
    grouped.set(key, [...(grouped.get(key) ?? []), failure.text]);
  }
  for (const [key, texts] of grouped) console.log(`  ✗ ${key}  ×${texts.length}  e.g. "${texts[0]}"`);
}
if (consoleErrors.length) console.log(`\nConsole errors:\n  ${[...new Set(consoleErrors)].join("\n  ")}`);
console.log(`\n${total === 0 ? "PASS" : "FAIL"}: ${total} text nodes below ${MIN_RATIO}:1 across ${report.length} views (${THEME}).`);
process.exit(total === 0 && consoleErrors.length === 0 ? 0 : 1);
