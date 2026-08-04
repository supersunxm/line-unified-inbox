import { GoogleTranslationProvider } from "../src/translation/providers/google-translation.provider";
import { TranslationConfig } from "../src/translation/translation.config";
import { TranslationMetrics } from "../src/translation/translation-metrics";
import { TranslationPilotSmokeTest } from "../src/translation/translation-pilot-smoke-test";
import { TranslationProvider } from "../src/translation/translation.provider";
import { TranslationReadinessService } from "../src/translation/translation-readiness.service";
import { TranslationUsageBudget } from "../src/translation/translation-usage-budget";
import { TranslationFeedbackService } from "../src/translation/translation-feedback";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Translation pilot smoke test is not allowed in production");
  const config = new TranslationConfig();
  const readiness = new TranslationReadinessService(config, new TranslationFeedbackService());
  const unavailableProvider: TranslationProvider = { async translate() { throw new Error("Provider unavailable"); } };
  const provider = readiness.check().ready && config.google ? new GoogleTranslationProvider(config.google) : unavailableProvider;
  const smoke = new TranslationPilotSmokeTest(readiness, provider, new TranslationMetrics(), new TranslationUsageBudget(config));
  const result = await smoke.run();
  console.log(JSON.stringify(result));
  if (!result.success) process.exitCode = 1;
}

void main().catch(() => {
  console.log(JSON.stringify({ readiness: { ready: false }, providerStatus: "FAILED", targetLanguages: ["en", "zh"], latencyMs: 0, characterCount: 0, success: false }));
  process.exitCode = 1;
});
