import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");
const sidebarSource = readFileSync(new URL("../src/components/shell/app-sidebar.tsx", import.meta.url), "utf8");

test("TopNavigation renders destination links as native Next.js Link components", () => {
  const expectedRoutes = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Store Chats", href: "/chats" },
    { name: "Follower Insights", href: "/follower-insights" },
    { name: "Stores", href: "/stores" },
    { name: "BM Approval", href: "/admin/registrations" },
    { name: "Purchase Intelligence", href: "/admin/purchase-analytics" },
    { name: "Friend Source Links", href: "/friend-source-links" },
    { name: "Mass Message", href: "/mass-messages" },
  ];

  for (const item of expectedRoutes) {
    const linkRegex = new RegExp(`<Link[^>]+href="${item.href}"`);
    assert.match(
      topNavSource,
      linkRegex,
      `Expected <Link> with href="${item.href}" for ${item.name}`
    );
  }
});

test("TopNavigation layout prevents transparent search container from intercepting clicks", () => {
  // 1. ResponsiveSearch container must NOT have flex-1 / lg:flex-1
  assert.doesNotMatch(
    topNavSource,
    /ref=\{searchRef\}\s+className="[^"]*flex-1[^"]*"/,
    "ResponsiveSearch must not have flex-1 which causes transparent overlay"
  );
  assert.match(
    topNavSource,
    /ref=\{searchRef\}\s+className="relative shrink-0"/,
    "ResponsiveSearch must have shrink-0"
  );

  // The current header controls remain shrink-to-content beside the sidebar-backed header.
  assert.doesNotMatch(topNavSource, /lg:flex-1/, "header controls must not expand across navigation space");
  assert.match(topNavSource, /className="flex shrink-0 items-center justify-end gap-2"/);
});

test("secondary links are rendered in the current sidebar and mobile More menu", () => {
  assert.match(topNavSource, /aria-expanded=\{moreOpen\}/);
  for (const href of ["/stores", "/admin/purchase-analytics", "/friend-source-links", "/mass-messages"]) {
    assert.match(sidebarSource, new RegExp(`href: "${href}"`));
    assert.match(topNavSource, new RegExp(`href="${href}"`));
  }
});

test("TopNavigation accessibility: focus rings, ARIA roles, and keyboard handlers are intact", () => {
  // Focus ring definition
  assert.match(topNavSource, /focus-visible:ring-2/);
  assert.match(topNavSource, /focus-visible:ring-emerald-500\/40/);

  // Escape key closes menus
  assert.match(topNavSource, /event\.key === "Escape"/);

  // Sidebar navigation landmarks and active-page semantics
  assert.match(sidebarSource, /<nav className="space-y-1" aria-label=\{t\.workspace\}/);
  assert.match(sidebarSource, /aria-current=\{active \?/);
});
