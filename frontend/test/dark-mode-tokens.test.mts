import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../src/app/globals.css");
const tiktokDashboard = read("../src/app/tiktok/tiktok-public-dashboard.tsx");
const followerChart = read("../src/app/tiktok/dashboard/tiktok-follower-chart.tsx");
const richMessages = read("../src/app/rich-messages/rich-messages-view.tsx");

// Dark mode remaps the slate scale and white (--color-slate-900 becomes #f8fafc,
// --color-white becomes the surface colour), so stock Tailwind dark: palette classes
// render inverted. Fixed pages must use --app-* tokens in their dark: variants.
const darkPalette = /dark:[\w:-]*(?:bg|text|border|divide)-(?:slate-\d+|white|black)\b/;

test("dark mode remaps slate and white, which is why dark: palette classes break", () => {
  assert.match(css, /html\[data-theme="dark"\] \{[\s\S]*?--color-white: var\(--surface\);[\s\S]*?--color-slate-900: #f8fafc;/);
});

test("/tiktok uses --app-* tokens in dark mode", () => {
  assert.doesNotMatch(tiktokDashboard, darkPalette);
  assert.doesNotMatch(followerChart, darkPalette);
  // Hero: a fixed dark panel in light mode; tokens in dark mode so the title is readable.
  assert.match(tiktokDashboard, /bg-\[#07111f\] px-6 py-7 text-white dark:border dark:border-\[var\(--app-border\)\] dark:bg-\[var\(--app-surface\)\] dark:text-\[var\(--app-text-primary\)\]/);
  assert.match(tiktokDashboard, /text-white\/45 dark:text-\[var\(--app-text-secondary\)\]/);
  // KPI and section cards: surface in dark mode.
  assert.equal(tiktokDashboard.match(/bg-white p-5 shadow-\[0_10px_28px_rgba\(15,23,42,0\.045\)\] dark:border-\[var\(--app-border\)\] dark:bg-\[var\(--app-surface\)\]/g)?.length, 3);
  // The filled refresh button becomes accent-filled in dark mode (white text via globals.css).
  assert.match(tiktokDashboard, /text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-\[var\(--app-accent\)\] dark:hover:bg-\[var\(--app-accent-hover\)\]/);
});

test("/rich-messages: token preview surface and readable green buttons in dark mode", () => {
  assert.match(richMessages, /<div className="sticky top-5 rounded-xl bg-\[#eef1f4\] p-4 dark:bg-\[var\(--app-surface-subtle\)\]">/);
  assert.match(richMessages, /bg-\[#06c755\] px-4 py-2 text-sm font-semibold text-white dark:bg-\[var\(--app-accent\)\]">\+ สร้างใหม่/);
  assert.match(richMessages, /bg-\[#06c755\] px-5 py-2\.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-\[var\(--app-accent\)\]"/);
  // The rule that gives those buttons white text exists only in dark mode and skips disabled buttons.
  assert.ok(css.includes('html[data-theme="dark"] button.text-white[class~="dark:bg-[var(--app-accent)]"]:not(:disabled, [aria-disabled="true"]) {\n  color: var(--app-accent-contrast);\n}'));
  assert.ok(css.includes('html[data-theme="dark"] button.text-white[class~="dark:bg-[var(--app-accent)]"]:is(:disabled, [aria-disabled="true"]) {\n  background: var(--button-primary-disabled-bg);'));
  // The global text-white remap itself is unchanged.
  assert.match(css, /--color-white: var\(--surface\);/);
});

test("minor dark-mode fixes use tokens: ONLINE chip, Google Review banner, save buttons", () => {
  assert.match(read("../src/app/conversation-list-presentation.ts"), /"bg-blue-100 text-blue-800 dark:bg-blue-950\/60 dark:text-\[var\(--app-text-primary\)\] border/);
  const review = read("../src/app/google-review-kpi/google-review-kpi-view.tsx");
  assert.match(review, /<p className="text-xs font-bold text-blue-900 dark:text-\[var\(--app-text-primary\)\]">/);
  assert.match(review, /text-\[11px\] font-medium text-blue-900 dark:text-\[var\(--app-text-primary\)\] shadow-xs"/);
  assert.equal(read("../src/app/greeting-messages/greeting-messages-view.tsx").match(/dark:bg-\[var\(--app-accent\)\] dark:hover:bg-\[var\(--app-accent-hover\)\] dark:active:bg-\[var\(--app-accent-hover\)\]"/g)?.length, 2);
  assert.match(read("../src/app/rich-menus/rich-menus-view.tsx"), /text-white px-5 py-2 text-xs font-bold transition shadow-xs disabled:opacity-50 dark:bg-\[var\(--app-accent\)\] dark:hover:bg-\[var\(--app-accent-hover\)\]"/);
});
