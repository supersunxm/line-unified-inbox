export enum BIQueryIntent {
  SLA_ANALYSIS = "sla_analysis",
  ROOT_CAUSE = "root_cause",
  STORE_RISK = "store_risk",
  BM_PERFORMANCE = "bm_performance",
  CUSTOMER_DEMAND = "customer_demand",
  OPERATION_RECOMMENDATION = "operation_recommendation",
}

export interface BIQueryAnalysisResult {
  intent: BIQueryIntent;
  confidence: number;
  entities: {
    storeName?: string;
    timeRange?: string;
  };
}

export interface BIEvidenceItem {
  metric: string;
  value: string;
  explanation: string;
}

export interface BIAnswer {
  question: string;
  intent: BIQueryIntent;
  summary: string;
  evidence: BIEvidenceItem[];
  affectedStores: string[];
  recommendation: string;
  confidence: number;
  generatedAt: string;
}

export interface BIQueryRequestDto {
  question: string;
}
