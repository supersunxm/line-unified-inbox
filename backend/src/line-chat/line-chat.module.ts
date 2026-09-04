import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { AuthModule } from "../auth/auth.module";
import { LineChatSessionService } from "./line-chat-session.service";
import { LineChatNicknameQueueService } from "./line-chat-nickname-queue.service";
import { LineChatOperationsService } from "./line-chat-operations.service";
import { LineChatOperationsController } from "./line-chat-operations.controller";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatHealthService } from "./line-chat-health.service";
import { LineChatSessionHealthProbeService } from "./line-chat-session-health-probe.service";

@Global()
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LineChatOperationsController],
  providers: [
    LineChatSessionService,
    LineChatNicknameQueueService,
    LineChatOperationsService,
    LineChatProfileOperationCoordinator,
    LineChatHealthService,
    LineChatSessionHealthProbeService,
  ],
  exports: [
    LineChatSessionService,
    LineChatNicknameQueueService,
    LineChatOperationsService,
    LineChatProfileOperationCoordinator,
    LineChatHealthService,
    LineChatSessionHealthProbeService,
  ],
})
export class LineChatModule {}
