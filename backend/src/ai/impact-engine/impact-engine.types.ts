export type EffectivenessRating = "SUCCESS" | "PARTIAL" | "FAILED";

export interface ActionImpactResultDto {
  id: string;
  taskId: string;
  storeId: string;
  storeName: string;
  actionTitle: string;
  beforeMetrics: {
    slaRate: number;
    pendingCount: number;
    responseTimeMinutes: number;
  };
  afterMetrics: {
    slaRate: number;
    pendingCount: number;
    responseTimeMinutes: number;
  };
  impactScore: number; // 0 - 100
  effectiveness: EffectivenessRating;
  improvementSummary: string;
  learnedPattern: string;
  evaluatedAt: string;
}

export interface ImpactSummary {
  totalEvaluated: number;
  successRatePct: number;
  avgSlaRecoveryPct: number;
  topSuccessfulActions: ActionImpactResultDto[];
  learnedPatterns: string[];
}
