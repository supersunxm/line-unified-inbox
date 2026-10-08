#!/usr/bin/env node
// Screenshots of the metrics pages rendered against the seeded API (scripts/v2-seed-api.mjs:
// synthetic, deterministic data — no backend, no customer data). Manual, not in CI.
//
//   npm run build && npx next start -p 3000      # in one terminal
//   OUT=/tmp/shots node scripts/render-pages.mjs /home /dashboard "/store-360?storeId=store-1"
//
// Writes <OUT>/<name>-<theme>-<viewport>.png for light and dark, desktop (1440) and mobile (390),
// and prints console errors. Exit 1 when a page logs a console or page error.

import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { routeSeededApi } from "./v2-seed-api.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "screenshots";
const here = dirname(fileURLToPath(import.meta.url));
const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("Usage: node scripts/render-pages.mjs <path> [<path> …]");
  process.exit(2);
}

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
  console.error("Playwright not found.");
  process.exit(2);
}

const slug = (path) => path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "") || "root";

const { chromium } = await loadPlaywright();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
mkdirSync(OUT, { recursive: true });
const errors = [];
for (const theme of ["light", "dark"]) {
  for (const [viewport, size] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport: size, colorScheme: theme, isMobile: viewport === "mobile", hasTouch: viewport === "mobile" });
    await context.addInitScript((value) => { try { localStorage.setItem("oppo-line-oa-theme", value); } catch { /* storage blocked */ } }, theme);
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") errors.push(`${viewport}/${theme} ${page.url()}: ${message.text()}`); });
    page.on("pageerror", (error) => errors.push(`${viewport}/${theme} ${page.url()}: ${String(error)}`));
    await routeSeededApi(page);
    for (const path of paths) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      const file = join(OUT, `${slug(path)}-${theme}-${viewport}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
    await context.close();
  }
}
await browser.close();
if (errors.length) console.log(`\nConsole errors:\n  ${[...new Set(errors)].join("\n  ")}`);
process.exit(errors.length ? 1 : 0);
