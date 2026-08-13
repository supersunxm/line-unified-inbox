import { Module } from "@nestjs/common";
import { ActivityController } from "./activity.controller";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { CustomersController } from "./customers.controller";
import { DashboardController } from "./dashboard.controller";
import { HealthController } from "./health.controller";
import { MetadataController } from "./metadata.controller";
import { PrismaModule } from "./prisma.module";
import { StoresController } from "./stores.controller";
import { LineWebhookModule } from "./webhooks/line/line-webhook.module";
import { CredentialsModule } from "./credentials/credentials.module";
import { LineOfficialAccountsModule } from "./line-official-accounts/line-official-accounts.module";
import { ClassificationModule } from "./classification/classification.module";
import { LineProfileModule } from "./line-profile.module";
import { StoreMasterModule } from "./store-master/store-master.module";
import { AuthModule } from "./auth/auth.module";
import { OperationsController } from "./operations.controller";
import { OperationsModule } from "./operations/operations.module";
import { MediaModule } from "./media/media.module";
import { FollowerInsightsModule } from "./follower-insights/follower-insights.module";
import { FriendSourceLinksModule } from "./friend-source-links/friend-source-links.module";
import { ClassificationInsightsModule } from "./classification-insights/classification-insights.module";
import { TranslationModule } from "./translation/translation.module";
import { CustomerIntelligenceService } from "./customer-intelligence.service";

import { DashboardAnalyticsService } from "./dashboard-analytics.service";
import { OperationReportService } from "./operation-report.service";
import { RootCauseService } from "./ai/root-cause.service";
import { RecommendationService } from "./ai/recommendation.service";
import { ExecutiveBriefModule } from "./ai/executive-brief/executive-brief.module";
import { BiAssistantModule } from "./ai/bi-assistant/bi-assistant.module";
import { ActionAgentModule } from "./ai/action-agent/action-agent.module";
import { ImpactEngineModule } from "./ai/impact-engine/impact-engine.module";
import { AiTelemetryModule } from "./ai/telemetry/ai-telemetry.module";
import { OperationalMemoryModule } from "./ai/memory/operational-memory.module";
import { LineMessagingService } from "./line-messaging/line-messaging.service";
import { MobileConversationsController } from "./mobile/mobile-conversations.controller";
import { MobileConversationsService } from "./mobile/mobile-conversations.service";
import { MobileNotificationsController } from "./mobile/mobile-notifications.controller";
import { MobileNotificationsService } from "./mobile/mobile-notifications.service";
import { MobileConfigController } from "./mobile/mobile-config.controller";
import { MobileConfigService } from "./mobile/mobile-config.service";
import { RealtimeModule } from "./realtime/realtime.module";
import { MassMessageModule } from "./mass-message/mass-message.module";

@Module({
  imports: [PrismaModule, AuthModule, RealtimeModule, CredentialsModule, MediaModule, ClassificationModule, ClassificationInsightsModule, LineProfileModule, LineWebhookModule, LineOfficialAccountsModule, StoreMasterModule, FollowerInsightsModule, FriendSourceLinksModule, TranslationModule, OperationsModule, ExecutiveBriefModule, BiAssistantModule, ActionAgentModule, ImpactEngineModule, AiTelemetryModule, OperationalMemoryModule, MassMessageModule],
  controllers: [HealthController, StoresController, ConversationsController, ActivityController, DashboardController, MetadataController, OperationsController, CustomersController, MobileConversationsController, MobileNotificationsController, MobileConfigController],
  providers: [ConversationsService, LineMessagingService, DashboardAnalyticsService, OperationReportService, CustomerIntelligenceService, RootCauseService, RecommendationService, MobileConversationsService, MobileNotificationsService, MobileConfigService],
})
export class AppModule {}
