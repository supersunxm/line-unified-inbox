import { generateTranslationBenchmarkSubmission, ProviderTranslationBenchmarkRunner } from "../src/translation/benchmark/translation-benchmark.runner";
import { GoogleTranslationProvider } from "../src/translation/providers/google-translation.provider";
import { readGoogleTranslationProviderOptions } from "../src/translation/translation.config";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Translation benchmark generation is not allowed in production");
  const options = readGoogleTranslationProviderOptions();
  if (!options) throw new Error("Google benchmark credentials are unavailable");
  const runner = new ProviderTranslationBenchmarkRunner(new GoogleTranslationProvider(options));
  const submission = await generateTranslationBenchmarkSubmission(runner, "google-cloud-translation-v3", new Date(), "google", { providerVersion: "v3" });
  console.log(JSON.stringify(submission, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Google translation benchmark generation failed");
  process.exitCode = 1;
});
