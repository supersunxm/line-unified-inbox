import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Leaving /dashboard by client-side navigation froze the renderer: the
// navigation commits in a transition, so passive-effect cleanups
// (observer.disconnect) were deferred while MutationObserver microtasks kept
// re-inserting nodes into the detached dashboard tree. These checks pin the
// two guards that stop that loop.

const executiveV2 = readFileSync(new URL("../src/app/dashboard/executive-dashboard-v2.tsx", import.meta.url), "utf8");
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

test("executive dashboard peer-panel observer is registered in a layout effect", () => {
  const effect = effectBlockAround(executiveV2, "new MutationObserver(attach)");
  assert.match(effect, /^useLayoutEffect\(/);
  assert.match(executiveV2, /observer\.disconnect\(\)/);
});

test("executive dashboard attach does nothing once the observed root is detached", () => {
  const attach = executiveV2.slice(
    executiveV2.indexOf("const attach = () => {"),
    executiveV2.indexOf("new MutationObserver(attach)"),
  );
  const guardIndex = attach.search(/if \(!root\.isConnected\) return;/);
  const insertIndex = attach.indexOf("insertAdjacentElement");
  assert.notEqual(guardIndex, -1);
  assert.ok(guardIndex < insertIndex, "root.isConnected guard must precede the insert");
  assert.match(attach, /!header\.isConnected\) return;/);
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
