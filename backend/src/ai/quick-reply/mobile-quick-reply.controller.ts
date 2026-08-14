import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import type { AuthRequest } from "../../auth/auth.guard";
import { GenerateQuickRepliesDto, QuickReplyLifecycleEventDto } from "./quick-reply.dto";
import { QuickReplyService } from "./quick-reply.service";

@Controller("mobile/conversations")
export class MobileQuickReplyController {
  constructor(private readonly quickReplies: QuickReplyService) {}

  @Post(":id/quick-replies")
  generate(@Req() request: AuthRequest, @Param("id") conversationId: string, @Body() dto: GenerateQuickRepliesDto) {
    return this.quickReplies.generate(request.user!, conversationId, dto);
  }

  @Post(":id/quick-replies/events")
  recordLifecycle(@Req() request: AuthRequest, @Param("id") conversationId: string, @Body() dto: QuickReplyLifecycleEventDto) {
    return this.quickReplies.recordLifecycle(request.user!, conversationId, dto);
  }
}
