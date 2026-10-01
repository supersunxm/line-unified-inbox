"use client";

import { useEffect } from "react";
import { AUTH_UNAUTHORIZED_EVENT, redirectToLogin, shouldRedirectOnUnauthorized } from "@/lib/auth-session";
import { authUserStore } from "@/lib/auth-user-store";

/**
 * One app-wide handler for a session that expires or is revoked mid-use.
 *
 * Pages that already handle AUTH_UNAUTHORIZED_EVENT keep doing so; this runs a
 * tick later and `redirectToLogin` is a no-op once any redirect has started,
 * so there is never a second navigation. Signed-out visitors on public pages
 * are never redirected.
 */
export function AuthUnauthorizedListener() {
  useEffect(() => {
    let timer = 0;
    const handleUnauthorized = () => {
      const hadSession = authUserStore.hasSeenSession();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (shouldRedirectOnUnauthorized(window.location.pathname, hadSession)) redirectToLogin();
      }, 0);
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  return null;
}
