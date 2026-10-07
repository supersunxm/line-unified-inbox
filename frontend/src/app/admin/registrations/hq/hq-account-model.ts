export type HqAccountRole = "ADMIN" | "ASSISTANT";

export type HqAccount = {
  id: string;
  role: HqAccountRole;
  displayName: string;
  employeeId: string | null;
  email: string;
  status: "ACTIVE" | "SUSPENDED";
  isActive: boolean;
  canAccessWeb: boolean;
  canAccessMobile: boolean;
  canAccessHq: boolean;
  canAccessAllStores: boolean;
  canManageAccounts: boolean;
  canReply: boolean;
  canAccessMainOa: boolean;
  canManageMainOa: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export function hqPermissionSummary(account: HqAccount) {
  const admin = account.role === "ADMIN";
  return [
    account.canAccessWeb && "Web",
    account.canAccessMobile && "Mobile",
    (admin || account.canAccessAllStores) && "All Stores",
    admin && "Account Management",
    (admin || account.canReply) && "Reply",
    account.canAccessMainOa && "Main OA",
    account.canAccessMainOa && account.canManageMainOa && "Main OA management",
    admin && "Export / Download",
  ].filter(Boolean).join(" · ");
}

/** A failed mutation never returns an account that the UI can render as saved. */
export async function saveHqAccountRole(account: HqAccount, role: HqAccountRole, mutate: (id: string, role: HqAccountRole) => Promise<{ role: HqAccountRole }>): Promise<HqAccount> {
  const persisted = await mutate(account.id, role);
  return { ...account, role: persisted.role, canManageAccounts: persisted.role === "ADMIN" };
}
