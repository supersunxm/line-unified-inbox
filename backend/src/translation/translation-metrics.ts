import { Injectable } from "@nestjs/common";

export type TranslationMetricOutcome = "SUCCESS" | "FAILURE" | "CACHED" | "RATE_LIMITED";

export type TranslationMetricEvent = {
  outcome: TranslationMetricOutcome;
  durationMs: number;
  characterCount?: number;
  providerFailure?: boolean;
};

export type TranslationPilotMetricsSnapshot = {
  totalTranslationRequests: number;
  successfulTranslations: number;
  failedTranslations: number;
  providerFailures: number;
  rateLimitedRequests: number;
  averageDurationMs: number;
  averageCharacterCount: number;
  cacheHitCount: number;
};

@Injectable()
export class TranslationMetrics {
  private totalTranslationRequests = 0;
  private successfulTranslations = 0;
  private failedTranslations = 0;
  private providerFailures = 0;
  private rateLimitedRequests = 0;
  private cacheHitCount = 0;
  private totalDurationMs = 0;
  private totalCharacterCount = 0;
  private characterCountSamples = 0;

  record(event: TranslationMetricEvent): void {
    this.totalTranslationRequests += 1;
    this.totalDurationMs += event.durationMs;
    if (event.characterCount !== undefined) {
      this.totalCharacterCount += event.characterCount;
      this.characterCountSamples += 1;
    }
    if (event.outcome === "SUCCESS") this.successfulTranslations += 1;
    if (event.outcome === "CACHED") this.cacheHitCount += 1;
    if (event.outcome === "FAILURE") this.failedTranslations += 1;
    if (event.outcome === "RATE_LIMITED") this.rateLimitedRequests += 1;
    if (event.providerFailure) this.providerFailures += 1;
  }

  snapshot(): TranslationPilotMetricsSnapshot {
    return {
      totalTranslationRequests: this.totalTranslationRequests,
      successfulTranslations: this.successfulTranslations,
      failedTranslations: this.failedTranslations,
      providerFailures: this.providerFailures,
      rateLimitedRequests: this.rateLimitedRequests,
      averageDurationMs: this.totalTranslationRequests ? this.totalDurationMs / this.totalTranslationRequests : 0,
      averageCharacterCount: this.characterCountSamples ? this.totalCharacterCount / this.characterCountSamples : 0,
      cacheHitCount: this.cacheHitCount,
    };
  }

  resetMetrics(): void {
    this.totalTranslationRequests = 0;
    this.successfulTranslations = 0;
    this.failedTranslations = 0;
    this.providerFailures = 0;
    this.rateLimitedRequests = 0;
    this.cacheHitCount = 0;
    this.totalDurationMs = 0;
    this.totalCharacterCount = 0;
    this.characterCountSamples = 0;
  }
}
