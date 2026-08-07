export function formatMemoryCaseSummary(storeName: string, successfulAction: string, confidence: number, slaLift: number): string {
  return `Self-learning memory pattern verified for ${storeName}: "${successfulAction}" with ${confidence}% confidence (+${slaLift}% SLA recovery).`;
}
