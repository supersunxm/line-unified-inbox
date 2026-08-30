export type ConversationOwnerRecord = {
  id: string;
  displayName: string;
  isActive?: boolean;
  status?: string;
  role?: string;
  canAccessAllStores?: boolean;
  memberships?: Array<{ storeId: string }>;
} | null | undefined;

/**
 * Only expose an owner while the account is active and still has an active
 * membership to the conversation's store. This keeps stale owner relations
 * from leaking after deactivation or store access removal.
 */
export function serializeConversationOwner(owner: ConversationOwnerRecord, storeId: string | null | undefined) {
  if (!owner || !storeId || owner.isActive === false || (owner.status && owner.status !== "ACTIVE")) return null;
  const hasGlobalStoreAccess = owner.role === "ADMIN" || owner.canAccessAllStores === true;
  if (!hasGlobalStoreAccess && !owner.memberships?.some((membership) => membership.storeId === storeId)) return null;
  const displayName = owner.displayName?.trim();
  if (!displayName) return null;
  return { id: owner.id, displayName };
}
