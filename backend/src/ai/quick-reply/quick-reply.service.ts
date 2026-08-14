import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../../auth/auth.guard";
import { QuickReplyConfigService } from "./quick-reply.config";
import { QuickReplyContextBuilder } from "./quick-reply-context-builder";
import { QuickReplyAuditService } from "./quick-reply-audit.service";
import { QuickReplySafetyService } from "./quick-reply-safety.service";
import { GenerateQuickRepliesDto, QuickReplyLifecycleEventDto, type QuickReplyGenerationResponseDto } from "./quick-reply.dto";
import type { QuickReplyProvider } from "./quick-reply.types";
import { QUICK_REPLY_PROVIDER } from "./quick-reply.tokens";
import { QuickReplyGenerationStore } from "./quick-reply-generation.store";
import { QuickReplyRateLimitService } from "./quick-reply-rate-limit.service";
import { QuickReplyMetricsService } from "./quick-reply-metrics.service";

@Injectable()
export class QuickReplyService {
  constructor(
    private readonly contextBuilder: QuickReplyContextBuilder,
    @Inject(QUICK_REPLY_PROVIDER) private readonly provider: QuickReplyProvider,
    private readonly safety: QuickReplySafetyService,
    private readonly audit: QuickReplyAuditService,
    private readonly config: QuickReplyConfigService,
    private readonly generations: QuickReplyGenerationStore,
    private readonly rateLimit: QuickReplyRateLimitService,
    private readonly metrics: QuickReplyMetricsService,
  ) {}

  async generate(user: AuthUser, conversationId: string, dto: GenerateQuickRepliesDto = new GenerateQuickRepliesDto()): Promise<QuickReplyGenerationResponseDto> {
    const config = this.config.get();
    if (!config.enabled) throw new NotFoundException("Resource not found");
    if (!config.allowedPlatformRoles.includes(user.role)) throw new ForbiddenException("Quick Reply access is forbidden");
    if (!config.locales.includes(dto.locale)) throw new ForbiddenException("Quick Reply locale is not enabled");

    try {
      await this.rateLimit.consume(user.id, config.requestsPerUserPerMinute);
    } catch (error) {
      this.metrics.record("rate_limited");
      throw error;
    }

    const context = await this.contextBuilder.build(user, conversationId, dto, config.suggestionTtlSeconds);
    if (user.role !== "ADMIN" && !user.memberships?.some((membership) => config.allowedMembershipRoles.includes(membership.role as "STORE_MANAGER" | "STAFF"))) throw new ForbiddenException("Quick Reply access is forbidden");
    if (config.allowedUserIds.length > 0 && !config.allowedUserIds.includes(user.id) && user.role !== "ADMIN") throw new ForbiddenException("Quick Reply access is forbidden");
    if (config.allowedStoreIds.length > 0 && !config.allowedStoreIds.includes(context.storeId) && user.role !== "ADMIN") throw new ForbiddenException("Quick Reply access is forbidden");

    await this.audit.record({ eventType: "REQUESTED", actorUserId: user.id, conversationId, contextMessageId: context.contextMessageId }, user);
    this.metrics.record("requested");
    try {
      const providerResult = await this.withTimeout(this.provider.generate({ context, maxSuggestions: Math.min(dto.maxSuggestions, config.maxSuggestions) }), config.timeoutMs);
      const safetyResult = this.safety.validate(context, providerResult.candidates, Math.min(dto.maxSuggestions, config.maxSuggestions));
      const generationId = randomUUID();
      const suggestions = safetyResult.accepted.map((candidate) => ({ id: randomUUID(), text: candidate.text, intent: candidate.intent, source: candidate.source, confidence: candidate.confidence, grounded: candidate.grounded, riskFlags: candidate.riskFlags, requiresHumanApproval: true as const }));
      const response = { generationId, conversationId, contextMessageId: context.contextMessageId, contextVersion: context.contextVersion, generatedAt: context.builtAt, expiresAt: context.expiresAt, fallbackUsed: safetyResult.fallbackRequired, suggestions };
      this.generations.remember({ generationId, userId: user.id, conversationId, contextMessageId: context.contextMessageId, contextVersion: context.contextVersion, locale: context.locale, suggestionIds: suggestions.map((suggestion) => suggestion.id), expiresAt: Date.parse(context.expiresAt) });
      await this.audit.record({ eventType: "GENERATED", actorUserId: user.id, conversationId, contextMessageId: context.contextMessageId, generationId, providerName: providerResult.providerName, providerVersion: providerResult.providerVersion, sourceTypes: suggestions.map((suggestion) => suggestion.source), riskFlags: [...new Set(suggestions.flatMap((suggestion) => suggestion.riskFlags))], latencyMs: providerResult.latencyMs, outcome: safetyResult.fallbackRequired ? "FALLBACK" : "READY" }, user);
      this.metrics.record(safetyResult.fallbackRequired ? "fallback" : "generated", { suggestionCount: suggestions.length });
      return response;
    } catch (error) {
      await this.audit.record({ eventType: "FAILED", actorUserId: user.id, conversationId, contextMessageId: context.contextMessageId, outcome: "PROVIDER_UNAVAILABLE" }, user);
      this.metrics.record("failed");
      if (error instanceof ConflictException || error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException("Quick Reply is temporarily unavailable");
    }
  }

  async recordLifecycle(user: AuthUser, conversationId: string, dto: QuickReplyLifecycleEventDto) {
    const config = this.config.get();
    if (!config.enabled) throw new NotFoundException("Resource not found");
    const record = this.generations.get(dto.generationId);
    if (!record || record.userId !== user.id || record.conversationId !== conversationId || record.contextVersion !== dto.contextVersion) throw new ConflictException("Quick Reply is stale");
    if (dto.event !== "SHOWN" && (!dto.suggestionId || !record.suggestionIds.includes(dto.suggestionId))) throw new ConflictException("Quick Reply suggestion is stale");
    const current = await this.contextBuilder.build(user, conversationId, { locale: record.locale, maxSuggestions: config.maxSuggestions }, config.suggestionTtlSeconds);
    if (current.contextVersion !== record.contextVersion) {
      this.generations.delete(dto.generationId);
      throw new ConflictException("Quick Reply is stale");
    }
    await this.audit.record({ eventType: dto.event, actorUserId: user.id, conversationId, contextMessageId: record.contextMessageId, generationId: record.generationId, outcome: "ACCEPTED" }, user);
    this.metrics.record("lifecycle", { lifecycle: dto.event });
    return { accepted: true, generationId: dto.generationId, event: dto.event };
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Quick Reply provider timeout")), timeoutMs);
      promise.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("Quick Reply provider failed"));
      });
    });
  }
}
