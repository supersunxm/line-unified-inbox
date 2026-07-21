export const AUTH_UNAUTHORIZED_EVENT = "oppo-line-oa:unauthorized";

export function shouldRedirectToLogin(status: number, pathname: string) {
  return status === 401 && pathname !== "/login";
}

export function routeAfterLogin(pathname: string) {
  return pathname === "/login" ? "/dashboard" : null;
}
