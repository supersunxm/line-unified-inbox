export type CustomerVoiceAnalysisCheckpoint = {
  analysisVersion: string;
  lastAnalyzedMessageAt: Date | null;
};

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
