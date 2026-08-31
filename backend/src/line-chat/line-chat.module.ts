import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { AuthModule } from "../auth/auth.module";
import { LineChatSessionService } from "./line-chat-session.service";
import { LineChatNicknameQueueService } from "./line-chat-nickname-queue.service";
import { LineChatNicknameWorkerService } from "./line-chat-nickname-worker.service";
import { LineChatOperationsService } from "./line-chat-operations.service";
import { LineChatOperationsController } from "./line-chat-operations.controller";

@Global()
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LineChatOperationsController],
  providers: [
    LineChatSessionService,
    LineChatNicknameQueueService,
    LineChatNicknameWorkerService,
    LineChatOperationsService,
  ],
  exports: [
    LineChatSessionService,
    LineChatNicknameQueueService,
    LineChatNicknameWorkerService,
    LineChatOperationsService,
  ],
})
export class LineChatModule {}

@Module({
  imports: [PrismaModule],
  providers: [
    LineChatSessionService,
    LineChatNicknameQueueService,
    LineChatNicknameWorkerService,
  ],
  exports: [
    LineChatSessionService,
    LineChatNicknameQueueService,
    LineChatNicknameWorkerService,
  ],
})
export class LineChatNicknameWorkerModule {}

