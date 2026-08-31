import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { LineChatNicknameWorkerService } from "./line-chat-nickname-worker.service";
import { LineChatSessionService } from "./line-chat-session.service";

/**
 * Composition root for the dedicated nickname worker process.
 *
 * Do not import this module from AppModule or another worker. Keeping the
 * polling provider behind this standalone module is the primary ownership
 * boundary; DISABLE_NICKNAME_WORKER is only an emergency kill switch.
 */
@Module({
  imports: [PrismaModule],
  providers: [LineChatSessionService, LineChatNicknameWorkerService],
  exports: [LineChatNicknameWorkerService],
})
export class LineChatNicknameWorkerModule {}
