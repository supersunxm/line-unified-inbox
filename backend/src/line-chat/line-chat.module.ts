import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { AuthModule } from "../auth/auth.module";
import { LineChatSessionService } from "./line-chat-session.service";
import { LineChatNicknameQueueService } from "./line-chat-nickname-queue.service";
import { LineChatOperationsService } from "./line-chat-operations.service";
import { LineChatOperationsController } from "./line-chat-operations.controller";

@Global()
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LineChatOperationsController],
  providers: [
    LineChatSessionService,
    LineChatNicknameQueueService,
    LineChatOperationsService,
  ],
  exports: [
    LineChatSessionService,
    LineChatNicknameQueueService,
    LineChatOperationsService,
  ],
})
export class LineChatModule {}
