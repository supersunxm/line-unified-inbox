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
