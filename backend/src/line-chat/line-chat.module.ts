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
import { LineChatAuthRecoveryService } from "./line-chat-auth-recovery.service";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";
import { LineChatManagerMessageRelayService } from "./line-chat-manager-message-relay.service";
import { LineChatNovncRecoveryService } from "./line-chat-novnc-recovery.service";

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
    LineChatAuthRecoveryService,
    LineChatRecentResolverService,
    LineChatManagerMessageRelayService,
    LineChatNovncRecoveryService,
  ],
  exports: [
    LineChatSessionService,
    LineChatNicknameQueueService,
    LineChatOperationsService,
    LineChatProfileOperationCoordinator,
    LineChatHealthService,
    LineChatSessionHealthProbeService,
    LineChatAuthRecoveryService,
    LineChatRecentResolverService,
    LineChatManagerMessageRelayService,
    LineChatNovncRecoveryService,
  ],
})
export class LineChatModule {}
