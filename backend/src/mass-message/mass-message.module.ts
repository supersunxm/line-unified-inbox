import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CredentialsModule } from "../credentials/credentials.module";
import { LineMessagingService } from "../line-messaging/line-messaging.service";
import { RichMessageModule } from "../rich-message/rich-message.module";
import { MassMessageController } from "./mass-message.controller";
import { MassMessageService } from "./mass-message.service";
import { MassMessageScopeService } from "./mass-message-scope.service";
import { MassMessageProcessorService } from "./mass-message-processor.service";
import { BroadcastController } from "./broadcast.controller";
import { BroadcastService } from "./broadcast.service";
import { BroadcastScopeService } from "./broadcast-scope.service";
import { BroadcastProcessorService } from "./broadcast-processor.service";
import { BroadcastSchedulerService } from "./broadcast-scheduler.service";

@Module({
  imports: [PrismaModule, AuthModule, CredentialsModule, RichMessageModule],
  controllers: [MassMessageController, BroadcastController],
  providers: [
    MassMessageService,
    MassMessageScopeService,
    MassMessageProcessorService,
    BroadcastService,
    BroadcastScopeService,
    BroadcastProcessorService,
    BroadcastSchedulerService,
    LineMessagingService,
  ],
  exports: [
    MassMessageService,
    MassMessageScopeService,
    MassMessageProcessorService,
    BroadcastService,
    BroadcastProcessorService,
  ],
})
export class MassMessageModule {}
