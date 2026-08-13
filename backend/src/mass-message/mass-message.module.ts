import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CredentialsModule } from "../credentials/credentials.module";
import { LineMessagingService } from "../line-messaging/line-messaging.service";
import { MassMessageController } from "./mass-message.controller";
import { MassMessageService } from "./mass-message.service";
import { MassMessageScopeService } from "./mass-message-scope.service";
import { MassMessageProcessorService } from "./mass-message-processor.service";

@Module({
  imports: [PrismaModule, AuthModule, CredentialsModule],
  controllers: [MassMessageController],
  providers: [
    MassMessageService,
    MassMessageScopeService,
    MassMessageProcessorService,
    LineMessagingService,
  ],
  exports: [
    MassMessageService,
    MassMessageScopeService,
    MassMessageProcessorService,
  ],
})
export class MassMessageModule {}
