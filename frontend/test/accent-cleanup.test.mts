import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const OLD_BRAND_GREENS = /#00a651|#008f46|#00ba7c|rgba\(0, ?166, ?81|rgba\(0, ?186, ?124|#009b69|#39d99a/i;

test("brand-accent surfaces no longer hardcode the retired brand greens", () => {
  for (const path of [
    "../src/app/manifest.ts",
    "../src/app/public-landing-page.tsx",
    "../src/app/globals.css",
    "../src/app/follower-insights/follower-insights-modern.module.css",
    "../src/app/follower-insights/follower-insights-polish.module.css",
    "../src/app/follower-insights/trend-chart.tsx",
    "../src/app/follower-insights/store-breakdown-table.tsx",
    "../src/app/dashboard/executive-dashboard-base.tsx",
    "../src/app/dashboard/executive-dashboard-v2.tsx",
    "../src/app/connect/tiktok/page.tsx",
    "../src/app/tiktok-integration/page.tsx",
  ]) {
    assert.doesNotMatch(read(path), OLD_BRAND_GREENS, `${path} still uses a retired brand green`);
  }
  assert.match(read("../src/app/manifest.ts"), /theme_color: "#1f6b4a"/);
});

test("Store 360 inherits the global accent instead of overriding it", () => {
  const css = read("../src/app/globals.css");
  const store360Light = css.slice(css.indexOf(".store360-workspace {"), css.indexOf("}", css.indexOf(".store360-workspace {")));
  const darkStart = css.indexOf('html[data-theme="dark"] .store360-workspace {');
  const store360Dark = css.slice(darkStart, css.indexOf("}", darkStart));
  for (const block of [store360Light, store360Dark]) {
    assert.doesNotMatch(block, /--app-accent(-hover|-soft|-contrast)?:/);
    // Status colors stay scoped to Store 360.
    assert.match(block, /--app-success:/);
  }
});

test("shell focus rings and primary chart series use the accent token", () => {
  for (const path of ["../src/components/shell/top-navigation.tsx", "../src/components/shell/app-sidebar.tsx", "../src/components/shell/context-sidebar.tsx"]) {
    const source = read(path);
    assert.match(source, /focus-visible:ring-\[var\(--app-accent\)\]\/40/);
    assert.doesNotMatch(source, /ring-emerald-500/);
  }
  assert.match(read("../src/app/follower-insights/trend-chart.tsx"), /metric === "followers" \? "var\(--app-accent\)"/);
  assert.match(read("../src/app/tiktok/dashboard/tiktok-follower-chart.tsx"), /stroke="var\(--app-accent\)"/);
  assert.match(read("../src/app/admin/purchase-analytics/purchase-intelligence-dashboard.tsx"), /stroke="var\(--app-accent\)"/);
});

test("accent-filled non-button elements keep white text in dark mode", () => {
  const css = read("../src/app/globals.css");
  // Dark mode remaps text-white to the surface color.
  assert.match(css, /html\[data-theme="dark"\] \{[\s\S]*?--color-white: var\(--surface\);/);
  for (const background of ["bg-[var(--app-accent)]", "bg-[var(--app-accent-hover)]", "bg-[var(--app-accent,#1f6b4a)]", "bg-[var(--app-accent,#111827)]"]) {
    assert.ok(css.includes(`:not(button).text-white[class~="${background}"]`), `missing contrast rule for ${background}`);
  }
  assert.ok(css.includes('html[data-theme="dark"] :not(button).text-white[class~="dark:bg-[var(--app-accent)]"] {\n  color: var(--app-accent-contrast);\n}'));
});

test("LINE and TikTok styling on public store pages is not brand-accent", () => {
  // /stores uses the LINE brand green literally; TikTok stays black/white.
  const directory = read("../src/app/stores/public-stores-directory.tsx");
  assert.match(directory, /rounded-xl bg-\[#06C755\] px-3 py-2 text-xs font-semibold text-white[\s\S]*?aria-label=\{`แอด LINE \$\{store\.name\}`\}/);
  assert.match(directory, /bg-slate-900 dark:bg-white dark:text-slate-900 px-3 py-2 text-xs font-semibold text-white[\s\S]*?aria-label=\{`เปิด TikTok \$\{store\.name\}`\}/);
  // Store locator's LINE chat CTA is coloured through its own page palette, so that
  // palette keeps its previous green instead of the brand accent.
  const locatorPage = read("../src/app/store-locator/page.tsx");
  assert.match(locatorPage, /"--app-accent": "#00a651"/);
  assert.match(read("../src/app/store-locator/store-locator-app.tsx"), /bg-\[var\(--app-accent\)\][^"]*"[\s\S]{0,200}data-testid="store-locator-line-cta"/);
});

test("status greens are left alone", () => {
  // Replied share in the dashboard donut and the health gauge keep their status color.
  assert.match(read("../src/app/dashboard/message-overview.tsx"), /stroke="#059669"/);
  assert.match(read("../src/app/dashboard/circular-health-gauge.tsx"), /"#10b981"/);
});
