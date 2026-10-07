export const AUTH_UNAUTHORIZED_EVENT = "oppo-line-oa:unauthorized";
export const PASSWORD_CHANGE_REQUIRED_CODE = "PASSWORD_CHANGE_REQUIRED";

export type AuthState = "loading" | "authenticated" | "unauthenticated";

export function getAuthState(authChecked: boolean, authUser: unknown): AuthState {
  if (!authChecked) return "loading";
  return authUser ? "authenticated" : "unauthenticated";
}

export function shouldRedirectToLogin(status: number, pathname: string) {
  return status === 401 && pathname !== "/login";
}

export function shouldRedirectToPasswordChange(status: number, code: string | undefined, pathname: string) {
  return status === 403 && code === PASSWORD_CHANGE_REQUIRED_CODE && pathname !== "/change-password";
}

export function routeAfterLogin(pathname: string) {
  return pathname === "/login" ? "/home" : null;
}

export function resolveAuthRedirect({
  authState,
  pathname,
  firstAdminRequired = false,
}: {
  authState: AuthState;
  pathname: string;
  firstAdminRequired?: boolean;
}): string | null {
  if (authState === "loading") return null;

  if (authState === "authenticated") {
    return pathname === "/login" ? "/home" : null;
  }

  if (firstAdminRequired) return null;

  if (pathname !== "/login") return "/login";

  return null;
}

// Routes anyone may view signed out. A 401 there must never bounce the visitor to /login.
const PUBLIC_PATH_PREFIXES = ["/login", "/change-password", "/register", "/privacy", "/terms", "/download", "/stores", "/store-locator", "/friend-attribution", "/f/"];

export function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * The global 401 listener redirects only when this tab previously had a valid
 * session (so it expired or was revoked mid-use) and the page is not public.
 */
export function shouldRedirectOnUnauthorized(pathname: string, hadSession: boolean) {
  return hadSession && !isPublicPath(pathname);
}

let loginRedirectStarted = false;
let passwordChangeRedirectStarted = false;

/** Record that a redirect to /login is under way, so other listeners do not start a second one. */
export function beginLoginRedirect() {
  loginRedirectStarted = true;
}

export function isLoginRedirectStarted() {
  return loginRedirectStarted;
}

/** Redirect to /login at most once per page lifetime. */
export function redirectToLogin() {
  if (loginRedirectStarted || typeof window === "undefined" || window.location.pathname === "/login") return;
  beginLoginRedirect();
  window.location.replace("/login");
}

/** Redirect a forced-password-change session to the only route the backend allows for recovery. */
export function redirectToPasswordChange() {
  if (passwordChangeRedirectStarted || typeof window === "undefined" || window.location.pathname === "/change-password") return;
  passwordChangeRedirectStarted = true;
  window.location.replace("/change-password");
}
