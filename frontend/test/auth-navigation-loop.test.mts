import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getAuthState,
  resolveAuthRedirect,
  routeAfterLogin,
  shouldRedirectToLogin,
} from "../src/lib/auth-session.ts";
import { createAuthRewrite, createBackendRewrite } from "../next.config.ts";

test("getAuthState accurately maps loading, authenticated, and unauthenticated states", () => {
  // 1. Loading state when authChecked is false
  assert.equal(getAuthState(false, null), "loading");
  assert.equal(getAuthState(false, { id: "u-1" }), "loading");

  // 2. Authenticated state when authChecked is true and authUser exists
  assert.equal(getAuthState(true, { id: "u-1", email: "admin@oppo.th" }), "authenticated");

  // 3. Unauthenticated state when authChecked is true and authUser is null
  assert.equal(getAuthState(true, null), "unauthenticated");
  assert.equal(getAuthState(true, undefined), "unauthenticated");
});

test("resolveAuthRedirect enforces deterministic, loop-free redirect rules", () => {
  // 1. Loading state never triggers any redirect
  assert.equal(resolveAuthRedirect({ authState: "loading", pathname: "/login" }), null);
  assert.equal(resolveAuthRedirect({ authState: "loading", pathname: "/dashboard" }), null);
  assert.equal(resolveAuthRedirect({ authState: "loading", pathname: "/chats" }), null);
  assert.equal(resolveAuthRedirect({ authState: "loading", pathname: "/stores" }), null);

  // 2. Authenticated user on /login redirects once to the Main Workspace
  assert.equal(resolveAuthRedirect({ authState: "authenticated", pathname: "/login" }), "/home");

  // 3. Authenticated user on protected pages stays on the page (no redirect)
  assert.equal(resolveAuthRedirect({ authState: "authenticated", pathname: "/dashboard" }), null);
  assert.equal(resolveAuthRedirect({ authState: "authenticated", pathname: "/chats" }), null);
  assert.equal(resolveAuthRedirect({ authState: "authenticated", pathname: "/stores" }), null);

  // 4. Unauthenticated user on /login stays on /login to view the login form (no redirect)
  assert.equal(resolveAuthRedirect({ authState: "unauthenticated", pathname: "/login" }), null);

  // 5. Unauthenticated user on protected pages redirects to /login
  assert.equal(resolveAuthRedirect({ authState: "unauthenticated", pathname: "/dashboard" }), "/login");
  assert.equal(resolveAuthRedirect({ authState: "unauthenticated", pathname: "/chats" }), "/login");
  assert.equal(resolveAuthRedirect({ authState: "unauthenticated", pathname: "/stores" }), "/login");

  // 6. First admin setup required: unauthenticated user on protected route does not redirect to /login
  assert.equal(
    resolveAuthRedirect({
      authState: "unauthenticated",
      pathname: "/dashboard",
      firstAdminRequired: true,
    }),
    null,
  );
});

test("routeAfterLogin returns /home for /login and null otherwise", () => {
  assert.equal(routeAfterLogin("/login"), "/home");
  assert.equal(routeAfterLogin("/dashboard"), null);
  assert.equal(routeAfterLogin("/chats"), null);
});

test("shouldRedirectToLogin triggers only on 401 outside /login", () => {
  assert.equal(shouldRedirectToLogin(401, "/dashboard"), true);
  assert.equal(shouldRedirectToLogin(401, "/chats"), true);
  assert.equal(shouldRedirectToLogin(401, "/login"), false);
  assert.equal(shouldRedirectToLogin(200, "/dashboard"), false);
  assert.equal(shouldRedirectToLogin(403, "/dashboard"), false);
});

test("Next.js rewrite configuration includes same-origin backend and auth proxies", () => {
  const nextConfigCode = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

  // createBackendRewrite proxies /api-backend/* to API_BASE_URL/*
  const backendRewrite = createBackendRewrite("https://api.lineoppo.click");
  assert.equal(backendRewrite.source, "/api-backend/:path*");
  assert.equal(backendRewrite.destination, "https://api.lineoppo.click/:path*");

  // createAuthRewrite proxies /auth/* to API_BASE_URL/auth/*
  const authRewrite = createAuthRewrite("https://api.lineoppo.click");
  assert.equal(authRewrite.source, "/auth/:path*");
  assert.equal(authRewrite.destination, "https://api.lineoppo.click/auth/:path*");

  // next.config.ts incorporates both rewrites
  assert.match(nextConfigCode, /createBackendRewrite\(API_BASE_URL\)/);
  assert.match(nextConfigCode, /createAuthRewrite\(API_BASE_URL\)/);
});

test("api.ts uses same-origin proxy in browser to guarantee cookie transmission and prevent 401 loops", () => {
  const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");

  // In-browser requests route via same-origin rewrite (/auth/* or /api-backend/*)
  assert.match(apiCode, /path\.startsWith\("\/auth\/"\)\s*\?\s*path\s*:\s*`\/api-backend\$\{path\}`/);

  // /auth/me and /auth/setup-status enforce no-store and no-cache headers to prevent stale 304 responses
  assert.match(apiCode, /me:\s*\(\)\s*=>\s*request[\s\S]*?"\/auth\/me"[\s\S]*?cache:\s*"no-store"/);
  assert.match(apiCode, /setupStatus:\s*\(\)\s*=>\s*request[\s\S]*?"\/auth\/setup-status"[\s\S]*?cache:\s*"no-store"/);
});

test("ApplicationWorkspace implements single authority redirect logic without UI flicker or competing loops", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  // 1. Imports and uses resolveAuthRedirect and getAuthState
  assert.match(pageCode, /import\s*\{[^}]*getAuthState[^}]*resolveAuthRedirect[^}]*\}\s*from\s*"@\/lib\/auth-session"/);
  assert.match(pageCode, /const destination = resolveAuthRedirect/);

  // 2. submitLogin updates auth state and redirects cleanly if on /login
  assert.match(pageCode, /setAuthUser\(user\)/);
  assert.match(pageCode, /window\.location\.pathname === "\/login"[\s\S]*?window\.location\.replace\("\/dashboard"\)/);

  // 3. Render guards prevent dashboard UI leakage while on /login
  assert.match(pageCode, /window\.location\.pathname === "\/login"[\s\S]*?Redirecting to dashboard…/);

  // 4. Render guards prevent login form flashing while on protected route awaiting redirect
  assert.match(pageCode, /window\.location\.pathname !== "\/login"[\s\S]*?Redirecting to login…/);
});
