/**
 * Product Classification Evaluation Runner
 *
 * Runs all 100 evaluation cases against the live matcher and produces an
 * accuracy report. Target: ≥ 90% overall accuracy.
 *
 * Run with:
 *   npx tsx --test src/classification/product-evaluation.spec.ts
 */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { automaticCatalogAliases, PRODUCT_CATALOG } from "./product-catalog";
import { matchProduct, MatchableModel } from "./product-matcher";
import { EVALUATION_CASES, EvaluationCase } from "./product-evaluation-cases";

// Build models from the static catalog (no DB required — mirrors classification.service.ts)
const MODELS: MatchableModel[] = PRODUCT_CATALOG.map((entry, index) => ({
  id: String(index),
  name: entry.model,
  classificationLevel: entry.level,
  priority: entry.priority,
  aliases: automaticCatalogAliases(entry).map(({ alias, safety, language }) => ({ alias, safety, language, priority: 0 })),
  productSeries: { name: entry.family, productGroup: entry.group },
}));

function detectFromMessage(text: string) {
  return matchProduct([{ id: "eval", text, sentAt: new Date() }], MODELS);
}

// ── Individual case tests ─────────────────────────────────────────────────

for (const evalCase of EVALUATION_CASES) {
  void test(`[eval] ${evalCase.message.substring(0, 60)}`, () => {
    const result = detectFromMessage(evalCase.message);

    if (evalCase.expectedModel === null) {
      assert.equal(
        result?.model.name ?? null,
        null,
        `Expected NO MATCH but got: ${result?.model.name} (${evalCase.notes ?? ""})`,
      );
    } else {
      assert.equal(
        result?.model.name,
        evalCase.expectedModel,
        `Expected "${evalCase.expectedModel}" but got "${result?.model.name ?? "NO MATCH"}" (${evalCase.notes ?? ""})`,
      );
      if (evalCase.expectedDetectionMethod) {
        assert.equal(
          result?.detectionMethod,
          evalCase.expectedDetectionMethod,
          `Expected detectionMethod "${evalCase.expectedDetectionMethod}" but got "${result?.detectionMethod}"`,
        );
      }
    }
  });
}

// ── Accuracy summary (runs after individual tests) ────────────────────────

after(() => {
  const results = EVALUATION_CASES.map((evalCase) => {
    const result = detectFromMessage(evalCase.message);
    const actualModel = result?.model.name ?? null;
    const actualMethod = result?.detectionMethod ?? null;

    const modelCorrect = actualModel === evalCase.expectedModel;
    const methodCorrect =
      !evalCase.expectedDetectionMethod || actualMethod === evalCase.expectedDetectionMethod;
    const correct = modelCorrect && methodCorrect;

    return { evalCase, actualModel, actualMethod, correct };
  });

  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const wrong = total - correct;
  const accuracy = ((correct / total) * 100).toFixed(1);

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║         Product Classification Accuracy Report        ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Total cases : ${String(total).padEnd(37)}║`);
  console.log(`║  Correct     : ${String(correct).padEnd(37)}║`);
  console.log(`║  Wrong       : ${String(wrong).padEnd(37)}║`);
  console.log(`║  Accuracy    : ${`${accuracy}%`.padEnd(37)}║`);
  console.log("╚══════════════════════════════════════════════════════╝");

  if (wrong > 0) {
    console.log("\nFailing cases:");
    for (const r of results.filter((r) => !r.correct)) {
      const c = r.evalCase;
      const expectedStr = c.expectedModel ?? "NO MATCH";
      const gotStr = r.actualModel ?? "NO MATCH";
      const methodNote =
        c.expectedDetectionMethod && r.actualMethod !== c.expectedDetectionMethod
          ? ` [method: expected=${c.expectedDetectionMethod} got=${r.actualMethod}]`
          : "";
      console.log(`  ✗ "${c.message}"`);
      console.log(`    expected: ${expectedStr}  got: ${gotStr}${methodNote}`);
      if (c.notes) console.log(`    notes: ${c.notes}`);
    }
  }

  // Accuracy must meet production threshold
  assert.ok(
    correct / total >= 0.9,
    `Accuracy ${accuracy}% is below the 90% production threshold (${wrong} failing cases)`,
  );
});
