import { TranslationConfig, readMessageTranslationConfig } from "./translation.config";
import { TranslationFeedbackService } from "./translation-feedback";
import { TranslationMetrics } from "./translation-metrics";
import { runTranslationPilotPreflight } from "./translation-pilot-preflight";
import { TranslationReadinessService } from "./translation-readiness.service";

export type TranslationPilotCheckResult = {
  ready: boolean;
  checks: {
    configuration: boolean;
    provider: boolean;
    runtime: boolean;
    metrics: boolean;
  };
};

function metricsAvailable(metrics: TranslationMetrics): boolean {
  return Object.values(metrics.snapshot()).every(
    (value) => typeof value === "number" && Number.isFinite(value) && value >= 0,
  );
}

export function runTranslationPilotCheck(
  environment: NodeJS.ProcessEnv,
  arguments_: readonly string[] = [],
): TranslationPilotCheckResult {
  const preflight = runTranslationPilotPreflight(environment, arguments_);
  const config = readMessageTranslationConfig(environment) as TranslationConfig;
  const feedback = new TranslationFeedbackService();
  const runtime = new TranslationReadinessService(config, feedback).check();
  const checks = {
    configuration: preflight.ready,
    provider: preflight.checks.googleProvider && preflight.checks.credentialsConfigured,
    runtime: runtime.ready,
    metrics: metricsAvailable(new TranslationMetrics()),
  };
  return { ready: Object.values(checks).every(Boolean), checks };
}
