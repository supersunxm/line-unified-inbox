import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Leaving /dashboard by client-side navigation froze the renderer: the
// navigation commits in a transition, so passive-effect cleanups
// (observer.disconnect) were deferred while MutationObserver microtasks kept
// re-inserting nodes into the detached dashboard tree. These checks pin the
// two guards that stop that loop.

// The executive dashboard and its peer-panel portal (the first source of the freeze) were removed
// with the monthly dashboard rework (8 Oct 2026); the monthly dashboard renders no DOM observers.
const monthlyDashboard = readFileSync(new URL("../src/app/dashboard/monthly-dashboard.tsx", import.meta.url), "utf8");
const legacyBoundary = readFileSync(new URL("../src/app/legacy-i18n-boundary.tsx", import.meta.url), "utf8");

function effectBlockAround(source: string, marker: string) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `expected ${marker} in source`);
  const effectIndex = Math.max(
    source.lastIndexOf("useEffect(", markerIndex),
    source.lastIndexOf("useLayoutEffect(", markerIndex),
  );
  assert.notEqual(effectIndex, -1, `expected an effect enclosing ${marker}`);
  return source.slice(effectIndex, markerIndex);
}

test("the monthly dashboard has no DOM mutation observer or portal", () => {
  assert.doesNotMatch(monthlyDashboard, /MutationObserver|createPortal/);
});

test("legacy i18n boundary observer is registered in a layout effect", () => {
  const effect = effectBlockAround(legacyBoundary, "new MutationObserver(");
  assert.match(effect, /^useLayoutEffect\(/);
  assert.match(legacyBoundary, /observer\.disconnect\(\)/);
});

test("legacy i18n boundary skips DOM work once its root is detached", () => {
  assert.match(legacyBoundary, /const translateTree = \(node: Node\) => \{\s*if \(!root\.isConnected\) return;/);
  assert.match(legacyBoundary, /new MutationObserver\(\(mutations\) => \{\s*if \(!root\.isConnected\) return;/);
});
