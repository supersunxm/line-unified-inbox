export interface AiNormalizedTelemetry {
  slaRatePct: number;
  pendingCount: number;
  msgCount: number;
  msgDiffPct: number;
  riskStoresCount: number;
  riskStoresList: string[];
  peakWindow: string;
  topStoreName: string;
  topProduct: string;
  generatedAt: string;
}
