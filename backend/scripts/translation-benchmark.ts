import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { TRANSLATION_BENCHMARK_CORPUS, TRANSLATION_BENCHMARK_VERSION } from "../src/translation/benchmark/translation-benchmark.corpus";
import { evaluateTranslationBenchmark } from "../src/translation/benchmark/translation-benchmark";
import { TranslationBenchmarkSubmission } from "../src/translation/benchmark/translation-benchmark.types";
import { OPPO_RETAIL_TRANSLATION_GLOSSARY } from "../src/translation/benchmark/oppo-retail-glossary";
import { TRANSLATION_BENCHMARK_CATEGORY_WEIGHTS } from "../src/translation/benchmark/translation-benchmark.metadata";
import { createTranslationBenchmarkSnapshot, serializeTranslationBenchmarkSnapshot } from "../src/translation/benchmark/translation-benchmark.snapshot";

async function main() {
  const inputPath = process.argv[2];
  if (inputPath === "--describe") {
    console.log(JSON.stringify({ benchmarkVersion: TRANSLATION_BENCHMARK_VERSION, cases: TRANSLATION_BENCHMARK_CORPUS.length, targets: ["en", "zh"], candidatesRequired: TRANSLATION_BENCHMARK_CORPUS.length * 2, glossaryTerms: OPPO_RETAIL_TRANSLATION_GLOSSARY.length, categoryWeights: TRANSLATION_BENCHMARK_CATEGORY_WEIGHTS, humanReviewDimensions: ["adequacy", "fluency", "terminology", "safety", "notes"] }, null, 2));
    return;
  }
  if (!inputPath) throw new Error("Usage: npm run translation:benchmark -- <candidate-output.json> [--snapshot-output <snapshot.json>]");
  const raw = await readFile(resolve(inputPath), "utf8");
  const submission = JSON.parse(raw) as TranslationBenchmarkSubmission;
  const report = evaluateTranslationBenchmark(submission);
  console.log(JSON.stringify(report, null, 2));
  const snapshotFlagIndex = process.argv.indexOf("--snapshot-output");
  if (snapshotFlagIndex >= 0) {
    const snapshotPath = process.argv[snapshotFlagIndex + 1];
    if (!snapshotPath) throw new Error("--snapshot-output requires a file path");
    await writeFile(resolve(snapshotPath), serializeTranslationBenchmarkSnapshot(createTranslationBenchmarkSnapshot(report)), { encoding: "utf8", flag: "wx" });
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Translation benchmark failed");
  process.exitCode = 1;
});
