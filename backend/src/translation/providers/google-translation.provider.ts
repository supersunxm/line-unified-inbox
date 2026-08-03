import { v3 } from "@google-cloud/translate";
import { TranslationTargetLanguage } from "../dto/create-message-translation.dto";
import { GoogleTranslationCredentials } from "../translation.config";
import { TranslationProvider, TranslationProviderError, TranslationProviderResult } from "../translation.provider";

type GoogleTranslationRequest = {
  parent: string;
  contents: string[];
  mimeType: "text/plain";
  sourceLanguageCode: "th";
  targetLanguageCode: "en" | "zh-CN";
};

type GoogleTranslationResponse = {
  translations?: Array<{ translatedText?: string | null; detectedLanguageCode?: string | null }> | null;
};

export interface GoogleTranslationClient {
  translateText(request: GoogleTranslationRequest): Promise<[GoogleTranslationResponse, ...unknown[]]>;
}

export type GoogleTranslationProviderOptions = {
  projectId: string;
  credentials: GoogleTranslationCredentials;
  client?: GoogleTranslationClient;
};

export class GoogleTranslationProvider implements TranslationProvider {
  private readonly client: GoogleTranslationClient;

  constructor(private readonly options: GoogleTranslationProviderOptions) {
    this.client = options.client ?? new v3.TranslationServiceClient({ projectId: options.projectId, credentials: options.credentials });
  }

  async translate(text: string, targetLanguage: TranslationTargetLanguage): Promise<TranslationProviderResult> {
    try {
      const [response] = await this.client.translateText({
        parent: `projects/${this.options.projectId}/locations/global`,
        contents: [text],
        mimeType: "text/plain",
        sourceLanguageCode: "th",
        targetLanguageCode: targetLanguage === "zh" ? "zh-CN" : "en",
      });
      const translation = response.translations?.[0];
      const translatedText = translation?.translatedText?.trim();
      if (!translatedText) throw new TranslationProviderError("EMPTY_RESPONSE");
      const detectedLanguage = translation?.detectedLanguageCode;
      return {
        translatedText,
        ...(detectedLanguage ? { detectedLanguage } : {}),
        characterCount: [...text].length,
        provider: "google",
      };
    } catch (error: unknown) {
      if (error instanceof TranslationProviderError) throw error;
      throw new TranslationProviderError("PROVIDER_REQUEST_FAILED");
    }
  }
}
