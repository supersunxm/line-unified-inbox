import { TranslationTargetLanguage } from "./dto/create-message-translation.dto";

export type TranslationProviderResult = {
  translatedText: string;
  detectedLanguage?: string;
  characterCount: number;
  provider: "google";
};

export interface TranslationProvider {
  translate(text: string, targetLanguage: TranslationTargetLanguage): Promise<TranslationProviderResult>;
}

export const TRANSLATION_PROVIDER = Symbol("TRANSLATION_PROVIDER");

export class TranslationProviderError extends Error {
  constructor(readonly category: "EMPTY_RESPONSE" | "PROVIDER_REQUEST_FAILED") {
    super("Translation provider request failed");
    this.name = "TranslationProviderError";
  }
}
