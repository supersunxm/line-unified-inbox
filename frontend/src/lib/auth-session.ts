export const AUTH_UNAUTHORIZED_EVENT = "oppo-line-oa:unauthorized";

export type AuthState = "loading" | "authenticated" | "unauthenticated";

export function getAuthState(authChecked: boolean, authUser: unknown): AuthState {
  if (!authChecked) return "loading";
  return authUser ? "authenticated" : "unauthenticated";
}

export function shouldRedirectToLogin(status: number, pathname: string) {
  return status === 401 && pathname !== "/login";
}

export function routeAfterLogin(pathname: string) {
  return pathname === "/login" ? "/dashboard" : null;
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
  // Never redirect while auth is still loading
  if (authState === "loading") {
    return null;
  }

  // Authenticated user visiting /login redirects to /dashboard
  if (authState === "authenticated") {
    return pathname === "/login" ? "/dashboard" : null;
  }

  // Unauthenticated user: if first admin setup required, do not redirect to /login
  if (firstAdminRequired) {
    return null;
  }

  // Unauthenticated user visiting a protected route redirects to /login
  if (pathname !== "/login") {
    return "/login";
  }

  return null;
}

