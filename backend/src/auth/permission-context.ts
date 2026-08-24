import { UserRole } from "@prisma/client";

export type PermissionContextMembership = {
  storeId: string;
  role: string;
};

export type PermissionContextInput = {
  role: UserRole;
  canAccessWeb?: boolean;
  canAccessMobile?: boolean;
  canAccessHq?: boolean;
  canAccessAllStores?: boolean;
  canManageAccounts?: boolean;
  canReply?: boolean;
  canAccessMainOa?: boolean;
  canManageMainOa?: boolean;
  memberships?: PermissionContextMembership[];
};

export type PermissionContext = {
  version: 2;
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
 * Stage 2 authorization projection.
 *
 * Platform/workspace/capability grants are persisted on User. Optional-input
 * fallbacks preserve compatibility for tests, old fixtures, and rollout code
 * that has not yet supplied the new columns. ADMIN remains the super-admin
 * security role and therefore retains HQ/all-store/account-management access.
 */
export function buildPermissionContext(input: PermissionContextInput): PermissionContext {
  const memberships = input.memberships ?? [];
  const membershipRoles = [...new Set(memberships.map((membership) => membership.role))];
  const storeIds = [...new Set(memberships.map((membership) => membership.storeId))];
  const isAdmin = input.role === UserRole.ADMIN;

  const canAccessWeb = input.canAccessWeb ?? true;
  const canAccessMobile = input.canAccessMobile ?? true;
  const canAccessHq = isAdmin || (input.canAccessHq ?? false);
  const canAccessAllStores = isAdmin || (input.canAccessAllStores ?? false);
  const canManageAccounts = isAdmin || (input.canManageAccounts ?? false);
  const canReply = isAdmin || (input.canReply ?? storeIds.length > 0);
  const canAccessMainOa = input.canAccessMainOa ?? false;
  const canManageMainOa = canAccessMainOa && (input.canManageMainOa ?? false);

  return {
    version: 2,
    identity: {
      platformRole: input.role,
      membershipRoles,
    },
    platforms: {
      web: canAccessWeb,
      mobile: canAccessMobile,
    },
    workspaces: {
      hq: canAccessHq,
      store: storeIds.length > 0,
      mainOa: canAccessMainOa,
    },
    scope: {
      allStores: canAccessAllStores,
      storeIds,
    },
    capabilities: {
      manageAccounts: canManageAccounts,
      reply: canReply,
      accessMainOa: canAccessMainOa,
      manageMainOa: canManageMainOa,
    },
  };
}

export function hasWorkspaceAccess(context: PermissionContext) {
  return context.workspaces.hq || context.workspaces.store || context.workspaces.mainOa || context.scope.allStores;
}
