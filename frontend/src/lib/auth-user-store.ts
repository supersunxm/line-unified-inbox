import { useSyncExternalStore } from "react";
import type { AuthUser } from "./authorization";
import { AUTH_UNAUTHORIZED_EVENT } from "./auth-session.ts";

/**
 * In-memory cache of the signed-in user (`/auth/me`).
 *
 * This only decides what UI to draw. The backend still authenticates every
 * request, so a cached user can never widen data access. Nothing is persisted:
 * a hard reload always starts empty.
 *
 * Freshness (measured from the last successful fetch):
 * - under 60s: served as is;
 * - 60s to 5 min: served immediately, revalidated in the background;
 * - over 5 min or empty: callers wait for a new request.
 */
export const AUTH_USER_FRESH_MS = 60_000;
export const AUTH_USER_MAX_STALE_MS = 5 * 60_000;

export type AuthUserFreshness = "fresh" | "stale" | "expired" | "empty";

export type AuthUserSnapshot = {
  user: AuthUser | null;
  fetchedAt: number;
  /** Increments on every change, so gates can tell a refetched user from the one they mounted with. */
  version: number;
};

type Fetcher = () => Promise<AuthUser>;

function errorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error ? (error as { status?: unknown }).status : undefined;
}

export function createAuthUserStore({ now = () => Date.now() }: { now?: () => number } = {}) {
  let fetcher: Fetcher | null = null;
  let snapshot: AuthUserSnapshot = { user: null, fetchedAt: 0, version: 0 };
  let inflight: Promise<AuthUser> | null = null;
  // Bumped on invalidation so a request that started earlier cannot repopulate the cache.
  let generation = 0;
  let sessionSeen = false;
  const listeners = new Set<() => void>();

  const publish = (next: Omit<AuthUserSnapshot, "version">) => {
    snapshot = { ...next, version: snapshot.version + 1 };
    for (const listener of listeners) listener();
  };

  const store = {
    configure(nextFetcher: Fetcher) {
      fetcher = nextFetcher;
    },

    getSnapshot(): AuthUserSnapshot {
      return snapshot;
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    generation() {
      return generation;
    },

    /** True once this tab has seen a valid session; cleared only by logout. */
    hasSeenSession() {
      return sessionSeen;
    },

    freshness(): AuthUserFreshness {
      if (!snapshot.user) return "empty";
      const age = now() - snapshot.fetchedAt;
      if (age < AUTH_USER_FRESH_MS) return "fresh";
      if (age < AUTH_USER_MAX_STALE_MS) return "stale";
      return "expired";
    },

    /** The cached user if it may be rendered without waiting (fresh or stale), else null. */
    peekUsable(): AuthUser | null {
      const freshness = store.freshness();
      return freshness === "fresh" || freshness === "stale" ? snapshot.user : null;
    },

    /** Store a user returned by a request that started at `startedAtGeneration`. */
    seed(user: AuthUser, startedAtGeneration: number) {
      if (startedAtGeneration !== generation) return;
      sessionSeen = true;
      publish({ user, fetchedAt: now() });
    },

    /** Always asks the server; concurrent callers share one request. Keeps the cached user until it answers. */
    refresh(): Promise<AuthUser> {
      if (inflight) return inflight;
      if (!fetcher) return Promise.reject(new Error("Auth user store has no fetcher configured"));
      const startedAt = generation;
      const request = fetcher()
        .then((user) => {
          store.seed(user, startedAt);
          return user;
        })
        .catch((error: unknown) => {
          const status = errorStatus(error);
          // Only a request from the current generation may clear the cache; a late
          // failure from before a logout/login must not wipe the newer user.
          if ((status === 401 || status === 403) && startedAt === generation) store.invalidate();
          throw error;
        })
        .finally(() => {
          if (inflight === request) inflight = null;
        });
      inflight = request;
      return request;
    },

    /** Resolve the user for a gate, applying the freshness rules above. */
    get(): Promise<AuthUser> {
      const freshness = store.freshness();
      const user = snapshot.user;
      if (user && freshness === "fresh") return Promise.resolve(user);
      if (user && freshness === "stale") {
        // Background revalidation; a 401/403 clears the cache and the global listener redirects.
        store.refresh().catch(() => undefined);
        return Promise.resolve(user);
      }
      return store.refresh();
    },

    invalidate() {
      generation += 1;
      inflight = null;
      if (snapshot.user || snapshot.fetchedAt) publish({ user: null, fetchedAt: 0 });
    },

    /** Logout: forget the user and the fact that this tab had a session. */
    endSession() {
      sessionSeen = false;
      store.invalidate();
    },
  };

  return store;
}

export const authUserStore = createAuthUserStore();

let unauthorizedListenerAttached = false;
function attachUnauthorizedListener() {
  if (unauthorizedListenerAttached || typeof window === "undefined") return;
  unauthorizedListenerAttached = true;
  window.addEventListener(AUTH_UNAUTHORIZED_EVENT, () => authUserStore.invalidate());
}
attachUnauthorizedListener();

const serverSnapshot: AuthUserSnapshot = { user: null, fetchedAt: 0, version: 0 };

export function useAuthUserSnapshot(): AuthUserSnapshot {
  return useSyncExternalStore(authUserStore.subscribe, authUserStore.getSnapshot, () => serverSnapshot);
}

/** The cached user (any age), or null. Gates apply the freshness rules; display code can read this directly. */
export function useAuthUser(): AuthUser | null {
  return useAuthUserSnapshot().user;
}

export const getAuthUser = () => authUserStore.get();
export const refreshAuthUser = () => authUserStore.refresh();
export const invalidateAuthUser = () => authUserStore.invalidate();
