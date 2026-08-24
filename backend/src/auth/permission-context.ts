import { UserRole } from "@prisma/client";

export type PermissionContextMembership = {
  storeId: string;
  role: string;
};

export type PermissionContextInput = {
  role: UserRole;
  canAccessMainOa?: boolean;
  canManageMainOa?: boolean;
  memberships?: PermissionContextMembership[];
};

export type PermissionContext = {
  version: 1;
  identity: {
    platformRole: UserRole;
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

/**
 * Stage 1 compatibility projection.
 *
 * This converts the current role/membership model into one normalized
 * authorization context without changing runtime access decisions yet.
 * Explicit persisted web/mobile/HQ grants are intentionally deferred to
 * Stage 2 so the rollout is backwards-compatible with existing users.
 */
export function buildPermissionContext(input: PermissionContextInput): PermissionContext {
  const memberships = input.memberships ?? [];
  const membershipRoles = [...new Set(memberships.map((membership) => membership.role))];
  const storeIds = [...new Set(memberships.map((membership) => membership.storeId))];
  const isAdmin = input.role === UserRole.ADMIN;
  const canAccessMainOa = input.canAccessMainOa ?? false;
  const canManageMainOa = input.canManageMainOa ?? false;

  return {
    version: 1,
    identity: {
      platformRole: input.role,
      membershipRoles,
    },
    // Preserve current behavior in Stage 1: any authenticated account may use
    // either client type. Stage 2 will make these explicit persisted grants.
    platforms: {
      web: true,
      mobile: true,
    },
    workspaces: {
      hq: isAdmin,
      store: storeIds.length > 0,
      mainOa: canAccessMainOa,
    },
    scope: {
      allStores: isAdmin,
      storeIds,
    },
    capabilities: {
      manageAccounts: isAdmin,
      reply: isAdmin || storeIds.length > 0,
      accessMainOa: canAccessMainOa,
      manageMainOa: canManageMainOa,
    },
  };
}
