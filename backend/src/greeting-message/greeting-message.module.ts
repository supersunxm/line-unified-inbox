import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { LineMessagingService } from "../line-messaging/line-messaging.service";
import { LineProfileService } from "../line-profile.service";
import { AuditLogService } from "../auth/audit-log.service";
import { AuthModule } from "../auth/auth.module";
import { MediaModule } from "../media/media.module";
import { LineProfileModule } from "../line-profile.module";
import { CredentialsModule } from "../credentials/credentials.module";
import { ClassificationModule } from "../classification/classification.module";
import { GreetingMessageService } from "./greeting-message.service";
import { GreetingExecutionService } from "./greeting-execution.service";
import { GreetingMessageController } from "./greeting-message.controller";

@Module({
  imports: [
    AuthModule,
    MediaModule,
    LineProfileModule,
    CredentialsModule,
    ClassificationModule,
  ],
  controllers: [GreetingMessageController],
  providers: [
    PrismaService,
    CredentialEncryptionService,
    LineMessagingService,
    LineProfileService,
    AuditLogService,
    GreetingMessageService,
    GreetingExecutionService,
  ],
  exports: [GreetingMessageService, GreetingExecutionService],
})
export class GreetingMessageModule {}
