export interface OperationalMemoryCaseDto {
  id: string;
  storeId: string;
  storeName: string;
  problemPattern: string;
  rootCauseCategory: string;
  successfulAction: string;
  confidence: number; // 0 - 100
  timesApplied: number;
  avgSlaLiftPct: number;
  lastAppliedAt: string;
}

export interface OperationalMemorySummary {
  totalStoredCases: number;
  avgConfidencePct: number;
  topSlaLiftCase: string;
  cases: OperationalMemoryCaseDto[];
}
