import { BadGatewayException, Inject, Injectable, Logger, ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { TranslationTargetLanguage } from "./dto/create-message-translation.dto";
import { TranslationConfig } from "./translation.config";
import { TRANSLATION_PROVIDER, TranslationProvider, TranslationProviderError } from "./translation.provider";

export type MessageTranslationStatus = "TRANSLATED" | "CACHED" | "SAME_LANGUAGE" | "UNSUPPORTED_MESSAGE" | "UNSUPPORTED_LANGUAGE";

export type MessageTranslationResponse = {
  messageId: string;
  targetLanguage: TranslationTargetLanguage;
  status: MessageTranslationStatus;
  translatedText: string;
  cached: boolean;
};

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: TranslationConfig,
    @Inject(TRANSLATION_PROVIDER) private readonly provider: TranslationProvider | null,
  ) {}

  async translateMessage(messageId: string, targetLanguage: TranslationTargetLanguage, actingUserId: string): Promise<MessageTranslationResponse> {
    const startedAt = Date.now();
    if (!this.config.enabled) {
      this.logResult(messageId, actingUserId, targetLanguage, "UNAVAILABLE", startedAt, "FEATURE_DISABLED");
      throw new ServiceUnavailableException("Message translation is unavailable");
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        direction: true,
        messageType: true,
        originalText: true,
        originalLanguage: true,
        translatedEnglish: true,
        translatedChinese: true,
      },
    });

    if (!message || message.direction !== "INBOUND" || message.messageType !== "TEXT" || !message.originalText.trim()) {
      this.logResult(messageId, actingUserId, targetLanguage, "UNSUPPORTED_MESSAGE", startedAt, "MESSAGE_INELIGIBLE");
      throw new UnprocessableEntityException("Message is not eligible for translation");
    }

    const cachedText = targetLanguage === "en" ? message.translatedEnglish : message.translatedChinese;
    if (cachedText) {
      this.logResult(messageId, actingUserId, targetLanguage, "CACHED", startedAt);
      return { messageId, targetLanguage, status: "CACHED", translatedText: cachedText, cached: true };
    }

    if (message.originalLanguage?.toLowerCase() === targetLanguage) {
      this.logResult(messageId, actingUserId, targetLanguage, "SAME_LANGUAGE", startedAt);
      return { messageId, targetLanguage, status: "SAME_LANGUAGE", translatedText: message.originalText, cached: true };
    }

    if (!this.provider) {
      this.logResult(messageId, actingUserId, targetLanguage, "UNAVAILABLE", startedAt, "PROVIDER_NOT_CONFIGURED");
      throw new ServiceUnavailableException("Message translation provider is unavailable");
    }

    try {
      const result = await this.provider.translate(message.originalText, targetLanguage);
      await this.prisma.message.update({
        where: { id: message.id },
        data: targetLanguage === "en" ? { translatedEnglish: result.translatedText } : { translatedChinese: result.translatedText },
        select: { id: true },
      });
      this.logResult(messageId, actingUserId, targetLanguage, "TRANSLATED", startedAt);
      return { messageId, targetLanguage, status: "TRANSLATED", translatedText: result.translatedText, cached: false };
    } catch (error: unknown) {
      const category = error instanceof TranslationProviderError ? error.category : "PROVIDER_REQUEST_FAILED";
      this.logResult(messageId, actingUserId, targetLanguage, "FAILED", startedAt, category);
      throw new BadGatewayException("Message translation failed");
    }
  }

  private logResult(messageId: string, actingUserId: string, targetLanguage: TranslationTargetLanguage, status: string, startedAt: number, errorCategory?: string) {
    const entry = { messageId, actingUserId, targetLanguage, status, durationMs: Date.now() - startedAt, ...(errorCategory ? { errorCategory } : {}) };
    if (errorCategory) this.logger.warn(entry);
    else this.logger.log(entry);
  }
}
