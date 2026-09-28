export type HistoricalSourceCandidate = {
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  sourceEventId: string;
  direction: string;
  messageType: string;
  text: string;
  sentAt: Date;
};

export type HistoricalCanonicalSource = {
  id: string;
  conversationId: string;
  externalMessageId: string | null;
  storeId: string | null;
  lineOfficialAccountId: string;
  lineChatUserId: string | null;
  direction: string;
  messageType: string;
  text: string;
  sentAt: Date;
};

export type HistoricalSourceClassification =
  | "CANONICAL_EXACT"
  | "CANONICAL_EQUIVALENT_WITH_TIME_DRIFT"
  | "CANONICAL_EQUIVALENT_VIA_SAFE_CROSSWALK"
  | "SAFE_HISTORICAL_MISSING"
  | "AMBIGUOUS_CANONICAL_MATCH"
  | "CANONICAL_PAYLOAD_CONFLICT"
  | "CANONICAL_SCOPE_CONFLICT"
  | "NO_PROVABLE_DESTINATION"
  | "ARCHIVE_NOT_APPROVED";

export type HistoricalSourceClassificationResult = {
  classification: HistoricalSourceClassification;
  canonicalConversationId: string | null;
  canonicalMatchCount: number;
  timestampDriftMs: number | null;
  reason: string | null;
};

export function historicalExternalMessageIds(sourceEventId: string): readonly string[] {
  return [...new Set([sourceEventId, `line-chat-manager:${sourceEventId}`])];
}

export function isHistoricalSourceIdMatch(sourceEventId: string, externalMessageId: string | null): boolean {
  return externalMessageId !== null && historicalExternalMessageIds(sourceEventId).includes(externalMessageId);
}

export function classifyHistoricalSourceCandidate(input: {
  candidate: HistoricalSourceCandidate;
  canonicalMatches: readonly HistoricalCanonicalSource[];
  directConversationIds?: readonly string[];
  safeCrosswalkConversationIds?: readonly string[];
  archiveApproved: boolean;
}): HistoricalSourceClassificationResult {
  const empty = (
    classification: HistoricalSourceClassification,
    reason: string | null,
    canonicalConversationId: string | null = null,
    canonicalMatchCount = input.canonicalMatches.length,
    timestampDriftMs: number | null = null,
  ): HistoricalSourceClassificationResult => ({
    classification,
    canonicalConversationId,
    canonicalMatchCount,
    timestampDriftMs,
    reason,
  });

  if (!input.archiveApproved) return empty("ARCHIVE_NOT_APPROVED", "ARCHIVE_NOT_APPROVED");

  const canonicalById = new Map(input.canonicalMatches.map((message) => [message.id, message]));
  const canonicalMatches = [...canonicalById.values()];
  if (canonicalMatches.length > 1) return empty("AMBIGUOUS_CANONICAL_MATCH", "SOURCE_EVENT_ID_MATCHES_MULTIPLE_CANONICAL_MESSAGES");

  const directIds = [...new Set(input.directConversationIds ?? [])];
  const crosswalkIds = [...new Set(input.safeCrosswalkConversationIds ?? [])];
  if (directIds.length > 1 || crosswalkIds.length > 1) {
    return empty("AMBIGUOUS_CANONICAL_MATCH", "HISTORICAL_IDENTITY_HAS_MULTIPLE_DESTINATIONS");
  }

  const canonical = canonicalMatches[0];
  if (!canonical) {
    if (directIds.length === 1 || crosswalkIds.length === 1) {
      return empty("SAFE_HISTORICAL_MISSING", null, null, 0);
    }
    return empty("NO_PROVABLE_DESTINATION", "NO_CANONICAL_OR_HISTORICAL_DESTINATION", null, 0);
  }

  if (canonical.storeId !== input.candidate.storeId
    || canonical.lineOfficialAccountId !== input.candidate.lineOfficialAccountId) {
    return empty("CANONICAL_SCOPE_CONFLICT", "CANONICAL_STORE_OR_OA_MISMATCH", canonical.conversationId);
  }

  if (canonical.direction !== input.candidate.direction
    || canonical.messageType !== input.candidate.messageType
    || canonical.text !== input.candidate.text) {
    return empty("CANONICAL_PAYLOAD_CONFLICT", "CANONICAL_DIRECTION_TYPE_OR_TEXT_MISMATCH", canonical.conversationId);
  }

  const timestampDriftMs = canonical.sentAt.getTime() - input.candidate.sentAt.getTime();
  if (!Number.isFinite(timestampDriftMs)) {
    return empty("CANONICAL_PAYLOAD_CONFLICT", "CANONICAL_TIMESTAMP_INVALID", canonical.conversationId);
  }

  if (canonical.lineChatUserId === input.candidate.lineChatUserId
    || directIds.includes(canonical.conversationId)) {
    return timestampDriftMs === 0
      ? empty("CANONICAL_EXACT", null, canonical.conversationId, 1, 0)
      : empty("CANONICAL_EQUIVALENT_WITH_TIME_DRIFT", null, canonical.conversationId, 1, timestampDriftMs);
  }

  if (crosswalkIds.length === 1 && crosswalkIds[0] === canonical.conversationId) {
    return empty("CANONICAL_EQUIVALENT_VIA_SAFE_CROSSWALK", null, canonical.conversationId, 1, timestampDriftMs);
  }

  return empty("CANONICAL_SCOPE_CONFLICT", "CHAT_ID_MISMATCH_WITHOUT_MATCHING_LINK_SAFE_CROSSWALK", canonical.conversationId);
}
