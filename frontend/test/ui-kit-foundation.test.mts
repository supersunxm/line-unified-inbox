import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  KPI_EMPTY_VALUE,
  KPI_PERIOD_CLASS,
  KPI_SMALL_COLUMNS,
  KPI_STRIP_CONTAINER_CLASS,
  KPI_SUBTEXT_CLASS,
  isEmptyKpiValue,
  kpiGridClass,
  kpiItemSpanClass,
  kpiItemSpans,
  kpiValueClass,
  resolveKpiColumns,
  type KpiColumns,
} from "../src/components/ui/kpi-strip-model.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("PageHeader keeps its props and uses the redesigned type scale", () => {
  const source = read("../src/components/shell/page-header.tsx");
  for (const prop of ["tag?: React.ReactNode;", "title: React.ReactNode;", "description?: React.ReactNode;", "actions?: React.ReactNode;", "actionSlot?: React.ReactNode;", "className?: string;"]) {
    assert.ok(source.includes(prop), `PageHeader must keep ${prop}`);
  }
  assert.doesNotMatch(source, /\bmeta\b/);
  assert.match(source, /<h1 className="text-xl sm:text-2xl font-semibold leading-\[1\.3\] tracking-tight text-\[var\(--app-text-primary\)\]">/);
  assert.match(source, /<p className="mt-1 text-\[13px\] text-\[var\(--app-text-secondary\)\] leading-relaxed">/);
  assert.match(source, /<header className=\{`mb-4 /);
  assert.doesNotMatch(source, /select-none/);
  // The eyebrow keeps its existing styling.
  assert.match(source, /<div className="mb-1 text-xs font-semibold uppercase tracking-\[0\.04em\] text-\[var\(--app-text-tertiary\)\]">/);
});

test("KpiStrip model renders — only for null, undefined and empty string", () => {
  assert.equal(KPI_EMPTY_VALUE, "—");
  assert.equal(isEmptyKpiValue(null), true);
  assert.equal(isEmptyKpiValue(undefined), true);
  assert.equal(isEmptyKpiValue(""), true);
  assert.equal(isEmptyKpiValue(0), false);
  assert.equal(isEmptyKpiValue("0"), false);
  assert.equal(isEmptyKpiValue(" "), false);
});

test("KpiStrip model fills every grid row so the gap colour never shows as a block", () => {
  const allColumns: KpiColumns[] = [2, 3, 4, 5];
  for (const columns of allColumns) {
    for (let count = 1; count <= 12; count += 1) {
      for (const breakpoint of ["small", "large"] as const) {
        const perRow = breakpoint === "small" ? KPI_SMALL_COLUMNS : columns;
        let occupied = 0;
        for (let index = 0; index < count; index += 1) {
          const span = kpiItemSpans(index, count, columns)[breakpoint];
          assert.ok(span >= 1 && span <= perRow, `span ${span} fits ${perRow} columns`);
          if (index < count - 1) assert.equal(span, 1, "only the last item spans");
          occupied += span;
        }
        assert.equal(occupied % perRow, 0, `${count} items at ${perRow} columns (${breakpoint}) leave no empty cell`);
      }
    }
  }
  // Message Traffic: 5 items, 5 columns — the last item spans both small columns and resets at lg.
  assert.equal(kpiItemSpanClass(4, 5, 5), "sm:col-span-2 lg:col-span-1");
  assert.equal(kpiItemSpanClass(0, 5, 5), "");
  assert.equal(kpiItemSpanClass(3, 4, 4), "");
  assert.equal(kpiItemSpanClass(2, 3, 3), "sm:col-span-2 lg:col-span-1");
  assert.equal(kpiItemSpanClass(4, 5, 3), "sm:col-span-2 lg:col-span-2");
  assert.equal(kpiItemSpanClass(5, 6, 4), "sm:col-span-1 lg:col-span-3");
});

test("KpiStrip model returns complete literal class strings", () => {
  assert.equal(resolveKpiColumns(5), 5);
  assert.equal(resolveKpiColumns(1), 2);
  assert.equal(resolveKpiColumns(9), 5);
  assert.equal(resolveKpiColumns(3, 4), 4);
  assert.equal(kpiGridClass(5), `${KPI_STRIP_CONTAINER_CLASS} lg:grid-cols-5`);
  assert.match(KPI_STRIP_CONTAINER_CLASS, /rounded-\[var\(--app-radius-md\)\] border border-\[var\(--app-border\)\] bg-\[var\(--app-border-subtle\)\]/);
  assert.match(kpiValueClass(), /text-\[28px\] font-semibold .*font-tabular/);
  assert.match(kpiValueClass("compact"), /whitespace-nowrap text-\[22px\] font-semibold .*font-tabular/);
  assert.match(KPI_SUBTEXT_CLASS, /text-xs text-\[var\(--app-text-secondary\)\]/);
  assert.match(KPI_PERIOD_CLASS, /bg-\[var\(--app-surface-subtle\)\].*text-\[11px\].*text-\[var\(--app-text-secondary\)\]/);
  const model = read("../src/components/ui/kpi-strip-model.ts");
  assert.doesNotMatch(model, /-\$\{/, "no class names assembled from fragments");
  assert.doesNotMatch(model, /text-tertiary|neutral-soft/);
  assert.doesNotMatch(model, /#[0-9a-fA-F]{3,6}\b/);
});

test("KpiStrip renders a description list with real elements only", () => {
  const source = read("../src/components/ui/kpi-strip.tsx");
  assert.match(source, /<dl className=\{`\$\{kpiGridClass\(resolvedColumns\)\} \$\{className\}`\}/);
  assert.match(source, /<dt className=\{KPI_LABEL_CLASS\}>/);
  assert.match(source, /<dd className=\{kpiValueClass\(item\.valueSize\)\}>\{isEmptyKpiValue\(item\.value\) \? KPI_EMPTY_VALUE : item\.value\}<\/dd>/);
  assert.match(source, /<dd className=\{KPI_SUBTEXT_CLASS\}>/);
  assert.doesNotMatch(source, /\brole=|onClick|border-l-/);
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,6}\b/);
});

test("SectionCard uses the agreed tokens and sizes", () => {
  const source = read("../src/components/ui/section-card.tsx");
  for (const prop of ["title: React.ReactNode;", 'titleAs?: "h2" | "h3";', "meta?: React.ReactNode;", "footer?: React.ReactNode;", 'bodyPadding?: "default" | "none";']) {
    assert.ok(source.includes(prop), `SectionCard must declare ${prop}`);
  }
  assert.match(source, /<section\s+className=\{`overflow-hidden rounded-\[var\(--app-radius-md\)\] border border-\[var\(--app-border\)\] bg-\[var\(--app-surface\)\]/);
  assert.match(source, /<header className="flex min-h-12 items-center justify-between gap-3 border-b border-\[var\(--app-border-subtle\)\] px-4">/);
  assert.match(source, /<Title className="min-w-0 text-\[15px\] font-semibold/);
  // Footer stays at the bottom when grid cells stretch cards to equal heights.
  assert.match(source, /text-\[var\(--app-text-primary\)\] flex flex-col \$\{className\}`\}/);
  assert.match(source, /<div className=\{bodyPadding === "none" \? "flex-1" : "flex-1 p-4"\}>\{children\}<\/div>/);
  assert.match(source, /titleAs = "h2"/);
  assert.match(source, /<div className="shrink-0 text-xs text-\[var\(--app-text-secondary\)\]">\{meta\}<\/div>/);
  assert.match(source, /<div className="flex min-h-11 items-center border-t border-\[var\(--app-border-subtle\)\] px-4 text-\[13px\]">/);
  assert.match(source, /export function SectionCardRow[\s\S]*border-b border-\[var\(--app-border-subtle\)\] px-4 py-3 last:border-b-0/);
  assert.doesNotMatch(source, /\brole=|onClick|#[0-9a-fA-F]{3,6}\b/);
  const uiIndex = read("../src/components/ui/index.ts");
  assert.match(uiIndex, /export \* from "\.\/kpi-strip";/);
  assert.match(uiIndex, /export \* from "\.\/section-card";/);
  assert.doesNotMatch(uiIndex, /kpi-strip-model/);
});

function contrastRatio(first: string, second: string) {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/.{2}/g)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
    const linear = channels.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test("primary and secondary text meet 4.5:1 on surface, subtle surface and page background in both themes", () => {
  const css = read("../src/app/globals.css");
  const lightBlock = css.slice(css.indexOf(":root {"), css.indexOf('html[data-theme="dark"] {'));
  const darkStart = css.indexOf('html[data-theme="dark"] {');
  const darkBlock = css.slice(darkStart, css.indexOf("}", darkStart));
  const token = (block: string, name: string) => {
    const value = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6});`))?.[1];
    assert.ok(value, `Missing ${name}`);
    return value;
  };
  for (const [theme, block] of [["light", lightBlock], ["dark", darkBlock]] as const) {
    for (const text of ["--app-text-primary", "--app-text-secondary"]) {
      for (const background of ["--app-surface", "--app-surface-subtle", "--app-bg"]) {
        const ratio = contrastRatio(token(block, text), token(block, background));
        assert.ok(ratio >= 4.5, `${theme}: ${text} on ${background} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
});

test("Message Traffic uses PageHeader, KpiStrip and SectionCard on desktop", () => {
  const source = read("../src/app/dashboard/message-traffic/message-traffic-view.tsx");
  assert.match(source, /<PageHeader title=\{text\.title\} description=\{text\.description\} actions=\{<Button variant="secondary" size="sm" onClick=\{\(\) => void loadRange\(dateFrom, dateTo\)\} disabled=\{loading\}>\{text\.refresh\}<\/Button>\} \/>/);
  assert.doesNotMatch(source, /tag=\{text\.tag\}/);
  assert.match(source, /<FilterBar>/);
  assert.match(source, /<div role="alert"/);
  assert.match(source, /<KpiStrip\s+columns=\{5\}/);
  assert.match(source, /id: "peak-hour", label: text\.peakHour, value: data\.overallPeakHour\.window, [^\n]*valueSize: "compact" \},\n/);
  assert.match(source, /id: "busiest-day", label: text\.busiestDay, value: busiestDay \? dayLabel\(busiestDay\.dayOfWeek, language\) : null, [^\n]*valueSize: "compact" \},\n/);
  assert.doesNotMatch(source, /<MetricCard|tone=/);
  const kpiBlock = source.slice(source.indexOf("<KpiStrip"), source.indexOf("/>", source.indexOf("<KpiStrip")));
  assert.doesNotMatch(kpiBlock, /period:/, "no period pills on a custom date range");
  assert.match(source, /<SectionCard title=\{text\.hourly\}>/);
  assert.match(source, /<SectionCard title=\{text\.weekday\} bodyPadding="none">/);
  assert.match(source, /<SectionCard title=\{text\.ranking\} bodyPadding="none">/);
  assert.doesNotMatch(source, /<TableContainer|<CardHeader|<CardTitle/);
  // The mobile app is untouched.
  assert.doesNotMatch(read("../src/app/dashboard/message-traffic/mobile-message-traffic-app.tsx"), /KpiStrip|SectionCard/);
});

test("Download Center uses PageHeader, SectionCard and the kit Button", () => {
  const source = read("../src/app/download-center/page.tsx");
  assert.match(source, /<PageHeader title=\{t\.title\} description=\{t\.description\} \/>/);
  assert.doesNotMatch(source, /Reports & Data Export|<h1/);
  assert.match(source, /<SectionCard title=\{title\} footer=\{<Link href=\{href\} className="[^"]*">\{labels\.openSource\} →<\/Link>\}>/);
  assert.doesNotMatch(source, />Export</);
  assert.doesNotMatch(source, /<article/);
  assert.match(source, /<h2 className="mb-3 text-sm font-semibold text-\[var\(--app-text-secondary\)\]">\{t\.catalog\}<\/h2>/);
  assert.match(source, /<Button variant="primary" disabled=\{lineDownloading \|\| !dateFrom \|\| !dateTo \|\| dateTo < dateFrom\} onClick=\{\(\) => void downloadLine\(\)\}/);
  assert.match(source, /<Button variant="primary" disabled=\{storeDownloading\} onClick=\{\(\) => void downloadStoreMaster\(\)\}/);
  assert.doesNotMatch(source, /<button/);
  assert.doesNotMatch(source, /text-tertiary/);
});

test("Download Center links the LINE OA Account Master card to Store Management, not the public directory", () => {
  const source = read("../src/app/download-center/page.tsx");
  assert.match(source, /<DatasetCard title=\{t\.storeTitle\}[^>]*href="\/storemanagement"/);
  assert.doesNotMatch(source, /href="\/stores"/);
});
