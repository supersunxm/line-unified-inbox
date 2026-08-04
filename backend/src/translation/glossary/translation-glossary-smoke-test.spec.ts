import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { TranslationProvider } from "../translation.provider";
import { OPPO_PROTECTED_SOURCE_TERMS } from "./oppo-translation-glossary";
import { TranslationGlossarySmokeTest, TRANSLATION_GLOSSARY_SMOKE_TEXT } from "./translation-glossary-smoke-test";

test("glossary smoke test makes one provider call and preserves every protected term", async () => {
  let providerInput = "";
  const provider: TranslationProvider = {
    async translate(text) {
      providerInput = text;
      return { translatedText: text, characterCount: Array.from(text).length, provider: "google" };
    },
  };
  const result = await new TranslationGlossarySmokeTest(provider).run();
  assert.deepEqual(result, { providerCalls: 1, termsTested: 7, termsPreserved: true, success: true });
  assert.equal(TRANSLATION_GLOSSARY_SMOKE_TEXT.includes("ลูกค้า"), true);
  for (const term of OPPO_PROTECTED_SOURCE_TERMS) assert.equal(providerInput.includes(term), false);
});

test("glossary smoke test fails when a protected placeholder is changed", async () => {
  const provider: TranslationProvider = {
    async translate(text) {
      return { translatedText: text.replace(/ZXQG0QXZ/u, "changed"), characterCount: Array.from(text).length, provider: "google" };
    },
  };
  assert.deepEqual(await new TranslationGlossarySmokeTest(provider).run(), { providerCalls: 1, termsTested: 7, termsPreserved: false, success: false });
});

test("glossary smoke test sanitizes provider failure and never retries", async () => {
  const provider: TranslationProvider = {
    async translate() {
      throw new Error("credential and provider details must not escape");
    },
  };
  assert.deepEqual(await new TranslationGlossarySmokeTest(provider).run(), { providerCalls: 1, termsTested: 7, termsPreserved: false, success: false });
});

test("glossary smoke test has no database or application-message dependency", async () => {
  const sources = await Promise.all([
    readFile(join(process.cwd(), "src/translation/glossary/translation-glossary-smoke-test.ts"), "utf8"),
    readFile(join(process.cwd(), "scripts/translation-glossary-smoke-test.ts"), "utf8"),
  ]);
  for (const source of sources) assert.doesNotMatch(source, /prisma|database_url|message\.find|message\.create|message\.update/i);
});
