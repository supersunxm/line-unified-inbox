export type ExecutiveStatus = "HEALTHY" | "ATTENTION" | "CRITICAL";

export interface ExecutiveCriticalIssue {
  storeName: string;
  issue: string;
  impact: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export interface ExecutiveRecommendedDecision {
  action: string;
  owner: string;
  deadline: string;
  expectedImpact: string;
}

export interface ExecutiveDailyBrief {
  date: string;
  overallStatus: ExecutiveStatus;
  headline: string;
  keyHighlights: string[];
  criticalIssues: ExecutiveCriticalIssue[];
  rootCauseSummary: string;
  recommendedDecisions: ExecutiveRecommendedDecision[];
  metrics: {
    totalMessages: number;
    slaRate: number;
    pending: number;
    riskStores: number;
  };
  generatedAt: string;
}
