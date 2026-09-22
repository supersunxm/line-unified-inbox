import "./line-chat-pdf-relay-patch";
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { MediaStorageService } from "../media/media-storage";
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
import { LineChatHistoricalMappingBackfillService } from "./line-chat-historical-mapping-backfill.service";
import { LineChatMessageSendWorkerService } from "./line-chat-message-send-worker.service";
import { LineChatMirrorService } from "./line-chat-mirror.service";
import { LineChatMirrorReconcilerService } from "./line-chat-mirror-reconciler.service";
import { LineChatManagerMediaMaterializerService } from "./line-chat-manager-media-materializer.service";
import { LineChatMirrorSalesTagSyncService } from "./line-chat-mirror-sales-tag-sync.service";

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
    LineChatHistoricalMappingBackfillService,
    LineChatNicknameWorkerService,
    LineChatAuthRecoveryService,
    LineChatManagerMessageRelayWorkerService,
    LineChatManagerImageRelayWorkerService,
    LineChatNovncRecoveryWorkerService,
    LineChatMessageSendWorkerService,
    LineChatMirrorService,
    LineChatMirrorReconcilerService,
    MediaStorageService,
    LineChatManagerMediaMaterializerService,
    LineChatMirrorSalesTagSyncService,
  ],
  exports: [
    LineChatNicknameWorkerService,
    LineChatAuthRecoveryService,
    LineChatManagerMessageRelayWorkerService,
    LineChatManagerImageRelayWorkerService,
    LineChatNovncRecoveryWorkerService,
    LineChatMirrorService,
    LineChatMirrorReconcilerService,
    LineChatManagerMediaMaterializerService,
    LineChatMirrorSalesTagSyncService,
  ],
})
export class LineChatNicknameWorkerModule {}
