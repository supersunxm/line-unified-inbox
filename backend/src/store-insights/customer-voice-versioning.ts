export type CustomerVoiceAnalysisCheckpoint = {
  analysisVersion: string;
  lastAnalyzedMessageAt: Date | null;
};

/**
 * A checkpoint is current only when its version matches the deployed ruleset.
 * This deliberately allows historical rows to be reprocessed into the current
 * ruleset while keeping repeated current-version runs idempotent until a newer
 * inbound message arrives.
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
