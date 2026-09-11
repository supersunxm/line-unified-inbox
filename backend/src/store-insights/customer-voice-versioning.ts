export type CustomerVoiceAnalysisCheckpoint = {
  analysisVersion: string;
  lastAnalyzedMessageAt: Date | null;
};

export type CustomerVoiceVersionedResult = {
  conversationId: string;
  analysisVersion: string;
};

/**
 * Selects at most one current-version result per conversation. Historical
 * rows remain available to audit callers, but never enter current reporting.
 */
export function selectCurrentCustomerVoiceResults<T extends CustomerVoiceVersionedResult>(
  rows: readonly T[],
  currentVersion: string,
): T[] {
  const selected = new Map<string, T>();
  for (const row of rows) {
    if (row.analysisVersion !== currentVersion || selected.has(row.conversationId)) continue;
    selected.set(row.conversationId, row);
  }
  return [...selected.values()];
}

/**
 * A checkpoint is current only when its version matches the deployed ruleset.
 * This deliberately allows v1 rows to be reprocessed into v2 while keeping
 * repeated v2 runs idempotent until a newer inbound message arrives.
 */
export function shouldAnalyzeCustomerVoiceConversation(
  latestInboundMessageAt: Date | null | undefined,
  checkpoint: CustomerVoiceAnalysisCheckpoint | null | undefined,
  currentVersion: string,
): boolean {
  if (!checkpoint || checkpoint.analysisVersion !== currentVersion) return true;
  if (!latestInboundMessageAt || !checkpoint.lastAnalyzedMessageAt) return true;
  return latestInboundMessageAt > checkpoint.lastAnalyzedMessageAt;
}
