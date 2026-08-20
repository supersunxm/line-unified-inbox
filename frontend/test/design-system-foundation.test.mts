import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const uiIndex = readFileSync(new URL("../src/components/ui/index.ts", import.meta.url), "utf8");
const shellIndex = readFileSync(new URL("../src/components/shell/index.ts", import.meta.url), "utf8");

test("global design tokens are defined in :root and dark mode with semantic names", () => {
  const expectedTokens = [
    "--app-bg",
    "--app-surface",
    "--app-surface-subtle",
    "--app-surface-hover",
    "--app-surface-active",
    "--app-border",
    "--app-border-subtle",
    "--app-border-strong",
    "--app-text-primary",
    "--app-text-secondary",
    "--app-text-tertiary",
    "--app-text-disabled",
    "--app-accent",
    "--app-accent-hover",
    "--app-accent-soft",
    "--app-success",
    "--app-success-soft",
    "--app-warning",
    "--app-warning-soft",
    "--app-danger",
    "--app-danger-soft",
    "--app-info",
    "--app-info-soft",
    "--app-neutral",
    "--app-neutral-soft",
    "--app-radius-sm",
    "--app-radius-md",
    "--app-radius-lg",
    "--app-radius-xl",
    "--app-shadow-card",
    "--app-shadow-elevated",
    "--app-shadow-modal",
  ];

  for (const token of expectedTokens) {
    assert.match(css, new RegExp(`:root[\\s\\S]*${token}:`), `Token ${token} should be in :root`);
    assert.match(css, new RegExp(`html\\[data-theme="dark"\\][\\s\\S]*${token}:`), `Token ${token} should be in dark theme`);
  }
});

test("legacy dashboard --dash-* tokens alias to global --app-* tokens", () => {
  const dashAliases = [
    "--dash-bg: var(--app-bg)",
    "--dash-card: var(--app-surface)",
    "--dash-accent: var(--app-accent)",
    "--dash-text: var(--app-text-primary)",
    "--dash-text-secondary: var(--app-text-secondary)",
    "--dash-border: var(--app-border)",
    "--dash-green: var(--app-success)",
    "--dash-red: var(--app-danger)",
    "--dash-amber: var(--app-warning)",
  ];

  for (const alias of dashAliases) {
    assert.match(css, new RegExp(alias.replace("(", "\\(").replace(")", "\\)")), `Alias ${alias} must exist`);
  }
});

test("all shared UI primitives are exported from components/ui/index.ts", () => {
  const expectedExports = [
    "button",
    "icon-button",
    "card",
    "badge",
    "input",
    "select",
    "segmented-control",
    "table",
    "empty-state",
    "loading-state",
    "error-state",
    "modal",
  ];

  for (const exp of expectedExports) {
    assert.match(uiIndex, new RegExp(`export \\* from "\\./${exp}"`));
  }
});

test("layout components PageHeader and FilterBar are exported from components/shell/index.ts", () => {
  assert.match(shellIndex, /export \* from "\.\/page-header"/);
  assert.match(shellIndex, /export \* from "\.\/filter-bar"/);
  assert.match(shellIndex, /export \* from "\.\/page-container"/);
});

test("accessibility: UI primitives implement keyboard, focus, ARIA, and role standards", () => {
  const buttonCode = readFileSync(new URL("../src/components/ui/button.tsx", import.meta.url), "utf8");
  const iconButtonCode = readFileSync(new URL("../src/components/ui/icon-button.tsx", import.meta.url), "utf8");
  const segmentedCode = readFileSync(new URL("../src/components/ui/segmented-control.tsx", import.meta.url), "utf8");
  const modalCode = readFileSync(new URL("../src/components/ui/modal.tsx", import.meta.url), "utf8");
  const searchInputCode = readFileSync(new URL("../src/components/ui/input.tsx", import.meta.url), "utf8");

  // Focus visible rings
  assert.match(buttonCode, /focus-visible:ring-2/);
  assert.match(iconButtonCode, /focus-visible:ring-2/);
  assert.match(segmentedCode, /focus-visible:ring-2/);

  // ARIA attributes
  assert.match(segmentedCode, /role="radiogroup"/);
  assert.match(segmentedCode, /role="radio"/);
  assert.match(segmentedCode, /aria-checked=/);

  // Modal dialog accessibility
  assert.match(modalCode, /role="dialog"/);
  assert.match(modalCode, /aria-modal="true"/);
  assert.match(modalCode, /aria-labelledby="modal-title"/);
  assert.match(modalCode, /event\.key === "Escape"/);

  // Search input clear button accessibility
  assert.match(searchInputCode, /aria-label="Clear search"/);
});

