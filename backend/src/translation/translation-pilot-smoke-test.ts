import { TranslationTargetLanguage } from "./dto/create-message-translation.dto";
import { TranslationMetrics } from "./translation-metrics";
import { TranslationProvider } from "./translation.provider";
import { TranslationReadinessResponse, TranslationReadinessService } from "./translation-readiness.service";
import { TranslationUsageBudget } from "./translation-usage-budget";

export const TRANSLATION_PILOT_SMOKE_TEXT = "OPPO Reno16 มีของไหมครับ";
export const TRANSLATION_PILOT_SMOKE_TARGETS: TranslationTargetLanguage[] = ["en", "zh"];

export type TranslationPilotSmokeResult = {
  readiness: TranslationReadinessResponse;
  providerStatus: "NOT_INVOKED" | "AVAILABLE" | "FAILED";
  targetLanguages: TranslationTargetLanguage[];
  latencyMs: number;
  characterCount: number;
  success: boolean;
};

export class TranslationPilotSmokeTest {
  constructor(
    private readonly readiness: TranslationReadinessService,
    private readonly provider: TranslationProvider,
    private readonly metrics: TranslationMetrics,
    private readonly usageBudget: TranslationUsageBudget,
  ) {}

  async run(): Promise<TranslationPilotSmokeResult> {
    const readiness = this.readiness.check();
    const characterCount = Array.from(TRANSLATION_PILOT_SMOKE_TEXT).length;
    const base = { readiness, targetLanguages: [...TRANSLATION_PILOT_SMOKE_TARGETS], characterCount };
    if (!readiness.ready) return { ...base, providerStatus: "NOT_INVOKED", latencyMs: 0, success: false };

    const cache = new Map<TranslationTargetLanguage, string>();
    let latencyMs = 0;
    for (const targetLanguage of TRANSLATION_PILOT_SMOKE_TARGETS) {
      if (!this.usageBudget.consume(characterCount)) {
        this.metrics.record({ outcome: "RATE_LIMITED", durationMs: 0, characterCount });
        return { ...base, providerStatus: "NOT_INVOKED", latencyMs, success: false };
      }
      const startedAt = Date.now();
      try {
        const result = await this.provider.translate(TRANSLATION_PILOT_SMOKE_TEXT, targetLanguage);
        const durationMs = Date.now() - startedAt;
        latencyMs += durationMs;
        if (!result.translatedText.trim() || result.characterCount !== characterCount) throw new Error("INVALID_NORMALIZED_RESPONSE");
        cache.set(targetLanguage, result.translatedText);
        this.metrics.record({ outcome: "SUCCESS", durationMs, characterCount: result.characterCount });
      } catch {
        const durationMs = Date.now() - startedAt;
        latencyMs += durationMs;
        this.metrics.record({ outcome: "FAILURE", durationMs, characterCount, providerFailure: true });
        return { ...base, providerStatus: "FAILED", latencyMs, success: false };
      }

      const cached = cache.get(targetLanguage);
      if (!cached) return { ...base, providerStatus: "FAILED", latencyMs, success: false };
      this.metrics.record({ outcome: "CACHED", durationMs: 0, characterCount });
    }

    const metricSnapshot = this.metrics.snapshot();
    const budgetSnapshot = this.usageBudget.snapshot();
    const expectedUsage = characterCount * TRANSLATION_PILOT_SMOKE_TARGETS.length;
    const verified = metricSnapshot.totalTranslationRequests === 4
      && metricSnapshot.successfulTranslations === 2
      && metricSnapshot.failedTranslations === 0
      && metricSnapshot.cacheHitCount === 2
      && budgetSnapshot.dailyCharacterUsage === expectedUsage;
    return { ...base, providerStatus: verified ? "AVAILABLE" : "FAILED", latencyMs, success: verified };
  }
}
