import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AUTH_USER_FRESH_MS,
  AUTH_USER_MAX_STALE_MS,
  createAuthUserStore,
} from "../src/lib/auth-user-store.ts";
import {
  AUTH_UNAUTHORIZED_EVENT,
  isPublicPath,
  shouldRedirectOnUnauthorized,
} from "../src/lib/auth-session.ts";

type TestUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };

const userA: TestUser = { id: "u-a", email: "a@oppo.th", displayName: "A", role: "ADMIN" };
const userB: TestUser = { id: "u-b", email: "b@oppo.th", displayName: "B", role: "VIEWER" };

class StatusError extends Error {
  status: number;
  constructor(status: number) {
    super(`status ${status}`);
    this.status = status;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function harness() {
  let clock = 1_000_000;
  const store = createAuthUserStore({ now: () => clock });
  const calls: Array<ReturnType<typeof deferred<TestUser>>> = [];
  store.configure(() => {
    const call = deferred<TestUser>();
    calls.push(call);
    return call.promise as never;
  });
  return {
    store,
    calls,
    advance: (ms: number) => { clock += ms; },
    flush: () => new Promise((resolve) => setImmediate(resolve)),
  };
}

async function primed(user: TestUser = userA) {
  const h = harness();
  const pending = h.store.get();
  h.calls[0].resolve(user);
  await pending;
  return h;
}

test("concurrent callers share a single /auth/me request", async () => {
  const h = harness();
  const first = h.store.get();
  const second = h.store.get();
  const third = h.store.refresh();
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve(userA);
  assert.deepEqual(await Promise.all([first, second, third]), [userA, userA, userA]);
  assert.equal(h.store.getSnapshot().user, userA);
});

test("under 60s the cached user is served without a request", async () => {
  const h = await primed();
  h.advance(AUTH_USER_FRESH_MS - 1);
  assert.equal(h.store.freshness(), "fresh");
  assert.equal(await h.store.get(), userA);
  assert.equal(h.calls.length, 1);
});

test("between 60s and 5 min the cached user is served and revalidated once in the background", async () => {
  const h = await primed();
  h.advance(AUTH_USER_FRESH_MS);
  assert.equal(h.store.freshness(), "stale");
  assert.equal(h.store.peekUsable(), userA);
  assert.equal(await h.store.get(), userA);
  assert.equal(await h.store.get(), userA);
  assert.equal(h.calls.length, 2, "exactly one background request");
  h.calls[1].resolve(userB);
  await h.flush();
  assert.equal(h.store.getSnapshot().user, userB);
  assert.equal(h.store.freshness(), "fresh");
});

test("over 5 min callers wait for a new request", async () => {
  const h = await primed();
  h.advance(AUTH_USER_MAX_STALE_MS);
  assert.equal(h.store.freshness(), "expired");
  assert.equal(h.store.peekUsable(), null);
  let settled = false;
  const pending = h.store.get().then((user) => { settled = true; return user; });
  await h.flush();
  assert.equal(settled, false, "must not resolve from the expired cache");
  h.calls[1].resolve(userB);
  assert.equal(await pending, userB);
});

test("a 401 from /auth/me clears the cache and is never served from it", async () => {
  const h = await primed();
  h.advance(AUTH_USER_MAX_STALE_MS);
  const pending = h.store.get();
  h.calls[1].reject(new StatusError(401));
  await assert.rejects(pending, (error: StatusError) => error.status === 401);
  assert.equal(h.store.getSnapshot().user, null);
  assert.equal(h.store.freshness(), "empty");
  const next = h.store.get();
  assert.equal(h.calls.length, 3, "the next caller asks the server again");
  h.calls[2].reject(new StatusError(401));
  await assert.rejects(next);
});

test("a 401 during background revalidation clears the stale user", async () => {
  const h = await primed();
  h.advance(AUTH_USER_FRESH_MS + 1);
  assert.equal(await h.store.get(), userA);
  h.calls[1].reject(new StatusError(401));
  await h.flush();
  assert.equal(h.store.getSnapshot().user, null);
  assert.equal(h.store.peekUsable(), null);
});

test("a 403 from /auth/me clears the cache", async () => {
  const h = await primed();
  const pending = h.store.refresh();
  h.calls[1].reject(new StatusError(403));
  await assert.rejects(pending);
  assert.equal(h.store.getSnapshot().user, null);
});

test("a network or server error does not clear a valid cached user", async () => {
  const h = await primed();
  const pending = h.store.refresh();
  h.calls[1].reject(new StatusError(0));
  await assert.rejects(pending);
  assert.equal(h.store.getSnapshot().user, userA);
});

test("manual refresh keeps the cached user until the server answers", async () => {
  const h = await primed();
  const pending = h.store.refresh();
  assert.equal(h.calls.length, 2, "refresh always asks the server, even when fresh");
  assert.equal(h.store.getSnapshot().user, userA);
  h.calls[1].resolve(userB);
  assert.equal(await pending, userB);
  assert.equal(h.store.getSnapshot().user, userB);
});

test("invalidate drops the user and ignores a request that was already in flight", async () => {
  const h = await primed();
  const pending = h.store.refresh();
  h.store.invalidate();
  assert.equal(h.store.getSnapshot().user, null);
  h.calls[1].resolve(userB);
  await pending;
  assert.equal(h.store.getSnapshot().user, null, "pre-invalidation response must not repopulate the cache");
});

test("seed only applies when no invalidation happened since the request started", async () => {
  const h = harness();
  const startedAt = h.store.generation();
  h.store.invalidate();
  h.store.seed(userA as never, startedAt);
  assert.equal(h.store.getSnapshot().user, null);
  h.store.seed(userB as never, h.store.generation());
  assert.equal(h.store.getSnapshot().user, userB);
  assert.equal(h.store.hasSeenSession(), true);
});

test("endSession (logout) clears the user and the seen-session flag", async () => {
  const h = await primed();
  assert.equal(h.store.hasSeenSession(), true);
  h.store.endSession();
  assert.equal(h.store.getSnapshot().user, null);
  assert.equal(h.store.hasSeenSession(), false);
});

test("the version changes on every update so gates can tell a refetched user apart", async () => {
  const h = await primed();
  const before = h.store.getSnapshot().version;
  const pending = h.store.refresh();
  h.calls[1].resolve(userA);
  await pending;
  assert.ok(h.store.getSnapshot().version > before);
});

test("AUTH_UNAUTHORIZED_EVENT anywhere in the app invalidates the shared store", async () => {
  const fakeWindow = new EventTarget();
  (globalThis as { window?: unknown }).window = fakeWindow;
  try {
    const { authUserStore } = await import(`../src/lib/auth-user-store.ts?unauthorized-${Date.now()}`);
    authUserStore.seed(userA, authUserStore.generation());
    assert.equal(authUserStore.getSnapshot().user, userA);
    fakeWindow.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    assert.equal(authUserStore.getSnapshot().user, null);
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test("the global 401 redirect only fires for an expired session on a protected page", () => {
  assert.equal(shouldRedirectOnUnauthorized("/chats", true), true);
  assert.equal(shouldRedirectOnUnauthorized("/dashboard/message-traffic", true), true);
  assert.equal(shouldRedirectOnUnauthorized("/storemanagement", true), true);
  assert.equal(shouldRedirectOnUnauthorized("/download-center", true), true);
  assert.equal(shouldRedirectOnUnauthorized("/chats", false), false, "never seen a session: leave the page alone");
  for (const publicPath of ["/", "/login", "/change-password", "/register", "/privacy", "/terms", "/download", "/download/history", "/stores", "/stores/profile", "/store-locator", "/friend-attribution", "/f/abc"]) {
    assert.equal(isPublicPath(publicPath), true, publicPath);
    assert.equal(shouldRedirectOnUnauthorized(publicPath, true), false, publicPath);
  }
});

test("redirectToLogin navigates at most once", async () => {
  const replaced: string[] = [];
  (globalThis as { window?: unknown }).window = { location: { pathname: "/chats", replace: (url: string) => replaced.push(url) } };
  try {
    const session = await import(`../src/lib/auth-session.ts?redirect-${Date.now()}`);
    session.redirectToLogin();
    session.redirectToLogin();
    assert.deepEqual(replaced, ["/login"]);
    assert.equal(session.isLoginRedirectStarted(), true);
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test("redirectToLogin is a no-op once another handler has begun the redirect", async () => {
  const replaced: string[] = [];
  (globalThis as { window?: unknown }).window = { location: { pathname: "/chats", replace: (url: string) => replaced.push(url) } };
  try {
    const session = await import(`../src/lib/auth-session.ts?begun-${Date.now()}`);
    session.beginLoginRedirect();
    session.redirectToLogin();
    assert.deepEqual(replaced, []);
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const gateCode = readFileSync(new URL("../src/app/authorized-workspace.tsx", import.meta.url), "utf8");
const layoutCode = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const shellCode = readFileSync(new URL("../src/components/shell/app-shell.tsx", import.meta.url), "utf8");

test("session-changing API calls reset the cache inside api.ts, not at call sites", () => {
  assert.match(apiCode, /login: \([^)]*\) => withAuthUserReset\(/);
  assert.match(apiCode, /verifySetupOtp: \([^)]*\) => withAuthUserReset\(/);
  assert.match(apiCode, /logout: \(\) => withAuthUserReset\([\s\S]*?\{ endSession: true \}\)/);
  assert.match(apiCode, /changePassword: \([^)]*\) => withAuthUserReset\(/);
  assert.match(apiCode, /reset\(\);\s*try \{\s*return await run\(\);\s*\} finally \{\s*reset\(\);/);
  assert.match(apiCode, /"\/auth\/me"[\s\S]*?\)\.then\(seedAuthUserStore\(authUserStore\.generation\(\)\)\)/);
  assert.match(apiCode, /authUserStore\.configure\(\(\) =>\s*request<AuthUser>\("\/auth\/me"/);
});

test("manual refresh in the app shell re-checks the signed-in user", () => {
  assert.match(shellCode, /refreshAuthUser\(\)\.catch\(\(\) => undefined\);\s*void loadApplicationData\(\);/);
});

test("the root layout mounts exactly one global 401 listener", () => {
  assert.equal(layoutCode.match(/<AuthUnauthorizedListener \/>/g)?.length, 1);
});

test("the workspace 401 handler goes through the once-only redirect", () => {
  assert.match(pageCode, /setLoginPassword\(""\);\s*redirectToLogin\(\);/);
});

test("AuthorizedSection reads the shared store and blocks on a skeleton, never fetching /auth/me itself", () => {
  assert.doesNotMatch(gateCode, /api\.me\(/);
  assert.match(gateCode, /getAuthUser\(\)/);
  assert.match(gateCode, /authUserStore\.peekUsable\(\)/);
  assert.match(gateCode, /<ShellSkeleton placeholders=\{showSkeleton\}>\s*\{showSkeleton && <WorkspaceSkeleton label=\{t\.checking\} \/>\}/);
  assert.match(gateCode, /beginLoginRedirect\(\);\s*window\.location\.replace\("\/login"\);/);
  // Children (and therefore every data fetch) only render once an allowed user exists.
  assert.match(gateCode, /const allowed = user !== null && canAccessPrimarySection\(user, section\);/);
  assert.match(gateCode, /if \(!allowed \|\| showSkeleton\) \{[\s\S]*?<ShellSkeleton placeholders=\{showSkeleton\}>/);
  assert.match(gateCode, /<AuthorizedUserContext\.Provider value=\{user\}>\{children\}<\/AuthorizedUserContext\.Provider>/);
});
