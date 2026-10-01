import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFERRED_LOADING_DELAY_MS,
  DEFERRED_LOADING_MIN_VISIBLE_MS,
  nextDeferredLoadingChange,
} from "../src/components/ui/deferred-loading-model.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const loadingState = read("../src/components/ui/loading-state.tsx");
const errorState = read("../src/components/ui/error-state.tsx");
const kpiSkeleton = read("../src/components/ui/kpi-strip-skeleton.tsx");
const sectionSkeleton = read("../src/components/ui/section-card-skeleton.tsx");
const listSkeleton = read("../src/components/ui/list-row-skeleton.tsx");
const workspaceSkeleton = read("../src/components/ui/workspace-skeleton.tsx");
const skeletonText = read("../src/components/ui/skeleton-text.tsx");
const deferredHook = read("../src/components/ui/use-deferred-loading.ts");
const conversationSkeleton = read("../src/app/conversation-row-skeleton.tsx");
const uiIndex = read("../src/components/ui/index.ts");
const pageCode = read("../src/app/page.tsx");

const timing = { shownAt: 0, now: 0, delayMs: DEFERRED_LOADING_DELAY_MS, minVisibleMs: DEFERRED_LOADING_MIN_VISIBLE_MS };

test("deferred loading waits 200ms and stays at least 400ms once shown", () => {
  assert.equal(DEFERRED_LOADING_DELAY_MS, 200);
  assert.equal(DEFERRED_LOADING_MIN_VISIBLE_MS, 400);
  assert.deepEqual(nextDeferredLoadingChange({ ...timing, isLoading: true, visible: false }), { visible: true, afterMs: 200 });
  // Shown at t=1000, data arrives at t=1100: hold until t=1400.
  assert.deepEqual(nextDeferredLoadingChange({ ...timing, isLoading: false, visible: true, shownAt: 1000, now: 1100 }), { visible: false, afterMs: 300 });
  // Already shown for longer than the minimum: hide immediately.
  assert.deepEqual(nextDeferredLoadingChange({ ...timing, isLoading: false, visible: true, shownAt: 1000, now: 2000 }), { visible: false, afterMs: 0 });
  // Fast load never shows anything; a visible placeholder keeps showing while loading.
  assert.equal(nextDeferredLoadingChange({ ...timing, isLoading: false, visible: false }), null);
  assert.equal(nextDeferredLoadingChange({ ...timing, isLoading: true, visible: true }), null);
});

test("useDeferredLoading schedules through the model with the 200/400 defaults", () => {
  assert.match(deferredHook, /delayMs = DEFERRED_LOADING_DELAY_MS, minVisibleMs = DEFERRED_LOADING_MIN_VISIBLE_MS/);
  assert.match(deferredHook, /nextDeferredLoadingChange\(\{ isLoading, visible, shownAt: shownAt\.current, now: Date\.now\(\), delayMs, minVisibleMs \}\)/);
  assert.match(deferredHook, /return \(\) => window\.clearTimeout\(timer\);/);
});

test("Skeleton blocks have no border, pulse only when motion is allowed, and are hidden from screen readers", () => {
  const skeleton = loadingState.match(/export function Skeleton\([\s\S]*?\n  \);\n\}/)?.[0] ?? "";
  assert.match(skeleton, /aria-hidden="true"/);
  assert.match(skeleton, /motion-safe:animate-pulse rounded bg-\[var\(--app-surface-subtle\)\]/);
  assert.doesNotMatch(skeleton, /\bborder\b/);
  assert.doesNotMatch(skeleton, /(^|[\s`"])animate-pulse/);
  assert.match(conversationSkeleton, /motion-safe:animate-pulse/);
  assert.doesNotMatch(conversationSkeleton, /(^|[\s"])animate-pulse/);
});

test("KpiStripSkeleton reuses the kpi-strip-model geometry and takes a columns prop", () => {
  assert.match(kpiSkeleton, /from "\.\/kpi-strip-model"/);
  assert.match(kpiSkeleton, /columns\?: KpiColumns;/);
  assert.match(kpiSkeleton, /const resolvedColumns = resolveKpiColumns\(count, columns\);/);
  assert.match(kpiSkeleton, /className=\{`\$\{kpiGridClass\(resolvedColumns\)\} \$\{className\}`\}/);
  assert.match(kpiSkeleton, /className=\{`\$\{KPI_ITEM_CLASS\} \$\{kpiItemSpanClass\(index, count, resolvedColumns\)\}`\}/);
  assert.match(kpiSkeleton, /className=\{KPI_LABEL_CLASS\}/);
  assert.match(kpiSkeleton, /className=\{kpiValueClass\(\)\}/);
  assert.match(kpiSkeleton, /className=\{KPI_SUBTEXT_CLASS\}/);
  // No copied grid or item classes.
  assert.doesNotMatch(kpiSkeleton, /grid-cols-|bg-\[var\(--app-border-subtle\)\]|px-4 py-3\.5/);
});

test("composed skeletons announce one status with hidden text; only grey blocks are aria-hidden", () => {
  for (const [name, source] of [["KpiStripSkeleton", kpiSkeleton], ["SectionCardSkeleton", sectionSkeleton], ["ListRowSkeleton", listSkeleton], ["WorkspaceSkeleton", workspaceSkeleton]] as const) {
    assert.match(source, /role="status"\s+aria-busy="true"/, name);
    assert.match(source, /<span className="sr-only">\{label\}<\/span>/, name);
    assert.match(source, /label = "กำลังโหลด…"/, name);
    assert.doesNotMatch(source, /role="status"[^>]*aria-hidden/, `${name} must not hide its own status`);
  }
  // Building blocks are aria-hidden and never a second live region.
  assert.match(skeletonText, /<div aria-hidden="true"/);
  assert.doesNotMatch(skeletonText, /role="status"/);
  assert.match(listSkeleton, /<div aria-hidden="true" className=\{listClassName\}>/);
});

test("ConversationRowSkeleton is built on ListRowSkeleton with its original row markup", () => {
  assert.match(conversationSkeleton, /import \{ ListRowSkeleton \} from "@\/components\/ui\/list-row-skeleton";/);
  assert.match(conversationSkeleton, /listClassName="divide-y divide-\[var\(--border\)\] motion-safe:animate-pulse"/);
  assert.match(conversationSkeleton, /rowClassName="p-4 space-y-3"/);
  assert.match(conversationSkeleton, /<div className="h-4 w-32 rounded bg-\[var\(--border\)\]"><\/div>/);
  assert.equal(conversationSkeleton.match(/rounded-full bg-\[var\(--border\)\] opacity-60/g)?.length, 3);
});

test("ErrorState and the workspace Loading screen use tokens, not hardcoded colours", () => {
  assert.doesNotMatch(errorState, /#C62828|#fca5a5/i);
  assert.equal(errorState.match(/text-\[color-mix\(in_srgb,var\(--app-danger\)_70%,var\(--app-text-primary\)\)\]/g)?.length, 2);
  assert.match(pageCode, /if \(!authChecked\) return <main className="flex min-h-screen items-center justify-center bg-\[var\(--app-bg\)\] text-\[var\(--app-text-secondary\)\]">/);
});

test("skeleton kit is exported from components/ui", () => {
  for (const name of ["skeleton-text", "kpi-strip-skeleton", "section-card-skeleton", "list-row-skeleton", "deferred-loading-model", "use-deferred-loading", "workspace-skeleton"]) {
    assert.match(uiIndex, new RegExp(`export \\* from "\\./${name}";`), name);
  }
});
