import { Module } from "@nestjs/common";
import { ActivityController } from "./activity.controller";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
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

import { DashboardAnalyticsService } from "./dashboard-analytics.service";
import { OperationReportService } from "./operation-report.service";

@Module({
  imports: [PrismaModule, AuthModule, CredentialsModule, MediaModule, ClassificationModule, ClassificationInsightsModule, LineProfileModule, LineWebhookModule, LineOfficialAccountsModule, StoreMasterModule, FollowerInsightsModule, FriendSourceLinksModule, TranslationModule, OperationsModule],
  controllers: [HealthController, StoresController, ConversationsController, ActivityController, DashboardController, MetadataController, OperationsController],
  providers: [ConversationsService, DashboardAnalyticsService, OperationReportService],
})
export class AppModule {}
