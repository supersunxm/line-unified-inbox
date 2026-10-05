import { createHash } from "node:crypto";

export const MIRROR_IDENTITY_PROOF_VERSION = "live-mirror-identity-v1";
export const MIRROR_IDENTITY_PROVENANCE = "LIVE_MIRROR_RECONCILED";
export const BRIDGE_CLASSES = ["ALREADY_LINKED", "SAFE_BRIDGE_CANDIDATE", "MULTIPLE_MANAGER_IDS_FOR_CONVERSATION", "MULTIPLE_CONVERSATIONS_FOR_MANAGER_ID", "EXISTING_MAPPING_CONFLICT", "INSUFFICIENT_RECONCILIATION_EVIDENCE", "NO_MIRROR_BRIDGE_EVIDENCE"] as const;
export type BridgeClass = typeof BRIDGE_CLASSES[number];
export type BridgeConversation = { id: string; storeId: string | null; lineOfficialAccountId: string; lineChatUserId: string | null; lineChatMappingSource: string | null; lineChatMappedAt: Date | null; lineChatMappedById: string | null; latestMessageAt: Date };
export type BridgeGroup = { lineOfficialAccountId: string; lineChatUserId: string; canonicalConversationId: string | null; rowCount: number; proofs: string[]; invalidScope: boolean };
export type BridgeRow = { lineOfficialAccountId: string; lineChatUserId: string | null; canonicalConversationId: string | null; storeId: string | null; classification: BridgeClass; reason: string; proofIds: string[]; proofDigest: string; previousLineChatUserId: string | null; previousMappingSource: string | null; previousMappedAt: string | null; previousMappedById: string | null; activityAt: string | null };
export function bridgeHash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
export function classifyMirrorBridge(groups: readonly BridgeGroup[], conversations: readonly BridgeConversation[], eligibleOaIds: readonly string[]): BridgeRow[] {
  const eligible = new Set(eligibleOaIds);
  const byChat = new Map<string, BridgeGroup[]>();
  const byConversation = new Map<string, Set<string>>();
  for (const g of groups) {
    const key = `${g.lineOfficialAccountId}:${g.lineChatUserId}`;
    byChat.set(key, [...(byChat.get(key) ?? []), g]);
    if (g.canonicalConversationId) {
      const identities = byConversation.get(g.canonicalConversationId) ?? new Set<string>();
      identities.add(key); byConversation.set(g.canonicalConversationId, identities);
    }
  }
  const indexed = new Map(conversations.map(c => [c.id, c]));
  const owners = new Map<string, string[]>();
  for (const c of conversations) if (c.lineChatUserId !== null) {
    const key = `${c.lineOfficialAccountId}:${c.lineChatUserId}`;
    owners.set(key, [...(owners.get(key) ?? []), c.id]);
  }
  const rows: BridgeRow[] = [];
  for (const [key, evidence] of byChat) {
    const first = evidence[0];
    if (!eligible.has(first.lineOfficialAccountId)) continue;
    const destinations = [...new Set(evidence.map(g => g.canonicalConversationId).filter((id): id is string => id !== null))];
    const c = destinations.length === 1 ? indexed.get(destinations[0]) : undefined;
    const proofIds = evidence.flatMap(g => g.proofs).sort();
    let classification: BridgeClass;
    let reason: string;
    if (destinations.length > 1) { classification = "MULTIPLE_CONVERSATIONS_FOR_MANAGER_ID"; reason = "COMPETING_CANONICAL_DESTINATIONS"; }
    else if (c && (byConversation.get(c.id)?.size ?? 0) > 1) { classification = "MULTIPLE_MANAGER_IDS_FOR_CONVERSATION"; reason = "COMPETING_MANAGER_IDENTITIES"; }
    else if (!c || proofIds.length === 0 || evidence.some(g => g.invalidScope) || c.lineOfficialAccountId !== first.lineOfficialAccountId || !c.storeId || !/^U[0-9a-f]{32}$/u.test(first.lineChatUserId)) { classification = "INSUFFICIENT_RECONCILIATION_EVIDENCE"; reason = "NO_ACCEPTED_EXACT_LIVE_PROOF_OR_INVALID_SCOPE"; }
    else if ((c.lineChatUserId !== null && c.lineChatUserId !== first.lineChatUserId) || (owners.get(key) ?? []).some(id => id !== c.id)) { classification = "EXISTING_MAPPING_CONFLICT"; reason = "EXISTING_IDENTITY_DISAGREES_OR_OTHER_OWNER"; }
    else if (c.lineChatUserId === first.lineChatUserId) { classification = "ALREADY_LINKED"; reason = "EXACT_EXISTING_IDENTITY"; }
    else { classification = "SAFE_BRIDGE_CANDIDATE"; reason = "EXACT_RECONCILED_ONE_TO_ONE"; }
    rows.push({ lineOfficialAccountId: first.lineOfficialAccountId, lineChatUserId: first.lineChatUserId, canonicalConversationId: c?.id ?? null, storeId: c?.storeId ?? null, classification, reason, proofIds, proofDigest: bridgeHash(JSON.stringify(proofIds)), previousLineChatUserId: c?.lineChatUserId ?? null, previousMappingSource: c?.lineChatMappingSource ?? null, previousMappedAt: c?.lineChatMappedAt?.toISOString() ?? null, previousMappedById: c?.lineChatMappedById ?? null, activityAt: c?.latestMessageAt.toISOString() ?? null });
  }
  // Separate conversation-only rows ensure conversations without a canonical Mirror anchor are accounted for.
  for (const c of conversations) if (eligible.has(c.lineOfficialAccountId) && !byConversation.has(c.id)) rows.push({ lineOfficialAccountId: c.lineOfficialAccountId, lineChatUserId: c.lineChatUserId, canonicalConversationId: c.id, storeId: c.storeId, classification: "NO_MIRROR_BRIDGE_EVIDENCE", reason: "NO_CANONICAL_MIRROR_ANCHOR", proofIds: [], proofDigest: bridgeHash("[]"), previousLineChatUserId: c.lineChatUserId, previousMappingSource: c.lineChatMappingSource, previousMappedAt: c.lineChatMappedAt?.toISOString() ?? null, previousMappedById: c.lineChatMappedById, activityAt: c.latestMessageAt.toISOString() });
  return rows.sort((a,b) => `${a.lineOfficialAccountId}:${a.lineChatUserId}:${a.canonicalConversationId}`.localeCompare(`${b.lineOfficialAccountId}:${b.lineChatUserId}:${b.canonicalConversationId}`));
}
