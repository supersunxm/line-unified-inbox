export function formatLearnedPattern(storeName: string, actionType: string, slaImprovementPct: number): string {
  if (slaImprovementPct >= 50) {
    return `Peak traffic staffing intervention at ${storeName} demonstrates high efficacy (+${slaImprovementPct}% SLA recovery) for evening traffic surge patterns.`;
  } else if (slaImprovementPct >= 25) {
    return `Automated BM alert notification at ${storeName} yields moderate response velocity acceleration (+${slaImprovementPct}% SLA improvement).`;
  }
  return `Standard response follow-up at ${storeName} stabilized pending conversation accumulation.`;
}
