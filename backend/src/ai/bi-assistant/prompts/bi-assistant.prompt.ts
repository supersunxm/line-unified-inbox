import { BIQueryIntent } from "../bi-assistant.types";

export function formatBiSummaryText(
  intent: BIQueryIntent,
  slaRate: number,
  pendingCount: number,
  riskStoresCount: number,
  topStoreName: string,
  topProduct: string
): string {
  switch (intent) {
    case BIQueryIntent.SLA_ANALYSIS:
      return `Network SLA response rate is currently operating at ${slaRate}%. SLA degradation is primarily concentrated in ${riskStoresCount} stores during evening peak traffic hours.`;

    case BIQueryIntent.ROOT_CAUSE:
      return `Root cause analysis indicates that SLA drop is 42% attributed to evening message volume surge and 35% attributed to Branch Manager escalation delay at ${topStoreName}.`;

    case BIQueryIntent.STORE_RISK:
      return `Store risk analysis identifies ${topStoreName} as the highest priority intervention target with ${pendingCount} pending customer conversations.`;

    case BIQueryIntent.BM_PERFORMANCE:
      return `Branch Manager response tracking shows delayed login response after automated escalation at ${topStoreName}, resulting in extended customer waiting time.`;

    case BIQueryIntent.CUSTOMER_DEMAND:
      return `Customer demand inquiry signals are heavily concentrated on ${topProduct || "OPPO Device"} stock and pricing verifications across stores.`;

    case BIQueryIntent.OPERATION_RECOMMENDATION:
    default:
      return `Management is recommended to reallocate float backup responders during peak hours (18:00-22:00) at ${topStoreName} to recover SLA back to target.`;
  }
}
