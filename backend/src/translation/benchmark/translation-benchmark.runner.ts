import { TranslationProvider } from "../translation.provider";
import { TRANSLATION_BENCHMARK_CORPUS, TRANSLATION_BENCHMARK_VERSION } from "./translation-benchmark.corpus";
import { TranslationBenchmarkPricing, TranslationBenchmarkSubmission } from "./translation-benchmark.types";

export interface TranslationBenchmarkRunner {
  translate(text: string, targetLanguage: "en" | "zh"): Promise<{ translatedText: string }>;
}

export class ProviderTranslationBenchmarkRunner implements TranslationBenchmarkRunner {
  constructor(private readonly provider: TranslationProvider) {}
  async translate(text: string, targetLanguage: "en" | "zh") {
    const result = await this.provider.translate(text, targetLanguage);
    return { translatedText: result.translatedText };
  }
}

export async function generateTranslationBenchmarkSubmission(runner: TranslationBenchmarkRunner, systemName: string, generatedAt = new Date(), provider = systemName, metadata: { providerVersion?: string; pricing?: TranslationBenchmarkPricing } = {}): Promise<TranslationBenchmarkSubmission> {
  if (!systemName.trim()) throw new Error("systemName is required");
  const candidates = [];
  for (const testCase of TRANSLATION_BENCHMARK_CORPUS) {
    for (const targetLanguage of ["en", "zh"] as const) {
      const result = await runner.translate(testCase.sourceText, targetLanguage);
      if (!result.translatedText.trim()) throw new Error(`Benchmark runner returned an empty result for ${testCase.id}:${targetLanguage}`);
      candidates.push({ caseId: testCase.id, targetLanguage, translatedText: result.translatedText });
    }
  }
  return { benchmarkVersion: TRANSLATION_BENCHMARK_VERSION, systemName, provider, ...metadata, generatedAt: generatedAt.toISOString(), candidates };
}
