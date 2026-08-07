export type RootCauseCategory =
  | "WORKLOAD_SURGE"
  | "RESPONSE_CAPACITY"
  | "BM_ESCALATION_DELAY"
  | "PRODUCT_INQUIRY_COMPLEXITY"
  | "STORE_OPERATION_ISSUE";

export interface AIRootCauseDiagnosis {
  primaryCause: string;
  contributingFactors: string[];
  evidence: string[];
  category: RootCauseCategory;
}

export interface AIRootCauseInsight {
  id: string;
  storeId: string;
  storeName: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  problem: string;
  problemAge: string;
  diagnosis: AIRootCauseDiagnosis;
  confidence: number; // e.g. 91 (percentage)
  recommendation: string;
  expectedImpact: string;
  createdAt: string;
}

export interface AIRootCauseSummary {
  summary: string;
  confidence: number;
  totalAffectedStores: number;
  insights: AIRootCauseInsight[];
}
