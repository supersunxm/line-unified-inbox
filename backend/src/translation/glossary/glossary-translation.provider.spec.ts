import assert from "node:assert/strict";
import test from "node:test";
import { TranslationProvider } from "../translation.provider";
import { GlossaryTranslationProvider } from "./glossary-translation.provider";
import { TranslationGlossaryService } from "./translation-glossary.service";

test("runtime glossary protects OPPO terms around exactly one provider call", async () => {
  const source = "OPPO Reno16 ใช้ ColorOS และ SUPERVOOC พร้อม AI Eraser, AI Studio และ Find Series";
  let providerCalls = 0;
  let providerInput = "";
  const provider: TranslationProvider = {
    async translate(text) {
      providerCalls += 1;
      providerInput = text;
      return { translatedText: `Translated ${text}`, detectedLanguage: "th", characterCount: Array.from(text).length, provider: "google" };
    },
  };

  const result = await new GlossaryTranslationProvider(provider, new TranslationGlossaryService()).translate(source, "en");
  assert.equal(providerCalls, 1);
  for (const term of ["OPPO", "Reno16", "ColorOS", "SUPERVOOC", "AI Eraser", "AI Studio", "Find Series"]) {
    assert.equal(providerInput.includes(term), false);
    assert.equal(result.translatedText.includes(term), true);
  }
  assert.equal(source, "OPPO Reno16 ใช้ ColorOS และ SUPERVOOC พร้อม AI Eraser, AI Studio และ Find Series");
  assert.equal(result.characterCount, Array.from(source).length);
  assert.equal(result.detectedLanguage, "th");
});

test("runtime glossary leaves unrelated source and output unchanged", async () => {
  const provider: TranslationProvider = {
    async translate(text) {
      return { translatedText: text, characterCount: Array.from(text).length, provider: "google" };
    },
  };
  const source = "มีโทรศัพท์สีดำไหมครับ";
  const result = await new GlossaryTranslationProvider(provider, new TranslationGlossaryService()).translate(source, "zh");
  assert.equal(result.translatedText, source);
});

test("runtime glossary placeholder restoration does not cascade", async () => {
  const provider: TranslationProvider = {
    async translate(text) {
      return { translatedText: `${text} OPPO`, characterCount: Array.from(text).length, provider: "google" };
    },
  };
  const result = await new GlossaryTranslationProvider(provider, new TranslationGlossaryService()).translate("AI Studio", "en");
  assert.equal(result.translatedText, "AI Studio OPPO");
});