test("Phase 2A: TopNavigation and ContextSidebar consume semantic design tokens", () => {
  const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");
  const contextSidebarSource = readFileSync(new URL("../src/components/shell/context-sidebar.tsx", import.meta.url), "utf8");
  const appShellSource = readFileSync(new URL("../src/components/shell/app-shell.tsx", import.meta.url), "utf8");

  // TopNavigation semantic tokens
  assert.match(topNavSource, /--app-accent-soft/);
  assert.match(topNavSource, /--app-accent/);
  assert.match(topNavSource, /--app-border/);
  assert.match(topNavSource, /--app-surface/);
  assert.match(topNavSource, /--app-radius-md/);
  assert.match(topNavSource, /--app-shadow-elevated/);

  // ContextSidebar semantic tokens
  assert.match(contextSidebarSource, /--app-accent-soft/);
  assert.match(contextSidebarSource, /--app-surface/);
  assert.match(contextSidebarSource, /--app-border/);
  assert.match(contextSidebarSource, /--app-radius-md/);

  // AppShell semantic tokens
  assert.match(appShellSource, /--app-bg/);
  assert.match(appShellSource, /--app-text-primary/);
  assert.match(appShellSource, /--app-danger-soft/);
});

test("Phase 2B: Store Management (/stores) consumes shared design system components", () => {
  const pageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  // PageHeader & FilterBar
  assert.match(pageSource, /<PageHeader[\s\S]*title=\{text\.lineOaManagement\}/);
  assert.match(pageSource, /<FilterBar[\s\S]*searchSlot=\{/);

  // MetricCards
  assert.match(pageSource, /<MetricCard[\s\S]*label=\{text\.totalLineOa\}/);
  assert.match(pageSource, /<MetricCard[\s\S]*label=\{text\.activeLineOa\}/);
  assert.match(pageSource, /<MetricCard[\s\S]*label=\{text\.connectionIssues\}/);
  assert.match(pageSource, /<MetricCard[\s\S]*label=\{text\.messagesToday\}/);

  // Shared Table primitives
  assert.match(pageSource, /<TableContainer>/);
  assert.match(pageSource, /<Table>/);
  assert.match(pageSource, /<TableHeader>/);
  assert.match(pageSource, /<TableBody>/);
  assert.match(pageSource, /<TableRow key=\{account\.id\}/);

  // Semantic Badges
  assert.match(pageSource, /<Badge size="md" variant=\{statusVariant\} dot>/);
  assert.match(pageSource, /<Badge size="sm" variant=\{account\.store\.dataSource === "MASTER"/);

  // Shared Buttons
  assert.match(pageSource, /<Button[\s\S]*variant="primary"[\s\S]*connectLineOa/);
  assert.match(pageSource, /<Button[\s\S]*variant="secondary"[\s\S]*syncMasterFile/);
});

test("Phase 2C: Coupons and Friend Source Links consume shared design system components", () => {
  const couponsSource = readFileSync(new URL("../src/app/coupons/coupon-manager-aligned-view.tsx", import.meta.url), "utf8");
  const friendSourceLinksSource = readFileSync(new URL("../src/app/friend-source-links/friend-source-links-view.tsx", import.meta.url), "utf8");

  // Coupons UI components
  assert.match(couponsSource, /<PageHeader/);
  assert.match(couponsSource, /<Card/);
  assert.match(couponsSource, /<TableContainer>/);
  assert.match(couponsSource, /<Table>/);
  assert.match(couponsSource, /<Badge/);
  assert.match(couponsSource, /<Button/);
  assert.match(couponsSource, /<SearchInput/);
  assert.match(couponsSource, /<ErrorState/);

  // Friend Source Links UI components
  assert.match(friendSourceLinksSource, /<PageHeader/);
  assert.match(friendSourceLinksSource, /<FilterBar/);
  assert.match(friendSourceLinksSource, /<MetricCard/);
  assert.match(friendSourceLinksSource, /<TableContainer>/);
  assert.match(friendSourceLinksSource, /<Table>/);
  assert.match(friendSourceLinksSource, /<Badge/);
  assert.match(friendSourceLinksSource, /<Button/);
  assert.match(friendSourceLinksSource, /<SearchInput/);
});

test("Phase 2D: Mass Messages consumes shared design system components", () => {
  const massMessagesSource = readFileSync(new URL("../src/app/mass-messages/mass-messages-view.tsx", import.meta.url), "utf8");
  const purchaseComposerSource = readFileSync(new URL("../src/app/mass-messages/purchase-broadcast-composer.tsx", import.meta.url), "utf8");

  // Mass Messages view components
  assert.match(massMessagesSource, /<PageHeader/);
  assert.match(massMessagesSource, /<Card/);
  assert.match(massMessagesSource, /<MetricCard/);
  assert.match(massMessagesSource, /<TableContainer>/);
  assert.match(massMessagesSource, /<Table>/);
  assert.match(massMessagesSource, /<Badge/);
  assert.match(massMessagesSource, /<Button/);
  assert.match(massMessagesSource, /<SearchInput/);

  // Purchase composer components
  assert.match(purchaseComposerSource, /<PageHeader/);
  assert.match(purchaseComposerSource, /<Card/);
  assert.match(purchaseComposerSource, /<MetricCard/);
  assert.match(purchaseComposerSource, /<TableContainer>/);
  assert.match(purchaseComposerSource, /<Badge/);
  assert.match(purchaseComposerSource, /<Button/);
});

test("Phase 2E: Admin Purchase Analytics and Registrations consume shared design system components", () => {
  const purchaseAnalyticsSource = readFileSync(new URL("../src/app/admin/purchase-analytics/page.tsx", import.meta.url), "utf8");
  const registrationsSource = readFileSync(new URL("../src/app/admin/registrations/page.tsx", import.meta.url), "utf8");

  // Purchase Analytics UI components
  assert.match(purchaseAnalyticsSource, /<PageHeader/);
  assert.match(purchaseAnalyticsSource, /<FilterBar/);
  assert.match(purchaseAnalyticsSource, /<MetricCard/);
  assert.match(purchaseAnalyticsSource, /<Card/);
  assert.match(purchaseAnalyticsSource, /<TableContainer>/);
  assert.match(purchaseAnalyticsSource, /<Table>/);
  assert.match(purchaseAnalyticsSource, /<Badge/);
  assert.match(purchaseAnalyticsSource, /<Button/);

  // Registrations UI components
  assert.match(registrationsSource, /<PageHeader/);
  assert.match(registrationsSource, /<FilterBar/);
  assert.match(registrationsSource, /<Card/);
  assert.match(registrationsSource, /<TableContainer>/);
  assert.match(registrationsSource, /<Table>/);
  assert.match(registrationsSource, /<Badge/);
  assert.match(registrationsSource, /<Button/);
  assert.match(registrationsSource, /<SearchInput/);
});

test("Phase 2F: Classification Insights consumes shared design system components", () => {
  const classificationInsightsSource = readFileSync(new URL("../src/app/classification-insights/classification-insights-view.tsx", import.meta.url), "utf8");

  assert.match(classificationInsightsSource, /<PageHeader/);
  assert.match(classificationInsightsSource, /<MetricCard/);
  assert.match(classificationInsightsSource, /<Card/);
  assert.match(classificationInsightsSource, /<TableContainer>/);
  assert.match(classificationInsightsSource, /<Table>/);
  assert.match(classificationInsightsSource, /<Badge/);
  assert.match(classificationInsightsSource, /<Button/);
});

test("Phase 2G: TikTok Overview and Dashboard consume shared design system components", () => {
  const tiktokOverviewSource = readFileSync(new URL("../src/app/tiktok/tiktok-overview-view.tsx", import.meta.url), "utf8");
  const tiktokDashboardSource = readFileSync(new URL("../src/app/tiktok/dashboard/tiktok-dashboard-view.tsx", import.meta.url), "utf8");

  // TikTok Overview UI components
  assert.match(tiktokOverviewSource, /<PageHeader/);
  assert.match(tiktokOverviewSource, /<FilterBar/);
  assert.match(tiktokOverviewSource, /<MetricCard/);
  assert.match(tiktokOverviewSource, /<Card/);
  assert.match(tiktokOverviewSource, /<Badge/);
  assert.match(tiktokOverviewSource, /<Button/);
  assert.match(tiktokOverviewSource, /<SearchInput/);

  // TikTok Dashboard UI components
  assert.match(tiktokDashboardSource, /<PageHeader/);
  assert.match(tiktokDashboardSource, /<MetricCard/);
  assert.match(tiktokDashboardSource, /<Card/);
  assert.match(tiktokDashboardSource, /<TableContainer>/);
  assert.match(tiktokDashboardSource, /<Table>/);
  assert.match(tiktokDashboardSource, /<Badge/);
  assert.match(tiktokDashboardSource, /<Button/);
});

test("Phase 3: Unified Chat Inbox (/chats) consumes semantic tokens and responsive workspace structure", () => {
  const pageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  // Pane identifiers and structure
  assert.match(pageSource, /data-chat-pane="conversations"/);
  assert.match(pageSource, /data-chat-pane="detail"/);
  assert.match(pageSource, /data-conversation-row/);
  assert.match(pageSource, /data-chat-detail-header/);
  assert.match(pageSource, /data-chat-message-scroll/);
  assert.match(pageSource, /data-chat-reply-composer/);

  // Semantic tokens in chat panes
  assert.match(pageSource, /bg-\[var\(--app-surface\)\]/);
  assert.match(pageSource, /border-\[var\(--app-border\)\]/);
  assert.match(pageSource, /text-\[var\(--app-text-primary\)\]/);
  assert.match(pageSource, /text-\[var\(--app-text-secondary\)\]/);
  assert.match(pageSource, /bg-\[var\(--app-accent\)\]/);
});








