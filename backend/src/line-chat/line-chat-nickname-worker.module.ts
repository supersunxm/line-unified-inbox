import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { LineChatNicknameWorkerService } from "./line-chat-nickname-worker.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatHealthService } from "./line-chat-health.service";
import { LineChatSessionHealthProbeService } from "./line-chat-session-health-probe.service";
import { LineChatOaHealthProbeService } from "./line-chat-oa-health-probe.service";
import { LineChatHealthSchedulerService } from "./line-chat-health-scheduler.service";
import { LineChatAuthRecoveryService } from "./line-chat-auth-recovery.service";
import { LineChatManagerMessageRelayWorkerService } from "./line-chat-manager-message-relay-worker.service";
import { LineChatManagerImageRelayWorkerService } from "./line-chat-manager-image-relay-worker.service";
import { LineChatNovncRecoveryWorkerService } from "./line-chat-novnc-recovery-worker.service";
import { LineChatWebhookIdentityMapperService } from "./line-chat-webhook-identity-mapper.service";

/**
 * Composition root for the dedicated nickname worker process.
 *
 * Do not import this module from AppModule or another worker. Keeping the
 * polling provider behind this standalone module is the primary ownership
 * boundary; DISABLE_NICKNAME_WORKER is only an emergency kill switch.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    LineChatProfileOperationCoordinator,
    LineChatSessionService,
    LineChatRecentResolverService,
    LineChatHealthService,
    LineChatSessionHealthProbeService,
    LineChatOaHealthProbeService,
    LineChatHealthSchedulerService,
    LineChatWebhookIdentityMapperService,
    LineChatNicknameWorkerService,
    LineChatAuthRecoveryService,
    LineChatManagerMessageRelayWorkerService,
    LineChatManagerImageRelayWorkerService,
    LineChatNovncRecoveryWorkerService,
  ],
  exports: [
    LineChatNicknameWorkerService,
    LineChatAuthRecoveryService,
    LineChatManagerMessageRelayWorkerService,
    LineChatManagerImageRelayWorkerService,
    LineChatNovncRecoveryWorkerService,
  ],
})
export class LineChatNicknameWorkerModule {}
