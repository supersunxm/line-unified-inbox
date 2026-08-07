import type { RootCauseCategory } from "../root-cause.types";

export function formatPrimaryCauseText(category: RootCauseCategory, storeName: string, peakWindow: string): string {
  switch (category) {
    case "WORKLOAD_SURGE":
      return `Evening workload overload combined with peak traffic concentration during ${peakWindow} at ${storeName}.`;
    case "RESPONSE_CAPACITY":
      return `Response capacity bottleneck caused by low active operator coverage relative to open queue volume at ${storeName}.`;
    case "BM_ESCALATION_DELAY":
      return `Branch Manager response lag following automated system escalation at ${storeName}.`;
    case "PRODUCT_INQUIRY_COMPLEXITY":
      return `High concentration of product stock and pricing verification inquiries requiring manual staff lookup at ${storeName}.`;
    case "STORE_OPERATION_ISSUE":
    default:
      return `Abnormal response velocity variance and unassigned chat accumulation at ${storeName}.`;
  }
}

export function formatRecommendationText(category: RootCauseCategory, storeName: string, peakWindow: string): string {
  switch (category) {
    case "WORKLOAD_SURGE":
      return `Reallocate float support staff during peak traffic hours (${peakWindow}) to absorb message volume surge at ${storeName}.`;
    case "RESPONSE_CAPACITY":
      return `Assign backup responder to active queue at ${storeName} to clear pending conversation backlog immediately.`;
    case "BM_ESCALATION_DELAY":
      return `Trigger direct high-priority phone call / urgent push notification to ${storeName} Branch Manager.`;
    case "PRODUCT_INQUIRY_COMPLEXITY":
      return `Deploy automated Stock & Price AI quick-reply template for ${storeName} staff.`;
    case "STORE_OPERATION_ISSUE":
    default:
      return `Conduct immediate operational check with Area Manager for ${storeName} store shifts.`;
  }
}

export function formatExpectedImpactText(category: RootCauseCategory): string {
  switch (category) {
    case "WORKLOAD_SURGE":
      return "Expected to reduce SLA breach rate by 35% and recover response velocity to target.";
    case "RESPONSE_CAPACITY":
      return "Expected to clear pending queue within 45 minutes and prevent 100% of impending SLA breaches.";
    case "BM_ESCALATION_DELAY":
      return "Expected to resolve critical waiting items within 15 minutes of BM response.";
    case "PRODUCT_INQUIRY_COMPLEXITY":
      return "Expected to shorten average response time by 4.5 minutes per product inquiry.";
    case "STORE_OPERATION_ISSUE":
    default:
      return "Expected to normalize store response velocity back to network baseline.";
  }
}
