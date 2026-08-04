import { TranslationProvider } from "../translation.provider";
import { GlossaryTranslationProvider } from "./glossary-translation.provider";
import { OPPO_PROTECTED_SOURCE_TERMS } from "./oppo-translation-glossary";
import { TranslationGlossaryService } from "./translation-glossary.service";

export const TRANSLATION_GLOSSARY_SMOKE_TEXT = "ลูกค้าสนใจ OPPO Reno16 ใน Find Series ที่ใช้ ColorOS และ SUPERVOOC พร้อม AI Eraser และ AI Studio";

export type TranslationGlossarySmokeResult = {
  providerCalls: number;
  termsTested: number;
  termsPreserved: boolean;
  success: boolean;
};

export class TranslationGlossarySmokeTest {
  constructor(private readonly provider: TranslationProvider) {}

  async run(): Promise<TranslationGlossarySmokeResult> {
    let providerCalls = 0;
    const countedProvider: TranslationProvider = {
      translate: async (text, targetLanguage) => {
        providerCalls += 1;
        return this.provider.translate(text, targetLanguage);
      },
    };
    const glossaryProvider = new GlossaryTranslationProvider(countedProvider, new TranslationGlossaryService());

    try {
      const result = await glossaryProvider.translate(TRANSLATION_GLOSSARY_SMOKE_TEXT, "en");
      const termsPreserved = OPPO_PROTECTED_SOURCE_TERMS.every((term) => result.translatedText.includes(term));
      return {
        providerCalls,
        termsTested: OPPO_PROTECTED_SOURCE_TERMS.length,
        termsPreserved,
        success: providerCalls === 1 && termsPreserved,
      };
    } catch {
      return {
        providerCalls,
        termsTested: OPPO_PROTECTED_SOURCE_TERMS.length,
        termsPreserved: false,
        success: false,
      };
    }
  }
}
