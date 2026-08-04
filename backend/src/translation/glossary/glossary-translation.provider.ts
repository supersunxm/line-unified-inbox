import { TranslationTargetLanguage } from "../dto/create-message-translation.dto";
import { TranslationProvider, TranslationProviderResult } from "../translation.provider";
import { TranslationGlossaryService } from "./translation-glossary.service";

export class GlossaryTranslationProvider implements TranslationProvider {
  constructor(
    private readonly provider: TranslationProvider,
    private readonly glossary: TranslationGlossaryService,
  ) {}

  async translate(text: string, targetLanguage: TranslationTargetLanguage): Promise<TranslationProviderResult> {
    const protectedInput = this.glossary.protect(text);
    const result = await this.provider.translate(protectedInput.text, targetLanguage);
    return {
      ...result,
      translatedText: protectedInput.restore(result.translatedText),
      characterCount: Array.from(text).length,
    };
  }
}
