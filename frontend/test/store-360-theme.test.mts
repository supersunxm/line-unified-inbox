import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const view = readFileSync(new URL("../src/app/store-360/store-360-view.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/app/store-360/page.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("../src/components/date-range/unified-period-picker.tsx", import.meta.url), "utf8");
const exportControl = readFileSync(new URL("../src/app/store-360/store-360-export-control.tsx", import.meta.url), "utf8");

test("Store 360 reuses the canonical root theme state", () => {
  assert.match(layout, /ThemeProvider/);
  assert.match(layout, /oppo-line-oa-theme/);
  assert.match(layout, /document\.documentElement\.dataset\.theme = resolved/);
  assert.match(view, /className="store360-workspace/);
  assert.match(page, /className="store360-workspace/);
  assert.doesNotMatch(view, /biWorkspaceStyle/);
  assert.doesNotMatch(view, /<ThemeControl/);
  assert.doesNotMatch(view, /localStorage/);
});

test("Store 360 defines approved light tokens and a complete dark surface hierarchy", () => {
  assert.match(css, /\.store360-workspace\s*\{[\s\S]*--app-bg:\s*#f4f8fa/);
  assert.match(css, /\.store360-workspace\s*\{[\s\S]*--app-surface:\s*#ffffff/);
  assert.match(css, /html\[data-theme="dark"\] \.store360-workspace\s*\{[\s\S]*--app-bg:\s*#0d0f12/);
  assert.match(css, /html\[data-theme="dark"\] \.store360-workspace\s*\{[\s\S]*--app-surface:\s*#14171d/);
  for (const token of ["--app-border", "--app-text-primary", "--app-text-secondary", "--app-text-tertiary", "--input-background", "--app-insight-soft", "--app-shadow-elevated"]) {
    assert.match(css, new RegExp(`html\\[data-theme="dark"\\] \\.store360-workspace[\\s\\S]*${token}:`), `missing dark token ${token}`);
  }
});

test("Store 360 chart series and product identity use theme-aware presentation tokens", () => {
  assert.match(view, /fill="var\(--store360-chart-customers\)"/);
  assert.match(view, /fill="var\(--store360-chart-sales\)"/);
  assert.match(view, /stroke="var\(--store360-chart-reply\)"/);
  assert.match(view, /bg-\[var\(--store360-chart-customers\)\]/);
  assert.match(view, /bg-\[var\(--store360-chart-sales\)\]/);
  assert.match(view, /bg-\[var\(--store360-chart-reply\)\]/);
  assert.match(view, /var\(--store360-thumb-from\)/);
  assert.match(view, /var\(--store360-avatar\)/);
  assert.doesNotMatch(view, /fill="#64d3a6"|fill="#3c82dc"|stroke="#7543f5"/);
});

test("Store 360 date picker and export dialog inherit semantic theme tokens", () => {
  for (const source of [picker, exportControl]) {
    assert.match(source, /var\(--app-surface\)/);
    assert.match(source, /var\(--app-border\)/);
    assert.match(source, /var\(--app-text-primary\)/);
    assert.match(source, /var\(--app-surface-hover\)/);
  }
  assert.match(exportControl, /role="dialog"/);
  assert.match(picker, /createPortal/);
});

test("theme initialization remains authoritative across navigation and refresh", () => {
  assert.match(layout, /localStorage\.getItem\("oppo-line-oa-theme"\)/);
  assert.match(layout, /document\.documentElement\.style\.colorScheme = resolved/);
  assert.match(view, /<AppShell currentSection="store-360"/);
  assert.doesNotMatch(view, /setTheme\(/);
});
