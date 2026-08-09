/**
 * Product Golden Evaluation Benchmark Runner
 *
 * Runs all 160+ golden evaluation cases against the live matcher and produces a
 * comprehensive, independent benchmark report:
 *   - Overall Accuracy
 *   - False-Positive Rate (non-OPPO / ambiguous inputs falsely matched)
 *   - False-Negative Rate (valid OPPO queries missed)
 *   - Category Breakdown
 *   - List of failing cases
 *
 * Run with:
 *   npx tsx --test src/classification/product-golden-evaluation.spec.ts
 */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { automaticCatalogAliases, PRODUCT_CATALOG } from "./product-catalog";
import { matchProduct, MatchableModel } from "./product-matcher";
import { GOLDEN_EVALUATION_CASES, GoldenEvaluationCase } from "./product-golden-evaluation-cases";

const MODELS: MatchableModel[] = PRODUCT_CATALOG.map((entry, index) => ({
  id: String(index),
  name: entry.model,
  classificationLevel: entry.level,
  priority: entry.priority,
  aliases: automaticCatalogAliases(entry).map(({ alias, safety, language }) => ({
    alias,
    safety,
    language,
    priority: 0,
  })),
  productSeries: { name: entry.family, productGroup: entry.group },
}));

function detect(text: string) {
  return matchProduct([{ id: "golden-eval", text, sentAt: new Date() }], MODELS);
}

// ── Run Individual Tests ──────────────────────────────────────────────────

for (const c of GOLDEN_EVALUATION_CASES) {
  void test(`[golden] ${c.id}: "${c.message}"`, () => {
    const result = detect(c.message);
    const actual = result?.model.name ?? null;

    if (c.expectedModel === null) {
      assert.equal(
        actual,
        null,
        `False Positive: expected null but matched "${actual}" (${c.description})`,
      );
    } else {
      assert.equal(
        actual,
        c.expectedModel,
        `Mismatch: expected "${c.expectedModel}" but got "${actual ?? "NO MATCH"}" (${c.description})`,
      );
    }
  });
}

// ── Benchmark Report ──────────────────────────────────────────────────────

after(() => {
  const results = GOLDEN_EVALUATION_CASES.map((c) => {
    const result = detect(c.message);
    const actual = result?.model.name ?? null;
    const correct = actual === c.expectedModel;
    const isFalsePositive = c.expectedModel === null && actual !== null;
    const isFalseNegative = c.expectedModel !== null && actual === null;
    const isMismatch = c.expectedModel !== null && actual !== null && actual !== c.expectedModel;

    return {
      case: c,
      actual,
      detectionMethod: result?.detectionMethod ?? null,
      matchedPhrase: result?.matchedPhrase ?? null,
      correct,
      isFalsePositive,
      isFalseNegative,
      isMismatch,
    };
  });

  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const incorrect = total - correct;
  const falsePositives = results.filter((r) => r.isFalsePositive).length;
  const falseNegatives = results.filter((r) => r.isFalseNegative).length;
  const mismatches = results.filter((r) => r.isMismatch).length;
  const accuracy = ((correct / total) * 100).toFixed(1);

  // Category Breakdown
  const categories = [...new Set(GOLDEN_EVALUATION_CASES.map((c) => c.category))];
  const byCategory = categories.map((cat) => {
    const catResults = results.filter((r) => r.case.category === cat);
    const catTotal = catResults.length;
    const catCorrect = catResults.filter((r) => r.correct).length;
    const catAccuracy = ((catCorrect / catTotal) * 100).toFixed(1);
    return { category: cat, total: catTotal, correct: catCorrect, accuracy: `${catAccuracy}%` };
  });

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║           PRODUCT INTELLIGENCE GOLDEN BENCHMARK REPORT           ║");
  console.log("╠══════════════════════════════════════════════════════════════════╣");
  console.log(`║  Total Evaluation Cases  : ${String(total).padEnd(38)}║`);
  console.log(`║  Correct Predictions     : ${String(correct).padEnd(38)}║`);
  console.log(`║  Incorrect Predictions   : ${String(incorrect).padEnd(38)}║`);
  console.log(`║  False Positives (FP)    : ${String(falsePositives).padEnd(38)}║`);
  console.log(`║  False Negatives (FN)    : ${String(falseNegatives).padEnd(38)}║`);
  console.log(`║  Model Mismatches        : ${String(mismatches).padEnd(38)}║`);
  console.log(`║  Exact Product Accuracy  : ${`${accuracy}%`.padEnd(38)}║`);
  console.log("╠══════════════════════════════════════════════════════════════════╣");
  console.log("║                      CATEGORY BREAKDOWN                          ║");
  console.log("╠══════════════════════════════════════════════════════════════════╣");
  for (const cat of byCategory) {
    const line = `  ${cat.category.padEnd(26)} : ${cat.correct}/${cat.total} (${cat.accuracy})`;
    console.log(`║${line.padEnd(66)}║`);
  }
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  if (incorrect > 0) {
    console.log("── Failed Cases ─────────────────────────────────────────────────");
    for (const r of results.filter((r) => !r.correct)) {
      const c = r.case;
      console.log(`  ✗ [${c.id}] "${c.message}"`);
      console.log(`    Expected : ${c.expectedModel ?? "null (NO MATCH)"}`);
      console.log(`    Actual   : ${r.actual ?? "null (NO MATCH)"} [${r.detectionMethod ?? "none"}] matched="${r.matchedPhrase ?? ""}"`);
      console.log(`    Category : ${c.category} | ${c.description}\n`);
    }
  }

  // Golden benchmark assertion threshold
  assert.ok(
    correct / total >= 0.95,
    `Golden Benchmark accuracy ${accuracy}% is below the 95% threshold (${incorrect} failed)`,
  );
});
