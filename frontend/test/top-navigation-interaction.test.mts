import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("TopNavigation renders all 8 destination links as native Next.js Link components", () => {
  const expectedRoutes = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Store Chats", href: "/chats" },
    { name: "Stores", href: "/stores" },
    { name: "BM Approval", href: "/admin/registrations" },
    { name: "Classification Insights", href: "/classification-insights" },
    { name: "Follower Insights", href: "/follower-insights" },
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

  // 2. app-header-controls must use shrink-0 and ml-auto instead of lg:flex-1
  assert.doesNotMatch(
    topNavSource,
    /className="app-header-controls[^"]*lg:flex-1[^"]*"/,
    "app-header-controls must not have lg:flex-1 which splits header 50/50"
  );
  assert.match(
    topNavSource,
    /className="app-header-controls flex shrink-0 items-center justify-end gap-2 ml-auto"/,
    "app-header-controls must have shrink-0 and ml-auto"
  );
});

test("TopNavigation secondary links are rendered inline at 2xl and inside More dropdown below 2xl", () => {
  // Inline container at 2xl
  assert.match(topNavSource, /<div className="hidden items-center gap-0\.5 2xl:flex">/);

  // Dropdown for below 2xl
  assert.match(topNavSource, /<div ref=\{menuRef\} className="relative 2xl:hidden">/);

  // More menu contains secondary items
  for (const href of ["/classification-insights", "/follower-insights", "/friend-source-links", "/mass-messages"]) {
    const secondaryRegex = new RegExp(`role="menuitem"\\s+href="${href}"`);
    assert.match(topNavSource, secondaryRegex);
  }
});

test("TopNavigation accessibility: focus rings, ARIA roles, and keyboard handlers are intact", () => {
  // Focus ring definition
  assert.match(topNavSource, /focus-visible:ring-2/);
  assert.match(topNavSource, /focus-visible:ring-emerald-500\/40/);

  // ARIA current for active page
  assert.match(topNavSource, /aria-current=\{currentSection === "[a-z-]+"\s*\?\s*"page"\s*:\s*undefined\}/);

  // Escape key closes menus
  assert.match(topNavSource, /event\.key === "Escape"/);

  // Primary navigation landmark
  assert.match(topNavSource, /<nav aria-label="Primary navigation"/);
});
