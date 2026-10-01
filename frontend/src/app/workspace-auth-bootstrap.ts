// How ApplicationWorkspace starts its auth state. Kept free of React so node --test can import it.

export type WorkspaceAuthBootstrap<User> = {
  authUser: User | null;
  authChecked: boolean;
  /** Whether to call /auth/setup-status and then /auth/me on mount. */
  runSetupCheck: boolean;
};

/**
 * Inside AuthorizedSection the gate has already resolved the signed-in user, and
 * a valid session proves the first administrator exists. So the workspace starts
 * signed in and checked, with no /auth/setup-status or /auth/me call.
 * Without a user (the /login first-admin path) it runs the full setup check.
 */
export function initialWorkspaceAuth<User>(initialAuthUser: User | null | undefined): WorkspaceAuthBootstrap<User> {
  if (initialAuthUser) return { authUser: initialAuthUser, authChecked: true, runSetupCheck: false };
  return { authUser: null, authChecked: false, runSetupCheck: true };
}
