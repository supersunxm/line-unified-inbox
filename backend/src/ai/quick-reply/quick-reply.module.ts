import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma.module";
import { AuthModule } from "../../auth/auth.module";
import { QuickReplyConfigService } from "./quick-reply.config";
import { QuickReplyContextBuilder } from "./quick-reply-context-builder";
import { DeterministicQuickReplyProvider } from "./deterministic-quick-reply.provider";
import { QuickReplySafetyService } from "./quick-reply-safety.service";
import { QuickReplyAuditService } from "./quick-reply-audit.service";
import { QuickReplyService } from "./quick-reply.service";
import { MobileQuickReplyController } from "./mobile-quick-reply.controller";
import { QUICK_REPLY_PROVIDER } from "./quick-reply.tokens";
import { QuickReplyGenerationStore } from "./quick-reply-generation.store";
import { QuickReplyRateLimitService } from "./quick-reply-rate-limit.service";
import { QuickReplyMetricsService } from "./quick-reply-metrics.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MobileQuickReplyController],
  providers: [QuickReplyConfigService, QuickReplyContextBuilder, DeterministicQuickReplyProvider, QuickReplySafetyService, QuickReplyAuditService, QuickReplyGenerationStore, QuickReplyRateLimitService, QuickReplyMetricsService, QuickReplyService, { provide: QUICK_REPLY_PROVIDER, useExisting: DeterministicQuickReplyProvider }],
  exports: [QuickReplyService],
})
export class QuickReplyModule {}
