import type { PrimarySection } from "@/app/primary-navigation";

export type AuthorizationContext = {
  version: number;
  identity: {
    platformRole: "ADMIN" | "VIEWER";
    membershipRoles: string[];
  };
  platforms: {
    web: boolean;
    mobile: boolean;
  };
  workspaces: {
    hq: boolean;
    store: boolean;
    mainOa: boolean;
  };
  scope: {
    allStores: boolean;
    storeIds: string[];
  };
  capabilities: {
    manageAccounts: boolean;
    reply: boolean;
    accessMainOa: boolean;
    manageMainOa: boolean;
  };
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: "ADMIN" | "VIEWER";
  memberships?: Array<{ storeId: string; role: string }>;
  authorization?: AuthorizationContext;
  permissions?: {
    canAccessAllStores?: boolean;
    canReply?: boolean;
    canAccessMainOa?: boolean;
    canManageMainOa?: boolean;
    canManageAccounts?: boolean;
    platforms?: AuthorizationContext["platforms"];
    workspaces?: AuthorizationContext["workspaces"];
    scope?: AuthorizationContext["scope"];
    capabilities?: AuthorizationContext["capabilities"];
  };
};

function unique(values: string[]) {
  return [...new Set(values)];
}

/**
 * Stage 3 client compatibility adapter.
 *
 * Stage 2 responses include `authorization`, but this fallback keeps an older
 * cached/session response usable during a rolling deployment. Client UI must
 * consume this normalized context rather than scattered role checks.
 */
export function authorizationFor(user: AuthUser): AuthorizationContext {
  if (user.authorization) return user.authorization;

  const storeIds = unique((user.memberships ?? []).map((membership) => membership.storeId));
  const membershipRoles = unique((user.memberships ?? []).map((membership) => membership.role));
  const isAdmin = user.role === "ADMIN";
  const nested = user.permissions;
  const workspaces = nested?.workspaces ?? {
    hq: isAdmin,
    store: storeIds.length > 0,
    mainOa: nested?.canAccessMainOa ?? false,
  };
  const scope = nested?.scope ?? {
    allStores: nested?.canAccessAllStores ?? isAdmin,
    storeIds,
  };
  const capabilities = nested?.capabilities ?? {
    manageAccounts: nested?.canManageAccounts ?? isAdmin,
    reply: nested?.canReply ?? (isAdmin || storeIds.length > 0),
    accessMainOa: nested?.canAccessMainOa ?? false,
    manageMainOa: nested?.canManageMainOa ?? false,
  };

  return {
    version: 1,
    identity: { platformRole: user.role, membershipRoles },
    platforms: nested?.platforms ?? { web: true, mobile: true },
    workspaces,
    scope,
    capabilities,
  };
}

function hasBackendAdminAccess(auth: AuthorizationContext) {
  // These features are still protected by @Roles(ADMIN) on the backend.
  // Keep that policy centralized here until the backend exposes dedicated
  // capabilities for them; do not let individual UI components re-invent it.
  return auth.workspaces.hq && auth.identity.platformRole === "ADMIN";
}

export function canAccessPrimarySection(user: AuthUser, section: PrimarySection) {
  const auth = authorizationFor(user);
  switch (section) {
    case "home":
    case "dashboard":
      return auth.workspaces.hq;
    case "stores":
    case "purchase-analytics":
      return auth.workspaces.hq || auth.workspaces.store;
    case "friend-source-links":
    case "mass-messages":
    case "coupons":
    case "rich-menus":
    case "auto-responses":
    case "greeting-messages":
      return hasBackendAdminAccess(auth);
    case "google-review-kpi":
      return auth.workspaces.hq || auth.workspaces.store;
    case "admin-registrations":
      return hasBackendAdminAccess(auth) && auth.capabilities.manageAccounts;
    case "line-chat-health":
      return hasBackendAdminAccess(auth);
    case "chats":
      return auth.workspaces.store || auth.scope.allStores;
    case "follower-insights":
      return auth.workspaces.hq || auth.workspaces.store;
    case "main-oa":
      return auth.workspaces.mainOa && auth.capabilities.accessMainOa;
  }
}

export function canAccessWebTool(user: AuthUser, tool: "message-traffic" | "tiktok") {
  const auth = authorizationFor(user);
  if (tool === "message-traffic") return auth.workspaces.hq;
  if (tool === "tiktok") return hasBackendAdminAccess(auth);
  return false;
}

export function defaultRouteForUser(user: AuthUser) {
  const auth = authorizationFor(user);
  if (auth.workspaces.hq) return "/home";
  if (auth.workspaces.store) return "/chats";
  if (auth.workspaces.mainOa && auth.capabilities.accessMainOa) return "/main-oa";
  return "/login";
}

export function workspaceLabel(user: AuthUser) {
  const auth = authorizationFor(user);
  const labels: string[] = [];
  if (auth.workspaces.hq) labels.push("HQ");
  if (auth.workspaces.store) labels.push("Store");
  if (auth.workspaces.mainOa) labels.push("Main OA");
  return labels.join(" + ") || "No workspace";
}
