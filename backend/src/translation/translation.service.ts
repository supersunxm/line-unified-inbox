import { BadGatewayException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { TranslationTargetLanguage } from "./dto/create-message-translation.dto";
import { TranslationConfig } from "./translation.config";
import { TRANSLATION_PROVIDER, TranslationProvider, TranslationProviderError } from "./translation.provider";
import { TranslationAuditLogger } from "./translation-audit.logger";
import { TRANSLATION_RATE_LIMITER, TranslationRateLimiter } from "./translation-rate-limiter";
import { TranslationMetrics, TranslationMetricOutcome } from "./translation-metrics";
import { TranslationUsageBudget } from "./translation-usage-budget";
import { TranslationFeedbackService, TranslationFeedbackSignal } from "./translation-feedback";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: TranslationConfig,
    @Inject(TRANSLATION_PROVIDER) private readonly provider: TranslationProvider | null,
    @Inject(TRANSLATION_RATE_LIMITER) private readonly rateLimiter: TranslationRateLimiter,
    private readonly auditLogger: TranslationAuditLogger,
    private readonly metrics: TranslationMetrics,
    private readonly usageBudget: TranslationUsageBudget,
    private readonly feedback: TranslationFeedbackService,
  ) {}

  async translateMessage(messageId: string, targetLanguage: TranslationTargetLanguage, actingUserId: string): Promise<MessageTranslationResponse> {
    const startedAt = Date.now();
    if (!this.config.enabled) {
      this.logResult(messageId, actingUserId, targetLanguage, "UNAVAILABLE", startedAt, "FEATURE_DISABLED");
      throw new ServiceUnavailableException("Message translation is unavailable");
    }
    if (!this.config.pilotMode) {
      this.logResult(messageId, actingUserId, targetLanguage, "UNAVAILABLE", startedAt, "PILOT_DISABLED");
      throw new ServiceUnavailableException("Message translation is unavailable");
    }
    if (!this.config.allowedAdminIds.includes(actingUserId)) {
      this.auditLogger.recordPilotAccessBlocked(actingUserId);
      throw new ForbiddenException("Message translation pilot access denied");
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
      this.recordMetric("FAILURE", startedAt, message?.originalText ? Array.from(message.originalText).length : undefined);
      throw new UnprocessableEntityException("Message is not eligible for translation");
    }

    const cachedText = targetLanguage === "en" ? message.translatedEnglish : message.translatedChinese;
    if (cachedText) {
      this.logResult(messageId, actingUserId, targetLanguage, "CACHED", startedAt);
      this.recordMetric("CACHED", startedAt, Array.from(message.originalText).length);
      return { messageId, targetLanguage, status: "CACHED", translatedText: cachedText, cached: true };
    }

    if (message.originalLanguage?.toLowerCase() === targetLanguage) {
      this.logResult(messageId, actingUserId, targetLanguage, "SAME_LANGUAGE", startedAt);
      this.recordMetric("CACHED", startedAt, Array.from(message.originalText).length);
      return { messageId, targetLanguage, status: "SAME_LANGUAGE", translatedText: message.originalText, cached: true };
    }

    if (!this.provider) {
      this.logResult(messageId, actingUserId, targetLanguage, "UNAVAILABLE", startedAt, "PROVIDER_NOT_CONFIGURED");
      this.recordMetric("FAILURE", startedAt, Array.from(message.originalText).length);
      throw new ServiceUnavailableException("Message translation provider is unavailable");
    }

    const characterCount = Array.from(message.originalText).length;
    if (!this.rateLimiter.consume(actingUserId)) {
      this.logResult(messageId, actingUserId, targetLanguage, "RATE_LIMITED", startedAt, "RATE_LIMIT_EXCEEDED", characterCount);
      this.recordMetric("RATE_LIMITED", startedAt, characterCount);
      throw new HttpException("Message translation rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!this.usageBudget.consume(characterCount)) {
      this.logResult(messageId, actingUserId, targetLanguage, "RATE_LIMITED", startedAt, "DAILY_CHARACTER_BUDGET_EXCEEDED", characterCount);
      this.recordMetric("RATE_LIMITED", startedAt, characterCount);
      throw new HttpException("Message translation daily budget exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }

    let result;
    try {
      result = await this.provider.translate(message.originalText, targetLanguage);
    } catch (error: unknown) {
      const category = error instanceof TranslationProviderError ? error.category : "PROVIDER_REQUEST_FAILED";
      this.logResult(messageId, actingUserId, targetLanguage, "FAILED", startedAt, category, characterCount);
      this.recordMetric("FAILURE", startedAt, characterCount, true);
      throw new BadGatewayException("Message translation failed");
    }

    try {
      await this.prisma.message.update({
        where: { id: message.id },
        data: targetLanguage === "en" ? { translatedEnglish: result.translatedText } : { translatedChinese: result.translatedText },
        select: { id: true },
      });
      this.logResult(messageId, actingUserId, targetLanguage, "TRANSLATED", startedAt, undefined, result.characterCount, result.provider);
      this.recordMetric("SUCCESS", startedAt, result.characterCount);
      return { messageId, targetLanguage, status: "TRANSLATED", translatedText: result.translatedText, cached: false };
    } catch {
      this.logResult(messageId, actingUserId, targetLanguage, "FAILED", startedAt, "PERSISTENCE_FAILED", characterCount, result.provider);
      this.recordMetric("FAILURE", startedAt, characterCount);
      throw new BadGatewayException("Message translation failed");
    }
  }

  recordFeedbackAfterSuccess(status: MessageTranslationStatus, signal: TranslationFeedbackSignal): void {
    this.feedback.recordAfterSuccessfulTranslation(status, signal);
  }

  private logResult(messageId: string, actingUserId: string, targetLanguage: TranslationTargetLanguage, status: string, startedAt: number, errorCategory?: string, characterCount?: number, provider = this.config.provider) {
    this.auditLogger.record({ messageId, actingUserId, targetLanguage, provider, status, durationMs: Date.now() - startedAt, ...(characterCount === undefined ? {} : { characterCount }), ...(errorCategory ? { errorCategory } : {}) });
  }

  private recordMetric(outcome: TranslationMetricOutcome, startedAt: number, characterCount?: number, providerFailure = false) {
    this.metrics.record({ outcome, durationMs: Date.now() - startedAt, ...(characterCount === undefined ? {} : { characterCount }), ...(providerFailure ? { providerFailure: true } : {}) });
  }
}
