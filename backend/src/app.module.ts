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
import { MediaModule } from "./media/media.module";

@Module({
  imports: [PrismaModule, AuthModule, CredentialsModule, MediaModule, ClassificationModule, LineProfileModule, LineWebhookModule, LineOfficialAccountsModule, StoreMasterModule],
  controllers: [HealthController, StoresController, ConversationsController, ActivityController, DashboardController, MetadataController, OperationsController],
  providers: [ConversationsService],
})
export class AppModule {}
