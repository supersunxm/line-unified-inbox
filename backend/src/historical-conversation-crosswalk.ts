export const HISTORICAL_CROSSWALK_MAX_DRIFT_MS = 1_000;

export type HistoricalCrosswalkClassification =
  | "LINK_SAFE"
  | "LINK_AMBIGUOUS"
  | "LINK_CONFLICT"
  | "NO_CANONICAL_ANCHOR"
  | "DIRECT_VISIBLE";

export type HistoricalCrosswalkIdentity = {
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
};

export type HistoricalCrosswalkMessage = HistoricalCrosswalkIdentity & {
  sourceEventId: string;
  direction: string;
  messageType?: string;
  text: string;
  sentAt: Date;
};

export type CanonicalCrosswalkMessage = {
  id: string;
  conversationId: string;
  externalMessageId: string | null;
  direction: string;
  messageType: string;
  text: string;
  sentAt: Date;
  storeId: string | null;
  lineOfficialAccountId: string;
  lineChatUserId?: string | null;
};

export type HistoricalCrosswalkResult = {
  identity: HistoricalCrosswalkIdentity;
  classification: HistoricalCrosswalkClassification;
  canonicalConversationId: string | null;
  evidenceType: "SOURCE_EVENT_ID" | null;
  anchorCount: number;
  maxDriftMs: number | null;
  reasons: string[];
};

export type CanonicalSourceIndex = ReadonlyMap<string, readonly CanonicalCrosswalkMessage[]>;

export function selectSafeHistoricalCrosswalkRows<T extends HistoricalCrosswalkResult>(rows: readonly T[]): T[] {
  const safeRows = rows.filter((row) => row.classification === "LINK_SAFE");
  if (safeRows.some((row) => !row.canonicalConversationId || row.evidenceType !== "SOURCE_EVENT_ID" || row.anchorCount < 1)) {
    throw new Error("SAFE_CROSSWALK_ROW_MISSING_SOURCE_EVIDENCE");
  }
  return safeRows;
}

export function indexCanonicalSourceMessages(messages: readonly CanonicalCrosswalkMessage[]): CanonicalSourceIndex {
  const byExternalId = new Map<string, CanonicalCrosswalkMessage[]>();
  for (const message of messages) {
    if (!message.externalMessageId) continue;
    const existing = byExternalId.get(message.externalMessageId) ?? [];
    existing.push(message);
    byExternalId.set(message.externalMessageId, existing);
  }
  return byExternalId;
}

function sourceIds(sourceEventId: string): string[] {
  return [...new Set([sourceEventId, `line-chat-manager:${sourceEventId}`])];
}

export function isCanonicalSourceDuplicate(sourceEventId: string, externalMessageId: string | null | undefined): boolean {
  return externalMessageId != null && sourceIds(sourceEventId).includes(externalMessageId);
}

export function classifyHistoricalConversationIdentity(input: {
  identity: HistoricalCrosswalkIdentity;
  historicalMessages: readonly HistoricalCrosswalkMessage[];
  canonicalMessages: readonly CanonicalCrosswalkMessage[];
  canonicalSourceIndex?: CanonicalSourceIndex;
  directConversationIds?: readonly string[];
}): HistoricalCrosswalkResult {
  const { identity, historicalMessages, canonicalMessages } = input;
  const directIds = [...new Set(input.directConversationIds ?? [])];
  if (directIds.length === 1) {
    return {
      identity,
      classification: "DIRECT_VISIBLE",
      canonicalConversationId: null,
      evidenceType: null,
      anchorCount: 0,
      maxDriftMs: null,
      reasons: [],
    };
  }
  if (directIds.length > 1) {
    return {
      identity,
      classification: "LINK_AMBIGUOUS",
      canonicalConversationId: null,
      evidenceType: null,
      anchorCount: 0,
      maxDriftMs: null,
      reasons: ["DIRECT_IDENTITY_MATCHES_MULTIPLE_CONVERSATIONS"],
    };
  }

  const byExternalId = input.canonicalSourceIndex ?? indexCanonicalSourceMessages(canonicalMessages);

  const destinationIds = new Set<string>();
  const reasons = new Set<string>();
  let anchorCount = 0;
  let maxDriftMs = 0;
  let nonUniqueSourceMatch = false;
  for (const historical of historicalMessages) {
    const matches = new Map<string, CanonicalCrosswalkMessage>();
    for (const externalId of sourceIds(historical.sourceEventId)) {
      for (const canonical of byExternalId.get(externalId) ?? []) matches.set(canonical.id, canonical);
    }
    if (matches.size === 0) continue;
    if (matches.size > 1) {
      nonUniqueSourceMatch = true;
      reasons.add("SOURCE_EVENT_ID_MATCHES_MULTIPLE_CANONICAL_MESSAGES");
      continue;
    }

    const canonical = matches.values().next().value;
    if (!canonical) continue;
    if (canonical.storeId !== identity.storeId) reasons.add("STORE_MISMATCH");
    if (canonical.lineOfficialAccountId !== identity.lineOfficialAccountId) reasons.add("OA_MISMATCH");
    if (canonical.direction !== historical.direction) reasons.add("DIRECTION_MISMATCH");
    if (canonical.messageType !== "TEXT" || (historical.messageType != null && historical.messageType !== "TEXT")) reasons.add("NON_TEXT_SOURCE_ANCHOR");
    if (canonical.text !== historical.text) reasons.add("TEXT_MISMATCH");
    const driftMs = Math.abs(canonical.sentAt.getTime() - historical.sentAt.getTime());
    if (driftMs > HISTORICAL_CROSSWALK_MAX_DRIFT_MS) reasons.add("TIMESTAMP_DRIFT_OVER_ONE_SECOND");
    if (canonical.storeId !== identity.storeId
      || canonical.lineOfficialAccountId !== identity.lineOfficialAccountId
      || canonical.direction !== historical.direction
      || canonical.messageType !== "TEXT"
      || (historical.messageType != null && historical.messageType !== "TEXT")
      || canonical.text !== historical.text
      || driftMs > HISTORICAL_CROSSWALK_MAX_DRIFT_MS) continue;

    destinationIds.add(canonical.conversationId);
    anchorCount += 1;
    maxDriftMs = Math.max(maxDriftMs, driftMs);
  }

  if (destinationIds.size > 1 || nonUniqueSourceMatch) {
    reasons.add("VALID_SOURCE_ANCHORS_DIVERGE_ACROSS_CONVERSATIONS");
    return {
      identity,
      classification: "LINK_AMBIGUOUS",
      canonicalConversationId: null,
      evidenceType: null,
      anchorCount,
      maxDriftMs: anchorCount > 0 ? maxDriftMs : null,
      reasons: [...reasons].sort(),
    };
  }
  if (reasons.size > 0) {
    return {
      identity,
      classification: "LINK_CONFLICT",
      canonicalConversationId: null,
      evidenceType: null,
      anchorCount,
      maxDriftMs: anchorCount > 0 ? maxDriftMs : null,
      reasons: [...reasons].sort(),
    };
  }
  const [canonicalConversationId] = destinationIds;
  if (!canonicalConversationId) {
    return {
      identity,
      classification: "NO_CANONICAL_ANCHOR",
      canonicalConversationId: null,
      evidenceType: null,
      anchorCount: 0,
      maxDriftMs: null,
      reasons: [],
    };
  }
  return {
    identity,
    classification: "LINK_SAFE",
    canonicalConversationId,
    evidenceType: "SOURCE_EVENT_ID",
    anchorCount,
    maxDriftMs,
    reasons: [],
  };
}
