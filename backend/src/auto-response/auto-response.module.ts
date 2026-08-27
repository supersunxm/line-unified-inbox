import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { LineMessagingService } from "../line-messaging/line-messaging.service";
import { AuditLogService } from "../auth/audit-log.service";
import { AuthModule } from "../auth/auth.module";
import { AutoResponseService } from "./auto-response.service";
import { AutoResponseExecutionService } from "./auto-response-execution.service";
import { AutoResponseController } from "./auto-response.controller";

@Module({
  imports: [AuthModule],
  controllers: [AutoResponseController],
  providers: [
    PrismaService,
    CredentialEncryptionService,
    LineMessagingService,
    AuditLogService,
    AutoResponseService,
    AutoResponseExecutionService,
  ],
  exports: [AutoResponseService, AutoResponseExecutionService],
})
export class AutoResponseModule {}
