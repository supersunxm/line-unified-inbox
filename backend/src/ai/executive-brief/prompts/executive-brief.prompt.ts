import type { ExecutiveStatus } from "../executive-brief.types";

export function formatExecutiveHeadline(
  status: ExecutiveStatus,
  riskStoresCount: number,
  peakWindow: string,
  topStoreName: string
): string {
  switch (status) {
    case "CRITICAL":
      return `Critical SLA breach detected across ${riskStoresCount} stores mainly concentrated during evening peak (${peakWindow}). Immediate intervention required at ${topStoreName}.`;
    case "ATTENTION":
      return `SLA degradation detected from evening peak workload concentration during ${peakWindow}. ${riskStoresCount} stores require operational float support.`;
    case "HEALTHY":
    default:
      return `Network operating normally within healthy SLA parameters across all connected store channels.`;
  }
}

export function formatKeyHighlights(
  msgCount: number,
  msgDiffPct: number,
  slaRate: number,
  riskStoresCount: number,
  topProduct: string
): string[] {
  const diffSymbol = msgDiffPct >= 0 ? "+" : "";
  return [
    `Message volume ${diffSymbol}${msgDiffPct}% vs yesterday (${msgCount.toLocaleString()} messages today)`,
    `Network response rate SLA achievement operating at ${slaRate}%`,
    riskStoresCount > 0
      ? `${riskStoresCount} stores operating below target SLA threshold requiring management attention`
      : "0 stores currently breaching SLA thresholds",
    `Top customer inquiry interest concentrated on ${topProduct || "OPPO Devices"}`,
  ];
}
