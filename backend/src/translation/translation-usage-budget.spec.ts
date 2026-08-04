import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TRANSLATION_DAILY_CHARACTER_LIMIT, readTranslationDailyCharacterLimit, TranslationConfig } from "./translation.config";
import { bangkokCalendarDate, TranslationUsageBudget } from "./translation-usage-budget";

test("daily usage increments until the configured limit and then rejects", () => {
  const budget = new TranslationUsageBudget({ dailyCharacterLimit: 10 } as TranslationConfig);
  assert.equal(budget.consume(4), true);
  assert.equal(budget.consume(6), true);
  assert.equal(budget.consume(1), false);
  assert.deepEqual(budget.snapshot(), { dailyCharacterUsage: 10, dailyCharacterLimit: 10, budgetExceededRequests: 1 });
});

test("a fresh process-local budget starts with zero usage", () => {
  const config = { dailyCharacterLimit: 10 } as TranslationConfig;
  const firstProcess = new TranslationUsageBudget(config);
  firstProcess.consume(8);
  const restartedProcess = new TranslationUsageBudget(config);
  assert.equal(restartedProcess.snapshot().dailyCharacterUsage, 0);
});

test("missing daily limit uses the safe default and invalid limits fail validation", () => {
  assert.equal(readTranslationDailyCharacterLimit({}), DEFAULT_TRANSLATION_DAILY_CHARACTER_LIMIT);
  assert.equal(readTranslationDailyCharacterLimit({ TRANSLATION_DAILY_CHARACTER_LIMIT: "75000" }), 75_000);
  assert.throws(() => readTranslationDailyCharacterLimit({ TRANSLATION_DAILY_CHARACTER_LIMIT: "0" }), /positive integer/);
});

test("calendar reset key follows Asia/Bangkok rather than UTC", () => {
  assert.equal(bangkokCalendarDate(new Date("2026-08-04T16:59:59.000Z")), "2026-08-04");
  assert.equal(bangkokCalendarDate(new Date("2026-08-04T17:00:00.000Z")), "2026-08-05");
});

test("usage and exceeded count reset at the next Asia/Bangkok calendar date", () => {
  let now = new Date("2026-08-04T16:59:59.000Z");
  const budget = new TranslationUsageBudget({ dailyCharacterLimit: 5 } as TranslationConfig, () => now);
  assert.equal(budget.consume(5), true);
  assert.equal(budget.consume(1), false);
  now = new Date("2026-08-04T17:00:00.000Z");
  assert.deepEqual(budget.snapshot(), { dailyCharacterUsage: 0, dailyCharacterLimit: 5, budgetExceededRequests: 0 });
});
