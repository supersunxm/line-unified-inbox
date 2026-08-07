import { Injectable } from "@nestjs/common";
import { EffectivenessRating } from "./impact-engine.types";

@Injectable()
export class ImpactCalculationService {
  calculateImpact(
    beforeSla: number,
    afterSla: number,
    beforePending: number,
    afterPending: number,
    beforeResponseTime: number,
    afterResponseTime: number
  ): {
    impactScore: number;
    effectiveness: EffectivenessRating;
    slaImprovementPct: number;
  } {
    // 1. SLA Improvement %
    const slaDelta = Math.max(0, afterSla - beforeSla);

    // 2. Pending Reduction %
    const pendingDeltaPct = beforePending > 0
      ? Math.max(0, Math.round(((beforePending - afterPending) / beforePending) * 100))
      : 50;

    // 3. Response Time Acceleration %
    const responseDeltaPct = beforeResponseTime > 0
      ? Math.max(0, Math.round(((beforeResponseTime - afterResponseTime) / beforeResponseTime) * 100))
      : 50;

    // Impact Score Average
    const impactScore = Math.min(100, Math.max(0, Math.round((slaDelta + pendingDeltaPct + responseDeltaPct) / 3)));

    const effectiveness: EffectivenessRating =
      impactScore >= 80 ? "SUCCESS" : impactScore >= 40 ? "PARTIAL" : "FAILED";

    return {
      impactScore,
      effectiveness,
      slaImprovementPct: Math.round(slaDelta),
    };
  }
}
