import { hqPermissionSummaryLabels } from "./hq-registrations-i18n.ts";
import type { AppLanguage } from "../../../language-utils.ts";

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

export function hqPermissionSummary(account: HqAccount, language: AppLanguage = "en") {
  const labels = hqPermissionSummaryLabels[language];
  const admin = account.role === "ADMIN";
  return [
    account.canAccessWeb && labels.web,
    account.canAccessMobile && labels.mobile,
    (admin || account.canAccessAllStores) && labels.allStores,
    admin && labels.accountManagement,
    (admin || account.canReply) && labels.reply,
    account.canAccessMainOa && labels.mainOa,
    account.canAccessMainOa && account.canManageMainOa && labels.manageMainOa,
    admin && labels.export,
  ].filter(Boolean).join(" · ");
}

/** A failed mutation never returns an account that the UI can render as saved. */
export async function saveHqAccountRole(account: HqAccount, role: HqAccountRole, mutate: (id: string, role: HqAccountRole) => Promise<{ role: HqAccountRole }>): Promise<HqAccount> {
  const persisted = await mutate(account.id, role);
  return { ...account, role: persisted.role, canManageAccounts: persisted.role === "ADMIN" };
}
